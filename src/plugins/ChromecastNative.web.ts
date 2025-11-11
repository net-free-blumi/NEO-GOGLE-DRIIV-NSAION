// Web implementation for Chromecast Native (fallback for browser)
import { ChromecastSessionState, ChromecastMediaStatus } from './ChromecastNative';

export class ChromecastNativeWeb {
  async initialize(): Promise<{ success: boolean; available: boolean }> {
    return { success: false, available: false };
  }

  async discoverDevices(): Promise<{ devices: any[] }> {
    return { devices: [] };
  }

  async startSession(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Chromecast native not available on web' };
  }

  async endSession(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async loadMedia(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async play(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async pause(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async stop(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async seek(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async setVolume(): Promise<{ success: boolean; volume: number }> {
    return { success: false, volume: 0 };
  }

  async getVolume(): Promise<{ volume: number; muted: boolean }> {
    return { volume: 0, muted: false };
  }

  async getMediaStatus(): Promise<ChromecastMediaStatus> {
    return {
      isPlaying: false,
      isPaused: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      volume: 0,
      muted: false,
    };
  }

  async getSessionState(): Promise<ChromecastSessionState> {
    return { connected: false };
  }

  async addListener(): Promise<{ remove: () => void }> {
    return { remove: () => {} };
  }
}

