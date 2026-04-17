import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';
import { pushNotification } from '../lib/notifier.js';

const router = Router();

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024
  }
});

function cleanText(value, max = 5000) {
  return String(value || '')
    .replace(/\0/g, '')
    .trim()
    .slice(0, max);
}

async function hasActiveAccess(userId, criterion) {
  const approved = await prisma.payment.findFirst({
    where: {
      userId,
      status: 'approved'
    },
    orderBy: {
      approvedAt: 'desc'
    }
  });

  if (!approved) {
    return { ok: false, payment: null };
  }

  if (approved.plan === 'MONTHLY') {
    return { ok: true, payment: approved };
  }

  if (approved.plan === 'D') {
    return { ok: ['P', 'M', 'D'].includes(criterion), payment: approved };
  }

  if (approved.plan === 'M') {
    return { ok: ['P', 'M'].includes(criterion), payment: approved };
  }

  return {
    ok: approved.plan === 'P' && criterion === 'P',
    payment: approved
  };
}

router.post(
  '/create',
  requireAuth,
  (req, res, next) => {
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'proof', maxCount: 1 }
    ])(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: `حجم الملف كبير جدًا. الحد الأقصى هو ${MAX_UPLOAD_MB} MB.`
          });
        }

        return res.status(400).json({
          error: 'فشل في رفع الملف. تحقق من الحجم أو النوع.'
        });
      }

      return res.status(400).json({
        error: err.message || 'تعذر رفع الملف.'
      });
    });
  },
  async (req, res) => {
    try {
      const title = cleanText(req.body.title, 160);
      const criterion = cleanText(req.body.criterion, 2).toUpperCase();
      const details = cleanText(req.body.details, 6000);

      if (!title || !criterion || !details) {
        return res.status(400).json({
          error: 'الرجاء تعبئة كل الحقول الأساسية.'
        });
      }

      if (!['P', 'M', 'D'].includes(criterion)) {
        return res.status(400).json({
          error: 'المعيار المحدد غير صحيح.'
        });
      }

      const access = await hasActiveAccess(req.user.id, criterion);
      const mainFile = req.files?.file?.[0] || null;
      const proofFile = req.files?.proof?.[0] || null;

      const submission = await prisma.submission.create({
        data: {
          title,
          criterion,
          details,
          extractedText: null,
          fileName: mainFile?.originalname || null,
          mimeType: mainFile?.mimetype || null,
          fileBytes: mainFile?.buffer || null,
          status: 'pending',
          aiReply: access.ok
            ? `تم استلام طلبك بعنوان "${title}" وسيتم مراجعته من الفريق قريبًا. المعيار المطلوب: ${criterion}.`
            : `تم استلام طلبك بعنوان "${title}" لكن الدفع غير معتمد بعد. سيتم مراجعته بعد الاعتماد أو التواصل معك إذا لزم.`,
          userId: req.user.id,
          paymentId: access.payment?.id || null
        }
      });

      await pushNotification(
        req.user.id,
        'تم استلام الطلب',
        `تم استلام طلبك "${title}" بنجاح. الحالة الحالية: قيد المراجعة.`
      );

      if (proofFile) {
        await pushNotification(
          req.user.id,
          'تم رفع إثبات التحويل',
          `تم رفع إثبات التحويل مع الطلب "${title}" وسيتم مراجعته.`
        );
      }

      return res.json({ submission });
    } catch (err) {
      console.error('submission create failed:', err?.message || err);
      return res.status(500).json({
        error: 'تعذر إرسال الطلب الآن. حاول مرة أخرى.'
      });
    }
  }
);

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({ submissions });
  } catch (err) {
    console.error('submissions mine failed:', err?.message || err);
    return res.status(500).json({
      error: 'تعذر تحميل الطلبات.'
    });
  }
});

router.get('/all', requireStaff, async (_req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        user: true,
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({ submissions });
  } catch (err) {
    console.error('submissions all failed:', err?.message || err);
    return res.status(500).json({
      error: 'تعذر تحميل كل الطلبات.'
    });
  }
});

router.get('/:id/file', requireAuth, async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!submission) {
      return res.status(404).json({
        error: 'الملف غير موجود.'
      });
    }

    const allowed =
      submission.userId === req.user.id ||
      ['owner', 'admin', 'helper'].includes(req.user.role);

    if (!allowed) {
      return res.status(403).json({
        error: 'غير مصرح لك.'
      });
    }

    if (!submission.fileBytes) {
      return res.status(404).json({
        error: 'لا يوجد ملف محفوظ.'
      });
    }

    res.setHeader('Content-Type', submission.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(submission.fileName || 'file')}"`
    );

    return res.send(Buffer.from(submission.fileBytes));
  } catch (err) {
    console.error('submission file failed:', err?.message || err);
    return res.status(500).json({
      error: 'تعذر تحميل الملف.'
    });
  }
});

router.post('/:id/reply', requireStaff, async (req, res) => {
  try {
    const reply = cleanText(req.body.reply, 7000);
    const status = cleanText(req.body.status, 20);

    const submission = await prisma.submission.update({
      where: {
        id: req.params.id
      },
      data: {
        aiReply: reply || null,
        status: status || undefined
      }
    });

    await pushNotification(
      submission.userId,
      'تم تحديث طلبك',
      `تم تحديث حالة طلبك إلى: ${status || submission.status}. ${reply ? 'يوجد رد جديد داخل الطلب.' : ''}`
    );

    return res.json({ submission });
  } catch (err) {
    console.error('submission reply failed:', err?.message || err);
    return res.status(500).json({
      error: 'تعذر حفظ الرد.'
    });
  }
});

export default router;