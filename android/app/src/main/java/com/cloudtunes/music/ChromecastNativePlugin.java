package com.cloudtunes.music;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.CastSessionManagerListener;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.CastDevice;
import com.google.android.gms.common.api.ResultCallback;
import com.google.android.gms.common.api.Status;

import java.util.List;
import java.util.ArrayList;

@CapacitorPlugin(name = "ChromecastNative")
public class ChromecastNativePlugin extends Plugin {
    private static final String TAG = "ChromecastNativePlugin";
    private CastContext castContext;
    private CastSession castSession;
    private SessionManager sessionManager;

    @Override
    public void load() {
        super.load();
        try {
            // Initialize Cast Context
            CastOptions castOptions = new CastOptions.Builder()
                .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
                .build();
            
            castContext = CastContext.getSharedInstance(getContext());
            sessionManager = castContext.getSessionManager();
            
            // Add session manager listener
            sessionManager.addSessionManagerListener(new CastSessionManagerListener<CastSession>() {
                @Override
                public void onSessionStarting(CastSession session) {
                    Log.d(TAG, "Cast session starting");
                    notifyListeners("sessionStarting", new JSObject());
                }

                @Override
                public void onSessionStarted(CastSession session, String sessionId) {
                    Log.d(TAG, "Cast session started: " + sessionId);
                    castSession = session;
                    JSObject result = new JSObject();
                    result.put("sessionId", sessionId);
                    notifyListeners("sessionStarted", result);
                }

                @Override
                public void onSessionStartFailed(CastSession session, int error) {
                    Log.e(TAG, "Cast session start failed: " + error);
                    JSObject result = new JSObject();
                    result.put("error", error);
                    notifyListeners("sessionStartFailed", result);
                }

                @Override
                public void onSessionEnding(CastSession session) {
                    Log.d(TAG, "Cast session ending");
                    notifyListeners("sessionEnding", new JSObject());
                }

                @Override
                public void onSessionEnded(CastSession session, int error) {
                    Log.d(TAG, "Cast session ended: " + error);
                    castSession = null;
                    JSObject result = new JSObject();
                    result.put("error", error);
                    notifyListeners("sessionEnded", result);
                }

                @Override
                public void onSessionResuming(CastSession session, String sessionId) {
                    Log.d(TAG, "Cast session resuming: " + sessionId);
                    notifyListeners("sessionResuming", new JSObject());
                }

                @Override
                public void onSessionResumed(CastSession session, boolean wasSuspended) {
                    Log.d(TAG, "Cast session resumed");
                    castSession = session;
                    notifyListeners("sessionResumed", new JSObject());
                }

                @Override
                public void onSessionResumeFailed(CastSession session, int error) {
                    Log.e(TAG, "Cast session resume failed: " + error);
                    JSObject result = new JSObject();
                    result.put("error", error);
                    notifyListeners("sessionResumeFailed", result);
                }

                @Override
                public void onSessionSuspended(CastSession session, int reason) {
                    Log.d(TAG, "Cast session suspended: " + reason);
                    notifyListeners("sessionSuspended", new JSObject());
                }
            });
            
            Log.d(TAG, "Chromecast plugin loaded successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error loading Chromecast plugin", e);
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("available", castContext != null);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Chromecast", e);
            call.reject("Failed to initialize: " + e.getMessage());
        }
    }

    @PluginMethod
    public void discoverDevices(PluginCall call) {
        try {
            if (castContext == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            // Get available Cast devices
            List<CastDevice> devices = castContext.getCastDeviceDiscoveryManager().getCastDevices();
            List<JSObject> deviceList = new ArrayList<>();
            
            for (CastDevice device : devices) {
                JSObject deviceObj = new JSObject();
                deviceObj.put("id", device.getDeviceId());
                deviceObj.put("name", device.getFriendlyName());
                deviceObj.put("modelName", device.getModelName());
                deviceList.add(deviceObj);
            }
            
            JSObject result = new JSObject();
            result.put("devices", deviceList);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error discovering devices", e);
            call.reject("Failed to discover devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        try {
            if (castContext == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            String deviceId = call.getString("deviceId");
            
            if (deviceId != null && !deviceId.isEmpty()) {
                // Auto-connect to specific device (without popup)
                List<CastDevice> devices = castContext.getCastDeviceDiscoveryManager().getCastDevices();
                CastDevice targetDevice = null;
                
                for (CastDevice device : devices) {
                    if (device.getDeviceId().equals(deviceId)) {
                        targetDevice = device;
                        break;
                    }
                }
                
                if (targetDevice != null) {
                    // Auto-connect without picker
                    sessionManager.startSession(targetDevice);
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("message", "Auto-connecting to " + targetDevice.getFriendlyName());
                    call.resolve(result);
                } else {
                    call.reject("Device not found: " + deviceId);
                }
            } else {
                // Show device picker (fallback)
                sessionManager.startSession(CastOptions.CastDeviceFilterPolicy.FILTER_NONE);
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Session start requested (picker will show)");
                call.resolve(result);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting session", e);
            call.reject("Failed to start session: " + e.getMessage());
        }
    }

    @PluginMethod
    public void endSession(PluginCall call) {
        try {
            if (castSession != null) {
                castSession.endSession();
                castSession = null;
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error ending session", e);
            call.reject("Failed to end session: " + e.getMessage());
        }
    }

    @PluginMethod
    public void loadMedia(PluginCall call) {
        try {
            if (castSession == null || !castSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            String contentUrl = call.getString("contentUrl");
            String contentType = call.getString("contentType", "audio/mpeg");
            String title = call.getString("title", "Track");
            String subtitle = call.getString("subtitle", "");
            String imageUrl = call.getString("imageUrl", "");

            RemoteMediaClient remoteMediaClient = castSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
            metadata.putString(MediaMetadata.KEY_TITLE, title);
            if (!subtitle.isEmpty()) {
                metadata.putString(MediaMetadata.KEY_SUBTITLE, subtitle);
            }
            if (!imageUrl.isEmpty()) {
                metadata.addImage(new com.google.android.gms.cast.MediaInfo.UrlImageInfo(imageUrl));
            }

            MediaInfo mediaInfo = new MediaInfo.Builder(contentUrl)
                .setStreamType(com.google.android.gms.cast.MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType(contentType)
                .setMetadata(metadata)
                .build();

            remoteMediaClient.load(mediaInfo, true, 0)
                .setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
                    @Override
                    public void onResult(RemoteMediaClient.MediaChannelResult result) {
                        if (result.getStatus().isSuccess()) {
                            JSObject jsResult = new JSObject();
                            jsResult.put("success", true);
                            call.resolve(jsResult);
                        } else {
                            call.reject("Failed to load media: " + result.getStatus().getStatusMessage());
                        }
                    }
                });
        } catch (Exception e) {
            Log.e(TAG, "Error loading media", e);
            call.reject("Failed to load media: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        try {
            if (castSession == null || !castSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = castSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            remoteMediaClient.play().setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
                @Override
                public void onResult(RemoteMediaClient.MediaChannelResult result) {
                    if (result.getStatus().isSuccess()) {
                        JSObject jsResult = new JSObject();
                        jsResult.put("success", true);
                        call.resolve(jsResult);
                    } else {
                        call.reject("Failed to play: " + result.getStatus().getStatusMessage());
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error playing", e);
            call.reject("Failed to play: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        try {
            if (castSession == null || !castSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = castSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            remoteMediaClient.pause().setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
                @Override
                public void onResult(RemoteMediaClient.MediaChannelResult result) {
                    if (result.getStatus().isSuccess()) {
                        JSObject jsResult = new JSObject();
                        jsResult.put("success", true);
                        call.resolve(jsResult);
                    } else {
                        call.reject("Failed to pause: " + result.getStatus().getStatusMessage());
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error pausing", e);
            call.reject("Failed to pause: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            if (castSession == null || !castSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = castSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            remoteMediaClient.stop().setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
                @Override
                public void onResult(RemoteMediaClient.MediaChannelResult result) {
                    if (result.getStatus().isSuccess()) {
                        JSObject jsResult = new JSObject();
                        jsResult.put("success", true);
                        call.resolve(jsResult);
                    } else {
                        call.reject("Failed to stop: " + result.getStatus().getStatusMessage());
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error stopping", e);
            call.reject("Failed to stop: " + e.getMessage());
        }
    }

    @PluginMethod
    public void seek(PluginCall call) {
        try {
            if (castSession == null || !castSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            long position = call.getLong("position", 0);
            RemoteMediaClient remoteMediaClient = castSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            remoteMediaClient.seek(position).setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
                @Override
                public void onResult(RemoteMediaClient.MediaChannelResult result) {
                    if (result.getStatus().isSuccess()) {
                        JSObject jsResult = new JSObject();
                        jsResult.put("success", true);
                        call.resolve(jsResult);
                    } else {
                        call.reject("Failed to seek: " + result.getStatus().getStatusMessage());
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error seeking", e);
            call.reject("Failed to seek: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getSessionState(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("connected", castSession != null && castSession.isConnected());
            if (castSession != null && castSession.isConnected()) {
                result.put("sessionId", castSession.getSessionId());
            }
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting session state", e);
            call.reject("Failed to get session state: " + e.getMessage());
        }
    }
}

