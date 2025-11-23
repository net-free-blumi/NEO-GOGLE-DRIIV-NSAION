package com.cloudtunes.music.ui

import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.cloudtunes.music.ui.auth.LoginScreen
import com.cloudtunes.music.ui.home.HomeScreen
import com.cloudtunes.music.ui.navigation.Screen

/**
 * Main composable that handles navigation
 */
@Composable
fun MusicApp(
    onSignInRequest: ((Intent) -> Unit)? = null
) {
    val navController = rememberNavController()
    
    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onSignInRequest = onSignInRequest
            )
        }
        
        composable(Screen.Home.route) {
            HomeScreen()
        }
    }
}

