'use strict';
// Planner node - designs the meal plan.
const { normalizePreferences, describePreferences } = require('../preferences');
const { extractJsonArray } = require('../utils/json');

const summarize = ({ title, protein, ingredients = [] }) => ({ title, protein, ingredients });
const simplify = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Map an LLM pick (a title, or a recipe object) back to one of the candidate recipes.
function matchRecipe(pick, candidates) {
  const title = simplify(typeof pick === 'string' ? pick : pick?.title);
  if (!title) return null;
  return (
    candidates.find((r) => simplify(r.title) === title) ||
    candidates.find((r) => simplify(r.title).includes(title) || title.includes(simplify(r.title))) ||
    null
  );
}

// Fallback for malformed JSON (small models often emit e.g. {"a", "b"}): pick candidate
// titles in the order they appear in the response text.
function titlesMentioned(response, candidates) {
  const text = ` ${simplify(response)} `;
  return candidates
    .map((r) => ({ title: r.title, at: text.indexOf(` ${simplify(r.title)} `) }))
    .filter((m) => m.title && m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.title);
}

async function plannerNode(state, ctx) {
  ctx.log('planner', 'Designing the meal plan...');
  const prefs = normalizePreferences(state.preferences);
  const keepRecipes = state.keepRecipes || [];
  const internetRecipes = state.internetRecipes || [];

  if (!keepRecipes.length && !internetRecipes.length) {
    ctx.log('planner', 'No candidate recipes to choose from.', 'error');
    return { finalPlan: [] };
  }

  const candidates = [...keepRecipes, ...internetRecipes];
  const prefText = describePreferences(prefs);
  // Only titles are sent back by the LLM and mapped to the full recipes, which keeps
  // generation short and guarantees the plan only contains provided recipes.
  const prompt = `
    You are a professional Meal Planner.

    LOCAL RECIPES:
    ${JSON.stringify(keepRecipes.map(summarize), null, 2)}

    WEB RECIPES:
    ${JSON.stringify(internetRecipes.map(summarize), null, 2)}

    CONSTRAINTS:
    1. Avoid repeating proteins
    2. Only use the local and web recipes provided, do NOT invent new ones.
    ${prefText ? `3. Prefer recipes that best match the user's preferences:\n${prefText}\n` : ''}
    Pick ${prefs.numMeals} recipes that best fit the constraints and create a balanced meal plan for the week.
    Return ONLY a JSON array of the exact recipe titles you picked, in the order they should be cooked, no other text.

    Format:
    ["Recipe title 1", "Recipe title 2", ...]
    `;
  const response = await ctx.invokeLlm('planner', prompt);

  // build final plan from recipes
  let parsed = extractJsonArray(response);
  if (!parsed) {
    parsed = titlesMentioned(response, candidates);
    if (!parsed.length) {
      ctx.log('planner', 'Failed to parse meal plan as JSON', 'error');
      return { finalPlan: [] };
    }
    ctx.log('planner', 'Meal plan was not valid JSON; using recipe titles found in the response', 'warn');
  }
  const plan = [];
  for (const pick of parsed) {
    const recipe = matchRecipe(pick, candidates);
    if (recipe && !plan.includes(recipe)) plan.push(recipe);
    else if (!recipe) ctx.log('planner', `Ignoring unknown recipe: ${typeof pick === 'string' ? pick : JSON.stringify(pick)}`, 'warn');
    if (plan.length === prefs.numMeals) break;
  }
  ctx.log('planner', `Created meal plan with ${plan.length} recipes`);
  return { finalPlan: plan };
}

module.exports = { plannerNode, matchRecipe, titlesMentioned };
