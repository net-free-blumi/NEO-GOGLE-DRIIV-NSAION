# ✅ Checklist לפני הרצה

## 1. הגדרת Google OAuth Console ✅
- [x] Client ID נוצר
- [x] Authorized JavaScript origins: `http://localhost:3000` ✅
- [x] Authorized redirect URIs: `http://localhost:3000/callback` ✅
- [x] Client Secret קיים

**הכל בסדר!** ✅

## 2. הגדרת קובץ .env

צור קובץ `.env` בתיקיית `web/`:

```env
VITE_GOOGLE_CLIENT_ID=745814060499-3p5lj56d6esjs2vdotkoug1lbsqsmlve.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret-here
```

**חשוב:** 
- העתק את ה-Client Secret מה-Google Console
- הוסף את הקובץ ל-`.gitignore` (לא להעלות ל-Git!)

## 3. הרצת האתר

```bash
cd web
npm install  # אם עדיין לא התקנת
npm run dev
```

האתר יפתח ב: http://localhost:3000

## 4. בדיקה

1. פתח את האתר
2. לחץ "התחבר עם Google"
3. התחבר לחשבון Google
4. בדוק שההתחברות עובדת

## 🐛 פתרון בעיות

### אם ההתחברות לא עובדת:
1. **בדוק את הקונסול** (F12) - תראה הודעות שגיאה
2. **בדוק את קובץ .env** - וודא שה-Credentials נכונים
3. **בדוק את Google Console** - וודא שה-Redirect URI נכון
4. **נסה למחוק cookies** - לפעמים זה עוזר

### שגיאות נפוצות:
- `redirect_uri_mismatch` - ה-Redirect URI לא תואם ב-Google Console
- `invalid_client` - Client ID או Secret לא נכונים
- `access_denied` - המשתמש ביטל את ההרשאה

## 📝 הערות

- האתר עובד כמו אתר רגיל עם HTML/CSS/JS
- Vite הוא רק כלי פיתוח - אחרי `npm run build` תקבל קבצים סטטיים
- הקבצים ב-`dist/` יכולים להיות מועלים לכל שרת (Netlify, Vercel, וכו')

