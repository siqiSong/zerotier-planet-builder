/*
  ztncui - ZeroTier network controller UI
  Copyright (C) 2017-2021  Key Networks (https://key-networks.com)
  Licensed under GPLv3 - see LICENSE for details.
*/

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const session = require('express-session');
const helmet = require('helmet');
const crypto = require('crypto');

const index = require('./routes/index');
const invites = require('./routes/invites');
const users = require('./routes/users');
const zt_controller = require('./routes/zt_controller');
const i18n = require('./controllers/i18n');

const app = express();

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const secureSessionCookie = /^true$/i.test(process.env.SESSION_COOKIE_SECURE || '');
if (secureSessionCookie) app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(helmet());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  name: 'ztncui.sid',
  resave: false,
  saveUninitialized: false,
  secret: sessionSecret,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureSessionCookie
  }
}));
app.use(expressValidator());
app.use(cookieParser());
app.use(i18n.middleware);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/bootstrap/fonts')));
app.use('/bscss', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/jqjs', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/bsjs', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));

app.get('/app/planet', function(req, res, next) {
  const candidates = [
    process.env.PLANET_PATH,
    '/app/frontend/build/planet',
    '/app/dist/planet'
  ].filter(Boolean);
  const planetPath = candidates.find(candidate => fs.existsSync(candidate));
  if (!planetPath) return next();
  res.sendFile(planetPath);
});
app.get('/language/:lang', i18n.setLanguage);

app.use(function(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
});

app.use('/', index);
app.use('/invites', invites);
app.use('/users', users);
app.use('/controller', zt_controller);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
next();
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
