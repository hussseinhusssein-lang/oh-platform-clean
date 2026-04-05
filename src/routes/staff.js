import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireStaff, requireOwner } from '../lib/auth.js';
const router = Router();
router.get('/users', requireStaff, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ users });
});
router.post('/role', requireOwner, async (req, res) => {
  const { userId, role } = req.body;
  if (!['client', 'helper', 'admin', 'owner'].includes(role)) return res.status(400).json({ error: 'الدور غير صحيح.' });
  const user = await prisma.user.update({ where: { id: userId }, data: { role } });
  res.json({ user });
});
router.get('/stats', requireStaff, async (_req, res) => {
  const [users, payments, submissions, consultations] = await Promise.all([
    prisma.user.count(), prisma.payment.count(), prisma.submission.count(), prisma.consultation.count()
  ]);
  res.json({ stats: { users, payments, submissions, consultations } });
});
export default router;
