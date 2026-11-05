/**
 * Intelligent Chrome Tab Organizer - Options Controller
 */

import { DEFAULT_TAB_THRESHOLD, DEFAULT_BLOCKLIST, STORAGE_KEYS } from '../src/config/constants.js';

const thresholdInput = document.getElementById('thresholdInput');
const autoOrganizeInput = document.getElementById('autoOrganizeInput');
const enablePIIReviewInput = document.getElementById('enablePIIReviewInput');
const blocklistInput = document.getElementById('blocklistInput');
const btnSave = document.getElementById('btnSave');
const btnReset = document.getElementById('btnReset');
const saveStatus = document.getElementById('saveStatus');

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = data[STORAGE_KEYS.SETTINGS] || {};

    thresholdInput.value = settings.threshold || DEFAULT_TAB_THRESHOLD;
    autoOrganizeInput.checked = settings.autoOrganize !== false;
    enablePIIReviewInput.checked = settings.enablePIIReview !== false;

    const list = Array.isArray(settings.blocklist) ? settings.blocklist : DEFAULT_BLOCKLIST;
    blocklistInput.value = list.join('\n');
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings() {
  const threshold = parseInt(thresholdInput.value, 10) || DEFAULT_TAB_THRESHOLD;
  const autoOrganize = autoOrganizeInput.checked;
  const enablePIIReview = enablePIIReviewInput.checked;

  const rawBlocklist = blocklistInput.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const updatedSettings = {
    threshold,
    autoOrganize,
    enablePIIReview,
    blocklist: rawBlocklist
  };

  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updatedSettings });
    saveStatus.classList.remove('hidden');
    setTimeout(() => {
      saveStatus.classList.add('hidden');
    }, 2500);
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  }
}

function resetDefaults() {
  thresholdInput.value = DEFAULT_TAB_THRESHOLD;
  autoOrganizeInput.checked = true;
  enablePIIReviewInput.checked = true;
  blocklistInput.value = DEFAULT_BLOCKLIST.join('\n');
}

btnSave.addEventListener('click', saveSettings);
btnReset.addEventListener('click', resetDefaults);
document.addEventListener('DOMContentLoaded', loadSettings);
