import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';
import { generateStudyReply } from '../lib/ai.js';
import { pushNotification } from '../lib/notifier.js';
const router = Router();
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'اكتب العنوان والرسالة.' });
    let aiReply = 'تم استلام الاستشارة وسيتم الرد عليها من الفريق قريبًا.';
    try {
      if (process.env.OPENAI_API_KEY) {
        aiReply = await generateStudyReply({ mode: 'chat', title, details: message });
      }
    } catch (error) {
      console.error('AI consultation fallback:', error?.message || error);
    }
    const consultation = await prisma.consultation.create({ data: { title, message, aiReply, userId: req.user.id } });
    await pushNotification(req.user.id, 'تم استلام الاستشارة', `تم استلام استشارتك بعنوان "${title}" وسيتم الرد عليك قريبًا.`);
    res.json({ consultation });
  } catch (err) {
    console.error('consultation create failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر إرسال الاستشارة الآن. حاول مرة أخرى.' });
  }
});
router.get('/mine', requireAuth, async (req, res) => {
  const consultations = await prisma.consultation.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ consultations });
});
router.get('/all', requireStaff, async (_req, res) => {
  const consultations = await prisma.consultation.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
  res.json({ consultations });
});
router.post('/:id/reply', requireStaff, async (req, res) => {
  const { reply } = req.body;
  const consultation = await prisma.consultation.update({ where: { id: req.params.id }, data: { aiReply: reply || null } });
  await pushNotification(consultation.userId, 'تم الرد على الاستشارة', 'تم إرسال رد جديد على استشارتك. افتح حسابك لمراجعته.');
  res.json({ consultation });
});
export default router;
