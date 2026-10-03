'use strict';
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { runMealPlanner } = require('../src/graph');
const { AGENTS } = require('../src/agents');
const { DEFAULTS, PROJECT_ROOT, checkOllama, resolvePaths } = require('../src/config');

// In development keep history.json / meal_plans in the project folder (like the
// CLI); a packaged app writes them to the per-user data directory instead.
const dataDir = () => process.env.MEAL_PLANNER_DATA_DIR || (app.isPackaged ? app.getPath('userData') : PROJECT_ROOT);
const recipesFile = () => process.env.MEAL_PLANNER_RECIPES || path.join(PROJECT_ROOT, 'recipes.json');
const settingsFile = () => path.join(app.getPath('userData'), 'preferences.json');

let mainWindow;
let currentRun = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Meal Planner',
    backgroundColor: '#f6f4ef',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function readSaved() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

ipcMain.handle('app:init', () => ({
  agents: AGENTS,
  defaults: { model: DEFAULTS.model, baseUrl: DEFAULTS.baseUrl },
  saved: readSaved(),
  paths: resolvePaths({ dataDir: dataDir(), recipesFile: recipesFile() }),
}));

ipcMain.handle('ollama:status', (_event, settings = {}) => checkOllama(settings));

ipcMain.handle('plan:start', async (event, { preferences, settings = {} }) => {
  if (currentRun) throw new Error('A meal plan is already being generated.');
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ preferences, settings }, null, 2));

  const controller = new AbortController();
  currentRun = controller;
  const send = (payload) => !event.sender.isDestroyed() && event.sender.send('plan:event', payload);
  try {
    const result = await runMealPlanner({
      preferences,
      model: settings.model || DEFAULTS.model,
      baseUrl: settings.baseUrl || DEFAULTS.baseUrl,
      dataDir: dataDir(),
      recipesFile: recipesFile(),
      signal: controller.signal,
      onEvent: send,
    });
    return { ok: true, result };
  } catch (err) {
    const cancelled = controller.signal.aborted;
    send({ type: 'run-error', time: new Date().toISOString(), message: cancelled ? 'Cancelled.' : err.message, cancelled });
    return { ok: false, cancelled, error: err.message };
  } finally {
    currentRun = null;
  }
});

ipcMain.handle('plan:cancel', () => {
  currentRun?.abort();
  return true;
});

// Only allow opening files the planner itself writes.
ipcMain.handle('file:open', async (_event, target) => {
  const { dataDir: root } = resolvePaths({ dataDir: dataDir() });
  const resolved = path.resolve(String(target || ''));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('Path outside data directory');
  const error = await shell.openPath(resolved);
  if (error) throw new Error(error);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  currentRun?.abort();
  if (process.platform !== 'darwin') app.quit();
});
