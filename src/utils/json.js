'use strict';
// Helpers for pulling structured recipe data out of free-form LLM responses.

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// LLMs often wrap JSON in prose or ``` fences; find the array (or object) inside.
function extractJsonArray(response) {
  const text = String(response || '').trim();
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));

  for (const candidate of candidates) {
    const parsed = tryParse(candidate);
    if (parsed === undefined || parsed === null) continue;
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object') {
      const nested = Object.values(parsed).find(Array.isArray);
      return parsed.title ? [parsed] : nested || [parsed];
    }
  }
  return null;
}

const toStringList = (value) =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' ? Object.values(item).join(' ') : String(item)))
    .map((item) => item.trim())
    .filter(Boolean);

function normalizeRecipes(list) {
  return (list || [])
    .filter((r) => r && typeof r === 'object' && r.title)
    .map((r) => ({
      title: String(r.title).trim(),
      protein: r.protein ? String(r.protein).trim() : '',
      ingredients: toStringList(r.ingredients),
      instructions: toStringList(r.instructions),
    }));
}

module.exports = { extractJsonArray, normalizeRecipes };
