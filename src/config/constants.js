/**
 * Intelligent Chrome Tab Organizer - Enterprise Configuration & Constants
 */

export const DEFAULT_TAB_THRESHOLD = 10;

export const DEFAULT_BLOCKLIST = [
  'hr.internal.company.com',
  'payroll.internal.company.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'fidelity.com',
  'paypal.com',
  'login.gov',
  'accounts.google.com'
];

export const REVIEW_GROUP_NAME = 'Review (PII / Uncategorized)';
export const REVIEW_GROUP_COLOR = 'red';

export const TAB_GROUP_COLORS = [
  'blue',
  'green',
  'yellow',
  'purple',
  'pink',
  'cyan',
  'orange',
  'grey'
];

export const PII_PATTERNS = {
  // Social Security Number: 000-00-0000 or 000 00 0000
  SSN: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/,
  // Standard Credit Cards (Visa, MasterCard, Amex, Discover): formatted 4x4 or 13-19 digit strings
  CREDIT_CARD: /\b(?:4[0-9]{3}(?:[- ]?[0-9]{4}){3}|5[1-5][0-9]{2}(?:[- ]?[0-9]{4}){3}|3[47][0-9]{2}(?:[- ]?[0-9]{6}[- ]?[0-9]{5})|6(?:011|5[0-9]{2})(?:[- ]?[0-9]{4}){3}|[0-9]{13,19})\b/,
  // Standard Email Address
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/,
  // Phone numbers (US / International patterns)
  PHONE: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  // Explicit Confidentiality Labels
  CONFIDENTIAL_TAGS: /\b(?:CONFIDENTIAL|RESTRICTED|INTERNAL ONLY|PROPRIETARY|SECRET|PII|HIPAA|PATIENT RECORD|SALARY|PAYROLL)\b/i,
  // Secret/API Key patterns (e.g. bearer tokens, api keys)
  API_KEYS: /\b(?:api[_-]?key[_-]?[0-9a-zA-Z]{16,}|token[_-]?[0-9a-zA-Z]{16,}|secret[_-]?[0-9a-zA-Z]{16,}|bearer\s+[0-9a-zA-Z._-]{20,})\b/i
};

export const STORAGE_KEYS = {
  SETTINGS: 'tab_organizer_settings',
  LAST_RUN: 'tab_organizer_last_run'
};

export const MESSAGE_ACTIONS = {
  TRIGGER_ORGANIZATION: 'TRIGGER_ORGANIZATION',
  GET_STATUS: 'GET_STATUS',
  PROMPT_AI: 'PROMPT_AI',
  OFFSCREEN_READY: 'OFFSCREEN_READY'
};
