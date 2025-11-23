# Netlify - לא רלוונטי יותר

## ⚠️ הערה חשובה

**זה כבר לא פרויקט Web!** זה פרויקט **Android** בלבד.

## 🔧 מה לעשות ב-Netlify

### אפשרות 1: בטל את ה-Deploy ב-Netlify
1. לך ל-Netlify Dashboard
2. פתח את ה-Site settings
3. **Disable** את ה-Continuous Deployment
4. או **Delete** את ה-Site (אם לא צריך אותו)

### אפשרות 2: שנה את הגדרות Build
אם אתה רוצה לשמור את ה-Site ב-Netlify (למקרה עתידי):
1. לך ל-Site settings → Build & deploy
2. שנה את ה-Build command ל:
   ```
   echo "This is an Android project, not a web project"
   ```
3. או פשוט בטל את ה-Auto deploy

## 📱 הפרויקט החדש

זה פרויקט **Android** שצריך:
- **Android Studio** לבנייה
- **Gradle** לבניית APK
- **לא Netlify** - זה לא web app!

## ✅ Build APK

בנה APK עם:
```bash
./gradlew assembleDebug
```

או ב-Android Studio:
- Build → Build Bundle(s) / APK(s) → Build APK(s)

## 🔗 GitHub Actions

יש GitHub Actions workflow ב-`.github/workflows/build-apk.yml` שיכול לבנות APK אוטומטית!

