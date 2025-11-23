# הגדרת Credentials

## ✅ Credentials שהוגדרו

הקובץ `app/src/main/res/values/credentials.xml` כבר נוצר עם כל ה-Credentials הנדרשים:

- ✅ **Client ID** - מוגדר
- ✅ **Client Secret** - מוגדר  
- ✅ **Folder ID**: `1EhS3EzpK0dRK62v2V4YZuCLbcCrk6SN9`

**⚠️ הערה:** ה-Credentials נשמרים רק בקובץ `credentials.xml` המקומי ולא יועלו ל-GitHub.

## ✅ הכל מוכן!

כל ה-Credentials כבר מוגדרים:
- Client ID ✅
- Client Secret ✅
- Google Drive Folder ID ✅

### 2. OAuth Redirect URI

ודא שב-Google Cloud Console הוגדר:
- **Redirect URI**: `com.cloudtunes.music:/oauth2callback`
- **Package name**: `com.cloudtunes.music`

### 3. SHA-1 Certificate

הוסף את ה-SHA-1 של ה-debug keystore ב-Google Cloud Console:

```bash
# Windows
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# Mac/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

## 🔒 אבטחה

**⚠️ חשוב:** הקובץ `credentials.xml` נמצא ב-`.gitignore` כדי שלא יועלה ל-GitHub.

אם אתה משתף את הפרויקט, ודא שה-credentials לא נכללים!

## ✅ בדיקה

לאחר העדכון:
1. בנה את הפרויקט: `./gradlew assembleDebug`
2. הרץ על מכשיר/אמולטור
3. נסה להתחבר עם Google

