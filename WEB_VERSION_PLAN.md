# תוכנית ליצירת גרסת Web

## 🎯 אפשרויות

### אפשרות 1: Web App נפרד (מומלץ)
- תיקייה נפרדת: `web/`
- React + TypeScript
- משתמש באותם Google Drive credentials
- עיצוב דומה לאפליקציית Android
- ניתן לפרוס ב-Netlify/Vercel

### אפשרות 2: Capacitor (Hybrid)
- הוסיף Capacitor לפרויקט Android
- יוצר Web version מאותו קוד
- אבל Jetpack Compose לא עובד ב-Web
- צריך לכתוב UI מחדש

### אפשרות 3: שמירת שני פרויקטים
- `android/` - Android app
- `web/` - Web app
- שיתוף לוגיקה דרך shared library (אם אפשר)

## 💡 המלצה

**אפשרות 1** - הכי פשוט ויעיל:
- פרויקט Web נפרד ב-React
- משתמש באותם credentials
- עיצוב דומה
- קל לפרוס

## 📋 מה צריך ליצור

1. **פרויקט React + TypeScript**
   - Vite או Create React App
   - Google OAuth2 integration
   - Google Drive API
   - Music player עם HTML5 Audio

2. **עיצוב דומה**
   - Dark theme
   - UI דומה לאפליקציית Android
   - Responsive design

3. **תכונות זהות**
   - Login עם Google
   - רשימת שירים מ-Google Drive
   - סטרימינג מוזיקה
   - Player controls

## 🚀 צעדים

1. ליצור `web/` directory
2. להגדיר React project
3. להוסיף Google OAuth2
4. להוסיף Google Drive API
5. ליצור Music Player
6. לפרוס ב-Netlify

רוצה שאתחיל ליצור את זה?

