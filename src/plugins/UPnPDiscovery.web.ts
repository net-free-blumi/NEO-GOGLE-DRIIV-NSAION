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

  async addListener(): Promise<{ remove: () => void }> {
    return { remove: () => {} };
  }
}

