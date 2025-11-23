package com.cloudtunes.music.ui.auth

import android.app.Activity
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cloudtunes.music.R
import com.cloudtunes.music.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for authentication
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    private val _signInIntent = MutableStateFlow<android.content.Intent?>(null)
    val signInIntent: kotlinx.coroutines.flow.StateFlow<android.content.Intent?> = _signInIntent.asStateFlow()

    private val clientId: String = context.getString(R.string.google_client_id)
    private val clientSecret: String = context.getString(R.string.google_client_secret)

    init {
        // Check if already authenticated
        viewModelScope.launch {
            authRepository.isAuthenticated.collect { isAuthenticated ->
                _uiState.value = _uiState.value.copy(
                    isAuthenticated = isAuthenticated
                )
            }
        }
    }

    /**
     * Initiate Google Sign-In
     */
    fun signIn() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null
            )

            // Get Google Sign-In client and create intent
            val signInClient = authRepository.getGoogleSignInClient(clientId)
            val signInIntent = signInClient.signInIntent
            _signInIntent.value = signInIntent
        }
    }

    /**
     * Handle OAuth callback
     */
    fun handleOAuthCallback(authorizationCode: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null
            )

            val result = authRepository.handleOAuthCallback(
                authorizationCode = authorizationCode,
                clientId = clientId,
                clientSecret = clientSecret
            )

            when {
                result.isSuccess -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isAuthenticated = true
                    )
                }
                result.isFailure -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Authentication failed"
                    )
                }
            }
        }
    }
}

/**
 * UI State for authentication
 */
data class AuthUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val errorMessage: String? = null
)

