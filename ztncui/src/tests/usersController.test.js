const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const usersController = require('../controllers/usersController');

function tempEtc() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ztncui-users-'));
  fs.mkdirSync(path.join(dir, 'etc'));
  return dir;
}

function request(username) {
  return {
    body: {
      username: username,
      password1: 'longpassword',
      password2: 'longpassword'
    },
    checkBody() {
      return {
        notEmpty() { return this; },
        isLength() { return this; },
        equals() { return this; }
      };
    },
    sanitize() {
      return {
        escape() { return this; },
        trim() { return this; }
      };
    },
    validationErrors() {
      return null;
    }
  };
}

function response() {
  return {
    render(view, locals) {
      this.view = view;
      this.locals = locals;
    }
  };
}

test('setting password preserves an existing normal user role', async () => {
  const previousCwd = process.cwd();
  process.chdir(tempEtc());
  try {
    usersController.configure({ passwordHasher: async password => 'hash:' + password });
    await usersController.update_users({
      alice: { name: 'alice', role: 'user', pass_set: true, hash: 'old' }
    });

    await usersController.password_post(request('alice'), response());

    const users = await usersController.get_users();
    assert.equal(users.alice.role, 'user');
  } finally {
    process.chdir(previousCwd);
  }
});

test('admin-created users default to normal user role', async () => {
  const previousCwd = process.cwd();
  process.chdir(tempEtc());
  try {
    usersController.configure({ passwordHasher: async password => 'hash:' + password });
    await usersController.update_users({});

    await usersController.password_post(request('bob'), response());

    const users = await usersController.get_users();
    assert.equal(users.bob.role, 'user');
  } finally {
    process.chdir(previousCwd);
  }
});
