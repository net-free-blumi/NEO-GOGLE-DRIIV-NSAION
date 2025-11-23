package com.cloudtunes.music.ui.navigation

/**
 * Navigation screens in the app
 */
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Home : Screen("home")
    object Player : Screen("player")
    object Playlists : Screen("playlists")
}

