import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHostname, isDomainBlocklisted, filterTabsByBlocklist } from '../src/privacy/blocklist.js';

test('extractHostname parses valid URLs correctly', () => {
  assert.equal(extractHostname('https://github.com/deepmind'), 'github.com');
  assert.equal(extractHostname('http://chase.com/login'), 'chase.com');
  assert.equal(extractHostname('https://sub.portal.company.com:8080/path'), 'sub.portal.company.com');
  assert.equal(extractHostname('invalid-url'), null);
  assert.equal(extractHostname(null), null);
});

test('isDomainBlocklisted blocks internal and system protocols', () => {
  assert.equal(isDomainBlocklisted('chrome://extensions'), true);
  assert.equal(isDomainBlocklisted('chrome-extension://abcdef/popup.html'), true);
  assert.equal(isDomainBlocklisted('about:blank'), true);
  assert.equal(isDomainBlocklisted('edge://settings'), true);
  assert.equal(isDomainBlocklisted('file:///C:/secret.txt'), true);
});

test('isDomainBlocklisted detects exact and subdomain matches', () => {
  const blocklist = ['chase.com', 'bankofamerica.com', '*.internal.company.com'];

  assert.equal(isDomainBlocklisted('https://chase.com/account', blocklist), true);
  assert.equal(isDomainBlocklisted('https://auth.chase.com/login', blocklist), true);
  assert.equal(isDomainBlocklisted('https://portal.internal.company.com/hr', blocklist), true);
  assert.equal(isDomainBlocklisted('https://internal.company.com', blocklist), true);
  assert.equal(isDomainBlocklisted('https://github.com/repo', blocklist), false);
  assert.equal(isDomainBlocklisted('https://news.ycombinator.com', blocklist), false);
});

test('filterTabsByBlocklist partitions tabs accurately', () => {
  const tabs = [
    { id: 1, url: 'https://github.com/project' },
    { id: 2, url: 'https://chase.com/login' },
    { id: 3, url: 'https://docs.google.com/document' },
    { id: 4, url: 'chrome://settings' }
  ];

  const { allowed, blocklisted } = filterTabsByBlocklist(tabs, ['chase.com']);
  assert.equal(allowed.length, 2);
  assert.deepEqual(allowed.map(t => t.id), [1, 3]);
  assert.equal(blocklisted.length, 2);
  assert.deepEqual(blocklisted.map(t => t.id), [2, 4]);
});
