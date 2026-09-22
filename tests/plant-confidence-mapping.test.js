import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSupabaseConfidence } from '../src/db/plants.js';

test('maps raw numeric AI scores to AI-suggestion labels, never "Потвърдено"', () => {
  assert.equal(mapSupabaseConfidence('0.92'), 'Вероятно (AI 92%)');
  assert.equal(mapSupabaseConfidence('0.4'), 'Вероятно (AI 40%)');
  assert.equal(mapSupabaseConfidence('0.3'), 'Неопределимо (AI 30%)');
});

test('maps AI-generated archive labels with explicit AI provenance', () => {
  assert.equal(mapSupabaseConfidence('high'), 'Вероятно (Ботанически архив, AI висока увереност)');
  assert.equal(mapSupabaseConfidence('medium'), 'Вероятно (Ботанически архив, AI)');
  assert.equal(mapSupabaseConfidence('low'), 'Неопределимо (Ботанически архив, AI)');
});

test('is idempotent: a displayed label saved back by the editor round-trips unchanged', () => {
  for (const raw of ['0.92', '0.3', 'high', 'medium', 'low', 'Потвърдено', 'Вероятно (AI Анализ)']) {
    const displayed = mapSupabaseConfidence(raw);
    assert.equal(mapSupabaseConfidence(displayed), displayed, `round-trip changed ${raw}`);
  }
});

test('downgrades legacy AI/archive "Потвърдено" labels but keeps editor-confirmed ones', () => {
  assert.equal(mapSupabaseConfidence('Потвърдено (AI 92%)'), 'Вероятно (AI 92%)');
  assert.equal(mapSupabaseConfidence('Потвърдено (Ботанически архив)'), 'Вероятно (Ботанически архив)');
  assert.equal(mapSupabaseConfidence('Потвърдено'), 'Потвърдено');
  assert.equal(mapSupabaseConfidence('Потвърдено — проверено от редактор'), 'Потвърдено — проверено от редактор');
});

test('empty or unknown confidence falls back to a neutral label', () => {
  assert.equal(mapSupabaseConfidence(null), 'Вероятно');
  assert.equal(mapSupabaseConfidence(''), 'Вероятно');
});
