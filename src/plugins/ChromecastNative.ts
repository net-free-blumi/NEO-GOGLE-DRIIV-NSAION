import { registerPlugin } from '@capacitor/core';

export interface ChromecastSessionState {
  connected: boolean;
  sessionId?: string;
}

export interface ChromecastNativePlugin {
  initialize(): Promise<{ success: boolean; available: boolean }>;
  startSession(options?: { deviceId?: string }): Promise<{ success: boolean; message: string }>;
  endSession(): Promise<{ success: boolean }>;
  loadMedia(options: {
    contentUrl: string;
    contentType?: string;
    title?: string;
    subtitle?: string;
    imageUrl?: string;
  }): Promise<{ success: boolean }>;
  play(): Promise<{ success: boolean }>;
  pause(): Promise<{ success: boolean }>;
  stop(): Promise<{ success: boolean }>;
  seek(options: { position: number }): Promise<{ success: boolean }>;
  getSessionState(): Promise<ChromecastSessionState>;
  addListener(
    eventName: 'sessionStarted' | 'sessionEnded' | 'sessionStartFailed',
    listenerFunc: (data: any) => void
  ): Promise<{ remove: () => void }>;
}

const ChromecastNative = registerPlugin<ChromecastNativePlugin>('ChromecastNative', {
  web: () => import('./ChromecastNative.web').then(m => new m.ChromecastNativeWeb()),
});

export default ChromecastNative;

