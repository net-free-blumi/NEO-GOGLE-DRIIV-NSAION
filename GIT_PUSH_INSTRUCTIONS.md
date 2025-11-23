# הוראות העלאה ל-GitHub

## ✅ מה שנעשה

1. ✅ כל הקבצים החדשים נוספו ל-git
2. ✅ כל הקבצים הישנים נמחקו
3. ✅ Commit נוצר עם כל השינויים

## 🚀 העלאה ל-GitHub

### אם זה repository חדש:

```bash
# הוסף remote (החלף YOUR_USERNAME ו-REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# העלה את הקוד
git push -u origin main
```

### אם זה repository קיים:

```bash
# העלה את הקוד
git push origin main
```

או אם ה-branch נקרא אחרת:
```bash
git push origin master
```

## ⚠️ הערות חשובות

1. **Credentials לא יועלו** - הקובץ `app/src/main/res/values/credentials.xml` ב-`.gitignore`
2. **node_modules לא יועלו** - גם זה ב-`.gitignore`
3. **Build files לא יועלו** - כל הקבצים הזמניים ב-`.gitignore`

## 📝 מה יועלה

- ✅ כל קוד Kotlin
- ✅ כל קבצי Gradle
- ✅ כל ה-Resources (חוץ מ-credentials.xml)
- ✅ כל התיעוד (.md files)
- ✅ GitHub Actions workflows

## 🔒 אבטחה

**חשוב:** ודא ש-`credentials.xml` לא יועלה:
```bash
git check-ignore app/src/main/res/values/credentials.xml
```

אם זה מחזיר את הנתיב - הכל בסדר! ✅

