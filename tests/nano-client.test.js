import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAIResponse, buildClusteringPrompt } from '../src/ai/prompt-templates.js';
import { mockClusteringHeuristic, clusterTabsWithNano } from '../src/ai/nano-client.js';

test('parseAIResponse handles clean JSON arrays', () => {
  const jsonStr = JSON.stringify([
    { tabId: 101, suggestedGroup: 'Development' },
    { tabId: 102, suggestedGroup: 'Cloud' }
  ]);

  const parsed = parseAIResponse(jsonStr);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].tabId, 101);
  assert.equal(parsed[0].suggestedGroup, 'Development');
});

test('parseAIResponse extracts JSON from markdown code fences', () => {
  const markdownResp = '```json\n[\n  {"tabId": 201, "suggestedGroup": "Project Management"}\n]\n```';
  const parsed = parseAIResponse(markdownResp);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tabId, 201);
  assert.equal(parsed[0].suggestedGroup, 'Project Management');
});

test('parseAIResponse extracts JSON amidst commentary text', () => {
  const noisyResp = 'Here is the clustering result:\n[{"tabId": 301, "suggestedGroup": "Docs"}]\nHope this helps!';
  const parsed = parseAIResponse(noisyResp);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tabId, 301);
  assert.equal(parsed[0].suggestedGroup, 'Docs');
});

test('parseAIResponse returns empty array for malformed responses', () => {
  assert.deepEqual(parseAIResponse('Not JSON at all'), []);
  assert.deepEqual(parseAIResponse(''), []);
  assert.deepEqual(parseAIResponse(null), []);
});

test('buildClusteringPrompt includes tab IDs and titles', () => {
  const tabs = [
    { tabId: 1, title: 'GitHub PR #42', url: 'https://github.com/pulls/42' },
    { tabId: 2, title: 'Jira Sprint Board', url: 'https://jira.corp.net/board' }
  ];
  const prompt = buildClusteringPrompt(tabs);
  assert.match(prompt, /Tab ID: 1/);
  assert.match(prompt, /GitHub PR #42/);
  assert.match(prompt, /Tab ID: 2/);
});

test('mockClusteringHeuristic assigns sensible enterprise categories', () => {
  const tabs = [
    { tabId: 1, title: 'kubernetes/kubernetes Repo', url: 'https://github.com/kubernetes' },
    { tabId: 2, title: 'Sprint 4 Planning', url: 'https://jira.atlassian.com' },
    { tabId: 3, title: 'Architecture RFC', url: 'https://docs.google.com/document/d/123' },
    { tabId: 4, title: 'EC2 Instances Dashboard', url: 'https://console.aws.amazon.com/ec2' }
  ];

  const results = mockClusteringHeuristic(tabs);
  assert.equal(results.length, 4);
  assert.equal(results.find(r => r.tabId === 1).suggestedGroup, 'Code & Development');
  assert.equal(results.find(r => r.tabId === 2).suggestedGroup, 'Project Management');
  assert.equal(results.find(r => r.tabId === 3).suggestedGroup, 'Documentation & Notes');
  assert.equal(results.find(r => r.tabId === 4).suggestedGroup, 'Cloud Infrastructure');
});

test('clusterTabsWithNano falls back to mock heuristic when Prompt API is absent', async () => {
  const tabs = [
    { tabId: 10, title: 'React Documentation', url: 'https://react.dev' }
  ];
  const results = await clusterTabsWithNano(tabs, { allowMockFallback: true });
  assert.equal(results.length, 1);
  assert.equal(results[0].tabId, 10);
});
