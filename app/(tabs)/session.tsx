// File: app/(tabs)/session.tsx
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const USING_EMULATOR = true; // set false if testing on a physical phone
const BASE = "https://talkcoach.duckdns.org";
//const BASE = USING_EMULATOR ? 'http://10.0.2.2:5001' : 'http://192.168.1.33:5001';
const STT_URL = `${BASE}/transcribe`;
const TTS_URL = `${BASE}/tts`;
const CHAT_URL = `${BASE}/chat`;
const ANALYZE_URL = `${BASE}/analyze`;

type Turn = { role: 'assistant' | 'user'; text: string };

export default function SessionScreen() {
  const router = useRouter();
  const { conversation, feeling, focus } = useLocalSearchParams<{
    conversation?: string;
    feeling?: string;
    focus?: string; // JSON string from multiselect
  }>();

  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userText, setUserText] = useState<string>('');

  const initialAssistant = `Hey, good to see you! So you have a ${conversation} meeting, and you’re feeling ${feeling} about it. Tell me what you have in mind to tell your manager, and we’ll try to structure it better.`;
  const [assistantText, setAssistantText] = useState<string>(initialAssistant);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // NEW: track conversation turns for analysis
  const [turns, setTurns] = useState<Turn[]>([]);

  useEffect(() => {
    // seed turns with first assistant message
    setTurns([{ role: 'assistant', text: initialAssistant }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- RECORD -> STT ---
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow microphone access.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Record error', String(e));
    }
  };

  const stopRecording = async () => {
    try {
      const rec = recordingRef.current;
      if (!rec) return;
      await rec.stopAndUnloadAsync();
      setIsRecording(false);

      const uri = rec.getURI();
      recordingRef.current = null;
      if (!uri) return;

      const uploadRes = await FileSystem.uploadAsync(STT_URL, uri, {
        httpMethod: 'POST',
        fieldName: 'file',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        parameters: {},
      });

      if (uploadRes.status !== 200) {
        throw new Error(`HTTP ${uploadRes.status}: ${uploadRes.body?.slice(0, 200)}`);
      }

      const json = JSON.parse(uploadRes.body || '{}');
      const text = json.text || '';
      setUserText(text);

      if (text.trim()) {
        setTurns((prev) => [...prev, { role: 'user', text }]);
      }
    } catch (e) {
      Alert.alert('Stop/Upload error', String(e));
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }
  };

  // --- TTS: text -> audio -> play ---
  const speak = async (text: string) => {
    try {
      if (!text?.trim()) return;
      setIsSpeaking(true);

      // Unload any prior sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`TTS HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const { url } = await res.json();
      if (!url) throw new Error('No TTS URL returned');

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          await sound.unloadAsync();
          soundRef.current = null;
        }
      });

      await sound.playAsync();
    } catch (e) {
      setIsSpeaking(false);
      Alert.alert('TTS error', String(e));
    }
  };

  // --- CHAT: send userText + context -> get reply -> show + speak ---
  const sendMessage = async () => {
    try {
      if (!userText?.trim()) {
        Alert.alert('Say something first', 'Tap the mic, speak, then press Send.');
        return;
      }

      const res = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_text: userText,
          conversation,
          feeling,
          focus, // send as-is; server normalizes
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`CHAT HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const { reply } = await res.json();
      if (reply) {
        setAssistantText(reply);
        setTurns((prev) => [...prev, { role: 'assistant', text: reply }]);
        await speak(reply); // auto speak assistant reply
        setUserText('');    // clear current input after reply
      }
    } catch (e) {
      Alert.alert('Chat error', String(e));
    }
  };

  // --- END: call /analyze then navigate to report with results ---
  const endSession = async () => {
    try {
      const payload = {
        conversation,
        feeling,
        focus,
        turns,
      };

      const res = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`ANALYZE HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const report = await res.json();
      router.push({
        pathname: '/report',
        params: { report: JSON.stringify(report) },
      });
    } catch (e) {
      Alert.alert('Analyze error', String(e));
      // still navigate with a fallback
      router.push('/report');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* SCROLLABLE CONTENT */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator
      >
        {/* Assistant icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 999,
            backgroundColor: '#eef2ff',
            borderWidth: 2,
            borderColor: '#c7d2fe',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 36 }}>🤖</Text>
        </View>

        {/* Assistant text bubble */}
        <View
          style={{
            backgroundColor: '#dbeafe',
            borderRadius: 20,
            padding: 16,
            marginBottom: 12,
            maxWidth: 520,
            alignSelf: 'stretch',
          }}
        >
          <Text style={{ color: '#111827', fontSize: 16, textAlign: 'center' }}>
            {assistantText}
          </Text>
        </View>

        {/* Play current assistant text */}
        <Pressable
          onPress={() => speak(assistantText)}
          disabled={isSpeaking}
          style={({ pressed }) => ({
            backgroundColor: isSpeaking ? '#9ca3af' : pressed ? '#1d4ed8' : '#2563eb',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 24,
            marginBottom: 16,
            opacity: pressed ? 0.95 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {isSpeaking ? 'Speaking…' : '🔊 Play Assistant'}
          </Text>
        </Pressable>

        {/* User transcript bubble */}
        {userText ? (
          <View
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: 16,
              padding: 12,
              marginBottom: 20,
              maxWidth: 520,
              alignSelf: 'stretch',
            }}
          >
            <Text style={{ color: '#111827', fontSize: 15, textAlign: 'center' }}>
              {userText}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* STICKY FOOTER CONTROLS */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 20,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Mic button */}
        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          style={({ pressed }) => ({
            width: 90,
            height: 90,
            borderRadius: 999,
            backgroundColor: isRecording ? '#ef4444' : pressed ? '#1d4ed8' : '#2563eb',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 36 }}>
            {isRecording ? '■' : '🎤'}
          </Text>
        </Pressable>

        {/* Send Message / End Session */}
        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch', justifyContent: 'center' }}>
          <Pressable
            onPress={sendMessage}
            style={({ pressed }) => ({
              backgroundColor: '#2563eb',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 30,
              opacity: pressed ? 0.9 : 1,
              flexGrow: 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Send Message
            </Text>
          </Pressable>

          <Pressable
            onPress={endSession}
            style={({ pressed }) => ({
              backgroundColor: '#f87171',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 30,
              opacity: pressed ? 0.9 : 1,
              flexGrow: 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              End Session (Analyze)
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
