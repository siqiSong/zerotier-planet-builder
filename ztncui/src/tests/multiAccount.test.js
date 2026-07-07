const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const multiAccount = require('../controllers/multiAccount');

function tempDataFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ztncui-multi-'));
  return path.join(dir, 'multi-account.json');
}

function memoryUsers(initial) {
  let users = JSON.parse(JSON.stringify(initial));
  return {
    async get_users() {
      return users;
    },
    async update_users(next) {
      users = JSON.parse(JSON.stringify(next));
      return users;
    },
    snapshot() {
      return users;
    }
  };
}

test('migrates legacy users to admin and legacy networks to first admin', async () => {
  const users = memoryUsers({
    admin: { name: 'admin', hash: 'hash', pass_set: true }
  });
  multiAccount.configure({
    dataFile: tempDataFile(),
    usersController: users,
    passwordHasher: async () => 'hash'
  });

  await multiAccount.ensureMigration(await users.get_users(), ['n1', 'n2']);

  assert.equal(users.snapshot().admin.role, 'admin');
  assert.equal(await multiAccount.canAccessNetwork(users.snapshot().admin, 'n1'), true);
  assert.equal(await multiAccount.canAccessNetwork(users.snapshot().admin, 'n2'), true);
});

test('creates and redeems one-time invite for normal user', async () => {
  const users = memoryUsers({
    admin: { name: 'admin', hash: 'hash', pass_set: true, role: 'admin' }
  });
  multiAccount.configure({
    dataFile: tempDataFile(),
    usersController: users,
    passwordHasher: async (password) => 'hash:' + password
  });

  const invite = await multiAccount.createInvite(users.snapshot().admin);
  const user = await multiAccount.registerWithInvite('alice', 'pass123456', invite.code);

  assert.equal(user.name, 'alice');
  assert.equal(user.role, 'user');
  assert.equal(users.snapshot().alice.hash, 'hash:pass123456');
  await assert.rejects(
    () => multiAccount.registerWithInvite('bob', 'pass123456', invite.code),
    /Invalid invite code/
  );
});

test('filters networks for normal user but not admin', async () => {
  const users = memoryUsers({
    admin: { name: 'admin', role: 'admin' },
    alice: { name: 'alice', role: 'user' }
  });
  multiAccount.configure({
    dataFile: tempDataFile(),
    usersController: users,
    passwordHasher: async () => 'hash'
  });

  await multiAccount.recordNetworkOwner('n1', 'alice');
  await multiAccount.recordNetworkOwner('n2', 'admin');

  const networks = [
    { nwid: 'n1', name: 'alice-net' },
    { nwid: 'n2', name: 'admin-net' }
  ];

  assert.deepEqual(await multiAccount.filterNetworksForUser(users.snapshot().alice, networks), [
    { nwid: 'n1', name: 'alice-net' }
  ]);
  assert.deepEqual(await multiAccount.filterNetworksForUser(users.snapshot().admin, networks), networks);
});

test('annotates networks with owner metadata for admin list', async () => {
  const users = memoryUsers({
    admin: { name: 'admin', role: 'admin' },
    alice: { name: 'alice', role: 'user' }
  });
  multiAccount.configure({
    dataFile: tempDataFile(),
    usersController: users,
    passwordHasher: async () => 'hash'
  });

  await multiAccount.recordNetworkOwner('n1', 'alice');
  await multiAccount.recordNetworkOwner('n2', 'admin');

  const networks = await multiAccount.annotateNetworkOwners([
    { nwid: 'n1', name: 'alice-net' },
    { nwid: 'n2', name: 'admin-net' },
    { nwid: 'n3', name: 'unknown-net' }
  ]);

  assert.deepEqual(networks.map(network => network.owner), ['alice', 'admin', null]);
});

test('canAccessNetwork denies another normal user', async () => {
  const users = memoryUsers({
    alice: { name: 'alice', role: 'user' },
    bob: { name: 'bob', role: 'user' }
  });
  multiAccount.configure({
    dataFile: tempDataFile(),
    usersController: users,
    passwordHasher: async () => 'hash'
  });

  await multiAccount.recordNetworkOwner('n1', 'alice');

  assert.equal(await multiAccount.canAccessNetwork(users.snapshot().alice, 'n1'), true);
  assert.equal(await multiAccount.canAccessNetwork(users.snapshot().bob, 'n1'), false);
});

test('removes ownership metadata when a network is deleted', async () => {
  const users = memoryUsers({
    alice: { name: 'alice', role: 'user' }
  });
  multiAccount.configure({
    dataFile: tempDataFile(),
    usersController: users,
    passwordHasher: async () => 'hash'
  });

  await multiAccount.recordNetworkOwner('n1', 'alice');
  await multiAccount.removeNetworkOwner('n1');

  assert.equal(await multiAccount.canAccessNetwork(users.snapshot().alice, 'n1'), false);
});
