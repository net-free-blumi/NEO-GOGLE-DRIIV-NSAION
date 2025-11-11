import { registerPlugin } from '@capacitor/core';

export interface UPnPDevice {
  id: string;
  name: string;
  type: string;
  friendlyName: string;
  url: string;
  supportsPlayback: boolean;
}

export interface UPnPDiscoveryPlugin {
  startDiscovery(): Promise<{ success: boolean; message: string }>;
  stopDiscovery(): Promise<{ success: boolean; message: string }>;
  getDiscoveredDevices(): Promise<{ devices: UPnPDevice[] }>;
  playMedia(options: {
    deviceId: string;
    mediaUrl: string;
    title?: string;
  }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'deviceDiscovered',
    listenerFunc: (device: UPnPDevice) => void
  ): Promise<{ remove: () => void }>;
}

const UPnPDiscovery = registerPlugin<UPnPDiscoveryPlugin>('UPnPDiscovery', {
  web: () => import('./UPnPDiscovery.web').then(m => new m.UPnPDiscoveryWeb()),
});

export default UPnPDiscovery;

