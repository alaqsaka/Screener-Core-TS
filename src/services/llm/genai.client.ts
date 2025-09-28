let client: any;
let textModelId: string;
let embModelId: string;

async function initClient() {
  if (client) return client;

  const { GoogleGenAI } = await import('@google/genai');

  const apiKey = process.env.GENAI_API_KEY;
  if (!apiKey) throw new Error('GENAI_API_KEY is missing');

  client = new GoogleGenAI({ apiKey });
  textModelId = process.env.LLM_MODEL || 'gemini-1.5-flash';
  embModelId = process.env.EMBEDDING_MODEL || 'text-embedding-004';

  return client;
}

function extractText(res: any): string {
  console.log('[extractText] Received full response object. Looking for text...');

  const candidates = res?.candidates;
  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    console.error('[extractText] Error: "candidates" array not found or empty in the response.');
    return '';
  }

  const content = candidates[0]?.content;
  if (!content) {
    console.error('[extractText] Error: "content" object not found in the first candidate.');
    return '';
  }

  const parts = content.parts || [];
  console.log('[extractText] Found parts:', JSON.stringify(parts, null, 2));

  const extracted = parts.map((p: any) => p.text || '').join('');
  console.log('[extractText] Final extracted text length:', extracted.length);
  return extracted;
}

export async function generateText(
  prompt: string,
  opts?: { temperature?: number; maxOutputTokens?: number }
) {
  console.log('generateText called with prompt length:', prompt.length, 'opts:', opts);
  const anyClient = await initClient();

  if (anyClient.models?.generateContent) {
    console.log('Using anyClient.models.generateContent');
    const res = await anyClient.models.generateContent({
      model: textModelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.0,
        maxOutputTokens: opts?.maxOutputTokens ?? 800
      }
    });
    console.log('Raw response from generateContent:', JSON.stringify(res, null, 2));
    return extractText(res);
  }

  if (typeof anyClient.getGenerativeModel === 'function') {
    console.log('Using anyClient.getGenerativeModel');
    const model = anyClient.getGenerativeModel({ model: textModelId });
    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.0,
        maxOutputTokens: opts?.maxOutputTokens ?? 800
      }
    });
    
    console.log('Raw response from generateContent:', JSON.stringify(res, null, 2));
    return extractText(res);
  }

  throw new Error('No compatible generateContent method found on @google/genai client');
}

export async function createEmbedding(input: string) {
  const anyClient = await initClient();

  if (anyClient.models?.embedContent) {
    const res = await anyClient.models.embedContent({
      model: embModelId,
      content: { parts: [{ text: input }] }
    });
    return res.embedding.values;
  }

  if (typeof anyClient.getGenerativeModel === 'function') {
    const model = anyClient.getGenerativeModel({ model: embModelId });
    const res = await model.embedContent({
      content: { parts: [{ text: input }] }
    });
    return res.embedding.values;
  }

  if (typeof anyClient.embedContent === 'function') {
    const res = await anyClient.embedContent({
      model: embModelId,
      content: { parts: [{ text: input }] }
    });
    return res.embedding.values;
  }

  throw new Error('No compatible embedContent method found on @google/genai client');
}