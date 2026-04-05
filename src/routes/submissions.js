import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';
import { generateStudyReply } from '../lib/ai.js';
import { extractTextFromUpload } from '../lib/fileText.js';
import { pushNotification } from '../lib/notifier.js';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024) } });
async function hasActiveAccess(userId, criterion) {
  const approved = await prisma.payment.findFirst({ where: { userId, status: 'approved' }, orderBy: { approvedAt: 'desc' } });
  if (!approved) return { ok: false, payment: null };
  if (approved.plan === 'MONTHLY') return { ok: true, payment: approved };
  if (approved.plan === 'D') return { ok: ['P', 'M', 'D'].includes(criterion), payment: approved };
  if (approved.plan === 'M') return { ok: ['P', 'M'].includes(criterion), payment: approved };
  return { ok: approved.plan === 'P' && criterion === 'P', payment: approved };
}
router.post('/create', requireAuth, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'proof', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, criterion, details } = req.body;
    if (!title || !criterion || !details) return res.status(400).json({ error: 'الرجاء تعبئة كل الحقول الأساسية.' });
    const access = await hasActiveAccess(req.user.id, criterion);
    const mainFile = req.files?.file?.[0] || null;
    const proofFile = req.files?.proof?.[0] || null;
    const extractedText = await extractTextFromUpload(mainFile);
    let aiReply = access.ok
      ? `تم استلام طلبك بعنوان "${title}" وسيتم مراجعته من الفريق قريبًا. المعيار المطلوب: ${criterion}.`
      : `تم استلام طلبك بعنوان "${title}" لكن الدفع غير معتمد بعد. سيتم مراجعته بعد الاعتماد أو التواصل معك إذا لزم.`;
    try {
      if (process.env.OPENAI_API_KEY) {
        aiReply = await generateStudyReply({ mode: 'analysis', criterion, title, details, fileText: extractedText });
      }
    } catch (error) {
      console.error('AI submission fallback:', error?.message || error);
    }
    const submission = await prisma.submission.create({ data: { title, criterion, details, extractedText: extractedText || null, fileName: mainFile?.originalname || null, mimeType: mainFile?.mimetype || null, fileBytes: mainFile?.buffer || null, status: access.ok ? 'pending' : 'pending', aiReply, userId: req.user.id, paymentId: access.payment?.id || null } });
    if (proofFile) {
      await pushNotification(req.user.id, 'تم رفع إثبات التحويل', `تم رفع إثبات التحويل مع الطلب "${title}" وسيتم مراجعته.`);
    }
    await pushNotification(req.user.id, 'تم استلام الطلب', `تم استلام طلبك "${title}" بنجاح. الحالة الحالية: قيد المراجعة.`);
    res.json({ submission });
  } catch (err) {
    console.error('submission create failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر إرسال الطلب الآن. حاول مرة أخرى.' });
  }
});
router.get('/mine', requireAuth, async (req, res) => {
  const submissions = await prisma.submission.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ submissions });
});
router.get('/all', requireStaff, async (_req, res) => {
  const submissions = await prisma.submission.findMany({ include: { user: true, payment: true }, orderBy: { createdAt: 'desc' } });
  res.json({ submissions });
});
router.get('/:id/file', requireAuth, async (req, res) => {
  const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
  if (!submission) return res.status(404).json({ error: 'الملف غير موجود.' });
  const allowed = submission.userId === req.user.id || ['owner', 'admin', 'helper'].includes(req.user.role);
  if (!allowed) return res.status(403).json({ error: 'غير مصرح لك.' });
  if (!submission.fileBytes) return res.status(404).json({ error: 'لا يوجد ملف محفوظ.' });
  res.setHeader('Content-Type', submission.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(submission.fileName || 'file')}"`);
  res.send(Buffer.from(submission.fileBytes));
});
router.post('/:id/reply', requireStaff, async (req, res) => {
  const { reply, status } = req.body;
  const submission = await prisma.submission.update({ where: { id: req.params.id }, data: { aiReply: reply || null, status: status || undefined } });
  await pushNotification(submission.userId, 'تم تحديث طلبك', `تم تحديث حالة طلبك إلى: ${status || submission.status}. ${reply ? 'يوجد رد جديد داخل الطلب.' : ''}`);
  res.json({ submission });
});
export default router;
