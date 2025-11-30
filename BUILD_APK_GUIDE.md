# 🚀 מדריך יצירת APK - CloudTunes Music Player

> ⚡ **טיפ:** אם אתה בפיתוח פעיל, **מומלץ להשתמש ב-USB Debugging** במקום לבנות APK כל פעם!
> 
> ראה: **[USB_DEBUGGING_GUIDE.md](./USB_DEBUGGING_GUIDE.md)** - עדכון קוד מיידי ללא בניית APK!

---

## ✅ מה מוכן:
- ✅ **Application ID**: `com.cloudtunes.music`
- ✅ **Version**: 1.0 (versionCode: 1)
- ✅ **Google OAuth Credentials**: מוגדרים ב-`credentials.xml`
- ✅ **Signing Config**: מוגדר (debug signing)
- ✅ **Output File**: `CloudTunes-release-1.0.apk`

---

## 📱 יצירת APK ב-Android Studio

### שיטה 1: דרך Android Studio GUI (הכי קל)

1. **פתח את הפרויקט ב-Android Studio**
   - File → Open → בחר את התיקייה `NEO-GOGLE-DRIIV-NSAION-main`

2. **חכה ל-Gradle Sync** (אוטומטי)

3. **בנה APK:**
   - **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   - או: **Build** → **Generate Signed Bundle / APK** → בחר **APK**

4. **מיקום ה-APK:**
   ```
   app/build/outputs/apk/release/CloudTunes-release-1.0.apk
   ```

---

### שיטה 2: דרך Terminal (מהיר יותר)

```bash
# Windows PowerShell
cd "C:\קוד שלי נסיון\NEO-GOGLE-DRIIV-NSAION-main"
.\gradlew.bat assembleRelease
```

**המיקום:**
```
app\build\outputs\apk\release\CloudTunes-release-1.0.apk
```

---

### שיטה 3: Debug APK (לבדיקות)

```bash
.\gradlew.bat assembleDebug
```

**המיקום:**
```
app\build\outputs\apk\debug\CloudTunes-debug-1.0.apk
```

---

## ⚠️ הערות חשובות:

### 1. **Google OAuth Credentials**
   - ה-credentials מוגדרים ב-`app/src/main/res/values/credentials.xml`
   - אם צריך לשנות, ערוך את הקובץ הזה

### 2. **Signing (חתימה)**
   - כרגע משתמש ב-**debug signing** (שורה 34 ב-`build.gradle`)
   - ל-production, צריך ליצור **keystore** ולשנות את ה-signing config

### 3. **ProGuard**
   - כרגע **disabled** (`minifyEnabled false`)
   - ל-production, מומלץ להפעיל עם ProGuard rules

---

## 🔧 אם יש שגיאות:

### שגיאת Gradle Sync:
```bash
# נקה את הפרויקט
.\gradlew.bat clean

# סנכרן מחדש
.\gradlew.bat build
```

### שגיאת Dependencies:
- Android Studio → **File** → **Invalidate Caches / Restart**

### שגיאת Build:
- בדוק ש-JDK 21 מותקן
- בדוק ש-Android SDK 35 מותקן

---

## 📦 התקנת ה-APK:

1. **העבר את ה-APK לטלפון** (USB/Email/Cloud)
2. **הפעל "מקורות לא ידועים"** בהגדרות האבטחה
3. **התקן** את ה-APK

---

## ✅ בדיקה מהירה:

לאחר יצירת ה-APK, בדוק:
- ✅ גודל הקובץ: צריך להיות ~10-20 MB
- ✅ שם הקובץ: `CloudTunes-release-1.0.apk`
- ✅ מיקום: `app/build/outputs/apk/release/`

---

**🎵 בהצלחה!**

