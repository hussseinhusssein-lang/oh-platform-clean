import OpenAI from 'openai';

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function fallbackReply({ mode, prompt }) {
  return `وضع العمل الحالي تجريبي لأن مفتاح OpenAI غير مضاف بعد.

النمط: ${mode}

المحتوى المستلم:
${prompt}

عند إضافة المفتاح سيظهر هنا رد مفصل وتحليل منظم وخطوات تنفيذ واضحة.`;
}

export async function generateStudyReply({ mode, criterion, title, details, fileText, chatHistory = [] }) {
  const safePrompt = [
    title ? `العنوان: ${title}` : '',
    criterion ? `المعيار: ${criterion}` : '',
    details ? `التفاصيل: ${details}` : '',
    fileText ? `نص الملف المستخرج:\n${fileText}` : ''
  ].filter(Boolean).join('\n\n');

  if (!client) return fallbackReply({ mode, prompt: safePrompt || details || '' });

  const system = mode === 'chat'
    ? `أنت مساعد دراسي عربي متقدم داخل منصة OH.
هدفك شرح المطلوب بدقة، وتقسيمه إلى خطوات واضحة، وتحليل المعايير P/M/D عند الحاجة، وتقديم توجيه مفصل ومنظم جدًا.
لا تدّعِ أنك شخص حقيقي. لا تقل إنك "مهندس". كن مباشرًا وعمليًا، وركّز على الشرح والفهم.`
    : `أنت محلل دراسي عربي متقدم داخل منصة OH.
اقرأ وصف الطلب والملف المرفوع بدقة، ثم:
1) استخرج المطلوب كاملًا.
2) حدّد النقاط المهمة.
3) أعطِ شرحًا مفصلًا جدًا.
4) إن وُجد معيار ${criterion || ''} فركّز عليه فقط.
5) أعطِ بنية مقترحة، وخطوات تنفيذ، وملاحظات تحسين، وتحذير من أي نقص.`;

  const input = [
    { role: 'system', content: system },
    ...chatHistory.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: safePrompt || details || title || 'ابدأ الشرح.' }
  ];

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input
  });

  return response.output_text || 'لم يتم إنشاء رد.';
}
