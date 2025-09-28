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
  const candidates = res?.candidates;
  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    console.error('[extractText] Error: "candidates" array not found or empty in the response.', res);
    return '';
  }
  const content = candidates[0]?.content;
  if (!content) {
    console.error('[extractText] Error: "content" object not found in the first candidate.');
    return '';
  }
  const parts = content.parts || [];
  const extracted = parts.map((p: any) => p.text || '').join('');
  return extracted;
}

export async function generateText(
  prompt: string,
  opts?: { temperature?: number; maxOutputTokens?: number }
) {
  const anyClient = await initClient();

  if (anyClient.models?.generateContent) {
    const res = await anyClient.models.generateContent({
      model: textModelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.0,
        maxOutputTokens: opts?.maxOutputTokens ?? 800
      }
    });
    return extractText(res);
  }

  if (typeof anyClient.getGenerativeModel === 'function') {
    const model = anyClient.getGenerativeModel({ model: textModelId });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.0,
        maxOutputTokens: opts?.maxOutputTokens ?? 800
      }
    });
    return extractText(result.response);
  }

  throw new Error('No compatible generateContent method found on @google/genai client');
}

export async function createEmbedding(
  input: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
) {
  const anyClient = await initClient();

  if (anyClient.models?.embedContent) {
    const res = await anyClient.models.embedContent({
      model: embModelId,
      taskType,
      contents: [{ text: input }]
    });

    const embedding = res.embeddings?.[0]?.values ?? res.embedding?.values;
    if (!embedding) {
      throw new Error("Failed to create embedding. Response did not contain values.");
    }

    return embedding;
  }

  throw new Error(
    'No compatible embedContent method found on @google/genai client. Expected client.models.embedContent'
  );
}
