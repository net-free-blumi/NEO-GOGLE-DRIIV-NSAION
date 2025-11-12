package com.cloudtunes.music;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "UPnPDiscovery")
public class UPnPDiscoveryPlugin extends Plugin {
    private static final String TAG = "UPnPDiscoveryPlugin";
    private static final String SSDP_MULTICAST_ADDRESS = "239.255.255.250";
    private static final int SSDP_PORT = 1900;
    private static final String SSDP_MSEARCH = 
        "M-SEARCH * HTTP/1.1\r\n" +
        "HOST: 239.255.255.250:1900\r\n" +
        "MAN: \"ssdp:discover\"\r\n" +
        "ST: ssdp:all\r\n" +
        "MX: 3\r\n" +
        "\r\n";
    
    private WifiManager.MulticastLock multicastLock;
    private List<JSObject> discoveredDevices = new ArrayList<>();
    private ExecutorService discoveryExecutor;
    private boolean isDiscovering = false;
    private DatagramSocket socket;

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

            isDiscovering = true;
            discoveredDevices.clear();
            discoveryExecutor = Executors.newSingleThreadExecutor();
            
            // Start SSDP discovery in background thread
            discoveryExecutor.execute(() -> {
                try {
                    performSSDPDiscovery();
                } catch (Exception e) {
                    Log.e(TAG, "Error in SSDP discovery", e);
                }
            });

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "SSDP Discovery started");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error starting SSDP discovery", e);
            call.reject("Failed to start discovery: " + e.getMessage());
        }
    }

    private void performSSDPDiscovery() {
        try {
            // Create multicast socket
            MulticastSocket multicastSocket = new MulticastSocket(SSDP_PORT);
            InetAddress group = InetAddress.getByName(SSDP_MULTICAST_ADDRESS);
            multicastSocket.joinGroup(new InetSocketAddress(group, SSDP_PORT), getNetworkInterface());
            
            // Send M-SEARCH request
            byte[] requestBytes = SSDP_MSEARCH.getBytes(StandardCharsets.UTF_8);
            DatagramPacket requestPacket = new DatagramPacket(
                requestBytes, 
                requestBytes.length, 
                group, 
                SSDP_PORT
            );
            multicastSocket.send(requestPacket);
            Log.d(TAG, "M-SEARCH request sent");

            // Listen for responses (wait up to 5 seconds)
            byte[] buffer = new byte[8192];
            long startTime = System.currentTimeMillis();
            long timeout = 5000; // 5 seconds

            while (isDiscovering && (System.currentTimeMillis() - startTime) < timeout) {
                DatagramPacket responsePacket = new DatagramPacket(buffer, buffer.length);
                multicastSocket.setSoTimeout(1000); // 1 second timeout per response
                
                try {
                    multicastSocket.receive(responsePacket);
                    String response = new String(responsePacket.getData(), 0, responsePacket.getLength(), StandardCharsets.UTF_8);
                    parseSSDPResponse(response, responsePacket.getAddress().getHostAddress());
                } catch (java.net.SocketTimeoutException e) {
                    // Timeout is expected, continue listening
                    continue;
                }
            }

            multicastSocket.leaveGroup(new InetSocketAddress(group, SSDP_PORT), getNetworkInterface());
            multicastSocket.close();
            
            Log.d(TAG, "SSDP Discovery completed. Found " + discoveredDevices.size() + " devices");
        } catch (Exception e) {
            Log.e(TAG, "Error in SSDP discovery", e);
        }
    }

    private NetworkInterface getNetworkInterface() throws IOException {
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        while (interfaces.hasMoreElements()) {
            NetworkInterface networkInterface = interfaces.nextElement();
            if (networkInterface.isUp() && !networkInterface.isLoopback()) {
                return networkInterface;
            }
        }
        return null;
    }

    private void parseSSDPResponse(String response, String ipAddress) {
        try {
            // Parse SSDP response to extract device information
            String[] lines = response.split("\r\n");
            String location = null;
            String usn = null;
            String server = null;
            String st = null;

            for (String line : lines) {
                line = line.trim();
                if (line.toUpperCase().startsWith("LOCATION:")) {
                    location = line.substring(9).trim();
                } else if (line.toUpperCase().startsWith("USN:")) {
                    usn = line.substring(4).trim();
                } else if (line.toUpperCase().startsWith("SERVER:")) {
                    server = line.substring(7).trim();
                } else if (line.toUpperCase().startsWith("ST:")) {
                    st = line.substring(3).trim();
                }
            }

            // Only process devices that support media (AVTransport)
            if (location != null && (st == null || st.contains("MediaRenderer") || st.contains("AVTransport"))) {
                // Check if device already exists
                boolean exists = false;
                for (JSObject device : discoveredDevices) {
                    if (device.getString("id").equals(usn != null ? usn : ipAddress)) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    JSObject deviceObj = new JSObject();
                    deviceObj.put("id", usn != null ? usn : ipAddress);
                    deviceObj.put("name", server != null ? server : "UPnP Device");
                    deviceObj.put("type", "UPnP");
                    deviceObj.put("friendlyName", server != null ? server : "UPnP Device");
                    deviceObj.put("url", location);
                    deviceObj.put("ip", ipAddress);
                    deviceObj.put("supportsPlayback", true); // Assume support if found via SSDP

                    discoveredDevices.add(deviceObj);
                    notifyListeners("deviceDiscovered", deviceObj);
                    Log.d(TAG, "Device discovered: " + deviceObj.getString("name") + " at " + location);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing SSDP response", e);
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        try {
            isDiscovering = false;
            
            if (discoveryExecutor != null) {
                discoveryExecutor.shutdown();
                discoveryExecutor = null;
            }

            if (socket != null && !socket.isClosed()) {
                socket.close();
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
        // Note: Full UPnP control requires parsing device description XML and SOAP actions
        // This is a simplified implementation - for full functionality, consider using a UPnP library
        call.reject("Full UPnP playback requires device description parsing. Use a UPnP control library for complete functionality.");
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        call.reject("Full UPnP volume control requires device description parsing. Use a UPnP control library for complete functionality.");
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        call.reject("Full UPnP volume control requires device description parsing. Use a UPnP control library for complete functionality.");
    }

    @Override
    public void handleOnDestroy() {
        super.handleOnDestroy();
        isDiscovering = false;
        if (discoveryExecutor != null) {
            discoveryExecutor.shutdown();
        }
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }
    }
}
