package com.cloudtunes.music;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.cybergarage.upnp.Device;
import org.cybergarage.upnp.DeviceList;
import org.cybergarage.upnp.ControlPoint;
import org.cybergarage.upnp.device.DeviceChangeListener;
import org.cybergarage.upnp.ssdp.SSDPPacket;
import org.cybergarage.upnp.control.Action;
import org.cybergarage.upnp.control.ActionListener;
import org.cybergarage.upnp.Service;
import org.cybergarage.upnp.ArgumentList;
import org.cybergarage.upnp.Argument;

import java.util.List;
import java.util.ArrayList;

@CapacitorPlugin(name = "UPnPDiscovery")
public class UPnPDiscoveryPlugin extends Plugin {
    private static final String TAG = "UPnPDiscoveryPlugin";
    private ControlPoint controlPoint;
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

            // Start UPnP ControlPoint with SSDP discovery
            controlPoint = new ControlPoint();
            
            // Add device change listener to discover devices via SSDP
            controlPoint.addDeviceChangeListener(new DeviceChangeListener() {
                @Override
                public void deviceAdded(Device dev) {
                    Log.d(TAG, "SSDP Discovery: Device added - " + dev.getFriendlyName());
                    addDevice(dev);
                }

                @Override
                public void deviceRemoved(Device dev) {
                    Log.d(TAG, "SSDP Discovery: Device removed - " + dev.getFriendlyName());
                    removeDevice(dev);
                }
            });

            // Start SSDP search (M-SEARCH)
            controlPoint.start();
            controlPoint.search();

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
            if (controlPoint != null) {
                controlPoint.stop();
                controlPoint = null;
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
            Device device = findDeviceById(deviceId);
            if (device == null) {
                call.reject("Device not found");
                return;
            }

            // Find AVTransport service
            Service avTransportService = device.getService("urn:schemas-upnp-org:service:AVTransport:1");
            if (avTransportService == null) {
                avTransportService = device.getService("urn:schemas-upnp-org:service:AVTransport:2");
            }

            if (avTransportService == null) {
                call.reject("Device does not support AVTransport");
                return;
            }

            // Set AVTransport URI and play
            Action setURIAction = avTransportService.getAction("SetAVTransportURI");
            if (setURIAction != null) {
                setURIAction.setArgumentValue("InstanceID", "0");
                setURIAction.setArgumentValue("CurrentURI", mediaUrl);
                setURIAction.setArgumentValue("CurrentURIMetaData", createMetadata(title));
                
                if (setURIAction.postControlAction()) {
                    Log.d(TAG, "Media URI set successfully");
                    
                    // Play
                    Action playAction = avTransportService.getAction("Play");
                    if (playAction != null) {
                        playAction.setArgumentValue("InstanceID", "0");
                        playAction.setArgumentValue("Speed", "1");
                        
                        if (playAction.postControlAction()) {
                            Log.d(TAG, "Playback started");
                            JSObject result = new JSObject();
                            result.put("success", true);
                            call.resolve(result);
                        } else {
                            call.reject("Failed to play");
                        }
                    } else {
                        call.reject("Play action not available");
                    }
                } else {
                    call.reject("Failed to set media URI");
                }
            } else {
                call.reject("SetAVTransportURI action not available");
            }

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

            Device device = findDeviceById(deviceId);
            if (device == null) {
                call.reject("Device not found");
                return;
            }

            // Find RenderingControl service
            Service renderingControlService = device.getService("urn:schemas-upnp-org:service:RenderingControl:1");
            if (renderingControlService == null) {
                renderingControlService = device.getService("urn:schemas-upnp-org:service:RenderingControl:2");
            }

            if (renderingControlService == null) {
                call.reject("Device does not support volume control");
                return;
            }

            // Set volume (0-100, convert to string for UPnP)
            String volumeStr = String.valueOf(volume);
            
            Action setVolumeAction = renderingControlService.getAction("SetVolume");
            if (setVolumeAction != null) {
                setVolumeAction.setArgumentValue("InstanceID", "0");
                setVolumeAction.setArgumentValue("Channel", "Master");
                setVolumeAction.setArgumentValue("DesiredVolume", volumeStr);
                
                if (setVolumeAction.postControlAction()) {
                    Log.d(TAG, "Volume set successfully");
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("volume", volume);
                    call.resolve(result);
                } else {
                    call.reject("Failed to set volume");
                }
            } else {
                call.reject("SetVolume action not available");
            }
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

            Device device = findDeviceById(deviceId);
            if (device == null) {
                call.reject("Device not found");
                return;
            }

            // Find RenderingControl service
            Service renderingControlService = device.getService("urn:schemas-upnp-org:service:RenderingControl:1");
            if (renderingControlService == null) {
                renderingControlService = device.getService("urn:schemas-upnp-org:service:RenderingControl:2");
            }

            if (renderingControlService == null) {
                call.reject("Device does not support volume control");
                return;
            }

            Action getVolumeAction = renderingControlService.getAction("GetVolume");
            if (getVolumeAction != null) {
                getVolumeAction.setArgumentValue("InstanceID", "0");
                getVolumeAction.setArgumentValue("Channel", "Master");
                
                if (getVolumeAction.postControlAction()) {
                    Argument volumeArg = getVolumeAction.getArgument("CurrentVolume");
                    if (volumeArg != null) {
                        int volume = Integer.parseInt(volumeArg.getValue());
                        JSObject result = new JSObject();
                        result.put("volume", volume);
                        result.put("muted", false); // UPnP doesn't always support mute
                        call.resolve(result);
                    } else {
                        call.reject("Failed to get volume value");
                    }
                } else {
                    call.reject("Failed to get volume");
                }
            } else {
                call.reject("GetVolume action not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting volume", e);
            call.reject("Failed to get volume: " + e.getMessage());
        }
    }

    private Device findDeviceById(String deviceId) {
        if (controlPoint == null) return null;
        
        DeviceList deviceList = controlPoint.getDeviceList();
        for (int n = 0; n < deviceList.size(); n++) {
            Device device = deviceList.getDevice(n);
            if (device.getUDN().equals(deviceId)) {
                return device;
            }
        }
        return null;
    }

    private String createMetadata(String title) {
        // Create DIDL-Lite metadata (simplified)
        return "<?xml version=\"1.0\"?>" +
               "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" " +
               "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" " +
               "xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\">" +
               "<item id=\"1\" parentID=\"0\" restricted=\"true\">" +
               "<dc:title>" + escapeXml(title) + "</dc:title>" +
               "</item>" +
               "</DIDL-Lite>";
    }

    private String escapeXml(String text) {
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&apos;");
    }

    private void addDevice(Device device) {
        try {
            JSObject deviceObj = new JSObject();
            deviceObj.put("id", device.getUDN());
            deviceObj.put("name", device.getFriendlyName());
            deviceObj.put("type", "UPnP");
            deviceObj.put("friendlyName", device.getFriendlyName());
            deviceObj.put("url", device.getLocation());
            
            // Check if device supports AVTransport
            boolean supportsAVTransport = device.getService("urn:schemas-upnp-org:service:AVTransport:1") != null ||
                                         device.getService("urn:schemas-upnp-org:service:AVTransport:2") != null;
            deviceObj.put("supportsPlayback", supportsAVTransport);

            discoveredDevices.add(deviceObj);
            notifyListeners("deviceDiscovered", deviceObj);
        } catch (Exception e) {
            Log.e(TAG, "Error adding device", e);
        }
    }

    private void removeDevice(Device device) {
        discoveredDevices.removeIf(d -> {
            try {
                return d.getString("id").equals(device.getUDN());
            } catch (Exception e) {
                return false;
            }
        });
    }

    @Override
    public void handleOnDestroy() {
        super.handleOnDestroy();
        if (controlPoint != null) {
            controlPoint.stop();
        }
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }
    }
}
