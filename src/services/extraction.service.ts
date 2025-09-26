import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === 'application/pdf') {
    const data = await pdf(file.buffer);
    return data.text || '';
  }
  if (
    file.mimetype ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return value || '';
  }
  return file.buffer.toString('utf8');
}