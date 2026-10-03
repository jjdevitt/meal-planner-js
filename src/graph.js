'use strict';
// Builds and runs the meal planner agent graph (LangGraph.js).
const { StateGraph, END } = require('@langchain/langgraph');
const { MealState } = require('./state');
const { createLlm, createSearch, resolvePaths } = require('./config');
const { normalizePreferences } = require('./preferences');
const nodes = require('./nodes');

const NODE_FUNCTIONS = {
  supervisor: nodes.supervisor,
  librarian: nodes.librarianNode,
  explorer: nodes.explorerNode,
  planner: nodes.plannerNode,
  shopper: nodes.shopperNode,
  historian: nodes.historianNode,
  sous_chef: nodes.sousChefNode,
};
const WORKERS = Object.keys(NODE_FUNCTIONS).filter((name) => name !== 'supervisor');

// --- GRAPH SETUP ---
function buildGraph(ctx) {
  const builder = new StateGraph(MealState);
  for (const [name, fn] of Object.entries(NODE_FUNCTIONS)) {
    builder.addNode(name, async (state) => {
      ctx.emit({ type: 'agent-start', agent: name });
      try {
        const update = await fn(state, ctx);
        ctx.emit({ type: 'agent-end', agent: name, update });
        return update;
      } catch (err) {
        ctx.emit({ type: 'agent-error', agent: name, message: err.message });
        throw err;
      }
    });
  }

  builder.addEdge('__start__', 'supervisor');
  builder.addConditionalEdges('supervisor', (state) => state.nextStep, {
    ...Object.fromEntries(WORKERS.map((name) => [name, name])),
    end: END,
  });
  for (const name of WORKERS) builder.addEdge(name, 'supervisor');

  return builder.compile();
}

function createContext({ llm, search, paths, random, signal, emit }) {
  return {
    llm,
    search,
    paths,
    random,
    signal,
    emit,
    log: (agent, message, level = 'info') => emit({ type: 'log', agent, message, level }),
    async invokeLlm(agent, prompt) {
      emit({ type: 'llm-start', agent });
      let text = '';
      if (typeof llm.stream === 'function') {
        for await (const chunk of await llm.stream(prompt, { signal })) {
          const token = typeof chunk === 'string' ? chunk : chunk?.content ?? '';
          text += token;
          emit({ type: 'llm-token', agent, token });
        }
      } else {
        text = await llm.invoke(prompt, { signal });
        emit({ type: 'llm-token', agent, token: text });
      }
      emit({ type: 'llm-end', agent });
      return text;
    },
  };
}

async function runMealPlanner({
  preferences = {},
  model,
  baseUrl,
  dataDir,
  recipesFile,
  onEvent = () => {},
  signal,
  llm,
  search,
  random,
} = {}) {
  const emit = (event) => onEvent({ time: new Date().toISOString(), ...event });
  const ctx = createContext({
    llm: llm || createLlm({ model, baseUrl }),
    search: search || createSearch(),
    paths: resolvePaths({ dataDir, recipesFile }),
    random,
    signal,
    emit,
  });
  const prefs = normalizePreferences(preferences);
  const graph = buildGraph(ctx);

  emit({ type: 'run-start', preferences: prefs });
  const result = await graph.invoke({ task: 'Weekly plan', preferences: prefs }, { recursionLimit: 50, signal });
  emit({ type: 'run-end', result });
  return result;
}

module.exports = { buildGraph, runMealPlanner, NODE_FUNCTIONS };
