/**
 * Gemini Nano Prompt Templates & Schema Definitions
 */

export const SYSTEM_PROMPT = `You are an enterprise Chrome browser assistant. Your task is to organize open browser tabs by semantic similarity into 2 to 4 concise, intuitive category names (e.g. "Cloud Infrastructure", "Project Documentation", "Code Review").
Assign every provided tabId to one suggestedGroup name.
You MUST reply with ONLY a valid JSON array of objects. Do not include markdown code fences or conversational text.`;

export const JSON_SCHEMA_CONSTRAINT = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      tabId: { type: 'number' },
      suggestedGroup: { type: 'string' }
    },
    required: ['tabId', 'suggestedGroup']
  }
};

/**
 * Builds the user prompt for Gemini Nano clustering.
 * @param {Array<{tabId: number, title: string, url: string}>} tabs
 * @returns {string}
 */
export function buildClusteringPrompt(tabs) {
  const tabList = tabs
    .map(t => `- Tab ID: ${t.tabId}\n  Title: ${t.title}\n  URL: ${t.url}`)
    .join('\n\n');

  return `Group the following ${tabs.length} tabs into 2 to 4 semantic categories.
Return a JSON array where each entry has "tabId" (number) and "suggestedGroup" (string).

Tabs to organize:
${tabList}

JSON Output:`;
}

/**
 * Parses and validates the LLM response into an array of { tabId, suggestedGroup }.
 * Handles markdown fences, whitespace, and structural validation.
 * @param {string} rawResponse
 * @returns {Array<{tabId: number, suggestedGroup: string}>}
 */
export function parseAIResponse(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return [];
  }

  let cleaned = rawResponse.trim();

  // Strip Markdown code fences if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
    cleaned = cleaned.trim();
  }

  // Find array brackets if response has leading/trailing commentary
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const validated = [];
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const tabId = Number(item.tabId);
        const suggestedGroup = typeof item.suggestedGroup === 'string' ? item.suggestedGroup.trim() : '';
        if (!isNaN(tabId) && suggestedGroup.length > 0) {
          validated.push({ tabId, suggestedGroup });
        }
      }
    }
    return validated;
  } catch {
    // Return empty array when raw string does not form a valid JSON array
    return [];
  }
}
