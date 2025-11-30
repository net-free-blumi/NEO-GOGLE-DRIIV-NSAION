# מדריך התקנה והפעלה - CloudTunes Music Player

מדריך זה מסביר איך להריץ את האפליקציה גם כאתר וגם כ-APK.

## 📱 גרסת Android (APK)

### דרישות מוקדמות
- Android Studio (או Gradle command line)
- JDK 21
- Android SDK 35

### בניית APK

#### אפשרות 1: דרך Android Studio
1. פתח את הפרויקט ב-Android Studio
2. בחר `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. ה-APK יווצר ב: `app/build/outputs/apk/debug/CloudTunes-debug-1.0.apk`

#### אפשרות 2: דרך Command Line
```bash
# Windows
gradlew.bat assembleDebug

# Linux/Mac
./gradlew assembleDebug
```

ה-APK יווצר ב: `app/build/outputs/apk/debug/CloudTunes-debug-1.0.apk`

### התקנת APK
```bash
adb install app/build/outputs/apk/debug/CloudTunes-debug-1.0.apk
```

או העתק את הקובץ לטלפון והתקן ידנית.

### הערות חשובות ל-Android
- צריך להגדיר Google OAuth Client ID ב-Google Console
- ה-Redirect URI צריך להיות: `com.cloudtunes.music:/oauth2callback`
- צריך להוסיף את ה-Credentials בקוד (ראה `app/src/main/java/com/cloudtunes/music/`)

---

## 🌐 גרסת Web

### דרישות מוקדמות
- Node.js 18+ 
- npm או yarn

### התקנה

1. **עבור לתיקיית web:**
```bash
cd web
```

2. **התקן dependencies:**
```bash
npm install
```

3. **צור קובץ .env:**
```bash
# העתק את ENV_EXAMPLE.txt ל-.env
# Windows PowerShell:
Copy-Item ENV_EXAMPLE.txt .env

# Linux/Mac:
cp ENV_EXAMPLE.txt .env
```

4. **ערוך את .env והוסף את ה-Credentials שלך:**
```env
VITE_GOOGLE_CLIENT_ID=your-actual-client-id
VITE_GOOGLE_CLIENT_SECRET=your-actual-client-secret
```

### הרצה

#### מצב פיתוח (Development)
```bash
npm run dev
```

האתר יפתח ב: http://localhost:3000

#### בניית גרסת Production
```bash
npm run build
```

הקבצים יווצרו ב: `web/dist/`

#### תצוגה מקדימה של Production Build
```bash
npm run preview
```

### הערות חשובות ל-Web
- צריך להגדיר Google OAuth Client ID ב-Google Console
- ה-Redirect URI צריך להיות: `http://localhost:3000/callback` (לפיתוח)
- ל-Production: `https://yourdomain.com/callback`

---

## 🔑 הגדרת Google OAuth

### שלב 1: יצירת OAuth Client
1. לך ל: https://console.cloud.google.com/
2. בחר פרויקט (או צור חדש)
3. לך ל: **APIs & Services** → **Credentials**
4. לחץ **Create Credentials** → **OAuth client ID**

### שלב 2: הגדרת Web Client
- **Application type**: Web application
- **Name**: CloudTunes Web (או שם אחר)
- **Authorized redirect URIs**:
  - `http://localhost:3000/callback` (לפיתוח)
  - `https://yourdomain.com/callback` (ל-Production)
- העתק את **Client ID** ו-**Client Secret**

### שלב 3: הגדרת Android Client
- **Application type**: Android
- **Name**: CloudTunes Android (או שם אחר)
- **Package name**: `com.cloudtunes.music`
- **SHA-1 certificate fingerprint**: (ראה למטה)
- העתק את **Client ID**

### קבלת SHA-1 Fingerprint
```bash
# Windows (Debug keystore)
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# Linux/Mac (Debug keystore)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

---

## 🐛 פתרון בעיות

### Web לא עובד
1. בדוק שיש קובץ `.env` עם credentials נכונים
2. בדוק שה-Redirect URI תואם ב-Google Console
3. פתח את הקונסול בדפדפן (F12) ובדוק שגיאות
4. בדוק שהפורט 3000 פנוי

### Android לא בונה
1. בדוק שיש Android SDK 35 מותקן
2. בדוק שיש JDK 21
3. נסה: `gradlew clean` ואז `gradlew assembleDebug`
4. בדוק את הלוגים ב-Android Studio

### התחברות Google לא עובדת
1. **Web**: בדוק שה-CLIENT_ID וה-CLIENT_SECRET נכונים ב-.env
2. **Android**: בדוק שה-CLIENT_ID מוגדר בקוד
3. בדוק שה-Redirect URIs נכונים ב-Google Console
4. בדוק שה-API מופעל: **Google Drive API** ו-**Google OAuth2 API**

---

## 📝 מבנה הפרויקט

```
.
├── app/                    # Android App (Kotlin)
│   ├── src/main/
│   │   ├── java/          # קוד Kotlin
│   │   ├── res/           # משאבים (layouts, strings, etc.)
│   │   └── AndroidManifest.xml
│   └── build.gradle       # הגדרות Android
│
├── web/                    # Web App (React + TypeScript)
│   ├── src/
│   │   ├── pages/         # דפים
│   │   ├── contexts/      # React Contexts
│   │   └── components/    # רכיבים
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## ✅ Checklist לפני הרצה

### Web
- [ ] Node.js מותקן
- [ ] `npm install` הושלם
- [ ] קובץ `.env` קיים עם credentials
- [ ] Google OAuth Client מוגדר ב-Console
- [ ] Redirect URI נוסף ב-Google Console

### Android
- [ ] Android Studio מותקן
- [ ] Android SDK 35 מותקן
- [ ] JDK 21 מותקן
- [ ] Google OAuth Client מוגדר ב-Console
- [ ] SHA-1 fingerprint נוסף ב-Google Console

---

## 🚀 צעדים הבאים

1. **הרץ את ה-Web** ובדוק שההתחברות עובדת
2. **בנה APK** והתקן על מכשיר
3. **בדוק את הלוגים** כדי לזהות בעיות
4. **תקן בעיות** לפי הצורך

---

## 📞 תמיכה

אם יש בעיות:
1. בדוק את הלוגים (קונסול בדפדפן / Logcat ב-Android)
2. בדוק שה-Credentials נכונים
3. בדוק שה-APIs מופעלים ב-Google Console

