# 🚀 התחלה מהירה - CloudTunes

## Web (אתר) - 3 שלבים

```bash
# 1. התקן dependencies
cd web
npm install

# 2. צור קובץ .env (העתק מ-ENV_EXAMPLE.txt והוסף את ה-credentials שלך)
# Windows: Copy-Item ENV_EXAMPLE.txt .env
# Linux/Mac: cp ENV_EXAMPLE.txt .env

# 3. הרץ
npm run dev
```

פתח: http://localhost:3000

---

## Android (APK) - 2 שלבים

### דרך Android Studio:
1. פתח את הפרויקט ב-Android Studio
2. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. ה-APK ב: `app/build/outputs/apk/debug/CloudTunes-debug-1.0.apk`

### דרך Command Line:
```bash
# Windows
gradlew.bat assembleDebug

# Linux/Mac  
./gradlew assembleDebug
```

---

## ⚠️ חשוב!

**לפני הרצה - צריך להגדיר Google OAuth:**

1. לך ל: https://console.cloud.google.com/apis/credentials
2. צור OAuth 2.0 Client ID
3. **Web**: הוסף Redirect URI: `http://localhost:3000/callback`
4. **Android**: הוסף Package name: `com.cloudtunes.music` + SHA-1 fingerprint
5. העתק את ה-Credentials לקובץ `.env` (Web) או לקוד (Android)

---

## 📖 מדריך מפורט

ראה `SETUP_GUIDE.md` למדריך מלא עם כל הפרטים.

