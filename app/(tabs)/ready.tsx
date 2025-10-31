// File: app/(tabs)/ready.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReadyScreen() {
  const router = useRouter();
  const { conversation, feeling, focus } = useLocalSearchParams<{
    conversation?: string;
    feeling?: string;
    focus?: string; // JSON string from multiselect
  }>();

  // Safely parse the focus list (since it’s JSON from the previous screen)
  const parsedFocus: string[] = (() => {
    try {
      if (typeof focus === 'string') return JSON.parse(focus);
      return [];
    } catch {
      return [];
    }
  })();

  const onStart = () => {
    router.push({
      pathname: '/session',
      params: { conversation, feeling, focus },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 520,
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Assistant Icon */}
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 999,
              backgroundColor: '#eef2ff',
              borderWidth: 2,
              borderColor: '#c7d2fe',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 48 }}>🤖</Text>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
            Ready to practice your conversation?
          </Text>

          {/* Summary */}
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>
            {conversation ? `Meeting: ${String(conversation)}` : ''}
            {conversation && feeling ? '  •  ' : ''}
            {feeling ? `Feeling: ${String(feeling)}` : ''}
          </Text>

          {/* Focus Points */}
          {parsedFocus.length ? (
            <View style={{ marginTop: 4, alignSelf: 'stretch' }}>
              <Text style={{ textAlign: 'center', color: '#6b7280' }}>
                Focus points:
              </Text>
              {parsedFocus.map((f) => (
                <Text
                  key={f}
                  style={{ textAlign: 'center', color: '#374151', marginTop: 2 }}
                >
                  • {f}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Start Button */}
          <Pressable
            onPress={onStart}
            style={({ pressed }) => ({
              marginTop: 20,
              paddingVertical: 16,
              paddingHorizontal: 32,
              borderRadius: 28,
              backgroundColor: '#2563eb',
              opacity: pressed ? 0.95 : 1,
              alignItems: 'center',
              alignSelf: 'stretch',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              Start conversation
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
