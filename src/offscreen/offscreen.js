/**
 * Offscreen Document Handler for Chrome Prompt API (Gemini Nano)
 * Provides window.ai access for service workers in environments where self.ai is absent.
 */

import { clusterTabsWithNano, checkGeminiAvailability } from '../ai/nano-client.js';
import { MESSAGE_ACTIONS } from '../config/constants.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === MESSAGE_ACTIONS.PROMPT_AI) {
    (async () => {
      try {
        const groupings = await clusterTabsWithNano(message.payload);
        sendResponse({ success: true, groupings });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (message.action === 'CHECK_NANO_AVAILABILITY') {
    (async () => {
      try {
        const status = await checkGeminiAvailability();
        sendResponse({ success: true, status });
      } catch (err) {
        sendResponse({ success: false, status: 'no', error: err.message });
      }
    })();
    return true;
  }
});
