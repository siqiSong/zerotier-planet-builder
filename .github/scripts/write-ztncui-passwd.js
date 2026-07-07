const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');

const username = process.env.ZTNCUI_USERNAME || process.env.USERNAME || 'admin';
const password = process.env.ZTNCUI_PASSWORD || process.env.PASSWORD;

if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
  throw new Error('ZTNCUI_USERNAME must be 3-32 letters, numbers, underscores, or dashes.');
}

if (!password || password.length < 10) {
  throw new Error('ZTNCUI_PASSWORD must be at least 10 characters.');
}

(async () => {
  const hash = await argon2.hash(password);
  const user = {
    [username]: {
      name: username,
      pass_set: true,
      hash,
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  };
  const target = path.join(process.cwd(), 'etc', 'default.passwd');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(user), { mode: 0o600 });
})();
