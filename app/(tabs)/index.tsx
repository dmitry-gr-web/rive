import { SM_NAME } from '@/constants/talk';
import { Phase, useVoiceLoop } from '@/hooks/useVoiceLoop';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Rive, { Alignment, Fit, RiveRef } from 'rive-react-native';

export default function TalkScreen() {
  const riveRef = useRef<RiveRef>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [riveDebug, setRiveDebug] = useState<string>('debug: waiting...');

  const { applyRivePhase } = useVoiceLoop(riveRef, setPhase, setErrorText, setRiveDebug);

  useEffect(() => {
    applyRivePhase(phase);
  }, [phase, applyRivePhase]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Talking Tom</Text>
        <View style={styles.riveContainer}>
          <Rive
            ref={riveRef}
            style={styles.rive}
            fit={Fit.Contain}
            alignment={Alignment.Center}
            autoplay
            stateMachineName={SM_NAME}
            source={require('../../assets/rive/talking_tom.riv')}
            onRiveEventReceived={() => {
              setRiveDebug('Rive Loaded ✅');
              applyRivePhase(phase);
            }}
          />
        </View>
        <View style={styles.controls}>
          <Text style={styles.phaseText}>{phase.toUpperCase()}</Text>
          <Text style={styles.debugText}>{riveDebug}</Text>
          {errorText && <Text style={styles.errorText}>{errorText}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  riveContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    overflow: 'hidden',
  },
  rive: { flex: 1 },
  controls: { alignItems: 'center', marginTop: 24 },
  phaseText: { fontSize: 22, fontWeight: '700', color: '#007AFF' },
  debugText: { fontSize: 11, color: 'gray', marginTop: 10 },
  errorText: { color: 'red', marginTop: 10 },
});
