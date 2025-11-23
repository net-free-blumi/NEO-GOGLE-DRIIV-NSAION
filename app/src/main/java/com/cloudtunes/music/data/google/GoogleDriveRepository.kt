package com.cloudtunes.music.data.google

import android.util.Log
import com.cloudtunes.music.data.auth.AuthRepository
import com.google.api.client.http.HttpRequestInitializer
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.model.File
import com.google.api.services.drive.model.FileList
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for Google Drive operations
 * Handles file listing, metadata extraction, and streaming URLs
 */
@Singleton
class GoogleDriveRepository @Inject constructor(
    private val authRepository: AuthRepository
) {
    companion object {
        private const val TAG = "GoogleDriveRepository"
        private val AUDIO_MIME_TYPES = listOf(
            "audio/mpeg",
            "audio/mp3",
            "audio/mp4",
            "audio/wav",
            "audio/flac",
            "audio/ogg",
            "audio/aac",
            "audio/webm"
        )
    }

    /**
     * Get Drive service instance
     */
    private suspend fun getDriveService(
        clientId: String,
        clientSecret: String
    ): Drive? {
        return withContext(Dispatchers.IO) {
            val credential = authRepository.getCredential(clientId, clientSecret)
                ?: return@withContext null

            val requestInitializer = HttpRequestInitializer { request ->
                credential.initialize(request)
            }

            Drive.Builder(
                NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
            )
                .setApplicationName("Music Player")
                .build()
        }
    }

    /**
     * List audio files from a specific folder
     */
    suspend fun listAudioFiles(
        folderId: String,
        clientId: String,
        clientSecret: String
    ): Result<List<SongMetadata>> {
        return withContext(Dispatchers.IO) {
            try {
                val drive = getDriveService(clientId, clientSecret)
                    ?: return@withContext Result.failure(
                        Exception("Failed to get Drive service - not authenticated")
                    )

                val query = "'$folderId' in parents and trashed = false and " +
                    "(mimeType = 'audio/mpeg' or mimeType = 'audio/mp3' or " +
                    "mimeType = 'audio/mp4' or mimeType = 'audio/wav' or " +
                    "mimeType = 'audio/flac' or mimeType = 'audio/ogg' or " +
                    "mimeType = 'audio/aac' or mimeType = 'audio/webm')"

                val request = drive.files().list()
                    .setQ(query)
                    .setFields("files(id,name,mimeType,size,modifiedTime,thumbnailLink)")
                    .setOrderBy("name")
                    .setPageSize(1000)
                    .setSupportsAllDrives(true)
                    .setIncludeItemsFromAllDrives(true)

                val fileList: FileList = request.execute()
                val files = fileList.files ?: emptyList()

                val songs = files.map { file ->
                    SongMetadata(
                        id = file.id,
                        name = file.name,
                        mimeType = file.mimeType ?: "audio/mpeg",
                        size = file.size?.toLong() ?: 0L,
                        modifiedTime = file.modifiedTime?.value ?: 0L,
                        thumbnailUrl = file.thumbnailLink,
                        streamUrl = getStreamUrl(file.id)
                    )
                }

                Log.d(TAG, "Found ${songs.size} audio files")
                Result.success(songs)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to list audio files", e)
                Result.failure(e)
            }
        }
    }

    /**
     * List all folders in Drive (for folder selection)
     */
    suspend fun listFolders(
        clientId: String,
        clientSecret: String
    ): Result<List<DriveFolder>> {
        return withContext(Dispatchers.IO) {
            try {
                val drive = getDriveService(clientId, clientSecret)
                    ?: return@withContext Result.failure(
                        Exception("Failed to get Drive service - not authenticated")
                    )

                val query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"

                val request = drive.files().list()
                    .setQ(query)
                    .setFields("files(id,name,modifiedTime)")
                    .setOrderBy("name")
                    .setPageSize(1000)
                    .setSupportsAllDrives(true)
                    .setIncludeItemsFromAllDrives(true)

                val fileList: FileList = request.execute()
                val files = fileList.files ?: emptyList()

                val folders = files.map { file ->
                    DriveFolder(
                        id = file.id,
                        name = file.name,
                        modifiedTime = file.modifiedTime?.value ?: 0L
                    )
                }

                Log.d(TAG, "Found ${folders.size} folders")
                Result.success(folders)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to list folders", e)
                Result.failure(e)
            }
        }
    }

    /**
     * Get streaming URL for a file
     * Uses Google Drive API to get a direct download link
     */
    private fun getStreamUrl(fileId: String): String {
        // For streaming, we'll use the Google Drive API download endpoint
        // The actual URL will be constructed with the access token in the player
        return "https://www.googleapis.com/drive/v3/files/$fileId?alt=media"
    }

    /**
     * Get file metadata
     */
    suspend fun getFileMetadata(
        fileId: String,
        clientId: String,
        clientSecret: String
    ): Result<SongMetadata> {
        return withContext(Dispatchers.IO) {
            try {
                val drive = getDriveService(clientId, clientSecret)
                    ?: return@withContext Result.failure(
                        Exception("Failed to get Drive service - not authenticated")
                    )

                val file: File = drive.files().get(fileId)
                    .setFields("id,name,mimeType,size,modifiedTime,thumbnailLink")
                    .execute()

                val metadata = SongMetadata(
                    id = file.id,
                    name = file.name,
                    mimeType = file.mimeType ?: "audio/mpeg",
                    size = file.size?.toLong() ?: 0L,
                    modifiedTime = file.modifiedTime?.value ?: 0L,
                    thumbnailUrl = file.thumbnailLink,
                    streamUrl = getStreamUrl(file.id)
                )

                Result.success(metadata)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get file metadata", e)
                Result.failure(e)
            }
        }
    }
}

/**
 * Data class for song metadata
 */
data class SongMetadata(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val modifiedTime: Long,
    val thumbnailUrl: String? = null,
    val streamUrl: String
)

/**
 * Data class for Drive folder
 */
data class DriveFolder(
    val id: String,
    val name: String,
    val modifiedTime: Long
)

