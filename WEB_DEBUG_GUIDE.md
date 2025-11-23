# מדריך לבדיקה עם גרסת Web

## 🎯 למה זה?

האפליקציה נבנית אבל "מסתובבת" אחרי התחברות. גרסת Web תאפשר:
- ✅ לראות לוגים מפורטים
- ✅ לזהות שגיאות
- ✅ לבדוק את זרימת OAuth
- ✅ לבדוק את Google Drive API

## 🚀 התקנה והרצה

```bash
cd web
npm install
npm run dev
```

האתר יפתח ב-http://localhost:3000

## 📋 מה לבדוק

1. **פתח את האתר** - תראה מסך התחברות
2. **לחץ "התחבר עם Google"** - בדוק את הלוגים:
   - האם נוצר auth URL?
   - האם יש redirect?
3. **אחרי התחברות** - בדוק:
   - האם קיבלנו authorization code?
   - האם החלפנו אותו ל-access token?
   - האם טענו שירים מ-Google Drive?
4. **בדוק את Console Logger** בתחתית המסך - כל הלוגים שם

## 🔍 מה לחפש בלוגים

### שגיאות נפוצות:

1. **"No authorization code received"**
   - הבעיה: OAuth callback לא מקבל code
   - פתרון: בדוק redirect URI ב-Google Cloud Console

2. **"Token exchange failed"**
   - הבעיה: לא מצליח להחליף code ל-token
   - פתרון: בדוק Client ID/Secret

3. **"Drive API error: 401"**
   - הבעיה: Access token לא תקין
   - פתרון: בדוק token refresh

4. **"Drive API error: 403"**
   - הבעיה: אין הרשאות
   - פתרון: בדוק scopes

## 📝 אחרי שזיהינו את הבעיה

1. תתקן את הבעיה ב-Web version
2. נבדוק שזה עובד
3. נתקן את אותה בעיה ב-Android app

## 🎉 יתרונות

- ✅ לוגים מפורטים
- ✅ קל לבדוק
- ✅ אין צורך ב-Android Studio
- ✅ רץ בדפדפן

## ⚠️ הערות

- זה גרסת בדיקה - לא מושלמת
- אחרי שנתקן את הבעיות, נוכל לשפר את האפליקציה

