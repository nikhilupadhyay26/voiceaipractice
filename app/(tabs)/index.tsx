// File: app/(tabs)/index.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  backgroundColor,
  cardBackground,
  primaryColor,
  radiusLarge,
  radiusMedium,
  screenPadding,
  textPrimary,
  textSecondary,
} from '../styles/theme';


const OPTIONS = [
  'Annual appraisal',
  'Mid-year review',
  'Promotion discussion',
  'General performance feedback',
  'Goal-setting',
];

export default function LandingScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const goNext = () => {
    if (!selected) return;
    router.push({ pathname: '/feelings', params: { conversation: selected } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: screenPadding,
          paddingVertical: screenPadding,
        }}
      >
        <View style={{ width: '100%', maxWidth: 520, gap: 16 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 8,
              color: textPrimary,
            }}
          >
            What kind of conversation are you preparing for?
          </Text>

          <View style={{ gap: 12 }}>
            {OPTIONS.map((opt) => {
              const isActive = selected === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSelected(opt)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.9 : 1,
                    borderWidth: 1,
                    borderColor: isActive ? primaryColor : '#e5e7eb',
                    backgroundColor: isActive ? '#dbeafe' : cardBackground,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: radiusMedium,
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 6,
                    elevation: 2,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      textAlign: 'center',
                      fontWeight: isActive ? '700' : '500',
                      color: textPrimary,
                    }}
                  >
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
              borderRadius: radiusLarge,
              backgroundColor: !selected ? textSecondary : primaryColor,
              opacity: pressed ? 0.95 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Next
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
