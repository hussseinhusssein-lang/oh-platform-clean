export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'يرجى تسجيل الدخول أولًا.' });
  next();
}

export function requireStaff(req, res, next) {
  if (!req.user || !['owner', 'admin', 'helper'].includes(req.user.role)) {
    return res.status(403).json({ error: 'غير مصرح لك بالدخول.' });
  }
  next();
}

export function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'هذه الصفحة مخصصة للمالك فقط.' });
  }
  next();
}
