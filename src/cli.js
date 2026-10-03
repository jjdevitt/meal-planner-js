#!/usr/bin/env node
'use strict';
// Command-line entry point (equivalent of the original main.py).
const { parseArgs } = require('util');
const { runMealPlanner } = require('./graph');
const { agentLabel } = require('./agents');
const { DEFAULTS } = require('./config');

const HELP = `Usage: npm run cli -- [options]

Options:
  --diet <text>         Diet style, e.g. "vegetarian"
  --avoid <list>        Comma-separated allergies/dislikes, e.g. "peanuts,shellfish"
  --cuisines <list>     Comma-separated favorite cuisines, e.g. "thai,mexican"
  --max-minutes <n>     Max cooking time in minutes
  --meals <n>           Number of meals to plan (1-7, default 3)
  --notes <text>        Anything else the planner should know
  --model <name>        Ollama model (default: ${DEFAULTS.model})
  --host <url>          Ollama URL (default: ${DEFAULTS.baseUrl})
  --verbose             Stream raw LLM output to the terminal
  -h, --help            Show this help`;

async function main() {
  const { values } = parseArgs({
    options: {
      diet: { type: 'string' },
      avoid: { type: 'string' },
      cuisines: { type: 'string' },
      'max-minutes': { type: 'string' },
      meals: { type: 'string' },
      notes: { type: 'string' },
      model: { type: 'string' },
      host: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const onEvent = (event) => {
    if (event.type === 'log') {
      const line = `[${agentLabel(event.agent)}] ${event.message}`;
      (event.level === 'error' ? console.error : console.log)(line);
    } else if (values.verbose && event.type === 'llm-token') {
      process.stdout.write(event.token);
    } else if (values.verbose && event.type === 'llm-end') {
      process.stdout.write('\n');
    }
  };

  const results = await runMealPlanner({
    preferences: {
      diet: values.diet,
      avoid: values.avoid,
      cuisines: values.cuisines,
      maxMinutes: values['max-minutes'],
      numMeals: values.meals,
      notes: values.notes,
    },
    model: values.model,
    baseUrl: values.host,
    onEvent,
  });

  console.log('\n=== MEAL PLAN ===');
  (results.finalPlan || []).forEach((recipe, i) => {
    console.log(`\nDay ${i + 1}: ${recipe.title || 'Unknown'} (${recipe.protein || 'N/A'})`);
  });
  console.log('\n=== RECIPE FILES CREATED ===');
  for (const file of results.recipeFiles || []) console.log(`✓ ${file}`);
  console.log('\n=== GROCERY LIST ===');
  if (results.groceryFile) console.log(`✓ ${results.groceryFile}`);
}

main().catch((err) => {
  console.error(`\n[Error] ${err.message}`);
  if (/fetch failed|ECONNREFUSED/i.test(err.message)) {
    console.error('Is Ollama running? Start it with `ollama serve` in another terminal.');
  }
  process.exit(1);
});
