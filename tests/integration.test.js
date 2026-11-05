import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSanitizedTabPayload } from '../src/tabs/extractor.js';
import { clusterTabsWithNano } from '../src/ai/nano-client.js';
import { applyTabGroupings } from '../src/tabs/grouper.js';
import { REVIEW_GROUP_NAME } from '../src/config/constants.js';

test('End-to-End Pipeline: extract -> cluster -> group -> ZDR purge', async () => {
  // Simulate 12 open tabs (exceeding the threshold of 10)
  const mockTabs = [
    { id: 1, title: 'GitHub - deepmind/antigravity', url: 'https://github.com/deepmind/antigravity' },
    { id: 2, title: 'Stack Overflow - Chrome Extension Manifest V3', url: 'https://stackoverflow.com/questions/1' },
    { id: 3, title: 'Pull Request #89 - Feature Auth', url: 'https://github.com/myorg/repo/pull/89' },
    { id: 4, title: 'AWS Management Console - EC2 Instances', url: 'https://console.aws.amazon.com' },
    { id: 5, title: 'Google Cloud Platform - Kubernetes Engine', url: 'https://cloud.google.com/kubernetes' },
    { id: 6, title: 'Sprint 10 JIRA Board', url: 'https://jira.company.com/board/10' },
    { id: 7, title: 'Linear - Backlog Tasks', url: 'https://linear.app/team/backlog' },
    { id: 8, title: 'Q3 Financial Review [CONFIDENTIAL]', url: 'https://docs.google.com/document/d/secret' },
    { id: 9, title: 'Employee Verification SSN 000-11-2222', url: 'https://internal.portal.com/verify' },
    { id: 10, title: 'Chase Online Banking - Account Overview', url: 'https://chase.com/login' },
    { id: 11, title: 'HR Employee Portal', url: 'https://hr.internal.company.com/portal' },
    { id: 12, title: 'System Settings', url: 'chrome://settings' }
  ];

  const customBlocklist = ['chase.com', 'hr.internal.company.com'];

  // Step 1: Extraction & Sanitization
  const { aiPayload, reviewTabs, blocklistedTabs } = await extractSanitizedTabPayload({
    tabsMock: mockTabs,
    blocklist: customBlocklist
  });

  // Verify Blocklisting
  assert.equal(blocklistedTabs.length, 3); // chase.com, hr.internal.company.com, chrome://settings
  assert.ok(blocklistedTabs.some(t => t.url.includes('chase.com')));
  assert.ok(blocklistedTabs.some(t => t.url.includes('hr.internal.company.com')));
  assert.ok(blocklistedTabs.some(t => t.url.startsWith('chrome://')));

  // Verify PII Detection & Review segregation
  assert.equal(reviewTabs.length, 2); // Q3 Financial Review [CONFIDENTIAL] and SSN 000-11-2222
  assert.ok(reviewTabs.some(t => t.tabId === 8));
  assert.ok(reviewTabs.some(t => t.tabId === 9));

  // Verify Safe Tabs for AI
  assert.equal(aiPayload.length, 7);
  for (const t of aiPayload) {
    assert.notEqual(t.tabId, 8);
    assert.notEqual(t.tabId, 9);
    assert.notEqual(t.tabId, 10);
    assert.notEqual(t.tabId, 11);
    assert.notEqual(t.tabId, 12);
  }

  // Step 2: AI Clustering (runs mock heuristic in test environment)
  const aiGroupings = await clusterTabsWithNano(aiPayload, { allowMockFallback: true });
  assert.equal(aiGroupings.length, 7);

  // Step 3: Tab Grouping
  const groupingResult = await applyTabGroupings({ aiGroupings, reviewTabs });
  assert.equal(groupingResult.success, true);
  assert.equal(groupingResult.reviewCount, 2);

  const groupTitles = groupingResult.groupsCreated.map(g => g.title);
  assert.ok(groupTitles.includes(REVIEW_GROUP_NAME));
  assert.ok(groupTitles.includes('Code & Development'));
  assert.ok(groupTitles.includes('Cloud Infrastructure'));
  assert.ok(groupTitles.includes('Project Management'));

  // Step 4: Verify Zero Data Retention memory purge
  assert.equal(aiGroupings.length, 0);
  assert.equal(reviewTabs.length, 0);
});
