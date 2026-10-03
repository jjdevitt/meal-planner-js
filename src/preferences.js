'use strict';
// Normalizes the user's meal preferences and turns them into prompt/search text.

const DEFAULT_NUM_MEALS = 3;
const MAX_NUM_MEALS = 7;

const splitList = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item).trim())
    .filter(Boolean);

function normalizePreferences(raw = {}) {
  const numMeals = Number.parseInt(raw.numMeals, 10);
  const maxMinutes = Number.parseInt(raw.maxMinutes, 10);
  return {
    diet: String(raw.diet || '').trim(),
    avoid: splitList(raw.avoid),
    cuisines: splitList(raw.cuisines),
    maxMinutes: Number.isFinite(maxMinutes) && maxMinutes > 0 ? maxMinutes : null,
    numMeals: Number.isFinite(numMeals) ? Math.min(Math.max(numMeals, 1), MAX_NUM_MEALS) : DEFAULT_NUM_MEALS,
    notes: String(raw.notes || '').trim(),
  };
}

function describePreferences(prefs) {
  const p = normalizePreferences(prefs);
  const lines = [];
  if (p.diet) lines.push(`- Diet: ${p.diet}`);
  if (p.avoid.length) lines.push(`- Must avoid (allergies/dislikes): ${p.avoid.join(', ')}`);
  if (p.cuisines.length) lines.push(`- Favorite cuisines: ${p.cuisines.join(', ')}`);
  if (p.maxMinutes) lines.push(`- Max cooking time: ${p.maxMinutes} minutes`);
  if (p.notes) lines.push(`- Notes: ${p.notes}`);
  return lines.join('\n');
}

function searchQueryFor(prefs) {
  const p = normalizePreferences(prefs);
  const minutes = p.maxMinutes || 30;
  return [
    'healthy',
    `${minutes}-minute`,
    p.diet,
    p.cuisines.join(' '),
    'dinner recipes no processed foods fresh protein',
    p.avoid.length ? `without ${p.avoid.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const MEAT = ['chicken', 'beef', 'pork', 'bacon', 'sausage', 'turkey', 'lamb', 'ham', 'steak', 'veal', 'duck', 'prosciutto', 'pancetta', 'chorizo', 'pepperoni', 'salami', 'meatball', 'ground meat', 'gelatin'];
const SEAFOOD = ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'anchovy', 'anchovies', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'fish sauce'];
const ANIMAL_PRODUCTS = ['egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'ricotta', 'ghee'];

// Ingredients a recipe must not mention for a given diet (used to pre-filter local recipes).
const DIET_EXCLUSIONS = {
  vegetarian: [...MEAT, ...SEAFOOD],
  vegan: [...MEAT, ...SEAFOOD, ...ANIMAL_PRODUCTS],
  pescatarian: MEAT,
};

function excludedTerms(prefs) {
  const p = normalizePreferences(prefs);
  return [...(DIET_EXCLUSIONS[p.diet.toLowerCase()] || []), ...p.avoid];
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word, case-insensitive match that also catches simple plurals ("peanut" -> "peanuts").
function recipeMentions(recipe, term) {
  const pattern = new RegExp(`\\b${escapeRegExp(term.trim())}(s|es)?\\b`, 'i');
  return pattern.test([recipe.title, recipe.protein, ...(recipe.ingredients || [])].join(' '));
}

module.exports = {
  DEFAULT_NUM_MEALS,
  MAX_NUM_MEALS,
  normalizePreferences,
  describePreferences,
  searchQueryFor,
  recipeMentions,
  excludedTerms,
};
