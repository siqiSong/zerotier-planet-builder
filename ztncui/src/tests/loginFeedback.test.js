const assert = require('node:assert/strict');
const test = require('node:test');

const loginFeedback = require('../controllers/loginFeedback');

test('failed login feedback preserves username and uses danger styling', () => {
  const session = {
    error: 'Authentication failed, please check your username and password.',
    loginUsername: 'xhandong'
  };

  const feedback = loginFeedback.consumeLoginFeedback(session);

  assert.equal(feedback.message, 'Authentication failed, please check your username and password.');
  assert.equal(feedback.messageClass, 'alert-danger');
  assert.equal(feedback.username, 'xhandong');
  assert.deepEqual(session, {});
});

test('successful feedback uses informational styling and is consumed once', () => {
  const session = { success: 'Account created. Please log in.' };

  const feedback = loginFeedback.consumeLoginFeedback(session);

  assert.equal(feedback.message, 'Account created. Please log in.');
  assert.equal(feedback.messageClass, 'alert-info');
  assert.equal(feedback.username, '');
  assert.deepEqual(session, {});
});
