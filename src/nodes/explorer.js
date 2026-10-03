'use strict';
// Explorer node - searches web for recipes.
const { normalizePreferences, describePreferences, searchQueryFor } = require('../preferences');
const { extractJsonArray, normalizeRecipes } = require('../utils/json');

// Fetch enough web recipes to cover any shortfall from the local database.
const numWebRecipes = (prefs, localCount = prefs.numMeals) =>
  Math.max(1, Math.round(prefs.numMeals / 3), prefs.numMeals - localCount);

async function explorerNode(state, ctx) {
  const prefs = normalizePreferences(state.preferences);
  const count = numWebRecipes(prefs, (state.keepRecipes || []).length);
  const query = searchQueryFor(prefs);
  ctx.log('explorer', `Searching web: "${query}"`);

  let results = '';
  try {
    results = await ctx.search(query);
    ctx.log('explorer', results ? `Got ${results.split('\n').length} search results.` : 'Search returned no results.');
  } catch (err) {
    ctx.log('explorer', `Web search failed (${err.message}); falling back to LLM-only ideas.`, 'warn');
  }

  // extract recipes from search results
  ctx.log('explorer', 'Structuring web results as recipes...');
  const prefText = describePreferences(prefs);
  const prompt = `
    From these search results, extract ${count} recipe ideas and format as JSON.
    If the search results are empty, suggest ${count} recipe ideas of your own that fit the description.
    Return a JSON array with objects containing: title, protein, ingredients (list), instructions (list)
    ingredients should be simple items with measurements for the recipe
    instructions should be concise steps that can be followed to make the recipe
    ${prefText ? `\n    The recipes MUST respect these user preferences:\n${prefText}\n` : ''}
    Search results:
    ${results || '(none)'}

    Format:
    [
      {"title": "Recipe Name", "protein": "Protein Type", "ingredients": ["item1", "item2"], "instructions": ["step1", "step2"]},
      ...
    ]

    Return ONLY the JSON array, no other text.
    `;
  const response = await ctx.invokeLlm('explorer', prompt);

  const parsed = extractJsonArray(response);
  if (!parsed) {
    ctx.log('explorer', 'Failed to parse LLM response as JSON', 'error');
    return { internetRecipes: [] };
  }
  const recipes = normalizeRecipes(parsed);
  ctx.log('explorer', `Extracted ${recipes.length} recipes from web${recipes.length ? `: ${recipes.map((r) => r.title).join(', ')}` : ''}`);
  return { internetRecipes: recipes };
}

module.exports = { explorerNode, numWebRecipes };
