package com.cloudtunes.music.player

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.cloudtunes.music.R
import com.cloudtunes.music.data.auth.AuthRepository
import com.cloudtunes.music.data.google.SongMetadata
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Music player using Media3 ExoPlayer
 * Handles streaming from Google Drive
 */
@Singleton
class MusicPlayer @Inject constructor(
    private val context: Context,
    private val authRepository: AuthRepository
) {
    var exoPlayer: ExoPlayer? = null
        private set

    private val _playbackState = MutableStateFlow(PlaybackState())
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    /**
     * Initialize ExoPlayer
     */
    fun initialize() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build().apply {
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        _playbackState.value = _playbackState.value.copy(
                            isPlaying = playbackState == Player.STATE_READY && isPlaying,
                            isLoading = playbackState == Player.STATE_BUFFERING
                        )
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        _playbackState.value = _playbackState.value.copy(
                            isPlaying = isPlaying
                        )
                    }
                })
            }
        }
    }

    /**
     * Play a song
     */
    suspend fun playSong(song: SongMetadata) {
        initialize()
        
        val clientId = context.getString(R.string.google_client_id)
        val clientSecret = context.getString(R.string.google_client_secret)
        
        val credential = authRepository.getCredential(clientId, clientSecret)
            ?: throw IllegalStateException("Not authenticated")

        // Build streaming URL with access token
        val streamUrl = "${song.streamUrl}&access_token=${credential.accessToken}"

        val mediaItem = MediaItem.fromUri(streamUrl)
        exoPlayer?.apply {
            setMediaItem(mediaItem)
            prepare()
            play()
        }

        _playbackState.value = _playbackState.value.copy(
            currentSong = song,
            isPlaying = true
        )
    }

    /**
     * Pause playback
     */
    fun pause() {
        exoPlayer?.pause()
        _playbackState.value = _playbackState.value.copy(
            isPlaying = false
        )
    }

    /**
     * Resume playback
     */
    fun resume() {
        exoPlayer?.play()
        _playbackState.value = _playbackState.value.copy(
            isPlaying = true
        )
    }

    /**
     * Toggle play/pause
     */
    fun togglePlayPause() {
        if (_playbackState.value.isPlaying) {
            pause()
        } else {
            resume()
        }
    }

    /**
     * Stop playback
     */
    fun stop() {
        exoPlayer?.stop()
        _playbackState.value = _playbackState.value.copy(
            isPlaying = false,
            currentSong = null
        )
    }

    /**
     * Release player resources
     */
    fun release() {
        exoPlayer?.release()
        exoPlayer = null
    }

    /**
     * Get current position in milliseconds
     */
    fun getCurrentPosition(): Long {
        return exoPlayer?.currentPosition ?: 0L
    }

    /**
     * Get duration in milliseconds
     */
    fun getDuration(): Long {
        return exoPlayer?.duration ?: 0L
    }

    /**
     * Seek to position
     */
    fun seekTo(positionMs: Long) {
        exoPlayer?.seekTo(positionMs)
    }
}

/**
 * Playback state
 */
data class PlaybackState(
    val currentSong: SongMetadata? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val position: Long = 0L,
    val duration: Long = 0L
)

