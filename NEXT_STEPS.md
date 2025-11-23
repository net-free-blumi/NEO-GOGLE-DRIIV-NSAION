# צעדים הבאים - Next Steps

## ✅ מה שכבר הושלם

1. **Credentials הוגדרו** - Client ID, Client Secret, ו-Folder ID כבר בקובץ `credentials.xml` ✅
2. **כל הקוד מעודכן** - ViewModels, Repositories, וכל הקוד משתמש ב-credentials מה-resources ✅
3. **OAuth Callback Activity** - מוכן לקבל את ה-authorization code ✅
4. **Google Drive Folder ID** - `1EhS3EzpK0dRK62v2V4YZuCLbcCrk6SN9` ✅

## 🔧 מה שצריך לעשות עכשיו

### 2. הגדר OAuth Redirect URI ב-Google Cloud Console

1. עבור ל-[Google Cloud Console](https://console.cloud.google.com/)
2. בחר את הפרויקט שלך
3. לך ל-**APIs & Services** > **Credentials**
4. פתח את ה-OAuth 2.0 Client ID שלך
5. הוסף **Authorized redirect URIs**:
   - `com.cloudtunes.music:/oauth2callback`

### 3. הוסף SHA-1 Certificate

**חשוב:** צריך להוסיף את ה-SHA-1 של ה-debug keystore:

```bash
# Windows
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# Mac/Linux  
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

העתק את ה-SHA-1 והוסף אותו ב-Google Cloud Console תחת **SHA-1 certificate fingerprints**.

### 4. השלם את Google Sign-In Flow

צריך להוסיף את ה-Google Sign-In Intent ב-`LoginScreen` או `MainActivity`.

**דוגמה:**
```kotlin
// ב-LoginScreen או MainActivity
val signInClient = authRepository.getGoogleSignInClient(clientId)
val signInIntent = signInClient.signInIntent
startActivityForResult(signInIntent, REQUEST_CODE_SIGN_IN)
```

### 5. בדוק את ה-Build

```bash
./gradlew assembleDebug
```

אם יש שגיאות קומפילציה, תקן אותן.

### 6. הרץ על מכשיר/אמולטור

1. פתח את הפרויקט ב-Android Studio
2. חבר מכשיר או הפעל אמולטור
3. לחץ Run (Shift+F10)
4. נסה להתחבר עם Google

## 🐛 פתרון בעיות

### שגיאת OAuth
- ודא שה-Client ID נכון
- ודא שה-SHA-1 תואם
- ודא שה-Redirect URI מוגדר נכון

### שגיאת Build
- ודא ש-JDK 21 מותקן
- נקה: `./gradlew clean`
- סנכרן Gradle files

### שגיאת Google Drive API
- ודא שה-Google Drive API מופעל ב-Google Cloud Console
- ודא שה-Folder ID נכון
- ודא שיש הרשאות לתיקייה

## 📝 הערות

- הקוד מוכן לעבודה
- צריך רק להשלים את ה-Google Sign-In flow
- אחרי זה הכל אמור לעבוד!

