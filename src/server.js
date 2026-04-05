import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './lib/prisma.js';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payments.js';
import submissionRoutes from './routes/submissions.js';
import consultationRoutes from './routes/consultations.js';
import staffRoutes from './routes/staff.js';
import chatRoutes from './routes/chat.js';
import notificationsRoutes from './routes/notifications.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'oh-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 } }));
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try { const user = await prisma.user.findUnique({ where: { id } }); done(null, user || false); }
  catch (error) { done(error); }
});
passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/google/callback` }, async (_access, _refresh, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('تعذر قراءة بريد Google.'));
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: profile.id }, { email }] } });
    const role = email.toLowerCase() === (process.env.OWNER_EMAIL || '').toLowerCase() ? 'owner' : (user?.role || 'client');
    if (!user) user = await prisma.user.create({ data: { googleId: profile.id, email, name: profile.displayName, avatar: profile.photos?.[0]?.value, role } });
    else user = await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.id, name: profile.displayName, avatar: profile.photos?.[0]?.value, role } });
    done(null, user);
  } catch (error) { done(error); }
}));
app.use('/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use(express.static(path.resolve(__dirname, '../public')));
app.get('/health', async (_req, res) => { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); });
app.use((err, _req, res, _next) => { console.error(err); if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `حجم الملف أكبر من الحد المسموح (${process.env.MAX_UPLOAD_MB || 10}MB).` }); res.status(500).json({ error: err?.message || 'حدث خطأ داخلي في الخادم.' }); });
const port = process.env.PORT || 3000;app.listen(port, '0.0.0.0', () => { console.log(`OH PostgreSQL running on ${port}`); });
