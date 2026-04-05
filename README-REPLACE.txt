استبدل هذه الملفات داخل مشروعك الحالي:

public/
- app.js
- styles.css
- index.html
- login.html
- dashboard.html
- pricing.html
- submit.html
- chat.html
- consultations.html
- oh-control.html
- staff-login.html

src/
- server.js

src/routes/
- auth.js
- payments.js
- submissions.js
- consultations.js
- chat.js
- staff.js

بعد الاستبدال:
1) احفظ كل الملفات
2) شغّل: npm start

مهم في .env:
OWNER_EMAIL="fahadcaocap@gmail.com"
LOCAL_PAYMENT_NUMBER="0795674778"
BASE_URL="http://localhost:3000"

إذا لم تضع OPENAI_API_KEY فلن يتعطل الموقع؛ سيعطي ردًا مؤقتًا بدل الانهيار.
