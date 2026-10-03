'use strict';
/* global window, document */
const api = window.mealPlanner;
const $ = (id) => document.getElementById(id);

const state = {
  agents: [],
  defaults: {},
  agentStatus: {},
  llmLine: null,
  startedAt: 0,
  timer: null,
  running: false,
};

const AGENT_ACTIVITY = {
  supervisor: 'Supervisor is deciding who goes next',
  librarian: 'Librarian is picking recipes from your local database',
  explorer: 'Explorer is searching the web for recipes',
  planner: 'Planner is designing your meal plan',
  shopper: 'Shopper is building the grocery list',
  sous_chef: 'Sous Chef is writing recipe files',
  historian: 'Historian is recording this plan',
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

const labelFor = (id) => state.agents.find((a) => a.id === id)?.label || id;
const timeOf = (iso) => new Date(iso || Date.now()).toLocaleTimeString([], { hour12: false });
const basename = (p) => String(p).split(/[\\/]/).pop();

// ---------- Ollama status ----------
function currentSettings() {
  const form = $('prefs-form');
  return {
    model: form.model.value.trim() || state.defaults.model,
    baseUrl: form.baseUrl.value.trim() || state.defaults.baseUrl,
  };
}

async function refreshOllamaStatus() {
  const pill = $('ollama-status');
  const text = $('ollama-status-text');
  pill.className = 'status-pill';
  text.textContent = 'Checking Ollama…';
  const status = await api.ollamaStatus(currentSettings());
  if (!status.ok) {
    pill.classList.add('error');
    text.textContent = `Ollama not reachable at ${status.baseUrl} — run "ollama serve"`;
  } else if (!status.hasModel) {
    pill.classList.add('warn');
    text.textContent = `Model "${status.model}" not found — run "ollama pull ${status.model}"`;
  } else {
    pill.classList.add('ok');
    text.textContent = `Ollama ready · ${status.model}`;
  }
  return status;
}

// ---------- Preferences ----------
function readPreferences() {
  const form = $('prefs-form');
  return {
    diet: form.diet.value,
    numMeals: form.numMeals.value,
    maxMinutes: form.maxMinutes.value,
    cuisines: form.cuisines.value,
    avoid: form.avoid.value,
    notes: form.notes.value,
  };
}

function fillForm(saved = {}) {
  const form = $('prefs-form');
  const values = { ...(saved.preferences || {}), ...(saved.settings || {}) };
  for (const [key, value] of Object.entries(values)) {
    if (form[key] && value !== undefined && value !== null) {
      form[key].value = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  form.model.placeholder = state.defaults.model;
  form.baseUrl.placeholder = state.defaults.baseUrl;
}

function summarizePreferences(p) {
  const parts = [];
  if (p.diet) parts.push(p.diet);
  parts.push(`${p.numMeals || 3} meals`);
  if (p.maxMinutes) parts.push(`≤ ${p.maxMinutes} min`);
  if (p.cuisines) parts.push(`cuisines: ${p.cuisines}`);
  if (p.avoid) parts.push(`avoid: ${p.avoid}`);
  if (p.notes) parts.push(`"${p.notes}"`);
  return parts.join(' · ');
}

// ---------- Agents panel ----------
function renderAgents() {
  const list = $('agent-list');
  list.replaceChildren(
    ...state.agents.map((agent) => {
      const status = state.agentStatus[agent.id] || { state: 'idle', summary: '' };
      return el(
        'li',
        { class: `agent ${status.state} ${agent.id === 'supervisor' ? 'supervisor' : ''}`, 'data-agent': agent.id },
        el('span', { class: 'icon' }),
        el('div', { class: 'name' }, agent.label, el('span', { class: 'state', text: status.state === 'idle' ? 'waiting' : status.state })),
        el('div', { class: 'desc', text: agent.description }),
        status.summary ? el('div', { class: 'summary', text: status.summary }) : null,
      );
    }),
  );
}

function setAgent(id, patch) {
  state.agentStatus[id] = { ...(state.agentStatus[id] || { state: 'idle', summary: '' }), ...patch };
  renderAgents();
}

function summarizeUpdate(agent, update = {}) {
  switch (agent) {
    case 'supervisor':
      return update.nextStep === 'end' ? 'Plan complete' : `Last routed to ${labelFor(update.nextStep)}`;
    case 'librarian':
      return `${(update.keepRecipes || []).length} local recipes selected`;
    case 'explorer':
      return `${(update.internetRecipes || []).length} web recipes found`;
    case 'planner':
      return `${(update.finalPlan || []).length} meals planned`;
    case 'shopper':
      return `${(update.groceryList || []).length} grocery items`;
    case 'sous_chef':
      return `${(update.recipeFiles || []).length} recipe files written`;
    case 'historian':
      return update.historyFile ? 'Saved to history.json' : 'Nothing recorded';
    default:
      return '';
  }
}

// ---------- Activity log ----------
function appendLog({ time, agent, message, level = 'info' }) {
  const log = $('log');
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  log.append(
    el(
      'div',
      { class: `log-line ${level}` },
      el('span', { class: 'time', text: timeOf(time) }),
      agent ? el('span', { class: `agent-tag ${agent}`, text: `[${labelFor(agent)}]` }) : null,
      message,
    ),
  );
  if (stick) log.scrollTop = log.scrollHeight;
}

function appendLlmToken(token) {
  const log = $('log');
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  if (!state.llmLine) {
    state.llmLine = el('div', { class: 'log-line llm' });
    log.append(state.llmLine);
  }
  state.llmLine.textContent += token;
  if (stick) log.scrollTop = log.scrollHeight;
}

// ---------- Results ----------
function renderResults(result = {}) {
  const plan = result.finalPlan || [];
  $('plan-list').replaceChildren(
    ...(plan.length
      ? plan.map((recipe, i) =>
          el(
            'details',
            { class: 'recipe' },
            el(
              'summary',
              {},
              el('div', {}, el('div', { class: 'day', text: `Day ${i + 1}` }), el('div', { class: 'title', text: recipe.title || 'Untitled' })),
              recipe.protein ? el('span', { class: 'protein', text: recipe.protein }) : null,
            ),
            el(
              'div',
              { class: 'body' },
              el('div', {}, el('h4', { text: 'Ingredients' }), el('ul', {}, (recipe.ingredients || []).map((x) => el('li', { text: x })))),
              el('div', {}, el('h4', { text: 'Instructions' }), el('ol', {}, (recipe.instructions || []).map((x) => el('li', { text: String(x).replace(/^\d+\.\s*/, '') })))),
            ),
          ),
        )
      : [el('p', { class: 'empty', text: 'The planner did not return a meal plan. Check the activity log for details.' })]),
  );

  const groceries = result.groceryList || [];
  $('grocery-list').replaceChildren(
    ...(groceries.length ? groceries.map((item) => el('li', { text: item })) : [el('li', { class: 'empty', text: 'No grocery items' })]),
  );
  const openGrocery = $('open-grocery');
  openGrocery.classList.toggle('hidden', !result.groceryFile);
  openGrocery.onclick = () => api.openPath(result.groceryFile);

  const files = [...(result.recipeFiles || []), result.groceryFile, result.historyFile].filter(Boolean);
  $('file-list').replaceChildren(
    ...(files.length
      ? files.map((file) =>
          el('li', { title: file }, el('span', { text: basename(file) }), el('button', { class: 'link', text: 'Open', onclick: () => api.openPath(file) })),
        )
      : [el('li', { class: 'empty', text: 'No files written' })]),
  );
  $('results').classList.remove('hidden');
}

// ---------- Run lifecycle ----------
function handleEvent(event) {
  switch (event.type) {
    case 'agent-start':
      state.llmLine = null;
      for (const [id, status] of Object.entries(state.agentStatus)) {
        if (status.state === 'active') state.agentStatus[id] = { ...status, state: 'done' };
      }
      setAgent(event.agent, { state: 'active' });
      $('now-working').textContent = `${AGENT_ACTIVITY[event.agent] || labelFor(event.agent)}…`;
      break;
    case 'agent-end':
      setAgent(event.agent, { state: 'done', summary: summarizeUpdate(event.agent, event.update) });
      break;
    case 'agent-error':
      setAgent(event.agent, { state: 'error', summary: event.message });
      appendLog({ ...event, level: 'error' });
      break;
    case 'log':
      state.llmLine = null;
      appendLog(event);
      break;
    case 'llm-start':
      state.llmLine = null;
      appendLog({ ...event, message: 'Thinking with the LLM…' });
      break;
    case 'llm-token':
      appendLlmToken(event.token);
      break;
    case 'llm-end':
      state.llmLine = null;
      break;
    case 'run-end':
      finishRun({ ok: true, result: event.result });
      break;
    case 'run-error':
      appendLog({ ...event, level: event.cancelled ? 'warn' : 'error', message: event.cancelled ? 'Run cancelled.' : `Run failed: ${event.message}` });
      break;
    default:
      break;
  }
}

function tick() {
  const secs = Math.floor((Date.now() - state.startedAt) / 1000);
  $('elapsed').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} elapsed`;
}

function finishRun({ ok, result, cancelled, error }) {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timer);
  $('cancel-btn').classList.add('hidden');
  $('restart-btn').classList.remove('hidden');
  if (ok) {
    $('now-working').textContent = `Done — ${(result.finalPlan || []).length} meals planned`;
    renderResults(result);
  } else {
    $('now-working').textContent = cancelled ? 'Cancelled' : 'Something went wrong';
    if (error && /fetch failed|ECONNREFUSED/i.test(error)) {
      appendLog({ level: 'error', message: 'Could not reach Ollama. Is "ollama serve" running?' });
    }
    for (const [id, status] of Object.entries(state.agentStatus)) {
      if (status.state === 'active') setAgent(id, { state: 'error' });
    }
  }
}

async function startRun(event) {
  event.preventDefault();
  const preferences = readPreferences();
  const settings = currentSettings();

  $('start-btn').disabled = true;
  const status = await refreshOllamaStatus();
  $('start-btn').disabled = false;
  if (!status.ok && !window.confirm('Ollama does not appear to be running. Start anyway?')) return;
  if (status.ok && !status.hasModel && !window.confirm(`Model "${status.model}" is not pulled yet. Start anyway?`)) return;

  state.agentStatus = {};
  state.llmLine = null;
  state.running = true;
  state.startedAt = Date.now();
  state.timer = setInterval(tick, 1000);
  tick();

  $('log').replaceChildren();
  $('results').classList.add('hidden');
  $('cancel-btn').classList.remove('hidden');
  $('restart-btn').classList.add('hidden');
  $('prefs-summary').textContent = `Preferences: ${summarizePreferences(preferences)} · model ${settings.model}`;
  $('now-working').textContent = 'Starting…';
  $('setup-view').classList.add('hidden');
  $('run-view').classList.remove('hidden');
  renderAgents();

  const response = await api.startPlan({ preferences, settings });
  finishRun(response);
}

async function init() {
  const info = await api.init();
  state.agents = info.agents;
  state.defaults = info.defaults;
  fillForm(info.saved);
  renderAgents();
  api.onEvent(handleEvent);

  $('prefs-form').addEventListener('submit', startRun);
  $('ollama-status').addEventListener('click', refreshOllamaStatus);
  $('prefs-form').model.addEventListener('change', refreshOllamaStatus);
  $('prefs-form').baseUrl.addEventListener('change', refreshOllamaStatus);
  $('cancel-btn').addEventListener('click', () => api.cancelPlan());
  $('restart-btn').addEventListener('click', () => {
    $('run-view').classList.add('hidden');
    $('setup-view').classList.remove('hidden');
  });
  $('show-llm').addEventListener('change', (e) => $('log').classList.toggle('hide-llm', !e.target.checked));
  refreshOllamaStatus();
}

init();
