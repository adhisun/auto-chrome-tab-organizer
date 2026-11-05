import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTabGroupings } from '../src/tabs/grouper.js';
import { isGenericTitle, purgeZDRMemory } from '../src/tabs/extractor.js';
import { REVIEW_GROUP_NAME, REVIEW_GROUP_COLOR } from '../src/config/constants.js';

test('isGenericTitle flags common SPA placeholder titles', () => {
  assert.equal(isGenericTitle('Dashboard'), true);
  assert.equal(isGenericTitle('Untitled'), true);
  assert.equal(isGenericTitle('Home'), true);
  assert.equal(isGenericTitle('App'), true);
  assert.equal(isGenericTitle(''), true);
  assert.equal(isGenericTitle('   '), true);
  assert.equal(isGenericTitle('GitHub - Pull Request #123'), false);
});

test('purgeZDRMemory clears array and destroys object contents', () => {
  const sensitivePayload = [
    { tabId: 1, title: 'Sensitive Patient 1', url: 'https://records.internal' },
    { tabId: 2, title: 'Sensitive Patient 2', url: 'https://records.internal' }
  ];

  purgeZDRMemory(sensitivePayload);

  // Array length must be 0
  assert.equal(sensitivePayload.length, 0);
});

test('applyTabGroupings processes categories, creates Review bucket, and purges ZDR memory', async () => {
  const aiGroupings = [
    { tabId: 101, suggestedGroup: 'Development' },
    { tabId: 102, suggestedGroup: 'Development' },
    { tabId: 103, suggestedGroup: 'Documentation' }
  ];

  const reviewTabs = [
    { tabId: 999, title: 'Confidential Salary Details', reviewReasons: ['Confidential tag'] }
  ];

  const result = await applyTabGroupings({ aiGroupings, reviewTabs });

  assert.equal(result.success, true);
  assert.equal(result.reviewCount, 1);

  // Check group names
  const titles = result.groupsCreated.map(g => g.title);
  assert.ok(titles.includes('Development'));
  assert.ok(titles.includes('Documentation'));
  assert.ok(titles.includes(REVIEW_GROUP_NAME));

  // Check Review bucket color
  const reviewGroup = result.groupsCreated.find(g => g.title === REVIEW_GROUP_NAME);
  assert.equal(reviewGroup.color, REVIEW_GROUP_COLOR);

  // Verify ZDR Purge occurred on the input arrays
  assert.equal(aiGroupings.length, 0);
  assert.equal(reviewTabs.length, 0);
});
