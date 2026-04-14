import {
  PLAYBACK_RATE,
  SM_NAME,
  START_THRESHOLD_DB,
  STOP_SILENCE_MS,
} from '@/constants/talk';
import { AudioStudioModule, useAudioRecorder } from '@siteed/expo-audio-studio';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import { RiveRef } from 'rive-react-native';

export type Phase = 'idle' | 'listening' | 'processing' | 'playing' | 'permission-denied';

export const useVoiceLoop = (
  riveRef: React.RefObject<RiveRef | null>,
  setPhase: React.Dispatch<React.SetStateAction<Phase>>,
  setErrorText: React.Dispatch<React.SetStateAction<string | null>>,
  setRiveDebug: React.Dispatch<React.SetStateAction<string>>,
) => {
  const { startRecording, stopRecording } = useAudioRecorder();

  const playbackSoundRef = useRef<Audio.Sound | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRunningRef = useRef(false);
  const stoppingRef = useRef(false);
  const isMountedRef = useRef(true);

  const lastLoudAtRef = useRef(0);
  const hasSpokenRef = useRef(false);

  // --- Керування станами ---
  const updateStatus = useCallback((next: Phase) => {
    if (!isMountedRef.current) return;
    setPhase(next);
    const rive = riveRef.current;
    if (!rive) return;
    try {
      rive.setInputState(SM_NAME, 'Talk', false);
      rive.setInputState(SM_NAME, 'Hear', false);
      rive.setInputState(SM_NAME, 'Check', false);

      if (next === 'listening') rive.setInputState(SM_NAME, 'Hear', true);
      else if (next === 'processing') rive.setInputState(SM_NAME, 'Check', true);
      else if (next === 'playing') rive.setInputState(SM_NAME, 'Talk', true);
    } catch (e) {
      setRiveDebug(`Rive err: ${String(e)}`);
    }
  }, [riveRef, setPhase, setRiveDebug]);

  // --- Налаштування аудіо (Динамік iOS) ---
  const setAudioMode = async (mode: 'record' | 'play') => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: mode === 'record',
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, 
        iosAudioMode: mode === 'play' ? 'videoChat' : 'voiceChat',
        defaultToSpeaker: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      } as any);

      if (mode === 'play' && Platform.OS === 'ios') {
        const mod = NativeModules.ExpoAudioStudioModule ?? NativeModules.AudioStudio;
        if (mod?.overrideOutputAudioPort) {
          await mod.overrideOutputAudioPort('speaker');
        }
      }
    } catch (e) {
      console.error('AudioMode Error:', e);
    }
  };

  const scheduleRestart = useCallback((delayMs = 150) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    loopRunningRef.current = false;
    stoppingRef.current = false;
    hasSpokenRef.current = false;
    updateStatus('idle');
    restartTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) startVoiceLoop();
    }, delayMs);
  }, [updateStatus]);

  // --- Відтворення (Високий голос) ---
  const playAudio = async (uri: string) => {
    try {
      if (playbackSoundRef.current) {
        await playbackSoundRef.current.unloadAsync();
      }

      if (Platform.OS === 'ios') {
        // Примусове скидання сесії для виходу звуку через зовнішній динамік
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false } as any);
        await Audio.setIsEnabledAsync(false);
        await Audio.setIsEnabledAsync(true);
        await new Promise((r) => setTimeout(r, 100));
      }

      await setAudioMode('play');
      updateStatus('playing');

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: true,
          volume: 1.0,
          rate: PLAYBACK_RATE, // Наприклад 1.5
          shouldCorrectPitch: false, // Робить голос тонким (ефект бурундука)
        },
        async (status) => {
          if (status.isLoaded && status.didJustFinish) {
            await sound.unloadAsync();
            scheduleRestart(100);
          }
        }
      );
      playbackSoundRef.current = sound;
    } catch (e) {
      setRiveDebug(`Play err: ${String(e)}`);
      scheduleRestart(300);
    }
  };

  const stopAndPlay = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    updateStatus('processing');
    try {
      const result = await stopRecording();
      if (result?.fileUri) {
        await playAudio(result.fileUri);
      } else {
        scheduleRestart(100);
      }
    } catch (e) {
      scheduleRestart(200);
    } finally {
      stoppingRef.current = false;
    }
  };

  // --- Головний цикл слуху ---
  const startVoiceLoop = useCallback(async () => {
    if (loopRunningRef.current || !isMountedRef.current) return;
    loopRunningRef.current = true;

    try {
      const perm = await AudioStudioModule.requestPermissionsAsync();
      if (!perm.granted) {
        updateStatus('permission-denied');
        return;
      }

      await setAudioMode('record');
      hasSpokenRef.current = false;
      lastLoudAtRef.current = Date.now();

      updateStatus('listening');

      await startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        streamFormat: 'float32',
        bufferDurationSeconds: 0.1,
        onAudioStream: async (event) => {
          if (stoppingRef.current || !isMountedRef.current) return;
          
          const samples = event.data as any;
          if (!samples || samples.length === 0) return;

          // Розрахунок гучності
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
          }
          const rms = Math.sqrt(sum / samples.length);
          const db = rms > 0 ? 20 * Math.log10(rms) : -160;

          const t = Date.now();

          // Дебаг для налаштування порогу START_THRESHOLD_DB
          setRiveDebug(`dB: ${db.toFixed(1)} | Spoken: ${hasSpokenRef.current ? 'YES' : 'NO'}`);

          // 1. Детектор голосу: користувач почав говорити
          if (db >= START_THRESHOLD_DB) {
            lastLoudAtRef.current = t;
            hasSpokenRef.current = true;
          }

          // 2. Детектор тиші: користувач замовк на ~1 сек
          if (hasSpokenRef.current && t - lastLoudAtRef.current >= STOP_SILENCE_MS) {
            await stopAndPlay();
          }
        },
      });
    } catch (e) {
      setRiveDebug(`Start err: ${String(e)}`);
      loopRunningRef.current = false;
      scheduleRestart(1000);
    }
  }, [updateStatus, startRecording, stopRecording]);

  useEffect(() => {
    isMountedRef.current = true;
    // Android потребує невеликої паузи після старту Activity
    const initDelay = Platform.OS === 'android' ? 600 : 100;
    const t = setTimeout(() => startVoiceLoop(), initDelay);
    
    return () => {
      isMountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      stopRecording().catch(() => {});
      if (playbackSoundRef.current) playbackSoundRef.current.unloadAsync();
    };
  }, [startVoiceLoop]);

  return { applyRivePhase: updateStatus };
};