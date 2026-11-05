# Intelligent Chrome Tab Organizer (Enterprise PoC)

A privacy-first, enterprise-grade Google Chrome Extension (Manifest V3) that automatically organizes browser tabs using semantic clustering powered by Chrome's local Gemini Nano model (`window.ai.languageModel` / `self.ai.languageModel` Prompt API).

Designed specifically for enterprise environments with **Zero Data Exfiltration** and **Zero Data Retention (ZDR)** guarantees.

---

## Key Features

- **Local Inference Only (Gemini Nano):** All AI processing runs on-device using Chrome's built-in Prompt API. Zero external LLM calls or cloud API costs.
- **Automated Milestone Trigger:** Automatically clusters and organizes tabs when reaching a configurable threshold (default: **10 open tabs**).
- **Domain Blocklisting:** Pre-configured with financial and internal corporate domains (e.g. `chase.com`, `*.internal.company.com`). Blocklisted tabs are completely excluded from AI payloads.
- **Human-in-the-Loop (HITL) Review Bucket:** Heuristically detects suspected PII (SSNs, credit card numbers, email addresses, phone numbers, secret API keys) or `[CONFIDENTIAL]` tags and routes them directly to a dedicated red **"Review (PII / Uncategorized)"** tab group without sending them to the LLM.
- **SPA Fallback DOM Extraction:** Injects a lightweight content script to grab `<h1>` tags for Single Page Applications with generic titles like "Dashboard" or "Home".
- **Zero Data Retention (ZDR):** Tab payloads, URLs, and AI sessions are destroyed and purged from memory immediately following grouping execution.
- **Modern Extension UI:** Real-time progress bar towards the 10-tab threshold, Gemini Nano status chip, manual "Organize Tabs Now" trigger, and configurable Options page.

---

## Project Structure

```
├── manifest.json              # Manifest V3 specification
├── package.json               # Node.js project & test configuration
├── icons/                     # Extension icons (16, 48, 128)
├── src/
│   ├── background/
│   │   └── service-worker.js  # Tab monitoring, badge updates, and trigger logic
│   ├── ai/
│   │   ├── nano-client.js     # Prompt API client & local heuristic fallback
│   │   └── prompt-templates.js# JSON Schema definition & output parser
│   ├── privacy/
│   │   ├── blocklist.js       # Domain matching & system URL filtering
│   │   └── pii-detector.js    # Regex PII & confidential marker scanner
│   ├── tabs/
│   │   ├── extractor.js       # Tab metadata extraction & ZDR memory purge
│   │   └── grouper.js         # chrome.tabGroups management & Review bucket
│   ├── offscreen/
│   │   ├── offscreen.html     # Offscreen bridge for Prompt API in window scope
│   │   └── offscreen.js
│   └── config/
│       └── constants.js       # Thresholds, colors, and regex patterns
├── popup/
│   ├── popup.html             # Extension action popup
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html           # Enterprise options & blocklist editor
│   ├── options.css
│   └── options.js
└── tests/                     # 22 automated unit and integration tests
    ├── blocklist.test.js
    ├── pii-detector.test.js
    ├── nano-client.test.js
    ├── grouper.test.js
    └── integration.test.js
```

---

## Installation & Setup

### 1. Load into Google Chrome

1. Open **Google Chrome** (Chrome 128+ recommended for Gemini Nano Prompt API).
2. Navigate to `chrome://extensions`.
3. In the upper-right corner, toggle on **Developer mode**.
4. Click **Load unpacked** in the top-left corner.
5. Select this project root directory.

### 2. Enabling Gemini Nano in Chrome (Optional for Live Inference)

If running in Chrome with Gemini Nano enabled:
1. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` and set to **Enabled**.
2. Navigate to `chrome://flags/#optimization-guide-on-device-model` and set to **Enabled BypassPerfRequirement**.
3. Relaunch Chrome and check `chrome://components` to ensure **Optimization Guide On Device Model** is downloaded.
*(Note: If Gemini Nano is not enabled on your machine, the extension automatically uses its built-in local semantic fallback heuristic so grouping functions seamlessly.)*

---

## Running Automated Tests

Run the complete test suite (22 unit & integration tests) via Node.js built-in test runner:

```bash
npm test
```

---

## License

Apache-2.0
