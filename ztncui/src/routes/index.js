/*
  ztncui - ZeroTier network controller UI
  Copyright (C) 2017-2021  Key Networks (https://key-networks.com)
  Licensed under GPLv3 - see LICENSE for details.
*/

const express = require('express');
const auth = require('../controllers/auth');
const authenticate = auth.authenticate;
const loginFeedback = require('../controllers/loginFeedback');
const multiAccount = require('../controllers/multiAccount');
const redirects = require('../controllers/redirects');
const router = express.Router();

/** Redirect logged user to controler page */
function guest_only(req, res, next) {
  if (req.session.user) {
    res.redirect('/controller');
  } else {
    next();
  }
}

/* GET home page. */
router.get('/', guest_only, function(req, res, next) {
  res.render('front_door', {title: 'ztncui'});
});

router.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

router.get('/login', guest_only, function(req, res) {
  const feedback = loginFeedback.consumeLoginFeedback(req.session);
  res.render('login', {
    title: 'Login',
    message: feedback.message,
    messageClass: feedback.messageClass,
    username: feedback.username
  });
});

router.get('/register', guest_only, function(req, res) {
  res.render('register', { title: 'Register with invite', message: null, form: {} });
});

router.post('/register', guest_only, async function(req, res) {
  try {
    await multiAccount.registerWithInvite(req.body.username, req.body.password, req.body.inviteCode);
    req.session.success = 'Account created. Please log in.';
    res.redirect('/login');
  } catch (err) {
    res.render('register', { title: 'Register with invite', message: err.message, form: req.body });
  }
});

router.post('/login', async function(req, res) {
  const username = (req.body.username || '').trim();
  await authenticate(username, req.body.password, function(err, user) {
    if (user) {
      req.session.regenerate(function() {
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name;
        if (user.pass_set) {
          res.redirect(redirects.safeRedirectTarget(req.query.redirect, '/controller'));
        } else {
          res.redirect('/users/' + user.name + '/password');
        }
      });
    } else {
      req.session.error = 'Authentication failed, please check your username and password.';
      req.session.loginUsername = username;
      res.redirect('/login');
    }
  });
});
module.exports = router;
