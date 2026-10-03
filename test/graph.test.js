'use strict';
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { tmpDir, recipe } = require('./helpers');
const { runMealPlanner } = require('../src/graph');

test('runMealPlanner runs every agent end-to-end and emits UI events', async () => {
  const dir = tmpDir();
  const events = [];
  const fakeLlm = {
    async *stream(prompt) {
      if (prompt.includes('extract')) yield JSON.stringify([recipe('Web Tacos', 'Fish')]);
      else yield JSON.stringify(['Web Tacos', 'Garlic Parm Chicken Potato Skillet']);
    },
  };

  const result = await runMealPlanner({
    preferences: { numMeals: 2 },
    dataDir: dir,
    llm: fakeLlm,
    search: async () => 'tacos',
    random: () => 0,
    onEvent: (e) => events.push(e),
  });

  assert.deepEqual(result.finalPlan.map((r) => r.title), ['Web Tacos', 'Garlic Parm Chicken Potato Skillet']);
  assert.equal(result.keepRecipes.length, 2);
  assert.equal(result.recipeFiles.length, 2);
  assert.ok(fs.existsSync(path.join(dir, 'meal_plans', 'grocery_list.txt')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'history.json'), 'utf8')).length, 1);

  const started = events.filter((e) => e.type === 'agent-start' && e.agent !== 'supervisor').map((e) => e.agent);
  assert.deepEqual(started, ['librarian', 'explorer', 'planner', 'shopper', 'sous_chef', 'historian']);
  assert.ok(events.some((e) => e.type === 'llm-token' && e.agent === 'planner'));
  assert.equal(events.at(-1).type, 'run-end');
});

test('runMealPlanner finishes even when the LLM returns garbage', async () => {
  const result = await runMealPlanner({
    dataDir: tmpDir(),
    llm: { invoke: async () => 'sorry, no' },
    search: async () => '',
  });
  assert.deepEqual(result.finalPlan, []);
  assert.deepEqual(result.recipeFiles, []);
  assert.equal(result.historyFile, '');
});
