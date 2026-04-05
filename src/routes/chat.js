import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import { generateStudyReply } from '../lib/ai.js';
const router = Router();
router.get('/sessions', requireAuth, async (req, res) => {
  const sessions = await prisma.chatSession.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, include: { messages: { take: 1, orderBy: { createdAt: 'asc' } } } });
  res.json({ sessions });
});
router.post('/sessions', requireAuth, async (req, res) => {
  const { title } = req.body;
  const session = await prisma.chatSession.create({ data: { title: title || 'محادثة جديدة', userId: req.user.id } });
  res.json({ session });
});
router.get('/sessions/:id', requireAuth, async (req, res) => {
  const session = await prisma.chatSession.findUnique({ where: { id: req.params.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  if (!session || session.userId !== req.user.id) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
  res.json({ session });
});
router.post('/sessions/:id/message', requireAuth, async (req, res) => {
  const { content } = req.body;
  const session = await prisma.chatSession.findUnique({ where: { id: req.params.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  if (!session || session.userId !== req.user.id) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
  if (!content) return res.status(400).json({ error: 'اكتب رسالتك أولًا.' });
  await prisma.chatMessage.create({ data: { chatSessionId: session.id, role: 'user', content } });
  const updated = await prisma.chatSession.findUnique({ where: { id: session.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  let replyText = 'تم استلام رسالتك. الذكاء غير مفعل حاليًا، وسيتم الرد عليك لاحقًا أو بعد تفعيل الخدمة.';
  try {
    if (process.env.OPENAI_API_KEY) {
      replyText = await generateStudyReply({ mode: 'chat', details: content, chatHistory: updated.messages.slice(-12) });
    }
  } catch (error) {
    console.error('AI chat fallback:', error?.message || error);
  }
  const aiMessage = await prisma.chatMessage.create({ data: { chatSessionId: session.id, role: 'assistant', content: replyText } });
  res.json({ reply: aiMessage });
});
export default router;
