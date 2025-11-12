# פתרון בעיית Java 25

## הבעיה:
```
Unsupported class file major version 69
```

זה אומר ש-Java 25 (class file version 69) לא נתמך על ידי Android Gradle Plugin הנוכחי.

## פתרון - הורדת Java 17 או 21:

### אפשרות 1: הורדת Java 21 (מומלץ - LTS)
1. הורד מ: https://adoptium.net/temurin/releases/?version=21
2. בחר: **JDK 21 LTS** (Windows x64)
3. התקן
4. הגדר את `JAVA_HOME`:
   ```powershell
   # בדוק איפה Java מותקנת
   where java
   
   # הגדר JAVA_HOME (החלף בנתיב הנכון)
   [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot', 'User')
   ```

### אפשרות 2: הורדת Java 17 (LTS ישן יותר)
1. הורד מ: https://adoptium.net/temurin/releases/?version=17
2. בחר: **JDK 17 LTS** (Windows x64)
3. התקן
4. הגדר את `JAVA_HOME` (כמו למעלה)

### אפשרות 3: שימוש ב-Java של Android Studio
Android Studio כולל JDK מובנה. אפשר להשתמש בו:
1. פתח Android Studio
2. File → Settings → Build, Execution, Deployment → Build Tools → Gradle
3. בחר "Gradle JDK" → בחר את ה-JDK של Android Studio

## אחרי ההורדה:
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## הערה:
Java 25 זה מאוד חדש (2025), ו-Android Gradle Plugin עדיין לא תומך בו. Java 21 או 17 הם הבחירות הטובות ביותר.

