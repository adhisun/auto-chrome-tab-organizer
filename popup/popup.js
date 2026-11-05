/**
 * Intelligent Chrome Tab Organizer - Popup Controller
 */

import { MESSAGE_ACTIONS, STORAGE_KEYS } from '../src/config/constants.js';

const tabCountText = document.getElementById('tabCountText');
const tabProgressBar = document.getElementById('tabProgressBar');
const nanoIndicator = document.getElementById('nanoIndicator');
const nanoStatusText = document.getElementById('nanoStatusText');
const autoOrganizeToggle = document.getElementById('autoOrganizeToggle');
const btnOrganize = document.getElementById('btnOrganize');
const btnOptions = document.getElementById('btnOptions');
const resultBanner = document.getElementById('resultBanner');
const resultMessage = document.getElementById('resultMessage');

async function refreshStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: MESSAGE_ACTIONS.GET_STATUS });
    if (!response) return;

    const { tabCount, threshold, autoOrganize, nanoStatus } = response;

    // Update Tab Count & Progress Bar
    tabCountText.textContent = `${tabCount} / ${threshold} Tabs`;
    const pct = Math.min(100, Math.round((tabCount / threshold) * 100));
    tabProgressBar.style.width = `${pct}%`;
    if (tabCount >= threshold) {
      tabProgressBar.style.backgroundColor = '#d93025';
    } else {
      tabProgressBar.style.backgroundColor = '#1a73e8';
    }

    // Update Auto-Organize Toggle
    autoOrganizeToggle.checked = Boolean(autoOrganize);

    // Update Gemini Nano Status Indicator
    nanoIndicator.className = 'status-indicator';
    if (nanoStatus === 'readily') {
      nanoIndicator.classList.add('ready');
      nanoStatusText.textContent = 'Gemini Nano: Ready (On-Device)';
    } else if (nanoStatus === 'after-download') {
      nanoIndicator.classList.add('warning');
      nanoStatusText.textContent = 'Gemini Nano: Model Downloading';
    } else {
      nanoIndicator.classList.add('ready');
      nanoStatusText.textContent = 'Gemini Nano / Local Semantic Engine Active';
    }
  } catch (err) {
    console.warn('Failed to fetch status from background:', err);
  }
}

// Auto Organize Toggle handler
autoOrganizeToggle.addEventListener('change', async () => {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const current = data[STORAGE_KEYS.SETTINGS] || {};
    current.autoOrganize = autoOrganizeToggle.checked;
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: current });
  } catch (err) {
    console.error('Error saving autoOrganize preference:', err);
  }
});

// Manual Organize button click
btnOrganize.addEventListener('click', async () => {
  btnOrganize.disabled = true;
  const btnText = btnOrganize.querySelector('.btn-text');
  const spinner = btnOrganize.querySelector('.spinner');

  btnText.textContent = 'Organizing Tabs...';
  spinner.classList.remove('hidden');
  resultBanner.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.TRIGGER_ORGANIZATION
    });

    if (response && response.success) {
      const groupCount = response.groupsCreated ? response.groupsCreated.length : 0;
      const reviewNotice = response.reviewCount > 0 ? ` (${response.reviewCount} routed to Review)` : '';
      resultMessage.textContent = `Organized into ${groupCount} groups${reviewNotice}!`;
      resultBanner.classList.remove('hidden');
    } else {
      resultMessage.textContent = response?.error || 'Organization completed.';
      resultBanner.classList.remove('hidden');
    }
  } catch (err) {
    resultMessage.textContent = 'Organization failed: ' + err.message;
    resultBanner.classList.remove('hidden');
  } finally {
    btnOrganize.disabled = false;
    btnText.textContent = 'Organize Tabs Now';
    spinner.classList.add('hidden');
    await refreshStatus();
  }
});

// Open settings/options page
btnOptions.addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options/options.html'));
  }
});

// Initialize on popup load
document.addEventListener('DOMContentLoaded', refreshStatus);
