# OH PostgreSQL

نسخة مبنية على PostgreSQL + Google Login + Prisma + نظام إدارة + شات + إرسال ملفات + ردود AI.

## التشغيل المحلي
1. انسخ `.env.example` إلى `.env`
2. عدّل القيم المطلوبة
3. نفذ:

```bash
npm install
npx prisma generate
npx prisma db push
npm start
```

## متغيرات مهمة
- `DATABASE_URL` : رابط PostgreSQL
- `BASE_URL` : رابط الموقع
- `OWNER_EMAIL` : إيميل Google الذي يصبح owner
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`

## روابط مهمة
- `/login.html`
- `/dashboard.html`
- `/pricing.html`
- `/submit.html`
- `/consultations.html`
- `/chat.html`
- `/staff-login.html`
- `/oh-control.html`

## ملاحظات
- الإرسال لا يفتح إلا بعد وجود دفعة approved تغطي المعيار المطلوب.
- الملفات تُحفظ داخل قاعدة البيانات كـ bytes في هذه النسخة.
- إذا لم تضف `OPENAI_API_KEY` سيعطي النظام ردًا تجريبيًا بدل الرد الحقيقي.
