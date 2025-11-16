# הוראות התקנת Java 21

## למה צריך Java 21?
Java 25 תקין, אבל **Android Gradle Plugin** עדיין לא תומך בו. זה לא בעיה של התקנה - זו בעיית תאימות.

## שלבים:

### 1. הורד Java 21 LTS
- לך ל: https://adoptium.net/temurin/releases/?version=21
- בחר: **JDK 21 LTS** → **Windows** → **x64** → **.msi**
- הורד והתקן

### 2. מצא את הנתיב להתקנה
לאחר ההתקנה, הנתיב יהיה משהו כמו:
```
C:\Program Files\Eclipse Adoptium\jdk-21.0.1.12-hotspot
```

### 3. עדכן את gradle.properties
פתח את הקובץ: `android/gradle.properties`

מצא את השורה:
```properties
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.9.10-hotspot
```

הקובץ כבר מעודכן עם הנתיב הנכון! אם יש לך גרסה אחרת, עדכן את הנתיב בהתאם.

**חשוב:** השתמש ב-`\\` (backslash כפול) בנתיב!

### 4. נסה שוב
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## הערה:
אפשר להשאיר גם את Java 25 מותקן - Gradle ישתמש ב-Java 21 רק לבניית Android.




