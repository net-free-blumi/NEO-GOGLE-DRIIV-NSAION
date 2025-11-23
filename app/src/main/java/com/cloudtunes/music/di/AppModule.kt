package com.cloudtunes.music.di

import android.content.Context
import com.cloudtunes.music.data.auth.AuthRepository
import com.cloudtunes.music.data.google.GoogleDriveRepository
import com.cloudtunes.music.data.preferences.AuthPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Dependency Injection module for the app
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAuthPreferences(
        @ApplicationContext context: Context
    ): AuthPreferences {
        return AuthPreferences(context)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        @ApplicationContext context: Context,
        authPreferences: AuthPreferences
    ): AuthRepository {
        return AuthRepository(context, authPreferences)
    }

    @Provides
    @Singleton
    fun provideGoogleDriveRepository(
        authRepository: AuthRepository
    ): GoogleDriveRepository {
        return GoogleDriveRepository(authRepository)
    }
}

