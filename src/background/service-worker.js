/**
 * Intelligent Chrome Tab Organizer - Background Service Worker (Manifest V3)
 * Continuous tab monitoring, threshold detection, and clustering orchestration.
 */

import { DEFAULT_TAB_THRESHOLD, DEFAULT_BLOCKLIST, STORAGE_KEYS, MESSAGE_ACTIONS } from '../config/constants.js';
import { extractSanitizedTabPayload } from '../tabs/extractor.js';
import { clusterTabsWithNano, checkGeminiAvailability } from '../ai/nano-client.js';
import { applyTabGroupings } from '../tabs/grouper.js';

let isOrganizing = false;
let debounceTimer = null;
let lastGroupedTabCount = 0;

/**
 * Loads user settings from chrome.storage.local with defaults.
 */
async function getSettings() {
  const defaults = {
    threshold: DEFAULT_TAB_THRESHOLD,
    blocklist: DEFAULT_BLOCKLIST,
    autoOrganize: true,
    enablePIIReview: true
  };

  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...defaults, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
  } catch {
    return defaults;
  }
}

/**
 * Updates extension action badge with current active window tab count.
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const count = tabs.length;
    const settings = await getSettings();

    await chrome.action.setBadgeText({ text: `${count}` });
    const color = count >= settings.threshold ? '#d93025' : '#1a73e8'; // Red if at threshold, else blue
    await chrome.action.setBadgeBackgroundColor({ color });
    return count;
  } catch (err) {
    console.warn('Error updating badge:', err);
    return 0;
  }
}

/**
 * Ensures offscreen document exists if Prompt API is not directly present in service worker scope.
 */
async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('src/offscreen/offscreen.html');

  // Check if offscreen document already exists
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    if (contexts.length > 0) return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['WORKERS'],
      justification: 'Run local Gemini Nano Prompt API in window context for browser tab clustering.'
    });
  } catch (err) {
    // If document already created or offscreen is not supported, ignore
    if (!err.message.includes('Only a single offscreen')) {
      console.warn('Offscreen document creation note:', err.message);
    }
  }
}

/**
 * Coordinates tab clustering inference using direct service worker AI or offscreen bridge.
 * @param {Array<any>} payload
 */
async function runClusteringInference(payload) {
  // If native Prompt API is directly accessible in service worker
  if (typeof self !== 'undefined' && self.ai && self.ai.languageModel) {
    return await clusterTabsWithNano(payload);
  }

  // Otherwise, use offscreen document bridge
  try {
    await setupOffscreenDocument();
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: MESSAGE_ACTIONS.PROMPT_AI, payload },
        response => {
          if (chrome.runtime.lastError) {
            console.warn('Offscreen bridge communication fallback:', chrome.runtime.lastError.message);
            resolve(clusterTabsWithNano(payload, { allowMockFallback: true }));
          } else if (response && response.success) {
            resolve(response.groupings);
          } else {
            console.warn('Offscreen AI returned error:', response?.error);
            resolve(clusterTabsWithNano(payload, { allowMockFallback: true }));
          }
        }
      );
    });
  } catch (err) {
    console.warn('Falling back to local heuristic due to bridge error:', err);
    return await clusterTabsWithNano(payload, { allowMockFallback: true });
  }
}

/**
 * Main orchestration entrypoint for tab organization.
 * @param {boolean} [force=false]
 */
export async function organizeTabs(force = false) {
  if (isOrganizing) {
    console.log('[Tab Organizer] Organization is already in progress, skipping.');
    return { skipped: true, reason: 'in-progress' };
  }

  isOrganizing = true;
  console.log('[Tab Organizer] Starting tab organization workflow...');

  try {
    const settings = await getSettings();
    const currentTabs = await chrome.tabs.query({ currentWindow: true });

    if (!force && currentTabs.length < settings.threshold) {
      console.log(`[Tab Organizer] Open tabs count (${currentTabs.length}) below threshold (${settings.threshold}).`);
      return { skipped: true, reason: 'below-threshold' };
    }

    // Step 1: Extract and sanitize payload (Domain blocklist filtering & PII detection)
    const { aiPayload, reviewTabs, blocklistedTabs } = await extractSanitizedTabPayload({
      blocklist: settings.blocklist
    });

    console.log(`[Tab Organizer] Extracted: ${aiPayload.length} for AI, ${reviewTabs.length} for Review, ${blocklistedTabs.length} Blocklisted.`);

    // Step 2: Send sanitized tabs to Gemini Nano Prompt API
    let aiGroupings = [];
    if (aiPayload.length > 0) {
      aiGroupings = await runClusteringInference(aiPayload);
    }

    // Step 3: Physically organize tabs into Chrome Tab Groups
    const result = await applyTabGroupings({
      aiGroupings,
      reviewTabs: settings.enablePIIReview ? reviewTabs : []
    });

    lastGroupedTabCount = currentTabs.length;
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_RUN]: {
        timestamp: Date.now(),
        tabCount: currentTabs.length,
        groups: result.groupsCreated
      }
    });

    console.log('[Tab Organizer] Successfully completed grouping:', result.groupsCreated);
    await updateBadge();
    return result;
  } catch (err) {
    console.error('[Tab Organizer] Organization failed:', err);
    return { success: false, error: err.message };
  } finally {
    isOrganizing = false;
  }
}

/**
 * Debounced check when tab count changes.
 */
function handleTabCountChange() {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    const count = await updateBadge();
    const settings = await getSettings();

    // Check milestone trigger
    if (settings.autoOrganize && count >= settings.threshold && count !== lastGroupedTabCount) {
      console.log(`[Tab Organizer] Milestone reached: ${count} open tabs (Threshold: ${settings.threshold}). Triggering auto-organization.`);
      await organizeTabs(false);
    }
  }, 1000);
}

// Tab lifecycle event listeners
chrome.tabs.onCreated.addListener(handleTabCountChange);
chrome.tabs.onRemoved.addListener(handleTabCountChange);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    handleTabCountChange();
  }
});

// Runtime message handling (from popup or options)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === MESSAGE_ACTIONS.TRIGGER_ORGANIZATION) {
    organizeTabs(true).then(result => sendResponse(result));
    return true; // Keep async channel open
  }

  if (message.action === MESSAGE_ACTIONS.GET_STATUS) {
    (async () => {
      const settings = await getSettings();
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let nanoStatus = 'no';
      try {
        nanoStatus = await checkGeminiAvailability();
      } catch {
        nanoStatus = 'no';
      }

      const lastRun = (await chrome.storage.local.get(STORAGE_KEYS.LAST_RUN))[STORAGE_KEYS.LAST_RUN] || null;

      sendResponse({
        tabCount: tabs.length,
        threshold: settings.threshold,
        autoOrganize: settings.autoOrganize,
        nanoStatus,
        lastRun
      });
    })();
    return true;
  }
});

// Initial startup badge setup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Tab Organizer] Extension installed/updated.');
  await updateBadge();
});
