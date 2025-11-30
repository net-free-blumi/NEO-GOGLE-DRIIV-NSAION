# 🌐 מדריך הגדרת Netlify - CloudTunes Web

## ✅ מה מוכן:

- ✅ `netlify.toml` - קובץ הגדרות Netlify
- ✅ `web/public/_redirects` - redirects ל-SPA routing
- ✅ Build command: `npm run build`
- ✅ Output directory: `dist`

---

## 🚀 שלב 1: הכנה

### 1. ודא שיש לך קובץ `.env` ב-`web/`:

```bash
cd web
# העתק את ENV_EXAMPLE.txt ל-.env
Copy-Item ENV_EXAMPLE.txt .env
```

### 2. ערוך את `.env` והוסף את ה-Credentials:

```env
VITE_GOOGLE_CLIENT_ID=your-actual-client-id
VITE_GOOGLE_CLIENT_SECRET=your-actual-client-secret
```

---

## 📤 שלב 2: העלאה ל-Netlify

### שיטה 1: דרך GitHub (מומלץ)

1. **ודא שהקוד ב-GitHub:**
   ```bash
   git add .
   git commit -m "Add Netlify configuration"
   git push origin main
   ```

2. **לך ל-Netlify:**
   - https://app.netlify.com
   - לחץ **"Add new site"** → **"Import an existing project"**
   - בחר **"GitHub"** והרשא ל-Netlify לגשת ל-repo שלך
   - בחר את ה-repo: `NEO-GOGLE-DRIIV-NSAION`

3. **הגדר Build settings:**
   - **Base directory:** `web`
   - **Build command:** `npm run build` (אוטומטי מ-`netlify.toml`)
   - **Publish directory:** `dist` (אוטומטי מ-`netlify.toml`)

4. **הוסף Environment Variables:**
   - **Site settings** → **Environment variables**
   - לחץ **"Add variable"**
   - הוסף:
     - `VITE_GOOGLE_CLIENT_ID` = `your-client-id`
     - `VITE_GOOGLE_CLIENT_SECRET` = `your-client-secret`

5. **לחץ "Deploy site"**

---

### שיטה 2: דרך Netlify CLI

```bash
# התקן Netlify CLI
npm install -g netlify-cli

# התחבר ל-Netlify
netlify login

# עבור לתיקיית web
cd web

# Deploy
netlify deploy --prod
```

---

## ⚙️ שלב 3: הגדרת Google OAuth

### 1. לך ל-Google Cloud Console:
   - https://console.cloud.google.com/apis/credentials

### 2. עדכן את ה-Web Client ID:
   - בחר את ה-Web Client ID שלך
   - **Authorized redirect URIs** → הוסף:
     ```
     https://your-site-name.netlify.app/callback
     ```
   - שמור

---

## 🔍 בדיקה

לאחר ה-Deploy:

1. **פתח את האתר:** `https://your-site-name.netlify.app`
2. **בדוק התחברות:** לחץ "התחבר עם Google"
3. **אם יש שגיאה:** בדוק את ה-Logs ב-Netlify:
   - **Site overview** → **Deploys** → לחץ על ה-Deploy האחרון
   - **Functions log** או **Build log**

---

## 🐛 פתרון בעיות

### שגיאה: "Build failed"

**פתרון:**
- ודא ש-`Base directory` = `web`
- ודא ש-`Build command` = `npm run build`
- בדוק את ה-Logs ב-Netlify

### שגיאה: "Environment variables not found"

**פתרון:**
- ודא שהוספת את ה-Variables ב-Netlify Dashboard
- ודא שהשמות נכונים: `VITE_GOOGLE_CLIENT_ID` (לא `GOOGLE_CLIENT_ID`)

### שגיאה: "404 on routes"

**פתרון:**
- ודא ש-`_redirects` קיים ב-`web/public/`
- ודא ש-`netlify.toml` מכיל את ה-redirects

---

## ✅ Checklist

- [ ] קובץ `.env` קיים ב-`web/` עם credentials
- [ ] `netlify.toml` קיים ב-`web/`
- [ ] `_redirects` קיים ב-`web/public/`
- [ ] הקוד ב-GitHub
- [ ] Netlify מחובר ל-GitHub repo
- [ ] Base directory = `web`
- [ ] Environment variables מוגדרים ב-Netlify
- [ ] Redirect URI נוסף ב-Google Cloud Console

---

**🎉 עכשיו האתר יעבוד ב-Netlify!**

**💡 טיפ:** כל push ל-GitHub יגרום ל-Deploy אוטומטי ב-Netlify!

