'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mealPlanner', {
  init: () => ipcRenderer.invoke('app:init'),
  ollamaStatus: (settings) => ipcRenderer.invoke('ollama:status', settings),
  startPlan: (payload) => ipcRenderer.invoke('plan:start', payload),
  cancelPlan: () => ipcRenderer.invoke('plan:cancel'),
  openPath: (target) => ipcRenderer.invoke('file:open', target),
  onEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('plan:event', listener);
    return () => ipcRenderer.removeListener('plan:event', listener);
  },
});
