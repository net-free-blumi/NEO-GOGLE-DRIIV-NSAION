package com.cloudtunes.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.cloudtunes.music.MainActivity;

public class MusicPlaybackService extends Service {
    private static final String TAG = "MusicPlaybackService";
    private static final String CHANNEL_ID = "music_playback_channel";
    private static final int NOTIFICATION_ID = 1;
    
    private MediaSessionCompat mediaSession;
    private final IBinder binder = new LocalBinder();
    private boolean isPlaying = false;
    private String currentTitle = "";
    private String currentArtist = "";
    private String currentArtworkUrl = "";

    public class LocalBinder extends Binder {
        MusicPlaybackService getService() {
            return MusicPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "MusicPlaybackService created");
        
        // Create MediaSession
        mediaSession = new MediaSessionCompat(this, "CloudTunes");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setActive(true);
        
        // Create notification channel
        createNotificationChannel();
        
        // Start foreground service
        startForeground(NOTIFICATION_ID, createNotification());
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (action != null) {
                switch (action) {
                    case "PLAY":
                        play();
                        break;
                    case "PAUSE":
                        pause();
                        break;
                    case "STOP":
                        stop();
                        break;
                    case "NEXT":
                        next();
                        break;
                    case "PREVIOUS":
                        previous();
                        break;
    }
            }
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mediaSession != null) {
            mediaSession.release();
        }
        stopForeground(true);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background music playback");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle.isEmpty() ? "CloudTunes" : currentTitle)
            .setContentText(currentArtist.isEmpty() ? "Music Player" : currentArtist)
            .setContentIntent(pendingIntent)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setStyle(new MediaStyle()
                .setShowActionsInCompactView(0, 1, 2)
                .setMediaSession(mediaSession.getSessionToken()));
        
        // Add media actions
        if (isPlaying) {
            builder.addAction(android.R.drawable.ic_media_pause, "Pause",
                createPendingIntent("PAUSE"));
        } else {
            builder.addAction(android.R.drawable.ic_media_play, "Play",
                createPendingIntent("PLAY"));
        }
        
        builder.addAction(android.R.drawable.ic_media_previous, "Previous",
            createPendingIntent("PREVIOUS"));
        builder.addAction(android.R.drawable.ic_media_next, "Next",
            createPendingIntent("NEXT"));
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop",
            createPendingIntent("STOP"));
        
        return builder.build();
    }
    
    private PendingIntent createPendingIntent(String action) {
        Intent intent = new Intent(this, MusicPlaybackService.class);
        intent.setAction(action);
        return PendingIntent.getService(
            this, action.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
    
    public void updateMetadata(String title, String artist, String artworkUrl) {
        currentTitle = title;
        currentArtist = artist;
        currentArtworkUrl = artworkUrl;
        
        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist);
        
        if (!artworkUrl.isEmpty()) {
            metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artworkUrl);
        }
        
        mediaSession.setMetadata(metadataBuilder.build());
        updateNotification();
    }
    
    public void setPlaybackState(boolean playing, long position, long duration) {
        isPlaying = playing;
        
        int state = playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setState(state, position, 1.0f)
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_STOP |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO
            );
        
        mediaSession.setPlaybackState(stateBuilder.build());
        updateNotification();
    }
    
    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, createNotification());
        }
    }
    
    private void play() {
        isPlaying = true;
        setPlaybackState(true, 0, 0);
        // Notify Capacitor plugin
        // This will be handled by the plugin
    }
    
    private void pause() {
        isPlaying = false;
        setPlaybackState(false, 0, 0);
    }
    
    private void stop() {
        isPlaying = false;
        setPlaybackState(false, 0, 0);
        stopForeground(true);
        stopSelf();
    }
    
    private void next() {
        // Notify Capacitor plugin
    }
    
    private void previous() {
        // Notify Capacitor plugin
    }
    
    public MediaSessionCompat.Token getMediaSessionToken() {
        return mediaSession.getSessionToken();
    }
}
