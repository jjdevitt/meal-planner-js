'use strict';
// Shared state definition for meal planner.
const { Annotation } = require('@langchain/langgraph');

const MealState = Annotation.Root({
  task: Annotation(),
  preferences: Annotation(),
  keepRecipes: Annotation(),
  internetRecipes: Annotation(),
  finalPlan: Annotation(),
  recipeFiles: Annotation(),
  groceryList: Annotation(),
  groceryFile: Annotation(),
  historyFile: Annotation(),
  nextStep: Annotation(),
});

module.exports = { MealState };
