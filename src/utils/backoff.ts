export async function withBackoff<T>(fn: () => Promise<T>, attempts = 4, baseMs = 500): Promise<T> {
  console.log(`[BACKOFF] Starting withBackoff: attempts=${attempts}, baseMs=${baseMs}`);
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    console.log(`[BACKOFF] Attempt ${i + 1} of ${attempts}`);
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break; 
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 150);
      console.log(`[BACKOFF] Attempt ${i + 1} failed: ${e}. Retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}