// File: app/(tabs)/focus.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FOCUS = [
  'Key achievements and contributions',
  'The challenges faced and how you handled them',
  'The extra responsibilities taken on',
  'Growth and learning over the year',
  'Goals and what you want to work on next',
];

export default function FocusScreen() {
  const router = useRouter();
  const { conversation, feeling } = useLocalSearchParams<{ conversation?: string; feeling?: string }>();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (opt: string) => {
    setSelected((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  const goNext = () => {
    if (!selected.length) return;
    router.push({
      pathname: '/ready',
      params: { conversation, feeling, focus: JSON.stringify(selected) },
    });
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
            What do you want your manager to clearly understand about your work?
          </Text>

          {(conversation || feeling) ? (
            <Text style={{ textAlign: 'center', color: '#6b7280' }}>
              {conversation ? `Preparing for: ${String(conversation)}` : ''}
              {conversation && feeling ? '  •  ' : ''}
              {feeling ? `Feeling: ${String(feeling)}` : ''}
            </Text>
          ) : null}

          <View style={{ gap: 12 }}>
            {FOCUS.map((opt) => {
              const isActive = selected.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => toggle(opt)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.95 : 1,
                    borderWidth: 1,
                    borderColor: isActive ? '#2563eb' : '#e5e7eb',
                    backgroundColor: isActive ? '#eef2ff' : '#fff',
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    elevation: 2,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Left-aligned checkbox */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: isActive ? '#2563eb' : '#9ca3af',
                        backgroundColor: isActive ? '#2563eb' : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isActive ? (
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>✓</Text>
                      ) : null}
                    </View>

                    {/* Label */}
                    <Text
                      style={{
                        flexShrink: 1,
                        fontSize: 16,
                        textAlign: 'left',
                        fontWeight: isActive ? '700' : '500',
                        color: '#111827',
                      }}
                    >
                      {opt}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={goNext}
            disabled={!selected.length}
            style={({ pressed }) => ({
              marginTop: 20,
              paddingVertical: 16,
              borderRadius: 24,
              backgroundColor: !selected.length ? '#9ca3af' : '#2563eb',
              opacity: pressed ? 0.95 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Next {selected.length ? `(${selected.length})` : ''}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
