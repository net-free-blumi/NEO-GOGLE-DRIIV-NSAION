package com.cloudtunes.music.ui.home

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cloudtunes.music.R
import com.cloudtunes.music.data.auth.AuthRepository
import com.cloudtunes.music.data.google.GoogleDriveRepository
import com.cloudtunes.music.data.google.SongMetadata
import com.cloudtunes.music.player.MusicPlayer
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for home screen
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val googleDriveRepository: GoogleDriveRepository,
    private val authRepository: AuthRepository,
    private val musicPlayer: MusicPlayer,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val clientId: String = context.getString(R.string.google_client_id)
    private val clientSecret: String = context.getString(R.string.google_client_secret)
    private val folderId: String = context.getString(R.string.google_drive_folder_id)

    init {
        loadSongs()
    }

    /**
     * Load songs from Google Drive
     */
    fun loadSongs() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null
            )

            val result = googleDriveRepository.listAudioFiles(
                folderId = folderId,
                clientId = clientId,
                clientSecret = clientSecret
            )

            when {
                result.isSuccess -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        songs = result.getOrNull() ?: emptyList()
                    )
                }
                result.isFailure -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Failed to load songs"
                    )
                }
            }
        }
    }

    /**
     * Play a song
     */
    fun playSong(song: SongMetadata) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                currentSong = song,
                isPlaying = true
            )
            // Start playback using Media3
            try {
                musicPlayer.playSong(song)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    errorMessage = "Failed to play song: ${e.message}",
                    isPlaying = false
                )
            }
        }
    }

    /**
     * Toggle play/pause
     */
    fun togglePlayPause() {
        musicPlayer.togglePlayPause()
        _uiState.value = _uiState.value.copy(
            isPlaying = !_uiState.value.isPlaying
        )
    }

    /**
     * Play next song
     */
    fun playNext() {
        val currentIndex = _uiState.value.songs.indexOfFirst { 
            it.id == _uiState.value.currentSong?.id 
        }
        if (currentIndex >= 0 && currentIndex < _uiState.value.songs.size - 1) {
            playSong(_uiState.value.songs[currentIndex + 1])
        }
    }

    /**
     * Play previous song
     */
    fun playPrevious() {
        val currentIndex = _uiState.value.songs.indexOfFirst { 
            it.id == _uiState.value.currentSong?.id 
        }
        if (currentIndex > 0) {
            playSong(_uiState.value.songs[currentIndex - 1])
        }
    }

    /**
     * Logout
     */
    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            // Navigation will be handled by the UI
        }
    }
}

/**
 * UI State for home screen
 */
data class HomeUiState(
    val isLoading: Boolean = false,
    val songs: List<SongMetadata> = emptyList(),
    val currentSong: SongMetadata? = null,
    val isPlaying: Boolean = false,
    val errorMessage: String? = null
)

