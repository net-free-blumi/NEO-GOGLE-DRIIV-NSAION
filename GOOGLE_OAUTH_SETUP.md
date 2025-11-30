# 🔐 מדריך הגדרת Google OAuth - CloudTunes

## ⚠️ שגיאת redirect_uri_mismatch - איך לתקן

אם אתה מקבל שגיאה **"Error 400: redirect_uri_mismatch"**, זה אומר שה-Redirect URI שהאפליקציה שולחת לא תואם למה שמוגדר ב-Google Cloud Console.

---

## 🔧 שלב 1: בדוק מה ה-Redirect URI שלך

### לאתר ב-Netlify:
1. פתח את האתר שלך ב-Netlify (למשל: `https://your-site.netlify.app`)
2. לחץ F12 לפתיחת Developer Tools
3. לך ל-Console
4. לחץ "התחבר עם Google"
5. תראה בקונסול את ה-Redirect URI המדויק

**דוגמה:**
```
Redirect URI: https://your-site.netlify.app/callback
```

### לאתר מקומי (localhost):
```
Redirect URI: http://localhost:3000/callback
```

---

## 🌐 שלב 2: הוסף Redirect URI ב-Google Cloud Console

1. **לך ל-Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **בחר את ה-Web Client ID שלך** (לא Android!)

3. **לחץ על העיפרון** (Edit) ליד ה-Client ID

4. **ב-"Authorized redirect URIs":**
   - לחץ **"+ ADD URI"**
   - הוסף את ה-Redirect URI המדויק:
     - **ל-Netlify:** `https://your-site.netlify.app/callback`
     - **ל-localhost:** `http://localhost:3000/callback`
   - **חשוב:** הוסף את שניהם אם אתה מפתח גם מקומית וגם ב-Netlify!

5. **שמור** (Save)

---

## ✅ שלב 3: בדיקה

1. **חכה 1-2 דקות** (Google צריך זמן לעדכן)
2. **נסה להתחבר שוב**
3. **אם עדיין לא עובד:**
   - בדוק שהקישור **בדיוק** תואם (כולל `https://` או `http://`)
   - בדוק שאין רווחים או תווים מיותרים
   - נסה למחוק cookies ולנסות שוב

---

## 📋 רשימת Redirect URIs שצריך להוסיף

### אם אתה מפתח מקומי:
```
http://localhost:3000/callback
```

### אם האתר ב-Netlify:
```
https://your-site-name.netlify.app/callback
```

### אם יש לך domain מותאם:
```
https://yourdomain.com/callback
```

**חשוב:** הוסף **כל** ה-URLs שאתה משתמש בהם!

---

## 🔍 איך לבדוק מה ה-Redirect URI בפועל

### דרך 1: Developer Console
1. פתח את האתר
2. לחץ F12
3. לך ל-Console
4. לחץ "התחבר עם Google"
5. תראה הודעות כמו:
   ```
   Redirect URI: https://your-site.netlify.app/callback
   ```

### דרך 2: Network Tab
1. פתח את האתר
2. לחץ F12 → Network
3. לחץ "התחבר עם Google"
4. חפש את הבקשה ל-`accounts.google.com`
5. תראה את ה-`redirect_uri` ב-URL

---

## 🐛 פתרון בעיות

### שגיאה: "redirect_uri_mismatch"
**פתרון:**
1. בדוק שהקישור ב-Google Console **בדיוק** תואם
2. ודא שאין רווחים או תווים מיותרים
3. ודא שה-URL מתחיל ב-`https://` (ל-Netlify) או `http://` (ל-localhost)
4. ודא שזה מסתיים ב-`/callback` (לא `/callback/`)

### שגיאה: "invalid_client"
**פתרון:**
- בדוק שה-Client ID נכון ב-`.env` או ב-Netlify Environment Variables

### שגיאה: "access_denied"
**פתרון:**
- המשתמש ביטל את ההרשאה - זה תקין, פשוט נסה שוב

---

## 📝 דוגמה להגדרה נכונה ב-Google Console

**Authorized JavaScript origins:**
```
https://your-site.netlify.app
http://localhost:3000
```

**Authorized redirect URIs:**
```
https://your-site.netlify.app/callback
http://localhost:3000/callback
```

**חשוב:**
- JavaScript origins **ללא** `/callback`
- Redirect URIs **עם** `/callback`

---

## ✅ Checklist

- [ ] בדקתי מה ה-Redirect URI בפועל (דרך Console)
- [ ] הוספתי את ה-Redirect URI ב-Google Cloud Console
- [ ] ה-URL תואם **בדיוק** (כולל `https://` ו-`/callback`)
- [ ] שמרתי את השינויים ב-Google Console
- [ ] חכיתי 1-2 דקות לעדכון
- [ ] ניסיתי להתחבר שוב

---

**🎉 אחרי שתעשה את זה, ההתחברות אמורה לעבוד!**

**💡 טיפ:** שמור את כל ה-Redirect URIs שאתה משתמש בהם - גם localhost וגם production!

