// Web implementation for Chromecast Native (fallback for browser)
import { ChromecastSessionState } from './ChromecastNative';

export class ChromecastNativeWeb {
  async initialize(): Promise<{ success: boolean; available: boolean }> {
    return { success: false, available: false };
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

  async getSessionState(): Promise<ChromecastSessionState> {
    return { connected: false };
  }

  async addListener(): Promise<{ remove: () => void }> {
    return { remove: () => {} };
  }
}

