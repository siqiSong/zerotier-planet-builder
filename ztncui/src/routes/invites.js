/*
  ztncui - invite administration routes
*/

const express = require('express');
const auth = require('../controllers/auth');
const multiAccount = require('../controllers/multiAccount');
const router = express.Router();

router.get('/', auth.restrict, multiAccount.requireAdmin, async function(req, res) {
  res.render('invites', {
    title: 'Invites',
    navigate: { active: 'invites' },
    invites: await multiAccount.listInvites()
  });
});

router.post('/', auth.restrict, multiAccount.requireAdmin, async function(req, res) {
  await multiAccount.createInvite(req.session.user);
  res.redirect('/invites');
});

module.exports = router;
