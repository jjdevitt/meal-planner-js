'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'meal-planner-'));

function makeCtx(overrides = {}) {
  const dir = overrides.dir || tmpDir();
  const logs = [];
  return {
    logs,
    dir,
    paths: {
      dataDir: dir,
      recipesFile: path.join(__dirname, '..', 'recipes.json'),
      historyFile: path.join(dir, 'history.json'),
      mealPlansDir: path.join(dir, 'meal_plans'),
      ...overrides.paths,
    },
    log: (agent, message, level = 'info') => logs.push({ agent, message, level }),
    random: () => 0.42,
    ...overrides,
  };
}

const recipe = (title, protein, ingredients = ['1 onion'], instructions = ['Cook it']) => ({ title, protein, ingredients, instructions });

module.exports = { tmpDir, makeCtx, recipe };
