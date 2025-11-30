package com.cloudtunes.music.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.cloudtunes.music.R
import com.cloudtunes.music.data.auth.AuthRepository
import com.cloudtunes.music.ui.theme.MusicPlayerTheme
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Main Activity - Entry point of the application
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    @Inject
    lateinit var authRepository: AuthRepository
    
    private lateinit var signInLauncher: androidx.activity.result.ActivityResultLauncher<Intent>
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Register for activity result
        signInLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK) {
                val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                handleSignInResult(task)
            }
        }
        
        setContent {
            MusicPlayerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MusicApp(
                        onSignInRequest = { signInIntent ->
                            signInLauncher.launch(signInIntent)
                        }
                    )
                }
            }
        }
    }
    
    private fun handleSignInResult(completedTask: Task<GoogleSignInAccount>) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val account = completedTask.getResult(ApiException::class.java)
                // Account signed in successfully
                val clientId = getString(R.string.google_client_id)
                val clientSecret = getString(R.string.google_client_secret)
                
                // Try server auth code first (if available)
                val serverAuthCode = account.serverAuthCode
                val result = if (serverAuthCode != null) {
                    // Exchange server auth code for tokens with refresh token
                    authRepository.handleServerAuthCode(
                        serverAuthCode = serverAuthCode,
                        clientId = clientId,
                        clientSecret = clientSecret
                    )
                } else {
                    // Fallback to GoogleAuthUtil (no refresh token)
                    authRepository.handleGoogleSignInAccount(
                        account = account,
                        clientId = clientId,
                        clientSecret = clientSecret
                    )
                }
                
                if (result.isFailure) {
                    android.util.Log.e("MainActivity", "Failed to authenticate", result.exceptionOrNull())
                } else {
                    android.util.Log.d("MainActivity", "Authentication successful")
                }
            } catch (e: ApiException) {
                // Sign in failed
                android.util.Log.e("MainActivity", "Sign in failed: ${e.statusCode}", e)
            }
        }
    }
}

