package com.cloudtunes.music;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.fourthline.cling.UpnpService;
import org.fourthline.cling.UpnpServiceImpl;
import org.fourthline.cling.android.AndroidUpnpServiceConfiguration;
import org.fourthline.cling.model.meta.RemoteDevice;
import org.fourthline.cling.model.meta.LocalDevice;
import org.fourthline.cling.registry.Registry;
import org.fourthline.cling.registry.RegistryListener;
import org.fourthline.cling.controlpoint.ControlPoint;
import org.fourthline.cling.model.action.ActionInvocation;
import org.fourthline.cling.model.message.UpnpResponse;
import org.fourthline.cling.model.meta.Service;
import org.fourthline.cling.support.avtransport.callback.SetAVTransportURI;
import org.fourthline.cling.support.avtransport.callback.Play;
import org.fourthline.cling.support.avtransport.callback.Pause;
import org.fourthline.cling.support.avtransport.callback.Stop;
import org.fourthline.cling.support.model.ProtocolInfo;
import org.fourthline.cling.support.model.ProtocolInfos;
import org.fourthline.cling.support.model.dlna.DLNAProfiles;
import org.fourthline.cling.support.model.dlna.DLNAProtocolInfo;
import org.fourthline.cling.support.renderingcontrol.callback.SetVolume;
import org.fourthline.cling.support.renderingcontrol.callback.GetVolume;
import org.fourthline.cling.support.model.Channel;

@CapacitorPlugin(name = "UPnPDiscovery")
public class UPnPDiscoveryPlugin extends Plugin {
    private static final String TAG = "UPnPDiscoveryPlugin";
    private UpnpService upnpService;
    private WifiManager.MulticastLock multicastLock;
    private List<JSObject> discoveredDevices = new ArrayList<>();

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "UPnP Discovery Plugin loaded");
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        try {
            // Enable multicast lock for UPnP discovery (SSDP)
            WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                multicastLock = wifi.createMulticastLock("UPnPDiscovery");
                multicastLock.setReferenceCounted(true);
                multicastLock.acquire();
            }

            // Start UPnP service with SSDP discovery
            upnpService = new UpnpServiceImpl(new AndroidUpnpServiceConfiguration(getContext()));
            
            // Add registry listener to discover devices via SSDP
            upnpService.getRegistry().addListener(new RegistryListener() {
                @Override
                public void remoteDeviceDiscoveryStarted(Registry registry, RemoteDevice device) {
                    Log.d(TAG, "SSDP Discovery started: " + device.getDisplayString());
                }

                @Override
                public void remoteDeviceDiscoveryFailed(Registry registry, RemoteDevice device, Exception ex) {
                    Log.w(TAG, "SSDP Discovery failed: " + device.getDisplayString(), ex);
                }

                @Override
                public void remoteDeviceAdded(Registry registry, RemoteDevice device) {
                    Log.d(TAG, "Device discovered via SSDP: " + device.getDisplayString());
                    addDevice(device);
                }

                @Override
                public void remoteDeviceUpdated(Registry registry, RemoteDevice device) {
                    Log.d(TAG, "Device updated: " + device.getDisplayString());
                    updateDevice(device);
                }

                @Override
                public void remoteDeviceRemoved(Registry registry, RemoteDevice device) {
                    Log.d(TAG, "Device removed: " + device.getDisplayString());
                    removeDevice(device);
                }

                @Override
                public void localDeviceAdded(Registry registry, LocalDevice device) {
                    // Ignore local devices
                }

                @Override
                public void localDeviceRemoved(Registry registry, LocalDevice device) {
                    // Ignore local devices
                }

                @Override
                public void beforeShutdown(Registry registry) {
                    // Ignore
                }

                @Override
                public void afterShutdown(Registry registry) {
                    // Ignore
                }
            });

            // Start SSDP search (M-SEARCH)
            upnpService.getControlPoint().search();

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "SSDP Discovery started");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error starting SSDP discovery", e);
            call.reject("Failed to start discovery: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        try {
            if (upnpService != null) {
                upnpService.shutdown();
                upnpService = null;
            }

            if (multicastLock != null && multicastLock.isHeld()) {
                multicastLock.release();
                multicastLock = null;
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Discovery stopped");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping discovery", e);
            call.reject("Failed to stop discovery: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDiscoveredDevices(PluginCall call) {
        JSObject result = new JSObject();
        result.put("devices", discoveredDevices);
        call.resolve(result);
    }

    @PluginMethod
    public void playMedia(PluginCall call) {
        try {
            String deviceId = call.getString("deviceId");
            String mediaUrl = call.getString("mediaUrl");
            String title = call.getString("title", "Track");

            if (deviceId == null || mediaUrl == null) {
                call.reject("Missing deviceId or mediaUrl");
                return;
            }

            // Find device
            RemoteDevice device = findDeviceById(deviceId);
            if (device == null) {
                call.reject("Device not found");
                return;
            }

            // Find AVTransport service
            Service avTransportService = device.findService(
                org.fourthline.cling.model.types.ServiceType.valueOf("AVTransport")
            );

            if (avTransportService == null) {
                call.reject("Device does not support AVTransport");
                return;
            }

            // Set AVTransport URI and play
            ControlPoint controlPoint = upnpService.getControlPoint();
            
            controlPoint.execute(new SetAVTransportURI(avTransportService, mediaUrl, createMetadata(title)) {
                @Override
                public void success(ActionInvocation invocation) {
                    Log.d(TAG, "Media URI set successfully");
                    controlPoint.execute(new Play(avTransportService) {
                        @Override
                        public void success(ActionInvocation invocation) {
                            Log.d(TAG, "Playback started");
                            JSObject result = new JSObject();
                            result.put("success", true);
                            call.resolve(result);
                        }

                        @Override
                        public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                            Log.e(TAG, "Playback failed: " + defaultMsg);
                            call.reject("Failed to play: " + defaultMsg);
                        }
                    });
                }

                @Override
                public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                    Log.e(TAG, "Set URI failed: " + defaultMsg);
                    call.reject("Failed to set media URI: " + defaultMsg);
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Error playing media", e);
            call.reject("Failed to play media: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        try {
            String deviceId = call.getString("deviceId");
            int volume = call.getInt("volume", 50); // 0-100
            
            if (deviceId == null) {
                call.reject("Missing deviceId");
                return;
            }

            RemoteDevice device = findDeviceById(deviceId);
            if (device == null) {
                call.reject("Device not found");
                return;
            }

            // Find RenderingControl service
            Service renderingControlService = device.findService(
                org.fourthline.cling.model.types.ServiceType.valueOf("RenderingControl")
            );

            if (renderingControlService == null) {
                call.reject("Device does not support volume control");
                return;
            }

            // Set volume (0-100, convert to 0-1.0 for UPnP)
            double volumeNormalized = Math.max(0.0, Math.min(1.0, volume / 100.0));
            
            ControlPoint controlPoint = upnpService.getControlPoint();
            controlPoint.execute(new SetVolume(renderingControlService, volumeNormalized) {
                @Override
                public void success(ActionInvocation invocation) {
                    Log.d(TAG, "Volume set successfully");
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("volume", volume);
                    call.resolve(result);
                }

                @Override
                public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                    Log.e(TAG, "Set volume failed: " + defaultMsg);
                    call.reject("Failed to set volume: " + defaultMsg);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error setting volume", e);
            call.reject("Failed to set volume: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        try {
            String deviceId = call.getString("deviceId");
            
            if (deviceId == null) {
                call.reject("Missing deviceId");
                return;
            }

            RemoteDevice device = findDeviceById(deviceId);
            if (device == null) {
                call.reject("Device not found");
                return;
            }

            // Find RenderingControl service
            Service renderingControlService = device.findService(
                org.fourthline.cling.model.types.ServiceType.valueOf("RenderingControl")
            );

            if (renderingControlService == null) {
                call.reject("Device does not support volume control");
                return;
            }

            ControlPoint controlPoint = upnpService.getControlPoint();
            controlPoint.execute(new GetVolume(renderingControlService) {
                @Override
                public void received(ActionInvocation invocation, double currentVolume) {
                    // Convert from 0-1.0 to 0-100
                    int volumePercent = (int) (currentVolume * 100);
                    JSObject result = new JSObject();
                    result.put("volume", volumePercent);
                    result.put("muted", false); // UPnP doesn't always support mute
                    call.resolve(result);
                }

                @Override
                public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                    Log.e(TAG, "Get volume failed: " + defaultMsg);
                    call.reject("Failed to get volume: " + defaultMsg);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error getting volume", e);
            call.reject("Failed to get volume: " + e.getMessage());
        }
    }

    private RemoteDevice findDeviceById(String deviceId) {
        if (upnpService == null) return null;
        
        for (RemoteDevice device : upnpService.getRegistry().getRemoteDevices()) {
            if (device.getIdentity().getUdn().toString().equals(deviceId)) {
                return device;
            }
        }
        return null;
    }

    private String createMetadata(String title) {
        // Create DIDL-Lite metadata (simplified)
        return "&lt;DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" " +
               "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" " +
               "xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\"&gt;" +
               "&lt;item id=\"1\" parentID=\"0\" restricted=\"true\"&gt;" +
               "&lt;dc:title&gt;" + title + "&lt;/dc:title&gt;" +
               "&lt;/item&gt;" +
               "&lt;/DIDL-Lite&gt;";
    }

    private void addDevice(RemoteDevice device) {
        try {
            JSObject deviceObj = new JSObject();
            deviceObj.put("id", device.getIdentity().getUdn().toString());
            deviceObj.put("name", device.getDisplayString());
            deviceObj.put("type", "UPnP");
            deviceObj.put("friendlyName", device.getDetails().getFriendlyName());
            
            String deviceURL = device.getIdentity().getDescriptorURL().toString();
            deviceObj.put("url", deviceURL);
            
            // Check if device supports AVTransport
            try {
                org.fourthline.cling.model.types.ServiceType avTransportType = 
                    org.fourthline.cling.model.types.ServiceType.valueOf("AVTransport");
                boolean supportsAVTransport = device.findService(avTransportType) != null;
                deviceObj.put("supportsPlayback", supportsAVTransport);
            } catch (Exception e) {
                deviceObj.put("supportsPlayback", false);
            }

            discoveredDevices.add(deviceObj);
            notifyListeners("deviceDiscovered", deviceObj);
        } catch (Exception e) {
            Log.e(TAG, "Error adding device", e);
        }
    }

    private void updateDevice(RemoteDevice device) {
        removeDevice(device);
        addDevice(device);
    }

    private void removeDevice(RemoteDevice device) {
        discoveredDevices.removeIf(d -> {
            try {
                return d.getString("id").equals(device.getIdentity().getUdn().toString());
            } catch (Exception e) {
                return false;
            }
        });
    }

    @Override
    public void handleOnDestroy() {
        super.handleOnDestroy();
        if (upnpService != null) {
            upnpService.shutdown();
        }
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }
    }
}
