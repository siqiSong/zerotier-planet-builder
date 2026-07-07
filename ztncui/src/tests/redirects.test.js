const assert = require('node:assert/strict');
const test = require('node:test');

const redirects = require('../controllers/redirects');

test('safeRedirectTarget allows local absolute paths', () => {
  assert.equal(redirects.safeRedirectTarget('/controller/networks', '/controller'), '/controller/networks');
});

test('safeRedirectTarget rejects external redirects', () => {
  assert.equal(redirects.safeRedirectTarget('https://example.com', '/controller'), '/controller');
  assert.equal(redirects.safeRedirectTarget('//example.com', '/controller'), '/controller');
  assert.equal(redirects.safeRedirectTarget('controller/networks', '/controller'), '/controller');
});
