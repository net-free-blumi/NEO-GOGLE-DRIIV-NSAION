# מדריך פריסה - CloudTunes

## הבעיה עם UPnP/DLNA Discovery

UPnP/DLNA discovery דורש גישה לרשת המקומית (SSDP - Simple Service Discovery Protocol), וזה **לא עובד** מ-Netlify או שירותי cloud אחרים כי:
- SSDP דורש multicast ברשת המקומית
- שירותי cloud לא יכולים לגשת לרשת המקומית שלך
- זה דורש שרת שרץ ברשת המקומית

## פתרונות חינמיים

### פתרון 1: Chromecast SDK (עובד ב-Netlify) ✅
- **חינמי** - Google Cast SDK חינמי
- **עובד ב-Netlify** - לא דורש שרת
- **מוגבל** - דורש user interaction (picker)
- **תמיכה** - Chromecast, Smart TVs עם Cast, וכו'

### פתרון 2: שרת מקומי (עובד רק בפיתוח) ⚠️
- **חינמי** - Node.js חינמי
- **עובד רק מקומית** - צריך להריץ במחשב שלך
- **תמיכה מלאה** - UPnP/DLNA, טלוויזיות חכמות, וכו'

**איך להריץ:**
```bash
npm run dev:all
```

זה יריץ:
- שרת frontend על פורט 3000
- שרת backend על פורט 3001 (עם UPnP discovery)

### פתרון 3: שירות חינמי חיצוני (מומלץ) 🌟
יש שירותים חינמיים שיכולים לעזור:
- **BubbleUPnP Server** - שרת חינמי שרץ על המחשב שלך
- **UPnP Browser Extension** - הרחבה לדפדפן

## המלצה

**לשימוש ב-Netlify:**
- השתמש ב-Chromecast SDK (כבר מובנה)
- זה יעבוד עם Chromecast, Smart TVs, וכו'
- זה דורש user interaction (picker) אבל זה הפתרון הטוב ביותר

**לשימוש מקומי:**
- הרץ `npm run dev:all`
- זה יאפשר גילוי מלא של כל המכשירים ברשת

## איך זה עובד עכשיו

1. **ב-Netlify** - Chromecast SDK עובד (דורש picker)
2. **מקומי** - UPnP/DLNA discovery עובד (דורש שרת מקומי)

## הערות

- Chromecast SDK **חינמי** ו**עובד ב-Netlify**
- UPnP/DLNA discovery **חינמי** אבל **דורש שרת מקומי**
- אין פתרון חינמי מלא שיעבוד ב-Netlify עם גילוי אוטומטי מלא

