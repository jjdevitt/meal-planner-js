'use strict';
// Shared configuration for meal planner agents.
const path = require('path');
const { Ollama } = require('@langchain/ollama');
const { search: ddgSearch, SafeSearchType } = require('duck-duck-scrape');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function normalizeBaseUrl(url) {
  const value = (url || '').trim() || 'http://127.0.0.1:11434';
  return /^https?:\/\//i.test(value) ? value.replace(/\/+$/, '') : `http://${value.replace(/\/+$/, '')}`;
}

const DEFAULTS = Object.freeze({
  model: process.env.OLLAMA_MODEL || 'llama3',
  baseUrl: normalizeBaseUrl(process.env.OLLAMA_HOST),
  dataDir: process.env.MEAL_PLANNER_DATA_DIR || PROJECT_ROOT,
  recipesFile: process.env.MEAL_PLANNER_RECIPES || path.join(PROJECT_ROOT, 'recipes.json'),
  // Full recipes make long prompts; Ollama's 4k default context would silently truncate them.
  numCtx: Number.parseInt(process.env.OLLAMA_NUM_CTX, 10) || 8192,
  // Cap generation so a small model that starts repeating itself can't run forever.
  numPredict: Number.parseInt(process.env.OLLAMA_NUM_PREDICT, 10) || 4096,
});

function resolvePaths({ dataDir = DEFAULTS.dataDir, recipesFile = DEFAULTS.recipesFile } = {}) {
  return {
    dataDir,
    recipesFile,
    historyFile: path.join(dataDir, 'history.json'),
    mealPlansDir: path.join(dataDir, 'meal_plans'),
  };
}

function createLlm({ model = DEFAULTS.model, baseUrl = DEFAULTS.baseUrl, numCtx = DEFAULTS.numCtx, numPredict = DEFAULTS.numPredict } = {}) {
  return new Ollama({ model, baseUrl: normalizeBaseUrl(baseUrl), numCtx, numPredict });
}

const stripHtml = (text) =>
  String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// DuckDuckGo search returning a plain-text blob of result snippets
// (equivalent of langchain's DuckDuckGoSearchRun).
function createSearch({ retries = 1, retryDelayMs = 2000 } = {}) {
  return async function search(query) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await ddgSearch(query, { safeSearch: SafeSearchType.MODERATE });
        if (res.noResults) return '';
        return res.results
          .slice(0, 8)
          .map((r) => `${stripHtml(r.title)}: ${stripHtml(r.description)}`)
          .join('\n');
      } catch (err) {
        lastError = err;
        if (attempt < retries) await sleep(retryDelayMs);
      }
    }
    throw lastError;
  };
}

async function checkOllama({ model = DEFAULTS.model, baseUrl = DEFAULTS.baseUrl } = {}) {
  const url = normalizeBaseUrl(baseUrl);
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false, baseUrl: url, model, error: `HTTP ${res.status}` };
    const body = await res.json();
    const models = (body.models || []).map((m) => m.name);
    const hasModel = models.some((name) => name === model || name === `${model}:latest`);
    return { ok: true, baseUrl: url, model, models, hasModel };
  } catch (err) {
    return { ok: false, baseUrl: url, model, error: err.message };
  }
}

module.exports = { PROJECT_ROOT, DEFAULTS, normalizeBaseUrl, resolvePaths, createLlm, createSearch, checkOllama };
