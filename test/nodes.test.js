'use strict';
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCtx, recipe } = require('./helpers');
const { supervisor } = require('../src/nodes/supervisor');
const { librarianNode } = require('../src/nodes/librarian');
const { explorerNode, numWebRecipes } = require('../src/nodes/explorer');
const { plannerNode } = require('../src/nodes/planner');
const { shopperNode } = require('../src/nodes/shopper');
const { sousChefNode, formatRecipe } = require('../src/nodes/sous_chef');
const { historianNode } = require('../src/nodes/historian');
const { normalizePreferences } = require('../src/preferences');

test('supervisor routes through every agent in order, then ends', () => {
  const state = {};
  const order = [];
  const results = { keepRecipes: [], internetRecipes: [], finalPlan: [], groceryList: [], recipeFiles: [], historyFile: '' };
  for (;;) {
    const { nextStep } = supervisor(state);
    if (nextStep === 'end') break;
    order.push(nextStep);
    const key = Object.keys(results).find((k) => state[k] === undefined);
    state[key] = results[key];
  }
  assert.deepEqual(order, ['librarian', 'explorer', 'planner', 'shopper', 'sous_chef', 'historian']);
});

test('librarian samples local recipes, honouring diet and avoid list', async () => {
  const ctx = makeCtx();
  const { keepRecipes } = await librarianNode({ preferences: { numMeals: 2 } }, ctx);
  assert.equal(keepRecipes.length, 2);

  const veg = await librarianNode({ preferences: { diet: 'Vegetarian', numMeals: 5 } }, ctx);
  assert.ok(veg.keepRecipes.every((r) => !/chicken|beef|pork|bacon|shrimp/i.test(JSON.stringify(r))));
});

test('librarian returns an empty list when recipes.json is missing', async () => {
  const ctx = makeCtx({ paths: { recipesFile: '/nope/recipes.json' } });
  assert.deepEqual(await librarianNode({}, ctx), { keepRecipes: [] });
  assert.equal(ctx.logs.at(-1).level, 'error');
});

test('explorer structures search results via the LLM', async () => {
  let prompt;
  const ctx = makeCtx({
    search: async (q) => `results for ${q}`,
    invokeLlm: async (_agent, p) => {
      prompt = p;
      return '```json\n[{"title":"Tofu Stir Fry","protein":"Tofu","ingredients":["tofu"],"instructions":["fry"]}]\n```';
    },
  });
  const out = await explorerNode({ preferences: { diet: 'Vegan' }, keepRecipes: [] }, ctx);
  assert.equal(out.internetRecipes[0].title, 'Tofu Stir Fry');
  assert.match(prompt, /extract 3 recipe ideas/);
  assert.match(prompt, /Diet: Vegan/);
  assert.match(prompt, /results for healthy 30-minute Vegan/);
});

test('explorer falls back to LLM-only when search fails, and handles bad JSON', async () => {
  const ctx = makeCtx({
    search: async () => {
      throw new Error('DDG anomaly');
    },
    invokeLlm: async () => 'not json',
  });
  assert.deepEqual(await explorerNode({}, ctx), { internetRecipes: [] });
  assert.ok(ctx.logs.some((l) => l.level === 'warn' && /DDG anomaly/.test(l.message)));
});

test('numWebRecipes covers any local shortfall', () => {
  assert.equal(numWebRecipes(normalizePreferences({ numMeals: 3 }), 3), 1);
  assert.equal(numWebRecipes(normalizePreferences({ numMeals: 6 }), 6), 2);
  assert.equal(numWebRecipes(normalizePreferences({ numMeals: 4 }), 1), 3);
});

test('planner maps picked titles to full recipes and caps to numMeals', async () => {
  const keep = [recipe('Beef Stew', 'Beef'), recipe('Chicken Piccata Recipe', 'Chicken')];
  const web = [recipe('Tofu Stir-Fry', 'Tofu')];
  const ctx = makeCtx({ invokeLlm: async () => 'Here: ["tofu stir fry", "Made Up Dish", "Chicken Piccata", "Beef Stew"]' });
  const { finalPlan } = await plannerNode({ keepRecipes: keep, internetRecipes: web, preferences: { numMeals: 2 } }, ctx);
  assert.deepEqual(finalPlan, [web[0], keep[1]]);
  assert.ok(ctx.logs.some((l) => l.level === 'warn' && /Made Up Dish/.test(l.message)));
});

test('planner also accepts full recipe objects in the LLM response', async () => {
  const keep = [recipe('A', 'Beef'), recipe('B', 'Chicken')];
  const ctx = makeCtx({ invokeLlm: async () => JSON.stringify([{ title: 'B', protein: 'x' }]) });
  const { finalPlan } = await plannerNode({ keepRecipes: keep, internetRecipes: [], preferences: {} }, ctx);
  assert.deepEqual(finalPlan, [keep[1]]);
});

test('planner falls back to titles mentioned in malformed JSON', async () => {
  const keep = [recipe('Shepherds Pie', 'Beef'), recipe('Loaded Baked Potato Soup', 'Bacon'), recipe('Unused', 'Tofu')];
  const ctx = makeCtx({ invokeLlm: async () => '{\n "Loaded Baked Potato Soup",\n "Shepherds Pie"\n}' });
  const { finalPlan } = await plannerNode({ keepRecipes: keep, internetRecipes: [], preferences: { numMeals: 3 } }, ctx);
  assert.deepEqual(finalPlan, [keep[1], keep[0]]);
});

test('planner skips the LLM when there are no candidates', async () => {
  const ctx = makeCtx({ invokeLlm: async () => assert.fail('should not call LLM') });
  assert.deepEqual(await plannerNode({ keepRecipes: [], internetRecipes: [] }, ctx), { finalPlan: [] });
});

test('shopper writes a de-duplicated grocery list', async () => {
  const ctx = makeCtx();
  const plan = [recipe('A', 'x', ['1 onion', ' 2 eggs ']), recipe('B', 'y', ['1 onion', 'salt'])];
  const out = await shopperNode({ finalPlan: plan }, ctx);
  assert.deepEqual(out.groceryList, ['1 onion', '2 eggs', 'salt']);
  assert.equal(fs.readFileSync(out.groceryFile, 'utf8'), 'GROCERY LIST\n\n- 1 onion\n- 2 eggs\n- salt\n');
  assert.deepEqual(await shopperNode({ finalPlan: [] }, ctx), { groceryList: [], groceryFile: '' });
});

test('sous chef writes one formatted file per recipe', async () => {
  const ctx = makeCtx();
  const plan = [recipe('Chili / Cornbread', 'Beef', ['- 1 lb beef', 'beans'], ['Brown beef', '2. Simmer']), { protein: 'no title' }];
  const { recipeFiles } = await sousChefNode({ finalPlan: plan }, ctx);
  assert.deepEqual(recipeFiles.map((f) => path.basename(f)), ['day_01_Chili__Cornbread.txt']);
  assert.equal(
    fs.readFileSync(recipeFiles[0], 'utf8'),
    'RECIPE: Chili / Cornbread\nPROTEIN: Beef\n\nINGREDIENTS:\n- 1 lb beef\n- beans\n\nINSTRUCTIONS:\n1. Brown beef\n2. Simmer\n',
  );
  assert.equal(formatRecipe(recipe('X', '')).includes('PROTEIN'), false);
});

test('historian appends entries to history.json', async () => {
  const ctx = makeCtx();
  fs.writeFileSync(ctx.paths.historyFile, JSON.stringify([{ date: 'old', plan: [] }]));
  const out = await historianNode({ finalPlan: [recipe('A', 'x')], preferences: { diet: 'Vegan' } }, ctx);
  const history = JSON.parse(fs.readFileSync(out.historyFile, 'utf8'));
  assert.equal(history.length, 2);
  assert.equal(history[1].plan[0].title, 'A');
  assert.equal(history[1].preferences.diet, 'Vegan');
  assert.match(history[1].date, /Z$/);
  assert.deepEqual(await historianNode({ finalPlan: [] }, ctx), { historyFile: '' });
});
