# Product Requirements Document (PRD): Intelligent Chrome Tab Organizer (Enterprise)

## 1. Project Overview
Build a privacy-first, enterprise-grade Google Chrome Extension (Manifest V3) that automatically organizes browser tabs using semantic clustering. The extension must utilize Chrome's built-in AI (Gemini Nano) via the local JavaScript Prompt API to ensure zero data exfiltration (Zero Data Retention) and eliminate external LLM API costs.

## 2. Core Mechanics & User Flow
*   **Trigger:** The extension continuously monitors open tabs. The automated grouping process triggers when the browser reaches a threshold of **10 open tabs**.
*   **Data Extraction:** When triggered, extract the `URL`, `Title`, and basic metadata for each open tab. (Include a fallback script to grab the DOM `<h1>` tag for Single Page Applications (SPAs) where titles are generic).
*   **AI Processing:** 
    *   Send the extracted tab data to the local Gemini Nano model (`window.ai.languageModel`).
    *   Instruct the LLM to cluster the tabs by semantic similarity and dynamically invent 2-3 broad category names.
*   **Execution:** Use the `chrome.tabGroups` API to physically group the tabs in the browser based on the LLM's JSON response.
*   **Cleanup:** Implement Zero Data Retention (ZDR). All tab context array data must be destroyed from memory immediately after grouping.

## 3. Privacy, Security & Governance (CRITICAL)
As an enterprise tool, this extension must adhere to strict security constraints:
*   **Local Inference Only:** All AI processing must happen locally on-device. No data is to be sent to external APIs like OpenAI or Anthropic.
*   **Domain Blocklisting:** Implement a configuration (hardcoded or options page) to ignore specific domains (e.g., `hr.internal.company.com`, `chase.com`). Tabs matching the blocklist should be excluded from the payload.
*   **PII & HITL (Human-in-the-Loop) Review Bucket:** If a tab title contains suspected Personally Identifiable Information (PII) or if the AI confidence for a category is low, the tab should NOT be automatically grouped. Instead, route it to an "Uncategorized" or "Review" bucket (a specific Tab Group or UI list) for the user to handle manually.

## 4. Technical Architecture & Setup

### Manifest V3 Requirements
The `manifest.json` must include at least the following permissions:
*   `tabs`: To read open tabs.
*   `tabGroups`: To create and manage Chrome Tab Groups.
*   `background`: To run the Service Worker for background monitoring.

### Gemini Nano (Built-in AI) Integration
The extension will interface with the Chrome Prompt API. 
*   **Availability Check:** The code must check `await window.ai.languageModel.availability()` before execution.
*   **Structured Output:** Use the `responseConstraint` parameter (JSON schema) in the Prompt API to force the LLM to return a strictly formatted array of objects. 

**Expected AI Output Format:**
```json
[
  {
    "tabId": 123,
    "suggestedGroup": "Project Alpha Development"
  },
  {
    "tabId": 124,
    "suggestedGroup": "Financial Dashboards"
  }
]
```

## 5. Antigravity Developer Instructions (Sprint 0 - PoC)
Please build the initial Proof of Concept (Sprint 0) with the following milestones:
1.  **Scaffold:** Create the basic Manifest V3 boilerplate with a Background Service Worker.
2.  **Monitor:** Implement the `chrome.tabs.onCreated` / `onUpdated` listeners to track tab counts and fire a console log when 10 tabs are reached.
3.  **Extract:** Write a function to generate the payload string containing Tab IDs, URLs, and Titles (excluding a sample blocklist array).
4.  **Prompt:** Implement the `window.ai.languageModel` session creation, passing the payload, and instructing the model to return the structured JSON schema.
5.  **Group:** Parse the LLM response and execute `chrome.tabs.group()` and `chrome.tabGroups.update()` to apply the generated names and colors to the tabs.