/*
  Invite-only multi-account helpers for ztncui.
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const chmod = util.promisify(fs.chmod);

const usernamePattern = /^[a-zA-Z0-9_-]{3,32}$/;
const minPasswordLength = 8;

let dataFile = process.env.MULTI_ACCOUNT_FILE || 'etc/multi-account.json';
let injectedUsersController = null;
let injectedPasswordHasher = null;

function configure(options) {
  dataFile = options.dataFile || dataFile;
  injectedUsersController = options.usersController || null;
  injectedPasswordHasher = options.passwordHasher || null;
}
exports.configure = configure;

function usersController() {
  if (injectedUsersController) return injectedUsersController;
  return require('./usersController');
}

async function hashPassword(password) {
  if (injectedPasswordHasher) return injectedPasswordHasher(password);
  return require('argon2').hash(password);
}

async function readData() {
  try {
    const data = JSON.parse(await readFile(dataFile, 'utf8'));
    if (!Array.isArray(data.invites)) data.invites = [];
    if (!Array.isArray(data.networks)) data.networks = [];
    return data;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return { invites: [], networks: [] };
  }
}

async function writeData(data) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
  await chmod(dataFile, 0o600);
  return data;
}

function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}
exports.isAdmin = isAdmin;

function requireAdmin(req, res, next) {
  if (isAdmin(req.session && req.session.user)) return next();
  res.status(403).render('error', { title: 'Forbidden', error: 'Admin access required' });
}
exports.requireAdmin = requireAdmin;

function firstAdminName(users) {
  const names = Object.keys(users);
  const adminName = names.find(name => users[name] && users[name].role === 'admin');
  return adminName || names[0] || 'admin';
}

async function ensureMigration(users, networkIds) {
  let changedUsers = false;
  for (const name of Object.keys(users)) {
    if (!users[name].role) {
      users[name].role = 'admin';
      if (!users[name].createdAt) users[name].createdAt = new Date().toISOString();
      changedUsers = true;
    }
  }
  if (changedUsers) await usersController().update_users(users);

  const data = await readData();
  const owner = firstAdminName(users);
  let changedData = false;
  for (const nwid of networkIds || []) {
    if (!data.networks.find(network => network.nwid === nwid)) {
      data.networks.push({ nwid: nwid, owner: owner, createdAt: new Date().toISOString() });
      changedData = true;
    }
  }
  if (changedData) await writeData(data);
}
exports.ensureMigration = ensureMigration;

async function listInvites() {
  return (await readData()).invites;
}
exports.listInvites = listInvites;

async function createInvite(adminUser) {
  if (!isAdmin(adminUser)) throw new Error('Admin access required');
  const data = await readData();
  const invite = {
    code: crypto.randomBytes(12).toString('hex'),
    createdBy: adminUser.name,
    createdAt: new Date().toISOString(),
    usedAt: null,
    usedBy: null
  };
  data.invites.unshift(invite);
  await writeData(data);
  return invite;
}
exports.createInvite = createInvite;

function validateRegistration(username, password, inviteCode, users) {
  if (!usernamePattern.test(username || '')) {
    throw new Error('Username must be 3-32 letters, numbers, underscore, or dash characters.');
  }
  if (!password || password.length < minPasswordLength) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (!inviteCode) throw new Error('Invite code is required.');
  if (users[username]) throw new Error('Username already exists.');
}

async function registerWithInvite(username, password, inviteCode) {
  const usersApi = usersController();
  const users = await usersApi.get_users();
  validateRegistration(username, password, inviteCode, users);

  const data = await readData();
  const invite = data.invites.find(item => item.code === inviteCode && !item.usedAt);
  if (!invite) throw new Error('Invalid invite code.');

  const user = {
    name: username,
    pass_set: true,
    hash: await hashPassword(password),
    role: 'user',
    createdAt: new Date().toISOString(),
    inviteCode: inviteCode
  };

  users[username] = user;
  invite.usedAt = new Date().toISOString();
  invite.usedBy = username;

  await usersApi.update_users(users);
  await writeData(data);
  return user;
}
exports.registerWithInvite = registerWithInvite;

async function recordNetworkOwner(nwid, username) {
  const data = await readData();
  const existing = data.networks.find(network => network.nwid === nwid);
  if (existing) {
    existing.owner = username;
  } else {
    data.networks.push({ nwid: nwid, owner: username, createdAt: new Date().toISOString() });
  }
  await writeData(data);
}
exports.recordNetworkOwner = recordNetworkOwner;

async function removeNetworkOwner(nwid) {
  const data = await readData();
  const networks = data.networks.filter(network => network.nwid !== nwid);
  if (networks.length === data.networks.length) return;
  data.networks = networks;
  await writeData(data);
}
exports.removeNetworkOwner = removeNetworkOwner;

async function canAccessNetwork(user, nwid) {
  if (isAdmin(user)) return true;
  if (!user || !nwid) return false;
  const data = await readData();
  const network = data.networks.find(item => item.nwid === nwid);
  return Boolean(network && network.owner === user.name);
}
exports.canAccessNetwork = canAccessNetwork;

async function filterNetworksForUser(user, networks) {
  if (isAdmin(user)) return networks;
  const data = await readData();
  const owned = data.networks
    .filter(network => network.owner === user.name)
    .map(network => network.nwid);
  return networks.filter(network => owned.includes(network.nwid));
}
exports.filterNetworksForUser = filterNetworksForUser;

async function annotateNetworkOwners(networks) {
  const data = await readData();
  return networks.map(network => {
    const metadata = data.networks.find(item => item.nwid === network.nwid);
    return Object.assign({}, network, { owner: metadata ? metadata.owner : null });
  });
}
exports.annotateNetworkOwners = annotateNetworkOwners;
