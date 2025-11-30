# 🔑 איך לעדכן את קובץ .env

## הבעיה
השגיאה `invalid_client` אומרת שה-Client Secret לא נכון.

## הפתרון

### שלב 1: מצא את ה-Client Secret
1. לך ל: https://console.cloud.google.com/apis/credentials
2. לחץ על ה-OAuth Client שלך: **NEO-GOGLE-DRIIV-NSAION**
3. גלול למטה לחלק **"Client secrets"**
4. תראה 2 secrets (מוסתרים עם `****`)
5. לחץ על **העין** 👁️ ליד אחד מהם כדי לראות את ה-Secret המלא
6. **העתק את ה-Secret המלא**

### שלב 2: עדכן את קובץ .env

פתח את הקובץ: `web/.env`

החלף את השורה:
```
VITE_GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
```

ב:
```
VITE_GOOGLE_CLIENT_SECRET=הערך-שהעתקת-מה-Google-Console
```

### שלב 3: הפעל מחדש את השרת

אחרי ששמרת את הקובץ:
1. עצור את השרת (Ctrl+C בטרמינל)
2. הפעל מחדש: `npm run dev`
3. נסה להתחבר שוב

---

## ⚠️ חשוב!
- ה-Client Secret רגיש - אל תעלה אותו ל-Git!
- הקובץ `.env` כבר ב-`.gitignore` אז זה בסדר
- אם אתה משתף את הקוד, אל תכלול את ה-.env

