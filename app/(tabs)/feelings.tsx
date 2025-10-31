// -----------------------------
// File: app/feelings.tsx (Step 2 placeholder)
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FEELINGS = [
  'Nervous',
  'Confident',
  'Unsure what to expect',
  'Frustrated',
  'Positive',
];

export default function FeelingsScreen() {
  const router = useRouter();
  const { conversation } = useLocalSearchParams<{ conversation?: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const goNext = () => {
    if (!selected) return;
    router.push({ pathname: '/focus', params: { conversation, feeling: selected } });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 24,
        }}
      >
        <View style={{ width: '100%', maxWidth: 520, gap: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
            How are you feeling about this discussion right now?
          </Text>
          {conversation ? (
            <Text style={{ textAlign: 'center', color: '#6b7280' }}>
              Preparing for: {String(conversation)}
            </Text>
          ) : null}

          <View style={{ gap: 12 }}>
            {FEELINGS.map((opt) => {
              const isActive = selected === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSelected(opt)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.9 : 1,
                    borderWidth: 1,
                    borderColor: isActive ? '#2563eb' : '#e5e7eb',
                    backgroundColor: isActive ? '#dbeafe' : '#fff',
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: 16,
                    elevation: 2,
                  })}
                >
                  <Text style={{
                    fontSize: 16,
                    textAlign: 'center',
                    fontWeight: isActive ? '700' : '500',
                    color: '#111827',
                  }}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={goNext}
            disabled={!selected}
            style={({ pressed }) => ({
              marginTop: 20,
              paddingVertical: 16,
              borderRadius: 24,
              backgroundColor: !selected ? '#9ca3af' : '#2563eb',
              opacity: pressed ? 0.95 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}