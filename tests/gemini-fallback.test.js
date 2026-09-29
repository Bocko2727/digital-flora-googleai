import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithModelFallback, uploadAiErrorResponse } from '../src/ai/gemini-fallback.js';

// generateWithModelFallback retries the primary model on Gemini 503 "high
// demand" errors and, only if that is exhausted, tries each fallback model
// once. `generate` is injected so no network call is made.

const PRIMARY = 'primary-model';
const FALLBACKS = ['fallback-a', 'fallback-b'];
const OPTIONS = { models: [PRIMARY, ...FALLBACKS], maxAttempts: 3, baseDelayMs: 0 };

function overloaded() {
  return new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}');
}

// Scripted stand-in for ai.models.generateContent: `script` maps a model name
// to a list of outcomes (an Error is thrown, anything else is returned).
function scripted(script) {
  const calls = [];
  const generate = async (params) => {
    calls.push(params.model);
    const outcomes = script[params.model] || [];
    const outcome = outcomes[Math.min(calls.filter((m) => m === params.model).length - 1, outcomes.length - 1)];
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
  return { generate, calls };
}

const silent = () => {
  const original = console.warn;
  console.warn = () => {};
  return () => { console.warn = original; };
};

test('returns the primary model response without touching fallbacks', async () => {
  const restore = silent();
  const { generate, calls } = scripted({ [PRIMARY]: [{ text: 'primary' }] });
  const response = await generateWithModelFallback(generate, { contents: 'x' }, OPTIONS);
  restore();
  assert.equal(response.text, 'primary');
  assert.deepEqual(calls, [PRIMARY]);
});

test('retries the primary model on 503 before giving up on it', async () => {
  const restore = silent();
  const { generate, calls } = scripted({ [PRIMARY]: [overloaded(), overloaded(), { text: 'third try' }] });
  const response = await generateWithModelFallback(generate, { contents: 'x' }, OPTIONS);
  restore();
  assert.equal(response.text, 'third try');
  assert.deepEqual(calls, [PRIMARY, PRIMARY, PRIMARY]);
});

test('falls back to the next model once the primary stays overloaded', async () => {
  const restore = silent();
  const { generate, calls } = scripted({ [PRIMARY]: [overloaded()], 'fallback-a': [{ text: 'from fallback' }] });
  const response = await generateWithModelFallback(generate, { contents: 'x' }, OPTIONS);
  restore();
  assert.equal(response.text, 'from fallback');
  assert.deepEqual(calls, [PRIMARY, PRIMARY, PRIMARY, 'fallback-a']);
});

test('tries each fallback only once and moves on when one is also unavailable', async () => {
  const restore = silent();
  const { generate, calls } = scripted({
    [PRIMARY]: [overloaded()],
    'fallback-a': [overloaded()],
    'fallback-b': [{ text: 'second fallback' }],
  });
  const response = await generateWithModelFallback(generate, { contents: 'x' }, OPTIONS);
  restore();
  assert.equal(response.text, 'second fallback');
  assert.deepEqual(calls, [PRIMARY, PRIMARY, PRIMARY, 'fallback-a', 'fallback-b']);
});

test('a broken fallback model does not hide the primary model error', async () => {
  const restore = silent();
  const primaryError = overloaded();
  const { generate } = scripted({
    [PRIMARY]: [primaryError],
    'fallback-a': [new Error('404 model not found')],
    'fallback-b': [overloaded()],
  });
  await assert.rejects(generateWithModelFallback(generate, { contents: 'x' }, OPTIONS), (error) => {
    restore();
    return error === primaryError;
  });
});

test('does not retry or fall back on non-overload errors such as a quota error', async () => {
  const restore = silent();
  const quota = new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}');
  const { generate, calls } = scripted({ [PRIMARY]: [quota], 'fallback-a': [{ text: 'should not run' }] });
  await assert.rejects(generateWithModelFallback(generate, { contents: 'x' }, OPTIONS), (error) => {
    restore();
    return error === quota;
  });
  assert.deepEqual(calls, [PRIMARY]);
});

test('upload response: an overload that survived every fallback is 503 AI_OVERLOADED', () => {
  const { status, body } = uploadAiErrorResponse(overloaded());
  assert.equal(status, 503);
  assert.equal(body.code, 'AI_OVERLOADED');
  assert.match(body.error, /ръчно/);
});

test('upload response: any other failure stays 502 AI_UNAVAILABLE', () => {
  const quota = new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}');
  for (const error of [quota, new SyntaxError('Unexpected token < in JSON'), new Error('API key should be set')]) {
    const { status, body } = uploadAiErrorResponse(error);
    assert.equal(status, 502);
    assert.equal(body.code, 'AI_UNAVAILABLE');
  }
});
