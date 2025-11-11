// Web implementation for UPnP Discovery (fallback for browser)
import { UPnPDevice } from './UPnPDiscovery';

export class UPnPDiscoveryWeb {
  async startDiscovery(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'UPnP discovery not available on web' };
  }

  async stopDiscovery(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'UPnP discovery not available on web' };
  }

  async getDiscoveredDevices(): Promise<{ devices: UPnPDevice[] }> {
    return { devices: [] };
  }

  async playMedia(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async setVolume(): Promise<{ success: boolean; volume: number }> {
    return { success: false, volume: 0 };
  }

  async getVolume(): Promise<{ volume: number; muted: boolean }> {
    return { volume: 0, muted: false };
  }

  async addListener(): Promise<{ remove: () => void }> {
    return { remove: () => {} };
  }
}

