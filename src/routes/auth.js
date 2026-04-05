import { Router } from 'express';
import passport from 'passport';
const router = Router();
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login.html' }), (req, res) => {
  if (['owner', 'admin', 'helper'].includes(req.user.role)) return res.redirect('/oh-control.html');
  return res.redirect('/dashboard.html');
});
router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});
router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});
export default router;
