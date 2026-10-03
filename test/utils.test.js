'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJsonArray, normalizeRecipes } = require('../src/utils/json');
const { normalizePreferences, describePreferences, searchQueryFor, recipeMentions, excludedTerms } = require('../src/preferences');
const { normalizeBaseUrl } = require('../src/config');

test('extractJsonArray handles plain, fenced and prose-wrapped JSON', () => {
  assert.deepEqual(extractJsonArray('[{"title":"A"}]'), [{ title: 'A' }]);
  assert.deepEqual(extractJsonArray('Sure!\n```json\n[{"title":"B"}]\n```'), [{ title: 'B' }]);
  assert.deepEqual(extractJsonArray('Here you go: [{"title":"C"}] enjoy'), [{ title: 'C' }]);
  assert.deepEqual(extractJsonArray('{"title":"D"}'), [{ title: 'D' }]);
  assert.deepEqual(extractJsonArray('{"recipes":[{"title":"E"}]}'), [{ title: 'E' }]);
  assert.equal(extractJsonArray('no json here'), null);
});

test('normalizeRecipes drops invalid entries and coerces lists', () => {
  const out = normalizeRecipes([{ title: ' Soup ', ingredients: 'water', instructions: ['Boil', ''] }, { protein: 'x' }, null]);
  assert.deepEqual(out, [{ title: 'Soup', protein: '', ingredients: ['water'], instructions: ['Boil'] }]);
});

test('normalizePreferences clamps meals and splits lists', () => {
  const p = normalizePreferences({ numMeals: '12', avoid: 'peanuts, shellfish ,', maxMinutes: 'abc' });
  assert.equal(p.numMeals, 7);
  assert.deepEqual(p.avoid, ['peanuts', 'shellfish']);
  assert.equal(p.maxMinutes, null);
  assert.equal(normalizePreferences().numMeals, 3);
});

test('preferences become prompt text and search query', () => {
  const prefs = { diet: 'Vegetarian', cuisines: 'Thai', maxMinutes: 45, avoid: 'peanuts', notes: 'for two' };
  const text = describePreferences(prefs);
  assert.match(text, /Diet: Vegetarian/);
  assert.match(text, /Must avoid.*peanuts/);
  assert.match(text, /for two/);
  assert.equal(describePreferences({}), '');
  assert.match(searchQueryFor(prefs), /45-minute Vegetarian Thai dinner recipes.*without peanuts/);
});

test('recipeMentions matches whole words and plurals', () => {
  const r = { title: 'Eggplant Parm', protein: '', ingredients: ['2 tbsp peanuts', 'chicken broth'] };
  assert.equal(recipeMentions(r, 'egg'), false);
  assert.equal(recipeMentions(r, 'peanut'), true);
  assert.equal(recipeMentions(r, 'Chicken'), true);
  assert.ok(excludedTerms({ diet: 'Vegan' }).includes('cheese'));
  assert.deepEqual(excludedTerms({ avoid: 'kale' }), ['kale']);
});

test('normalizeBaseUrl adds a scheme and trims slashes', () => {
  assert.equal(normalizeBaseUrl('0.0.0.0:11434/'), 'http://0.0.0.0:11434');
  assert.equal(normalizeBaseUrl('https://example.com'), 'https://example.com');
  assert.equal(normalizeBaseUrl(''), 'http://127.0.0.1:11434');
});
