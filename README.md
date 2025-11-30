# CloudTunes Music Player

אפליקציית מוזיקה שמתחברת ל-Google Drive ומנגנת קבצי מוזיקה ישירות משם.

**זמין ב-2 גרסאות:**
- 📱 **Android App** (APK) - אפליקציית Android native
- 🌐 **Web App** - אתר React/TypeScript

## 🎯 תכונות

- ✅ אימות Google Drive עם OAuth2 + Token Refresh
- ✅ סטרימינג מוזיקה ישירות מ-Google Drive (ללא הורדה)
- ✅ תמיכה ב-Chromecast ו-Bluetooth (בפיתוח)
- ✅ ממשק משתמש מודרני עם Jetpack Compose
- ✅ ארכיטקטורה MVVM נקייה
- ✅ נגינה ברקע (Background Playback)
- ✅ תורים ופלייליסטים

## 🏗️ ארכיטקטורה

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/cloudtunes/music/
│   │   │   ├── ui/              # Jetpack Compose UI
│   │   │   ├── viewmodel/       # MVVM ViewModels
│   │   │   ├── data/
│   │   │   │   ├── google/       # Google Drive API
│   │   │   │   ├── auth/         # OAuth2 Authentication
│   │   │   │   └── preferences/  # DataStore
│   │   │   ├── player/          # Media Player
│   │   │   ├── repository/       # Data repositories
│   │   │   └── di/              # Dependency Injection
│   │   └── res/                 # Resources
│   └── test/
└── build.gradle
```

## 🚀 התחלה מהירה

### Web (אתר)
```bash
cd web
npm install
# צור קובץ .env (ראה ENV_EXAMPLE.txt)
npm run dev
```

### Android (APK)

> ⚡ **לפיתוח:** מומלץ להשתמש ב-**[USB Debugging](./USB_DEBUGGING_GUIDE.md)** - עדכון קוד מיידי ללא בניית APK!

ראה: **[BUILD_APK_GUIDE.md](./BUILD_APK_GUIDE.md)** - מדריך בניית APK
```bash
# דרך Android Studio: Build → Build APK(s)
# או דרך Command Line:
gradlew assembleDebug
```

📖 **מדריך מפורט**: ראה `SETUP_GUIDE.md` או `QUICK_START.md`

## 📦 טכנולוגיות

- **Kotlin** - שפת התכנות
- **Jetpack Compose** - UI מודרני
- **MVVM** - ארכיטקטורה
- **Google Drive API** - גישה לקבצים
- **Media3** - נגן מוזיקה
- **Cast SDK** - תמיכה ב-Chromecast
- **Hilt** - Dependency Injection

## 🔧 Build

```bash
./gradlew assembleDebug
```

## 📝 תיעוד

- `QUICK_START.md` - התחלה מהירה (מומלץ להתחיל כאן!)
- `SETUP_GUIDE.md` - מדריך התקנה מפורט
- `SETUP.md` - הוראות התקנה מפורטות (Android)
- `ARCHITECTURE.md` - תיעוד ארכיטקטורה
- `CREDENTIALS_SETUP.md` - הגדרת Credentials
- `NEXT_STEPS.md` - צעדים הבאים
- `IMPLEMENTATION_NOTES.md` - הערות יישום

## 📝 רישיון

Private project

