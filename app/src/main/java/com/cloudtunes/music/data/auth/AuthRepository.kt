package com.cloudtunes.music.data.auth

import android.content.Context
import android.util.Log
import com.cloudtunes.music.data.preferences.AuthPreferences
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import com.google.api.client.auth.oauth2.Credential
import com.google.api.client.auth.oauth2.TokenResponse
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.http.UrlEncodedContent
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.DriveScopes
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.io.InputStreamReader
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for handling Google OAuth2 authentication
 * Manages token storage, refresh, and Google Drive API access
 */
@Singleton
class AuthRepository @Inject constructor(
    private val context: Context,
    private val authPreferences: AuthPreferences
) {
    companion object {
        private const val TAG = "AuthRepository"
        private const val REDIRECT_URI = "com.cloudtunes.music:/oauth2callback"
        private val SCOPES = listOf(
            DriveScopes.DRIVE_READONLY,
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile"
        )
    }

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: Flow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentCredential = MutableStateFlow<Credential?>(null)
    val currentCredential: Flow<Credential?> = _currentCredential.asStateFlow()

    init {
        checkAuthenticationStatus()
    }

    /**
     * Check if user is already authenticated
     */
    private fun checkAuthenticationStatus() {
        // Use suspend function in coroutine scope
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            val accessToken = authPreferences.getAccessToken()
            val refreshToken = authPreferences.getRefreshToken()
            
            _isAuthenticated.value = !accessToken.isNullOrEmpty() && !refreshToken.isNullOrEmpty()
            
            if (_isAuthenticated.value) {
                // Restore credential from stored tokens
                restoreCredential()
            }
        }
    }

    /**
     * Get Google Sign-In client for OAuth2
     */
    fun getGoogleSignInClient(clientId: String): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(clientId)
            .requestEmail()
            .requestProfile()
            .requestScopes(
                Scope(DriveScopes.DRIVE_READONLY)
            )
            .build()
        
        return GoogleSignIn.getClient(context, gso)
    }

    /**
     * Handle OAuth callback and exchange code for tokens
     */
    suspend fun handleOAuthCallback(
        authorizationCode: String,
        clientId: String,
        clientSecret: String
    ): Result<Credential> {
        return try {
            val transport = NetHttpTransport()
            val jsonFactory = GsonFactory.getDefaultInstance()

            val requestData = mapOf(
                "code" to authorizationCode,
                "client_id" to clientId,
                "client_secret" to clientSecret,
                "redirect_uri" to REDIRECT_URI,
                "grant_type" to "authorization_code"
            )

            // Exchange authorization code for tokens
            val tokenRequest = transport.createRequestFactory()
                .buildPostRequest(
                    com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token"),
                    UrlEncodedContent(requestData)
                )
            
            val response = tokenRequest.execute()
            val tokenResponse = response.parseAs(TokenResponse::class.java)
            
            if (tokenResponse.accessToken == null) {
                throw IllegalStateException("Failed to get access token from OAuth response")
            }

            // Create credential
            val credential = Credential.Builder(
                com.google.api.client.auth.oauth2.BearerToken.authorizationHeaderAccessMethod()
            )
                .setTransport(transport)
                .setJsonFactory(jsonFactory)
                .setTokenServerUrl(
                    com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token")
                )
                .setClientAuthentication(
                    com.google.api.client.auth.oauth2.ClientParametersAuthentication(
                        clientId,
                        clientSecret
                    )
                )
                .build()

            credential.setAccessToken(tokenResponse.accessToken)
            credential.setRefreshToken(tokenResponse.refreshToken)
            val expiresIn = tokenResponse.expiresInSeconds ?: 3600L
            credential.expirationTimeMilliseconds = 
                System.currentTimeMillis() + (expiresIn * 1000)

            // Store tokens
            authPreferences.saveTokens(
                accessToken = tokenResponse.accessToken,
                refreshToken = tokenResponse.refreshToken ?: "",
                expiresIn = expiresIn
            )

            _currentCredential.value = credential
            _isAuthenticated.value = true

            Log.d(TAG, "Authentication successful")
            Result.success(credential)
        } catch (e: Exception) {
            Log.e(TAG, "OAuth callback failed", e)
            Result.failure(e)
        }
    }

    /**
     * Get current credential, refreshing if needed
     */
    suspend fun getCredential(clientId: String, clientSecret: String): Credential? {
        val credential = _currentCredential.value
        
            if (credential != null && credential.refreshToken != null) {
            // Check if token needs refresh
            if (credential.expirationTimeMilliseconds != null &&
                credential.expirationTimeMilliseconds!! < System.currentTimeMillis() + 60000) {
                // Token expires in less than 1 minute, refresh it
                refreshToken(clientId, clientSecret)?.let {
                    return it
                }
            }
            return credential
        }

        // Try to restore from stored tokens
        restoreCredential()
        return _currentCredential.value
    }

    /**
     * Refresh access token using refresh token
     */
    private suspend fun refreshToken(clientId: String, clientSecret: String): Credential? {
        return try {
            val refreshToken = authPreferences.getRefreshToken()
            if (refreshToken.isNullOrEmpty()) {
                Log.w(TAG, "No refresh token available")
                return null
            }

            val transport = NetHttpTransport()
            val jsonFactory = GsonFactory.getDefaultInstance()

            val requestData = mapOf(
                "refresh_token" to refreshToken,
                "client_id" to clientId,
                "client_secret" to clientSecret,
                "grant_type" to "refresh_token"
            )

            val tokenRequest = transport.createRequestFactory()
                .buildPostRequest(
                    com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token"),
                    UrlEncodedContent(requestData)
                )
            
            val response = tokenRequest.execute()
            val tokenResponse = response.parseAs(TokenResponse::class.java)
            
            if (tokenResponse.accessToken == null) {
                throw IllegalStateException("Failed to refresh access token")
            }

            // Update credential
            val credential = _currentCredential.value ?: run {
                val newCredential = Credential.Builder(
                    com.google.api.client.auth.oauth2.BearerToken.authorizationHeaderAccessMethod()
                )
                    .setTransport(transport)
                    .setJsonFactory(jsonFactory)
                    .setTokenServerUrl(
                        com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token")
                    )
                    .setClientAuthentication(
                        com.google.api.client.auth.oauth2.ClientParametersAuthentication(
                            clientId,
                            clientSecret
                        )
                    )
                    .build()
                newCredential.setRefreshToken(refreshToken)
                newCredential
            }

            credential.setAccessToken(tokenResponse.accessToken)
            val expiresIn = tokenResponse.expiresInSeconds ?: 3600L
            credential.expirationTimeMilliseconds = 
                System.currentTimeMillis() + (expiresIn * 1000)

            // Update stored access token
            authPreferences.saveAccessToken(tokenResponse.accessToken, expiresIn)

            _currentCredential.value = credential

            Log.d(TAG, "Token refreshed successfully")
            credential
        } catch (e: Exception) {
            Log.e(TAG, "Token refresh failed", e)
            // If refresh fails, user needs to re-authenticate
            logout()
            null
        }
    }

    /**
     * Restore credential from stored tokens
     */
    private suspend fun restoreCredential() {
        val accessToken = authPreferences.getAccessToken()
        val refreshToken = authPreferences.getRefreshToken()
        
        if (!accessToken.isNullOrEmpty() && !refreshToken.isNullOrEmpty()) {
            val transport = NetHttpTransport()
            val jsonFactory = GsonFactory.getDefaultInstance()

            val credential = Credential.Builder(
                com.google.api.client.auth.oauth2.BearerToken.authorizationHeaderAccessMethod()
            )
                .setTransport(transport)
                .setJsonFactory(jsonFactory)
                .setTokenServerUrl(
                    com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token")
                )
                .build()

            credential.setAccessToken(accessToken)
            credential.setRefreshToken(refreshToken)
            credential.expirationTimeMilliseconds = authPreferences.getTokenExpiry()

            _currentCredential.value = credential
        }
    }

    /**
     * Logout and clear stored tokens
     */
    suspend fun logout() {
        authPreferences.clearTokens()
        _currentCredential.value = null
        _isAuthenticated.value = false
        Log.d(TAG, "User logged out")
    }
}

