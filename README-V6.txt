OH v6 - نسخة جاهزة للاستبدال

استبدل داخل مشروعك:
- public/
- src/
- data/ (اختياري - سيُنشأ تلقائيًا)
- DEPLOY-RENDER-DOMAIN.txt للشرح

مطلوب في .env:
OWNER_EMAIL="fahadcaocap@gmail.com"
LOCAL_PAYMENT_NUMBER="0795674778"
BASE_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
SESSION_SECRET="..."
DATABASE_URL="..."

بعد الاستبدال:
npm start

هذه النسخة تضيف:
- FAQ
- طريقة الاستخدام
- صفحة تواصل
- إشعارات داخلية
- فلترة وبحث في لوحة الإدارة
- رد على الطلبات والاستشارات
- رفع إثبات تحويل بصري
- هوية بصرية ولوجو
- دليل نشر Render وربط دومين
