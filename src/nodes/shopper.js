'use strict';
// Shopper node - makes a grocery list from the meal plan.
const fs = require('fs');
const path = require('path');

async function shopperNode(state, ctx) {
  ctx.log('shopper', 'Building grocery list...');
  const finalPlan = state.finalPlan || [];
  if (!finalPlan.length) {
    ctx.log('shopper', 'No final plan available', 'warn');
    return { groceryList: [], groceryFile: '' };
  }

  const groceryList = [];
  for (const recipe of finalPlan) {
    if (!recipe || typeof recipe !== 'object') continue;
    for (const ingredient of recipe.ingredients || []) {
      if (typeof ingredient !== 'string') continue;
      const item = ingredient.trim();
      if (item && !groceryList.includes(item)) groceryList.push(item);
    }
  }

  await fs.promises.mkdir(ctx.paths.mealPlansDir, { recursive: true });
  const groceryFile = path.join(ctx.paths.mealPlansDir, 'grocery_list.txt');
  const body = ['GROCERY LIST', '', ...groceryList.map((item) => `- ${item}`)].join('\n');
  await fs.promises.writeFile(groceryFile, `${body}\n`);

  ctx.log('shopper', `Grocery list created: ${groceryFile} (${groceryList.length} items)`);
  return { groceryList, groceryFile };
}

module.exports = { shopperNode };
