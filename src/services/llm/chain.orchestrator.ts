/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateText } from './genai.client';
import { cvExtractionPrompt, cvScoringPrompt, projectEvalPrompt, refinePrompt } from './prompts';

export function safeJson<T = any>(s: string): T {
    try {
        return JSON.parse(s) as T;
    } catch {
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');

        if (start >= 0 && end > start) {
            return JSON.parse(s.slice(start, end + 1)) as T;
        }

        throw new Error('LLM did not return valid JSON');
  }
}

export async function extractCV(cvText: string) {
    const out = await generateText(cvExtractionPrompt(cvText), {
        temperature: 0.0,
        maxOutputTokens: 800
    });
    return safeJson(out);
}

export async function scoreCV(extracted: unknown, context: string) {
  const out = await generateText(cvScoringPrompt(extracted, context), {
    temperature: 0.0,
    maxOutputTokens: 500
  });

  return safeJson(out);
}

export async function evaluateProject(projectText: string, context: string) {
  const out = await generateText(projectEvalPrompt(projectText, context), {
    temperature: 0.0,
    maxOutputTokens: 500
  });
  
  return safeJson(out);
}

export async function refineSummary(cvScore: unknown, projectScore: unknown) {
  return generateText(refinePrompt(cvScore, projectScore), {
    temperature: 0.2,
    maxOutputTokens: 250
  });
}