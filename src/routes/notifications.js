import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { getNotifications, markNotificationsRead } from '../lib/notifier.js';
const router = Router();
router.get('/mine', requireAuth, async (req, res) => {
  res.json({ notifications: await getNotifications(req.user.id) });
});
router.post('/mark-read', requireAuth, async (req, res) => {
  await markNotificationsRead(req.user.id);
  res.json({ ok: true });
});
export default router;
