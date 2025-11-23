package com.cloudtunes.music.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DataStore for storing authentication tokens securely
 */
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_prefs")

@Singleton
class AuthPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
        private val TOKEN_EXPIRY_KEY = longPreferencesKey("token_expiry")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
    }

    /**
     * Get access token
     */
    val accessToken: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[ACCESS_TOKEN_KEY]
    }

    /**
     * Get refresh token
     */
    val refreshToken: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[REFRESH_TOKEN_KEY]
    }

    /**
     * Get access token synchronously (for immediate use)
     */
    suspend fun getAccessToken(): String? {
        return context.dataStore.data.map { it[ACCESS_TOKEN_KEY] }.firstOrNull()
    }

    /**
     * Get refresh token synchronously
     */
    suspend fun getRefreshToken(): String? {
        return context.dataStore.data.map { it[REFRESH_TOKEN_KEY] }.firstOrNull()
    }

    /**
     * Get token expiry time
     */
    suspend fun getTokenExpiry(): Long? {
        return context.dataStore.data.map { it[TOKEN_EXPIRY_KEY] }.firstOrNull()
    }

    /**
     * Save tokens
     */
    suspend fun saveTokens(
        accessToken: String,
        refreshToken: String,
        expiresIn: Long
    ) {
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN_KEY] = accessToken
            prefs[REFRESH_TOKEN_KEY] = refreshToken
            prefs[TOKEN_EXPIRY_KEY] = System.currentTimeMillis() + (expiresIn * 1000)
        }
    }

    /**
     * Save access token only (for refresh)
     */
    suspend fun saveAccessToken(accessToken: String, expiresIn: Long) {
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN_KEY] = accessToken
            prefs[TOKEN_EXPIRY_KEY] = System.currentTimeMillis() + (expiresIn * 1000)
        }
    }

    /**
     * Save user email
     */
    suspend fun saveUserEmail(email: String) {
        context.dataStore.edit { prefs ->
            prefs[USER_EMAIL_KEY] = email
        }
    }

    /**
     * Get user email
     */
    suspend fun getUserEmail(): String? {
        return context.dataStore.data.map { it[USER_EMAIL_KEY] }.firstOrNull()
    }

    /**
     * Clear all tokens
     */
    suspend fun clearTokens() {
        context.dataStore.edit { prefs ->
            prefs.remove(ACCESS_TOKEN_KEY)
            prefs.remove(REFRESH_TOKEN_KEY)
            prefs.remove(TOKEN_EXPIRY_KEY)
            prefs.remove(USER_EMAIL_KEY)
        }
    }
}

