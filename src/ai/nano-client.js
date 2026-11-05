/**
 * Gemini Nano (Chrome Prompt API) Client
 * Interfaces with window.ai.languageModel / self.ai.languageModel
 * Zero external calls - 100% on-device inference.
 */

import { SYSTEM_PROMPT, JSON_SCHEMA_CONSTRAINT, buildClusteringPrompt, parseAIResponse } from './prompt-templates.js';

/**
 * Resolves the available AI LanguageModel object from global scopes.
 * Checks window.ai, self.ai, or global ai.
 */
export function getLanguageModelScope() {
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    return window.ai.languageModel;
  }
  if (typeof self !== 'undefined' && self.ai && self.ai.languageModel) {
    return self.ai.languageModel;
  }
  if (typeof globalThis !== 'undefined' && globalThis.ai && globalThis.ai.languageModel) {
    return globalThis.ai.languageModel;
  }
  return null;
}

/**
 * Checks Gemini Nano availability on the device.
 * @returns {Promise<'readily'|'after-download'|'no'|'mock'>}
 */
export async function checkGeminiAvailability() {
  const model = getLanguageModelScope();
  if (!model) {
    return 'no';
  }

  try {
    if (typeof model.availability === 'function') {
      return await model.availability();
    }
    if (typeof model.capabilities === 'function') {
      const caps = await model.capabilities();
      return caps.available || 'no';
    }
  } catch (err) {
    console.warn('Error checking Gemini Nano availability:', err);
    return 'no';
  }

  return 'no';
}

/**
 * Fallback semantic heuristic clustering when Gemini Nano is not enabled or during tests.
 * @param {Array<{tabId: number, title: string, url: string}>} tabs
 * @returns {Array<{tabId: number, suggestedGroup: string}>}
 */
export function mockClusteringHeuristic(tabs) {
  const results = [];
  for (const tab of tabs) {
    const url = (tab.url || '').toLowerCase();
    const title = (tab.title || '').toLowerCase();

    let category = 'General Research';

    if (url.includes('github') || url.includes('gitlab') || url.includes('stackoverflow') || title.includes('pull request') || title.includes('commit') || title.includes('repo')) {
      category = 'Code & Development';
    } else if (url.includes('aws') || url.includes('cloud.google') || url.includes('azure') || url.includes('console.') || title.includes('console') || title.includes('ec2')) {
      category = 'Cloud Infrastructure';
    } else if (url.includes('jira') || url.includes('trello') || url.includes('linear') || url.includes('asana') || /\bboard\b/i.test(title) || /\bticket\b/i.test(title)) {
      category = 'Project Management';
    } else if (url.includes('docs.google') || url.includes('notion') || url.includes('confluence') || title.includes('doc') || title.includes('notes') || title.includes('wiki')) {
      category = 'Documentation & Notes';
    } else if (url.includes('youtube') || url.includes('spotify') || url.includes('reddit') || url.includes('twitter') || url.includes('x.com')) {
      category = 'Media & Social';
    }

    results.push({
      tabId: tab.tabId,
      suggestedGroup: category
    });
  }
  return results;
}

/**
 * Creates a Gemini Nano session, prompts it with tabs payload, and cleans up the session.
 * @param {Array<{tabId: number, title: string, url: string}>} tabs
 * @param {object} [options]
 * @param {boolean} [options.allowMockFallback=true]
 * @returns {Promise<Array<{tabId: number, suggestedGroup: string}>>}
 */
export async function clusterTabsWithNano(tabs, options = {}) {
  const allowMock = options.allowMockFallback !== false;

  if (!tabs || tabs.length === 0) {
    return [];
  }

  const model = getLanguageModelScope();
  if (!model) {
    if (allowMock) {
      console.warn('Gemini Nano Prompt API unavailable in this context; using local fallback heuristic.');
      return mockClusteringHeuristic(tabs);
    }
    throw new Error('Chrome Prompt API (window.ai.languageModel) is not available.');
  }

  const availability = await checkGeminiAvailability();
  if (availability === 'no') {
    if (allowMock) {
      console.warn('Gemini Nano is not available on this device; using local fallback heuristic.');
      return mockClusteringHeuristic(tabs);
    }
    throw new Error('Gemini Nano is not available on this device.');
  }

  let session = null;
  try {
    // Attempt session creation with responseConstraint (Prompt API structured JSON output)
    const sessionConfig = {
      systemPrompt: SYSTEM_PROMPT
    };

    try {
      session = await model.create({
        ...sessionConfig,
        responseConstraint: JSON_SCHEMA_CONSTRAINT
      });
    } catch {
      // If responseConstraint is not yet supported in this specific Chrome build, create standard session
      session = await model.create(sessionConfig);
    }

    const promptText = buildClusteringPrompt(tabs);
    const rawResult = await session.prompt(promptText);

    const parsedGroups = parseAIResponse(rawResult);

    if (parsedGroups.length === 0 && allowMock) {
      console.warn('Nano output could not be parsed into groups; falling back to heuristic.');
      return mockClusteringHeuristic(tabs);
    }

    return parsedGroups;
  } finally {
    // Zero Data Retention (ZDR): Destroy the AI session and clear local context
    if (session && typeof session.destroy === 'function') {
      try {
        session.destroy();
      } catch (err) {
        console.warn('Error destroying Gemini Nano session:', err);
      }
    }
  }
}
