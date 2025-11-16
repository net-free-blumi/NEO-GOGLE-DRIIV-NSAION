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
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.CastDevice;
import com.google.android.gms.common.api.ResultCallback;
import com.google.android.gms.common.api.Status;
import com.google.android.gms.common.api.PendingResult;

import java.util.List;
import java.util.ArrayList;

@CapacitorPlugin(name = "ChromecastNative")
public class ChromecastNativePlugin extends Plugin implements SessionManagerListener<CastSession> {
    private static final String TAG = "ChromecastNativePlugin";
    private CastContext castContext;
    private CastSession castSession;
    private SessionManager sessionManager;

    @Override
    public void load() {
        super.load();
        try {
            // Initialize Cast Context - it should already be initialized via AndroidManifest
            // If not, we'll try to get it (may return null if not properly configured)
            try {
                castContext = CastContext.getSharedInstance(getContext());
                if (castContext != null) {
                    sessionManager = castContext.getSessionManager();
                    // Add this plugin as a SessionManagerListener
                    if (sessionManager != null) {
                        sessionManager.addSessionManagerListener(this);
                    }
                } else {
                    Log.w(TAG, "CastContext not available - make sure CastOptionsProvider is configured in AndroidManifest");
                }
            } catch (Exception e) {
                Log.e(TAG, "CastContext not initialized - Cast may not be available", e);
            }
            
            Log.d(TAG, "Chromecast plugin loaded successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error loading Chromecast plugin", e);
        }
    }

    // SessionManagerListener implementation
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

            // Note: Google Cast SDK 21.5.0 doesn't provide a direct API to discover devices
            // Devices are discovered automatically by the SDK and shown in the device picker
            // We can only return the currently connected device if there's an active session
            List<JSObject> deviceList = new ArrayList<>();
            
            // Check if there's an active session
            if (sessionManager != null) {
                CastSession currentSession = sessionManager.getCurrentCastSession();
                if (currentSession != null && currentSession.isConnected()) {
                    CastDevice device = currentSession.getCastDevice();
                    if (device != null) {
                        JSObject deviceObj = new JSObject();
                        deviceObj.put("id", device.getDeviceId());
                        deviceObj.put("name", device.getFriendlyName());
                        deviceObj.put("modelName", device.getModelName());
                        deviceList.add(deviceObj);
                    }
                }
            }
            
            JSObject result = new JSObject();
            result.put("devices", deviceList);
            result.put("note", "To discover devices, use the Cast Button which shows the device picker");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error discovering devices", e);
            call.reject("Failed to discover devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        try {
            if (castContext == null || sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            String deviceId = call.getString("deviceId");
            
            if (deviceId != null && !deviceId.isEmpty()) {
                // Check if already connected to this device
                CastSession currentSession = sessionManager.getCurrentCastSession();
                if (currentSession != null && currentSession.isConnected()) {
                    CastDevice currentDevice = currentSession.getCastDevice();
                    if (currentDevice != null && currentDevice.getDeviceId().equals(deviceId)) {
                        // Already connected to this device
                        JSObject result = new JSObject();
                        result.put("success", true);
                        result.put("message", "Already connected to " + currentDevice.getFriendlyName());
                        call.resolve(result);
                        return;
                    }
                }
                
                // Note: Google Cast SDK 21.5.0 doesn't allow direct connection by device ID
                // The user must select a device from the picker
                call.reject("Auto-connect by device ID is not supported. Please use the Cast Button to select a device.");
            } else {
                // Show device picker - this requires UI interaction
                // The SDK doesn't provide a programmatic way to show the picker without UI
                // We'll return a message indicating that the Cast Button should be used
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Please use the Cast Button in the UI to select a device");
                result.put("requiresPicker", true);
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
            if (sessionManager != null) {
                sessionManager.endCurrentSession(true);
            }
            castSession = null;
            
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
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            String contentUrl = call.getString("contentUrl");
            String contentType = call.getString("contentType", "audio/mpeg");
            String title = call.getString("title", "Track");
            String subtitle = call.getString("subtitle", "");
            String imageUrl = call.getString("imageUrl", "");

            RemoteMediaClient remoteMediaClient = currentSession.getRemoteMediaClient();
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
                // Use the new API for adding images
                metadata.addImage(new com.google.android.gms.cast.MediaInfo.Image.Builder()
                    .setUrl(imageUrl)
                    .build());
            }

            MediaInfo mediaInfo = new MediaInfo.Builder(contentUrl)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType(contentType)
                .setMetadata(metadata)
                .build();

            // Use ResultCallback (PendingResult API)
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
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = currentSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            // Use ResultCallback (PendingResult API)
            remoteMediaClient.play()
                .setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
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
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = currentSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            // Use ResultCallback (PendingResult API)
            remoteMediaClient.pause()
                .setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
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
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = currentSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            // Use ResultCallback (PendingResult API)
            remoteMediaClient.stop()
                .setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
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
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            long position = call.getLong("position", 0L);
            RemoteMediaClient remoteMediaClient = currentSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            // Use ResultCallback (PendingResult API)
            remoteMediaClient.seek(position)
                .setResultCallback(new ResultCallback<RemoteMediaClient.MediaChannelResult>() {
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
    public void setVolume(PluginCall call) {
        try {
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            double volume = call.getDouble("volume", 1.0);
            volume = Math.max(0.0, Math.min(1.0, volume)); // Clamp between 0 and 1

            // setVolume returns void, so we call it directly
            currentSession.setVolume(volume);
            JSObject jsResult = new JSObject();
            jsResult.put("success", true);
            jsResult.put("volume", volume);
            call.resolve(jsResult);
        } catch (Exception e) {
            Log.e(TAG, "Error setting volume", e);
            call.reject("Failed to set volume: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        try {
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            double volume = currentSession.getVolume();
            JSObject result = new JSObject();
            result.put("volume", volume);
            result.put("muted", currentSession.isMute());
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting volume", e);
            call.reject("Failed to get volume: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getMediaStatus(PluginCall call) {
        try {
            if (sessionManager == null) {
                call.reject("Chromecast not initialized");
                return;
            }

            CastSession currentSession = sessionManager.getCurrentCastSession();
            if (currentSession == null || !currentSession.isConnected()) {
                call.reject("No active Cast session");
                return;
            }

            RemoteMediaClient remoteMediaClient = currentSession.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                call.reject("RemoteMediaClient not available");
                return;
            }

            // getMediaStatus returns MediaStatus directly (synchronous)
            com.google.android.gms.cast.MediaStatus status = remoteMediaClient.getMediaStatus();
            if (status != null) {
                JSObject result = new JSObject();
                result.put("isPlaying", status.getPlayerState() == com.google.android.gms.cast.MediaStatus.PLAYER_STATE_PLAYING);
                result.put("isPaused", status.getPlayerState() == com.google.android.gms.cast.MediaStatus.PLAYER_STATE_PAUSED);
                result.put("isBuffering", status.getPlayerState() == com.google.android.gms.cast.MediaStatus.PLAYER_STATE_BUFFERING);
                result.put("currentTime", status.getStreamPosition());
                
                // Get duration from MediaInfo
                MediaInfo mediaInfo = status.getMediaInfo();
                if (mediaInfo != null) {
                    result.put("duration", mediaInfo.getStreamDuration());
                    if (mediaInfo.getMetadata() != null) {
                        result.put("title", mediaInfo.getMetadata().getString(MediaMetadata.KEY_TITLE));
                        result.put("subtitle", mediaInfo.getMetadata().getString(MediaMetadata.KEY_SUBTITLE));
                    }
                } else {
                    result.put("duration", 0);
                }
                
                result.put("volume", status.getStreamVolume());
                result.put("muted", status.isMute());
                
                call.resolve(result);
            } else {
                call.reject("Failed to get media status");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting media status", e);
            call.reject("Failed to get media status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getSessionState(PluginCall call) {
        try {
            JSObject result = new JSObject();
            if (sessionManager != null) {
                CastSession currentSession = sessionManager.getCurrentCastSession();
                boolean connected = currentSession != null && currentSession.isConnected();
                result.put("connected", connected);
                if (connected && currentSession != null) {
                    result.put("sessionId", currentSession.getSessionId());
                }
            } else {
                result.put("connected", false);
            }
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting session state", e);
            call.reject("Failed to get session state: " + e.getMessage());
        }
    }

    @Override
    public void handleOnDestroy() {
        super.handleOnDestroy();
        if (sessionManager != null) {
            sessionManager.removeSessionManagerListener(this);
        }
    }
}
