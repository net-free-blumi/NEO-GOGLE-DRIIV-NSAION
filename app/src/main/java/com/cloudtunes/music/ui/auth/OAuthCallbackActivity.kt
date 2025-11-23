package com.cloudtunes.music.ui.auth

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cloudtunes.music.ui.auth.AuthViewModel
import com.cloudtunes.music.ui.theme.MusicPlayerTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Activity to handle OAuth callback from Google
 * This activity receives the authorization code and exchanges it for tokens
 */
@AndroidEntryPoint
class OAuthCallbackActivity : ComponentActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val uri = intent.data
        if (uri != null) {
            handleOAuthCallback(uri)
        } else {
            finish()
        }
    }
    
    private fun handleOAuthCallback(uri: Uri) {
        setContent {
            MusicPlayerTheme {
                OAuthCallbackScreen(uri = uri)
            }
        }
    }
}

@Composable
fun OAuthCallbackScreen(
    uri: Uri,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    LaunchedEffect(uri) {
        val code = uri.getQueryParameter("code")
        if (code != null) {
            viewModel.handleOAuthCallback(code)
        } else {
            val error = uri.getQueryParameter("error")
            errorMessage = error ?: "Unknown error"
            isLoading = false
        }
    }
    
    // Observe authentication state
    val authState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    
    LaunchedEffect(authState.isAuthenticated) {
        if (authState.isAuthenticated) {
            // Close this activity and return to main
            isLoading = false
            (context as? ComponentActivity)?.finish()
        } else if (authState.errorMessage != null) {
            errorMessage = authState.errorMessage
            isLoading = false
        }
    }
    
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        when {
            isLoading -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator()
                    Text("מתחבר...")
                }
            }
            errorMessage != null -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "שגיאה: $errorMessage",
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
            authState.isAuthenticated -> {
                Text("התחברות הצליחה!")
            }
        }
    }
}

