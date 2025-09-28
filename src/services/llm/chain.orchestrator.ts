import { generateText } from './genai.client';
import { cvExtractionPrompt, cvScoringPrompt, projectEvalPrompt, refinePrompt } from './prompts';

function safeJson<T = any>(s: string): T {
    console.log('safeJson called with string length:', s.length);
    try {
        return JSON.parse(s) as T;
    } catch {
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');

        if (start >= 0 && end > start) {
            return JSON.parse(s.slice(start, end + 1)) as T;
        }
        console.log('safeJson failed to parse JSON:', s);

        throw new Error('LLM did not return valid JSON');
  }
}

export async function extractCV(cvText: string) {
    console.log('extractCV called with cvText length:', cvText.length);
    const out = await generateText(cvExtractionPrompt(cvText), {
        temperature: 0.0,
        maxOutputTokens: 800
    });

    console.log('extractCV output:', out);
    return safeJson(out);
}

export async function scoreCV(extracted: unknown, jobDescription: string, rubric: any) {
  const out = await generateText(cvScoringPrompt(jobDescription, extracted, rubric), {
    temperature: 0.0,
    maxOutputTokens: 500
  });

  return safeJson(out);
}

export async function evaluateProject(projectText: string, jobDescription: string, rubric: any) {
  const out = await generateText(projectEvalPrompt(jobDescription, projectText, rubric), {
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