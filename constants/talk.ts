import { Platform } from 'react-native';

// Частота опроса уровня микрофона
export const METERING_POLL_MS = 120;

// Пороги с гистерезисом (start выше, stop ниже), чтобы не "дребезжало"
// и чтобы старт надежно срабатывал на речь, а не на шум.
// RMS dBFS: тихий фон обычно -40..-30, голос вблизи -18..-5
// iOS: речь вблизи микрофона даёт ~-20..-8 dBFS
// Android: AGC сжимает, но речь всё равно выше -22 dBFS
export const START_THRESHOLD_DB = Platform.OS === 'android' ? -35 : -35;
export const STOP_THRESHOLD_DB = Platform.OS === 'android' ? -80 : -50;

// Сколько должен продлиться голос (мс), чтобы считать что человек реально начал говорить
export const MIN_VOICE_MS = 80;

// После того как речь уже была, сколько тишины (мс) нужно, чтобы завершить запись
export const STOP_SILENCE_MS = 600;

export const PLAYBACK_RATE = 1.25;
export const SM_NAME = 'State Machine 1';
