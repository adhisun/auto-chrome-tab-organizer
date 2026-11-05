/**
 * Enterprise Domain Blocklist Utilities
 * Ensures tabs from sensitive, internal, or financial domains are never exfiltrated
 * or sent to AI context.
 */

import { DEFAULT_BLOCKLIST } from '../config/constants.js';

/**
 * Extracts the hostname from a given URL string.
 * @param {string} urlString
 * @returns {string|null}
 */
export function extractHostname(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  try {
    const url = new URL(urlString);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Checks whether a tab's URL matches any blocklisted domain pattern or internal protocol.
 * @param {string} urlString
 * @param {string[]} [blocklist]
 * @returns {boolean}
 */
export function isDomainBlocklisted(urlString, blocklist = DEFAULT_BLOCKLIST) {
  if (!urlString || typeof urlString !== 'string') return true;

  // Internal and system protocols should always be excluded from AI clustering
  const trimmed = urlString.trim().toLowerCase();
  if (
    trimmed.startsWith('chrome://') ||
    trimmed.startsWith('chrome-extension://') ||
    trimmed.startsWith('edge://') ||
    trimmed.startsWith('about:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('view-source:')
  ) {
    return true;
  }

  const hostname = extractHostname(urlString);
  if (!hostname) return true; // Malformed URLs blocked by default

  const list = Array.isArray(blocklist) ? blocklist : DEFAULT_BLOCKLIST;

  for (const item of list) {
    if (!item) continue;
    const rule = item.trim().toLowerCase();

    // Wildcard matching, e.g. *.internal.company.com
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(2);
      if (hostname === suffix || hostname.endsWith('.' + suffix)) {
        return true;
      }
    } else {
      // Exact hostname or domain suffix match
      // e.g. "chase.com" matches "chase.com" and "auth.chase.com"
      if (hostname === rule || hostname.endsWith('.' + rule)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Partitions a list of tabs into allowed tabs and blocklisted tabs.
 * @param {Array<{id: number, url: string, title?: string}>} tabs
 * @param {string[]} [blocklist]
 * @returns {{ allowed: Array<any>, blocklisted: Array<any> }}
 */
export function filterTabsByBlocklist(tabs, blocklist = DEFAULT_BLOCKLIST) {
  if (!Array.isArray(tabs)) {
    return { allowed: [], blocklisted: [] };
  }

  const allowed = [];
  const blocklisted = [];

  for (const tab of tabs) {
    if (isDomainBlocklisted(tab.url, blocklist)) {
      blocklisted.push(tab);
    } else {
      allowed.push(tab);
    }
  }

  return { allowed, blocklisted };
}
