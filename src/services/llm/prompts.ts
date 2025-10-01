export function cvExtractionPrompt(cvText: string) {
    return [
      'System: You are an extractor that returns only valid JSON. Do not write anything else.',
      'User: Extract the following CV into JSON with keys:',
      '{ "name": string|null, "email": string|null, "skills": string[], "experience_years": number,',
      '  "projects": [{ "title": string, "description": string, "tech_stack": string[], "role": string|null, "impact": string|null }] }',
      'Return strictly JSON.',
      '--- CV START ---',
      cvText,
      '--- CV END ---'
    ].join('\n');
}
  
export function cvScoringPrompt(extractedJson: unknown, context: string) {
    return [
      'System: Return only JSON with numeric scores 1..5 and short notes.',
      'User: Given the job requirements and the extracted CV JSON, produce:',
      '{ "technical_skills": number, "experience_level": number, "achievements": number, "cultural_fit": number, "notes": string }',
      'RELEVANT JOB REQUIREMENTS (use this context to score the candidate):',
      context,
      'EXTRACTED_CV_JSON:',
      JSON.stringify(extractedJson)
    ].join('\n');
}
  
export function projectEvalPrompt(projectText: string, context: string) {
  return [
    'System: Return ONLY raw JSON. Do not include explanations, text, or extra nesting.',
    'User: Evaluate the project report and respond exactly in this JSON shape (no outer keys, no arrays):',
    '{ "correctness": number, "code_quality": number, "resilience": number, "documentation": number, "creativity": number, "notes": string }',
    '',
    'RELEVANT JOB REQUIREMENTS (use this context to evaluate the project):',
    context,
    '--- PROJECT START ---',
    projectText,
    '--- PROJECT END ---'
  ].join('\n');
}
  
export function refinePrompt(cvScore: unknown, projectScore: unknown) {
    return [
      'System: Return only plain text (3-5 sentences).',
      'User: Produce an overall summary for a hiring reviewer based on these results.',
      'CV_SCORE_JSON:',
      JSON.stringify(cvScore),
      'PROJECT_SCORE_JSON:',
      JSON.stringify(projectScore)
    ].join('\n');
}