# Architecture Documentation

## 🏗️ ארכיטקטורת הפרויקט

הפרויקט בנוי לפי **MVVM (Model-View-ViewModel)** עם הפרדה ברורה בין שכבות.

## 📂 מבנה התיקיות

```
app/src/main/java/com/cloudtunes/music/
├── data/
│   ├── auth/
│   │   └── AuthRepository.kt          # ניהול אימות Google OAuth2
│   ├── google/
│   │   └── GoogleDriveRepository.kt    # גישה ל-Google Drive API
│   └── preferences/
│       └── AuthPreferences.kt          # אחסון Tokens ב-DataStore
├── di/
│   └── AppModule.kt                    # Dependency Injection (Hilt)
├── player/
│   ├── MusicPlayer.kt                  # נגן מוזיקה (Media3)
│   └── MusicService.kt                 # שירות רקע לנגינה
├── ui/
│   ├── auth/
│   │   ├── LoginScreen.kt              # מסך התחברות
│   │   ├── AuthViewModel.kt             # ViewModel לאימות
│   │   └── OAuthCallbackActivity.kt     # טיפול ב-OAuth callback
│   ├── home/
│   │   ├── HomeScreen.kt                # מסך ראשי
│   │   └── HomeViewModel.kt             # ViewModel למסך ראשי
│   ├── navigation/
│   │   └── Screen.kt                   # הגדרות ניווט
│   ├── theme/
│   │   ├── Color.kt                     # צבעים
│   │   ├── Theme.kt                     # ערכת נושא
│   │   └── Type.kt                      # טיפוגרפיה
│   ├── MainActivity.kt                  # Activity ראשי
│   ├── MusicApp.kt                      # נקודת כניסה ל-Compose
│   └── MusicApplication.kt              # Application class
└── MusicApplication.kt                  # Application entry point
```

## 🔄 זרימת הנתונים

### 1. אימות (Authentication)

```
LoginScreen → AuthViewModel → AuthRepository → AuthPreferences (DataStore)
                                      ↓
                              Google OAuth2 API
```

### 2. טעינת שירים

```
HomeScreen → HomeViewModel → GoogleDriveRepository → Google Drive API
                                      ↓
                              AuthRepository (להשגת Token)
```

### 3. נגינת מוזיקה

```
HomeScreen → HomeViewModel → MusicPlayer → ExoPlayer (Media3)
                                      ↓
                              Google Drive Stream URL
```

## 🧩 רכיבים עיקריים

### AuthRepository
- מנהל את תהליך ה-OAuth2
- מרענן Tokens אוטומטית
- שומר Tokens ב-DataStore

### GoogleDriveRepository
- רשימת קבצי מוזיקה מ-Google Drive
- קבלת Metadata של שירים
- יצירת Streaming URLs

### MusicPlayer
- נגן מוזיקה מבוסס Media3 ExoPlayer
- תמיכה בסטרימינג מ-Google Drive
- ניהול מצב נגינה

### ViewModels
- מטפלים בלוגיקה עסקית
- מנהלים State של UI
- מתקשרים עם Repositories

## 🔐 אבטחה

- **Tokens** נשמרים ב-DataStore (מוצפן)
- **OAuth2** עם Refresh Token
- **HTTPS** לכל התקשרות עם Google APIs

## 📦 Dependencies

- **Hilt** - Dependency Injection
- **Jetpack Compose** - UI
- **Media3** - נגן מוזיקה
- **Google Drive API** - גישה לקבצים
- **DataStore** - אחסון מקומי
- **Coroutines** - אסינכרוניות

## 🚀 הרחבות עתידיות

- [ ] תמיכה ב-Chromecast
- [ ] תמיכה ב-Bluetooth
- [ ] פלייליסטים
- [ ] חיפוש שירים
- [ ] היסטוריית נגינה

