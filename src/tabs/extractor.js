/**
 * Tab Data Extractor & Sanitizer
 * Gathers tab details, extracts SPA fallback DOM <h1> titles, filters against blocklists,
 * and handles Zero Data Retention (ZDR) memory wiping.
 */

import { filterTabsByBlocklist } from '../privacy/blocklist.js';
import { partitionTabsForReview } from '../privacy/pii-detector.js';

/**
 * Checks if a tab title is generic and warrants an SPA DOM fallback extraction.
 * @param {string} title
 * @returns {boolean}
 */
export function isGenericTitle(title) {
  if (!title || typeof title !== 'string') return true;
  const clean = title.trim().toLowerCase();
  const genericTerms = [
    'untitled',
    'home',
    'dashboard',
    'app',
    'index',
    'new tab',
    'welcome',
    'loading...',
    'portal'
  ];
  return clean.length <= 2 || genericTerms.includes(clean);
}

/**
 * Script injected into SPA tabs to retrieve the top <h1> or main heading.
 * Runs in the context of the web page.
 */
function domHeadingExtractor() {
  const h1 = document.querySelector('h1');
  if (h1 && h1.innerText && h1.innerText.trim().length > 0) {
    return h1.innerText.trim().slice(0, 150);
  }
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.content && metaDesc.content.trim().length > 0) {
    return metaDesc.content.trim().slice(0, 150);
  }
  return null;
}

/**
 * Attempts to extract <h1> from an SPA tab using chrome.scripting API.
 * @param {number} tabId
 * @returns {Promise<string|null>}
 */
export async function extractSpaHeading(tabId) {
  if (typeof chrome === 'undefined' || !chrome.scripting || !chrome.scripting.executeScript) {
    return null;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: domHeadingExtractor
    });
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (err) {
    // Tab might be restricted (e.g. chrome://, webstore) or not loaded yet
    // Silently ignore permission/scripting errors for restricted pages
  }
  return null;
}

/**
 * Gathers and sanitizes tabs from the browser window.
 * Filters blocklisted domains and segregates PII tabs into reviewTabs.
 *
 * @param {object} [options]
 * @param {string[]} [options.blocklist]
 * @param {number} [options.windowId]
 * @returns {Promise<{
 *   aiPayload: Array<{tabId: number, title: string, url: string}>,
 *   reviewTabs: Array<any>,
 *   blocklistedTabs: Array<any>
 * }>}
 */
export async function extractSanitizedTabPayload(options = {}) {
  const blocklist = options.blocklist;
  const queryInfo = { currentWindow: true };
  if (options.windowId !== undefined) {
    queryInfo.windowId = options.windowId;
  }

  let tabs = [];
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    tabs = await chrome.tabs.query(queryInfo);
  } else {
    tabs = options.tabsMock || [];
  }

  // 1. Filter out blocklisted domains (Excluded from payload entirely)
  const { allowed, blocklisted: blocklistedTabs } = filterTabsByBlocklist(tabs, blocklist);

  // 2. Fallback SPA DOM inspection for generic titles
  const enrichedTabs = [];
  for (const tab of allowed) {
    let effectiveTitle = (tab.title || '').trim();
    let spaHeading = null;

    if (isGenericTitle(effectiveTitle) && tab.id) {
      spaHeading = await extractSpaHeading(tab.id);
      if (spaHeading) {
        effectiveTitle = `${effectiveTitle ? effectiveTitle + ' - ' : ''}${spaHeading}`;
      }
    }

    enrichedTabs.push({
      tabId: tab.id,
      title: effectiveTitle || tab.url || 'Untitled Tab',
      url: tab.url || '',
      extractedHeading: spaHeading
    });
  }

  // 3. Partition for PII and Sensitive Information
  const { safeTabs, reviewTabs } = partitionTabsForReview(enrichedTabs);

  // 4. Construct AI Payload (strictly Tab IDs, Titles, and sanitized URLs)
  const aiPayload = safeTabs.map(t => ({
    tabId: t.tabId,
    title: t.title,
    url: t.url
  }));

  return {
    aiPayload,
    reviewTabs,
    blocklistedTabs
  };
}

/**
 * Zero Data Retention (ZDR) Memory Purge
 * Overwrites memory objects immediately after grouping completes.
 * @param {Array<any>|object} dataRef
 */
export function purgeZDRMemory(dataRef) {
  if (!dataRef) return;
  if (Array.isArray(dataRef)) {
    for (let i = 0; i < dataRef.length; i++) {
      if (typeof dataRef[i] === 'object' && dataRef[i] !== null) {
        for (const key of Object.keys(dataRef[i])) {
          dataRef[i][key] = null;
        }
      }
      dataRef[i] = null;
    }
    dataRef.length = 0;
  } else if (typeof dataRef === 'object') {
    for (const key of Object.keys(dataRef)) {
      dataRef[key] = null;
    }
  }
}
