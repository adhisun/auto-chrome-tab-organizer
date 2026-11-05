/**
 * Chrome Tab Grouper & Execution Engine
 * Maps Gemini Nano classifications and Review Bucket tabs into native Chrome Tab Groups.
 * Enforces Zero Data Retention (ZDR) upon completion.
 */

import { TAB_GROUP_COLORS, REVIEW_GROUP_NAME, REVIEW_GROUP_COLOR } from '../config/constants.js';
import { purgeZDRMemory } from './extractor.js';

/**
 * Organizes tabs into Chrome Tab Groups based on AI groupings and review bucket items.
 *
 * @param {object} params
 * @param {Array<{tabId: number, suggestedGroup: string}>} params.aiGroupings
 * @param {Array<{tabId: number, title?: string, reviewReasons?: string[]}>} params.reviewTabs
 * @returns {Promise<{
 *   success: boolean,
 *   groupsCreated: Array<{ title: string, color: string, count: number }>,
 *   reviewCount: number
 * }>}
 */
export async function applyTabGroupings({ aiGroupings = [], reviewTabs = [] }) {
  const groupsCreated = [];
  let reviewCount = 0;

  // 1. Bucket tabs by category title
  const categoryMap = new Map(); // groupTitle -> tabIds[]

  for (const item of aiGroupings) {
    if (!item || !item.tabId) continue;
    const groupName = (item.suggestedGroup || 'General').trim();
    if (!categoryMap.has(groupName)) {
      categoryMap.set(groupName, []);
    }
    categoryMap.get(groupName).push(item.tabId);
  }

  // 2. Apply AI groups in Chrome
  let colorIndex = 0;
  for (const [groupTitle, tabIds] of categoryMap.entries()) {
    if (!tabIds || tabIds.length === 0) continue;

    const color = TAB_GROUP_COLORS[colorIndex % TAB_GROUP_COLORS.length];
    colorIndex++;

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.group) {
        const groupId = await chrome.tabs.group({ tabIds });
        if (chrome.tabGroups && chrome.tabGroups.update) {
          await chrome.tabGroups.update(groupId, {
            title: groupTitle,
            color: color,
            collapsed: false
          });
        }
      }
      groupsCreated.push({ title: groupTitle, color, count: tabIds.length });
    } catch (err) {
      console.error(`Failed to create Chrome Tab Group for "${groupTitle}":`, err);
    }
  }

  // 3. Apply Human-in-the-Loop Review Bucket
  if (reviewTabs && reviewTabs.length > 0) {
    const reviewTabIds = reviewTabs.map(t => t.tabId || t.id).filter(Boolean);
    reviewCount = reviewTabIds.length;

    if (reviewTabIds.length > 0) {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.group) {
          const reviewGroupId = await chrome.tabs.group({ tabIds: reviewTabIds });
          if (chrome.tabGroups && chrome.tabGroups.update) {
            await chrome.tabGroups.update(reviewGroupId, {
              title: REVIEW_GROUP_NAME,
              color: REVIEW_GROUP_COLOR,
              collapsed: false
            });
          }
        }
        groupsCreated.push({
          title: REVIEW_GROUP_NAME,
          color: REVIEW_GROUP_COLOR,
          count: reviewTabIds.length
        });
      } catch (err) {
        console.error('Failed to create Review Tab Group:', err);
      }
    }
  }

  // 4. Zero Data Retention (ZDR) Execution
  // Obliterate tab arrays and grouping metadata from memory
  purgeZDRMemory(aiGroupings);
  purgeZDRMemory(reviewTabs);
  categoryMap.clear();

  console.log('[ZDR] Tab context payload and memory arrays safely purged.');

  return {
    success: true,
    groupsCreated,
    reviewCount
  };
}
