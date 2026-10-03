'use strict';
// Sous Chef node - creates recipe files.
const fs = require('fs');
const path = require('path');

const safeFileName = (title) => title.replace(/\s/g, '_').replace(/[\\/:*?"<>|]/g, '');

function formatRecipe({ title, protein, ingredients = [], instructions = [] }) {
  const lines = [`RECIPE: ${title}`];
  if (protein) lines.push(`PROTEIN: ${protein}`);
  lines.push('', 'INGREDIENTS:');
  for (const ingredient of ingredients) {
    if (typeof ingredient === 'string') lines.push(ingredient.startsWith('-') ? ingredient : `- ${ingredient}`);
  }
  lines.push('', 'INSTRUCTIONS:');
  instructions.forEach((instruction, idx) => {
    const n = idx + 1;
    if (typeof instruction === 'string') lines.push(instruction.startsWith(`${n}.`) ? instruction : `${n}. ${instruction}`);
  });
  return `${lines.join('\n')}\n`;
}

async function sousChefNode(state, ctx) {
  ctx.log('sous_chef', 'Creating recipe files...');
  const finalPlan = state.finalPlan || [];
  await fs.promises.mkdir(ctx.paths.mealPlansDir, { recursive: true });

  const recipeFiles = [];
  for (const [idx, recipe] of finalPlan.entries()) {
    if (!recipe || typeof recipe !== 'object' || !recipe.title) continue;
    const day = String(idx + 1).padStart(2, '0');
    ctx.log('sous_chef', `Creating file for: ${recipe.title}`);
    const filename = path.join(ctx.paths.mealPlansDir, `day_${day}_${safeFileName(recipe.title)}.txt`);
    await fs.promises.writeFile(filename, formatRecipe(recipe));
    recipeFiles.push(filename);
    ctx.log('sous_chef', `Created: ${filename}`);
  }
  return { recipeFiles };
}

module.exports = { sousChefNode, formatRecipe, safeFileName };
