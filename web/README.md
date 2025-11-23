# CloudTunes Music Player - Web Version

גרסת Web לבדיקה עם לוגים מפורטים.

## התקנה

```bash
cd web
npm install
```

## הגדרת Credentials

צור קובץ `.env` בתיקיית `web/` עם ה-credentials שלך:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here
VITE_GOOGLE_CLIENT_SECRET=your-client-secret-here
```

ראה `.env.example` לדוגמה.

## הרצה

```bash
npm run dev
```

האתר יפתח ב-http://localhost:3000

## תכונות

- ✅ Google OAuth2 Login
- ✅ רשימת שירים מ-Google Drive
- ✅ לוגים מפורטים בקונסול
- ✅ Console Logger בתחתית המסך

## לוגים

כל הפעולות מתועדות בלוגים:
- בקונסול של הדפדפן (F12)
- בתחתית המסך (Console Logger)

## בדיקה

1. פתח את האתר
2. לחץ "התחבר עם Google"
3. התחבר לחשבון Google
4. בדוק את הלוגים - תראה בדיוק מה קורה בכל שלב
5. אם יש שגיאה, תראה אותה בלוגים

## Folder ID

הקוד משתמש ב-Folder ID: `1EhS3EzpK0dRK62v2V4YZuCLbcCrk6SN9`

## הערות

- זה גרסת בדיקה - לא מושלמת
- הלוגים יעזרו לזהות בעיות
- אחרי שנתקן את הבעיות, נוכל לשפר את האפליקציה
