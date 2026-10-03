'use strict';
// Historian node - records weekly meal plans to history.json.
const fs = require('fs');
const path = require('path');

async function historianNode(state, ctx) {
  const { historyFile } = ctx.paths;
  ctx.log('historian', `Recording weekly plan to ${historyFile}`);
  const finalPlan = state.finalPlan || [];
  if (!finalPlan.length) {
    ctx.log('historian', 'No final plan to record', 'warn');
    return { historyFile: '' };
  }

  let history = [];
  try {
    history = JSON.parse(await fs.promises.readFile(historyFile, 'utf8'));
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  const entry = { date: new Date().toISOString(), plan: finalPlan };
  if (state.preferences) entry.preferences = state.preferences;
  history.push(entry);

  await fs.promises.mkdir(path.dirname(historyFile), { recursive: true });
  await fs.promises.writeFile(historyFile, JSON.stringify(history, null, 2));
  ctx.log('historian', `Wrote history entry to ${historyFile}`);
  return { historyFile };
}

module.exports = { historianNode };
