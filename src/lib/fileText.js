import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';

export async function extractTextFromUpload(file) {
  if (!file) return '';
  const mime = file.mimetype || '';
  const name = (file.originalname || '').toLowerCase();

  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
    return file.buffer.toString('utf8').slice(0, 30000);
  }

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const parsed = await pdfParse(file.buffer);
    return (parsed.text || '').slice(0, 30000);
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return (result.value || '').slice(0, 30000);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const wb = xlsx.read(file.buffer, { type: 'buffer' });
    const combined = wb.SheetNames.map((sheet) => {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 });
      return `ورقة: ${sheet}\n` + rows.map((r) => r.join(' | ')).join('\n');
    }).join('\n\n');
    return combined.slice(0, 30000);
  }

  return '';
}
