package com.cloudtunes.music

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Application class for Music Player
 * Initializes Hilt dependency injection
 */
@HiltAndroidApp
class MusicApplication : Application()

