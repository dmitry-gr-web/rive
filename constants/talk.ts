import { Platform } from 'react-native';

export const METERING_POLL_MS = 120;

export const START_THRESHOLD_DB = Platform.OS === 'android' ? -35 : -35;
export const STOP_THRESHOLD_DB = Platform.OS === 'android' ? -80 : -50;

export const MIN_VOICE_MS = 80;

export const STOP_SILENCE_MS = 600;

export const PLAYBACK_RATE = 1.25;
export const SM_NAME = 'State Machine 1';
