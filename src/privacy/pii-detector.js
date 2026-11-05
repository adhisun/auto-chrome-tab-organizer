/**
 * Enterprise PII & Sensitive Information Detector
 * Identifies personally identifiable information (PII), credentials, or confidential tags
 * in tab titles and headers to prevent data exposure and route them to Human-in-the-Loop (HITL) review.
 */

import { PII_PATTERNS } from '../config/constants.js';

/**
 * Checks a text string for sensitive PII or confidential labels.
 * @param {string} text
 * @returns {{ hasPII: boolean, reasons: string[] }}
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string') {
    return { hasPII: false, reasons: [] };
  }

  const reasons = [];

  if (PII_PATTERNS.SSN.test(text)) {
    reasons.push('Social Security Number detected');
  }

  if (PII_PATTERNS.CREDIT_CARD.test(text)) {
    reasons.push('Credit Card / Financial Account number detected');
  }

  if (PII_PATTERNS.EMAIL.test(text)) {
    reasons.push('Email address detected in title');
  }

  if (PII_PATTERNS.PHONE.test(text)) {
    reasons.push('Phone number detected');
  }

  if (PII_PATTERNS.CONFIDENTIAL_TAGS.test(text)) {
    reasons.push('Confidential/Proprietary tag detected');
  }

  if (PII_PATTERNS.API_KEYS.test(text)) {
    reasons.push('API key or secret token detected');
  }

  return {
    hasPII: reasons.length > 0,
    reasons
  };
}

/**
 * Evaluates a tab object (title, url, extractedText) for any sensitive PII.
 * @param {{ id: number, title?: string, url?: string, extractedHeading?: string }} tab
 * @returns {{ isSensitive: boolean, reasons: string[] }}
 */
export function checkTabSensitivity(tab) {
  if (!tab) return { isSensitive: false, reasons: [] };

  const combined = [
    tab.title || '',
    tab.extractedHeading || '',
    tab.url ? decodeURIComponent(tab.url) : ''
  ].join(' ');

  const result = detectPII(combined);
  return {
    isSensitive: result.hasPII,
    reasons: result.reasons
  };
}

/**
 * Partitions a list of tabs into safe tabs and tabs that must be routed to the HITL Review bucket.
 * @param {Array<any>} tabs
 * @returns {{ safeTabs: Array<any>, reviewTabs: Array<any> }}
 */
export function partitionTabsForReview(tabs) {
  if (!Array.isArray(tabs)) {
    return { safeTabs: [], reviewTabs: [] };
  }

  const safeTabs = [];
  const reviewTabs = [];

  for (const tab of tabs) {
    const { isSensitive, reasons } = checkTabSensitivity(tab);
    if (isSensitive) {
      reviewTabs.push({ ...tab, reviewReasons: reasons });
    } else {
      safeTabs.push(tab);
    }
  }

  return { safeTabs, reviewTabs };
}
