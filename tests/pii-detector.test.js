import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPII, checkTabSensitivity, partitionTabsForReview } from '../src/privacy/pii-detector.js';

test('detectPII flags US Social Security Numbers', () => {
  const result = detectPII('Employee Profile - SSN 123-45-6789 Verification');
  assert.equal(result.hasPII, true);
  assert.match(result.reasons[0], /Social Security Number/);
});

test('detectPII flags Credit Card account numbers', () => {
  const result = detectPII('Checkout - Card 4111 2222 3333 4444');
  assert.equal(result.hasPII, true);
  assert.match(result.reasons[0], /Credit Card/);
});

test('detectPII flags Email addresses and phone numbers in titles', () => {
  const emailRes = detectPII('Inbox: message for user.smith@corp.com');
  assert.equal(emailRes.hasPII, true);

  const phoneRes = detectPII('Contact Details: (555) 234-5678');
  assert.equal(phoneRes.hasPII, true);
});

test('detectPII flags Confidential and Secret tags', () => {
  const result = detectPII('[CONFIDENTIAL] Q4 Financials and Payroll');
  assert.equal(result.hasPII, true);
  assert.match(result.reasons[0], /Confidential/);
});

test('detectPII flags API keys and tokens', () => {
  const result = detectPII('Settings - api_key_sample1234567890abcdef');
  assert.equal(result.hasPII, true);
  assert.match(result.reasons[0], /API key/);
});

test('detectPII passes clean titles', () => {
  const result = detectPII('GitHub - kubernetes/kubernetes: Production-Grade Container Scheduling');
  assert.equal(result.hasPII, false);
  assert.equal(result.reasons.length, 0);
});

test('partitionTabsForReview routes sensitive tabs into reviewTabs', () => {
  const tabs = [
    { tabId: 101, title: 'GitHub - Project Repo', url: 'https://github.com/myorg/repo' },
    { tabId: 102, title: 'HR Portal - SSN 987-65-4321 Records', url: 'https://portal.company.com' },
    { tabId: 103, title: 'AWS Management Console', url: 'https://console.aws.amazon.com' },
    { tabId: 104, title: 'Payroll Salary Adjustments [RESTRICTED]', url: 'https://docs.google.com/sheet' }
  ];

  const { safeTabs, reviewTabs } = partitionTabsForReview(tabs);
  assert.equal(safeTabs.length, 2);
  assert.deepEqual(safeTabs.map(t => t.tabId), [101, 103]);

  assert.equal(reviewTabs.length, 2);
  assert.deepEqual(reviewTabs.map(t => t.tabId), [102, 104]);
});
