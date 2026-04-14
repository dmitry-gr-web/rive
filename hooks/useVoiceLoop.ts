import { PLAYBACK_RATE, SM_NAME, START_THRESHOLD_DB, STOP_SILENCE_MS } from '@/constants/talk';
import { AudioStudioModule, useAudioRecorder } from '@siteed/expo-audio-studio';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import { RiveRef } from 'rive-react-native';

export type Phase = 'idle' | 'listening' | 'processing' | 'playing' | 'permission-denied';

export const useVoiceLoop = (
  riveRef: React.RefObject<RiveRef | null>,
  setPhase: React.Dispatch<React.SetStateAction<Phase>>,
  setRiveDebug: React.Dispatch<React.SetStateAction<string>>,
) => {
  const { startRecording, stopRecording } = useAudioRecorder();

  // Референси для керування станом без зайвих ререндерів
  const playbackSoundRef = useRef<Audio.Sound | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRunningRef = useRef(false);
  const stoppingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Дані детектора голосу
  const lastLoudAtRef = useRef(0);
  const hasSpokenRef = useRef(false);

  /**
   * Оновлює візуальний стан у React та перемикає вводи у Rive анімації
   */
  const updateStatus = useCallback(
    (next: Phase) => {
      if (!isMountedRef.current) return;
      setPhase(next);

      const rive = riveRef.current;
      if (!rive) return;

      try {
        // Скидаємо всі тригери анімації
        rive.setInputState(SM_NAME, 'Talk', false);
        rive.setInputState(SM_NAME, 'Hear', false);
        rive.setInputState(SM_NAME, 'Check', false);

        // Активуємо потрібний стан в залежності від фази
        if (next === 'listening') rive.setInputState(SM_NAME, 'Hear', true);
        else if (next === 'processing') rive.setInputState(SM_NAME, 'Check', true);
        else if (next === 'playing') rive.setInputState(SM_NAME, 'Talk', true);
      } catch (e) {
        setRiveDebug(`Rive error: ${String(e)}`);
      }
    },
    [riveRef, setPhase, setRiveDebug],
  );

  /**
   * Налаштовує глобальний аудіо-режим пристрою.
   * Важливо для iOS: режим videoChat змушує звук йти через зовнішні динаміки.
   */
  const setAudioMode = async (mode: 'record' | 'play') => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: mode === 'record',
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Додатковий форсований перемикач порту для iOS через нативний модуль
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

  /**
   * Очищує поточний звук та готує систему до нового циклу слуху
   */
  const scheduleRestart = useCallback(
    (delayMs = 150) => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      loopRunningRef.current = false;
      stoppingRef.current = false;
      hasSpokenRef.current = false;

      updateStatus('idle');

      restartTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) startVoiceLoop();
      }, delayMs);
    },
    [updateStatus],
  );

  /**
   * Завантажує та відтворює записаний файл з ефектом високого голосу
   */
  const playAudio = async (uri: string) => {
    try {
      // Очищуємо попередній звук, якщо він був
      if (playbackSoundRef.current) {
        await playbackSoundRef.current.unloadAsync();
      }

      if (Platform.OS === 'ios') {
        // "Ядерний" метод для iOS: вимикаємо і вмикаємо аудіо-движок,
        // щоб скинути заблокований мікрофоном вихід на динамік
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
          rate: PLAYBACK_RATE,
          shouldCorrectPitch: false, // false створює ефект "бурундука" при підвищенні rate
        },
        async (status) => {
          if (status.isLoaded && status.didJustFinish) {
            await sound.unloadAsync();
            scheduleRestart(100);
          }
        },
      );
      playbackSoundRef.current = sound;
    } catch (e) {
      setRiveDebug(`Play error: ${String(e)}`);
      scheduleRestart(300);
    }
  };

  /**
   * Зупиняє запис та ініціює процес відтворення
   */
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

  /**
   * Основна функція запуску прослуховування
   */
  const startVoiceLoop = useCallback(async () => {
    if (loopRunningRef.current || !isMountedRef.current) return;
    loopRunningRef.current = true;

    try {
      // Запит прав на використання мікрофона
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

          // Розрахунок RMS (середньоквадратичне значення) для визначення гучності в dB
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
          }
          const rms = Math.sqrt(sum / samples.length);
          const db = rms > 0 ? 20 * Math.log10(rms) : -160;

          const t = Date.now();

          // Вивід технічної інформації для дебагу
          setRiveDebug(`dB: ${db.toFixed(1)} | Spoken: ${hasSpokenRef.current ? 'ТАК' : 'НІ'}`);

          // 1. Якщо гучність вище порогу — фіксуємо активність голосу
          if (db >= START_THRESHOLD_DB) {
            lastLoudAtRef.current = t;
            hasSpokenRef.current = true;
          }

          // 2. Якщо голос був зафіксований, але вже 1 секунду тиша — зупиняємо і граємо
          if (hasSpokenRef.current && t - lastLoudAtRef.current >= STOP_SILENCE_MS) {
            await stopAndPlay();
          }
        },
      });
    } catch (e) {
      setRiveDebug(`Start error: ${String(e)}`);
      loopRunningRef.current = false;
      scheduleRestart(1000);
    }
  }, [updateStatus, startRecording, stopRecording]);

  /**
   * Ініціалізація при монтуванні компонента
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Невелика задержка для Android, щоб уникнути конфліктів при старті Activity
    const initDelay = Platform.OS === 'android' ? 400 : 100;
    setTimeout(() => startVoiceLoop(), initDelay);

    return () => {
      isMountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      stopRecording().catch(() => {});
      if (playbackSoundRef.current) {
        playbackSoundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [startVoiceLoop]);

  return { applyRivePhase: updateStatus };
};
