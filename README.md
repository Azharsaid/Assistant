# Life OS Assistant V2

نسخة static جاهزة للعمل على GitHub Pages بدون Node.js أو npm.

## الملفات
- `index.html` الصفحة الرئيسية
- `styles.css` التصميم
- `app.js` المنطق والربط مع Firebase
- `firebase-config.js` إعدادات Firebase
- `firestore.rules` قواعد Firestore المقترحة
- `manifest.webmanifest` و `service-worker.js` لأساسيات PWA

## النشر على GitHub Pages
1. ارفع كل الملفات إلى الريبو.
2. تأكد أن الصفحة الرئيسية اسمها `index.html`.
3. من GitHub > Settings > Pages:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/root`
4. بعد ظهور الرابط أضف دومين GitHub Pages إلى:
   - Firebase Authentication > Settings > Authorized domains

## Firebase
- فعّل Email/Password في Authentication.
- فعّل Firestore Database.
- استبدل قواعد Firestore بالقواعد الموجودة في `firestore.rules`.

## الموديولات
- Dashboard
- Expenses
- Appointments
- Tasks
- Habits
- Goals
- Notes
- Shopping
- Journal / Mood / Water
- AI Insights
- Settings

