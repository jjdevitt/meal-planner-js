'use strict';
// Display metadata for each agent, shared by the CLI and the Electron UI.
const AGENTS = [
  { id: 'supervisor', label: 'Supervisor', description: 'Watches the other agents and decides who runs next' },
  { id: 'librarian', label: 'Librarian', description: 'Picks recipes from the local recipes.json database' },
  { id: 'explorer', label: 'Explorer', description: 'Searches the web (DuckDuckGo) and uses the LLM to structure recipes' },
  { id: 'planner', label: 'Planner', description: 'LLM that merges local + web recipes into the weekly plan' },
  { id: 'shopper', label: 'Shopper', description: 'Builds a grocery list from the final meal plan' },
  { id: 'sous_chef', label: 'Sous Chef', description: 'Writes each recipe out to the meal_plans folder' },
  { id: 'historian', label: 'Historian', description: 'Records the plan in history.json' },
];

const agentLabel = (id) => AGENTS.find((a) => a.id === id)?.label || id;

module.exports = { AGENTS, agentLabel };
