// Gemini 503 "high demand" handling shared by the AI routes in server.js.

export function isGeminiOverloadedError(err) {
  const msg = err && err.message ? String(err.message) : '';
  return /"code"\s*:\s*503/.test(msg) || /UNAVAILABLE/.test(msg) || /high demand|overloaded/i.test(msg);
}

// Retries the first model on transient 503 errors with exponential backoff
// (1s -> 2s), max `maxAttempts` attempts. If it is still overloaded, each
// remaining model is tried once with no backoff, so a Vercel function pays at
// most one extra request per fallback. Any other error (including 429
// quota-exhausted) is re-thrown at once — retrying it does not help. If every
// model is unavailable, the first model's error is thrown.
export async function generateWithModelFallback(generate, params, { models, maxAttempts = 3, baseDelayMs = 1000 }) {
  const [primary, ...fallbacks] = models;
  let primaryError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await generate({ ...params, model: primary });
    } catch (err) {
      if (!isGeminiOverloadedError(err)) throw err;
      primaryError = err;
      if (attempt === maxAttempts - 1) break;
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      console.warn(`Gemini 503 (опит ${attempt + 1}/${maxAttempts}) — retry след ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  for (const model of fallbacks) {
    try {
      console.warn(`Gemini ${primary} е претоварен — опит с ${model}...`);
      return await generate({ ...params, model });
    } catch (err) {
      console.warn(`Gemini ${model} също не отговори: ${err && err.message ? String(err.message).slice(0, 120) : err}`);
    }
  }
  throw primaryError;
}
