function consumeLoginFeedback(session) {
  const error = session.error;
  const success = session.success;
  const username = session.loginUsername || '';

  delete session.error;
  delete session.success;
  delete session.loginUsername;

  return {
    message: error === 'Access denied!' ? null : (error || success || null),
    messageClass: error ? 'alert-danger' : 'alert-info',
    username: username
  };
}

exports.consumeLoginFeedback = consumeLoginFeedback;
