require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./config/db');

const app = express();
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set; sessions will not survive a server restart.');
}

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'campus.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.notice = req.session.notice || null;
  res.locals.currentPage = req.path === '/requests/new' ? 'new-request' : '';
  delete req.session.notice;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/maintenance'));
app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: 'We could not find that page.'
  });
});

app.use((err, req, res, next) => {
  console.error('Request failed:', err);
  if (res.headersSent) return next(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: 'The request could not be completed. Please try again.'
  });
});

const PORT = Number(process.env.PORT) || 3000;
if (require.main === module) {
  db.ready.then(() => {
    app.listen(PORT, () => {
      console.log(`Campus Maintenance System running on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Unable to initialize the database:', err);
    process.exitCode = 1;
  });
}

module.exports = app;
