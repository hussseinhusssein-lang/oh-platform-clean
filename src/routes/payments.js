import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';
import { pushNotification } from '../lib/notifier.js';
const router = Router();
const defaultPrices = { P: 4, M: 6, D: 8, MONTHLY: 45 };
const localPaymentNumber = process.env.LOCAL_PAYMENT_NUMBER || '0795674778';
async function getPrices() {
  const settings = await prisma.setting.findMany({ where: { key: { in: ['price_p', 'price_m', 'price_d', 'price_monthly'] } } });
  const map = Object.fromEntries(settings.map((s) => [s.key, Number(s.value)]));
  return { P: map.price_p || defaultPrices.P, M: map.price_m || defaultPrices.M, D: map.price_d || defaultPrices.D, MONTHLY: map.price_monthly || defaultPrices.MONTHLY };
}
function makeReference() { return `PAY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`; }
router.get('/prices', async (_req, res) => res.json(await getPrices()));
router.get('/info', async (_req, res) => res.json({ localPaymentNumber, methods: ['CliQ', 'ZainCash', 'OrangeMoney'] }));
router.post('/create', requireAuth, async (req, res) => {
  try {
    const prices = await getPrices();
    const { plan, method } = req.body;
    const amountJOD = prices[plan];
    if (!amountJOD) return res.status(400).json({ error: 'الخطة غير صحيحة.' });
    if (!['CliQ', 'ZainCash', 'OrangeMoney'].includes(method)) return res.status(400).json({ error: 'طريقة الدفع غير صحيحة.' });
    const payment = await prisma.payment.create({ data: { plan, amountJOD, method, reference: makeReference(), userId: req.user.id } });
    await pushNotification(req.user.id, 'تم إنشاء طلب الدفع', `تم إنشاء طلب دفع جديد للخطة ${plan} بقيمة ${amountJOD} د.أ. المرجع: ${payment.reference}.`);
    res.json({ payment, localPaymentNumber });
  } catch (err) {
    console.error('payment create failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر إنشاء الطلب الآن. حاول مرة أخرى.' });
  }
});
router.get('/mine', requireAuth, async (req, res) => {
  const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ payments });
});
router.get('/all', requireStaff, async (_req, res) => {
  const payments = await prisma.payment.findMany({ include: { user: true, approvedBy: true }, orderBy: { createdAt: 'desc' } });
  res.json({ payments });
});
router.post('/:id/approve', requireStaff, async (req, res) => {
  const payment = await prisma.payment.update({ where: { id: req.params.id }, data: { status: 'approved', approvedAt: new Date(), approvedById: req.user.id } });
  await pushNotification(payment.userId, 'تم اعتماد الدفع', `تم اعتماد دفعتك للخطة ${payment.plan}. يمكنك الآن إرسال الملف أو متابعة التنفيذ.`);
  res.json({ payment });
});
router.post('/:id/reject', requireStaff, async (req, res) => {
  const payment = await prisma.payment.update({ where: { id: req.params.id }, data: { status: 'rejected' } });
  await pushNotification(payment.userId, 'تم رفض الدفع', `تم رفض دفعتك الحالية. راجع صورة التحويل أو تواصل معنا للمساعدة.`);
  res.json({ payment });
});
router.post('/prices/save', requireStaff, async (req, res) => {
  if (!['owner', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'هذه العملية غير متاحة لك.' });
  const { P, M, D, MONTHLY } = req.body;
  const entries = [['price_p', P], ['price_m', M], ['price_d', D], ['price_monthly', MONTHLY]];
  await Promise.all(entries.map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } })));
  res.json({ ok: true, prices: await getPrices() });
});
export default router;
