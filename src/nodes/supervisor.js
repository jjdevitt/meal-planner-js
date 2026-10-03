'use strict';
// Supervisor node - routes between agents.

// A step is complete once its agent has written its key to state (even if the
// result was empty), so a failed step can't loop the graph forever.
const ROUTES = [
  ['keepRecipes', 'librarian'],
  ['internetRecipes', 'explorer'],
  ['finalPlan', 'planner'],
  ['groceryList', 'shopper'],
  ['recipeFiles', 'sous_chef'],
  ['historyFile', 'historian'],
];

function supervisor(state, ctx) {
  const pending = ROUTES.find(([key]) => state[key] === undefined || state[key] === null);
  const nextStep = pending ? pending[1] : 'end';
  ctx?.log('supervisor', nextStep === 'end' ? 'All agents finished.' : `Routing to ${nextStep}.`);
  return { nextStep };
}

module.exports = { supervisor, ROUTES };
