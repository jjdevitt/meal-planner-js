'use strict';
// Librarian node - accesses local recipe database.
const fs = require('fs');
const { normalizePreferences, recipeMentions, excludedTerms } = require('../preferences');

function sample(list, k, random) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(k, pool.length));
}

async function librarianNode(state, ctx) {
  const { recipesFile } = ctx.paths;
  ctx.log('librarian', `Accessing local recipe database (${recipesFile})...`);
  const prefs = normalizePreferences(state.preferences);

  let allRecipes;
  try {
    allRecipes = JSON.parse(await fs.promises.readFile(recipesFile, 'utf8'));
  } catch (err) {
    const msg = err.code === 'ENOENT' ? `${recipesFile} not found.` : `Librarian failed: ${err.message}`;
    ctx.log('librarian', msg, 'error');
    return { keepRecipes: [] };
  }

  const excluded = excludedTerms(prefs);
  const allowed = allRecipes.filter((r) => !excluded.some((term) => recipeMentions(r, term)));
  if (allowed.length < allRecipes.length) {
    const reason = [prefs.diet && `not ${prefs.diet.toLowerCase()}`, prefs.avoid.length && `contains ${prefs.avoid.join(', ')}`].filter(Boolean).join(' / ');
    ctx.log('librarian', `Skipped ${allRecipes.length - allowed.length} of ${allRecipes.length} recipes (${reason}).`);
  }

  const selection = sample(allowed, prefs.numMeals, ctx.random || Math.random);
  ctx.log('librarian', selection.length ? `Selected: ${selection.map((r) => r.title).join(', ')}` : 'No matching local recipes.');
  return { keepRecipes: selection };
}

module.exports = { librarianNode };
