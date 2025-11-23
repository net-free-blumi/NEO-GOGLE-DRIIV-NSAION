# Setup Guide - Music Player Android App

## 📋 דרישות מוקדמות

1. **Android Studio** - Hedgehog (2023.1.1) או חדש יותר
2. **JDK 21** - Java Development Kit
3. **Android SDK** - API Level 24-35
4. **Google Cloud Console** - לחשבון OAuth2

## 🔧 התקנה

### 1. הגדרת Google OAuth2

1. עבור ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש או בחר פרויקט קיים
3. הפעל את **Google Drive API**
4. צור **OAuth 2.0 Client ID**:
   - Application type: **Android**
   - Package name: `com.cloudtunes.music`
   - SHA-1: קבל מ-Android Studio (Build > Generate Signed Bundle/APK)

### 2. הגדרת Credentials

צור קובץ `app/src/main/res/values/credentials.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="google_client_id">YOUR_CLIENT_ID_HERE</string>
    <string name="google_client_secret">YOUR_CLIENT_SECRET_HERE</string>
    <string name="google_drive_folder_id">YOUR_FOLDER_ID_HERE</string>
</resources>
```

**⚠️ חשוב:** הוסף את הקובץ ל-`.gitignore` כדי לא להעלות אותו ל-GitHub!

### 3. בניית הפרויקט

```bash
./gradlew assembleDebug
```

הקובץ APK ייווצר ב:
`app/build/outputs/apk/debug/app-debug.apk`

## 🚀 הרצה

1. פתח את הפרויקט ב-Android Studio
2. חבר מכשיר Android או הפעל אמולטור
3. לחץ על **Run** (Shift+F10)

## 📱 תכונות

- ✅ אימות Google Drive עם OAuth2
- ✅ רענון אוטומטי של Token
- ✅ סטרימינג מוזיקה מ-Google Drive
- ✅ נגינה ברקע
- ✅ תמיכה ב-Chromecast (בפיתוח)
- ✅ ממשק מודרני עם Jetpack Compose

## 🐛 פתרון בעיות

### שגיאת OAuth
- ודא שה-Client ID נכון
- ודא שה-SHA-1 תואם
- ודא שה-Google Drive API מופעל

### שגיאת Build
- ודא ש-JDK 21 מותקן
- נקה את הפרויקט: `./gradlew clean`
- סנכרן Gradle files ב-Android Studio

## 📝 הערות

- הקוד נכתב ב-Kotlin עם best practices
- משתמש ב-Coroutines לאסינכרוניות
- DataStore לאחסון Tokens
- Media3 לנגינת מוזיקה
- Jetpack Compose ל-UI מודרני

