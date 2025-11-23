# Add project specific ProGuard rules here.
-keep class com.google.api.client.** { *; }
-keep class com.google.auth.** { *; }
-keep class com.google.apis.** { *; }

# Keep Google Drive API classes
-keep class com.google.api.services.drive.** { *; }

# Keep Media3
-keep class androidx.media3.** { *; }

# Keep Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

