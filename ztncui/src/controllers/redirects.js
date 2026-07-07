function safeRedirectTarget(target, fallback) {
  if (typeof target !== 'string') return fallback;
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;
  return target;
}

exports.safeRedirectTarget = safeRedirectTarget;
