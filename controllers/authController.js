const bcrypt = require('bcrypt');
const db = require('../config/db');

const PUBLIC_ROLES = ['student', 'faculty'];

exports.getLogin = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null, values: {} });
};

exports.postLogin = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password || email.length > 254 || password.length > 200) {
    return res.status(400).render('login', {
      error: 'Enter a valid email address and password.',
      values: { email }
    });
  }

  await db.ready;
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  const matches = user
    ? await bcrypt.compare(password, user.password)
    : await bcrypt.compare(password, '$2b$12$C6UzMDM.H6dfI/f/IKcEe.4b1fN0j95oRx1N5xv5dQInxjeZs7G5y');
  if (!user || !matches) {
    return res.status(401).render('login', {
      error: 'Invalid email or password.',
      values: { email }
    });
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => err ? reject(err) : resolve());
  });
  req.session.user = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role
  };
  return res.redirect('/dashboard');
};

exports.getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { error: null, values: {} });
};

exports.postRegister = async (req, res) => {
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = typeof req.body.role === 'string' ? req.body.role : '';
  const values = { full_name: fullName, email };

  if (fullName.length < 2 || fullName.length > 80 || !/^[\p{L}\p{M} .'-]+$/u.test(fullName)) {
    return res.status(400).render('register', {
      error: 'Enter a name between 2 and 80 characters using letters, spaces, apostrophes, periods, or hyphens.',
      values
    });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).render('register', { error: 'Enter a valid email address.', values });
  }
  if (password.length < 8 || password.length > 200) {
    return res.status(400).render('register', {
      error: 'Your password must be at least 8 characters long.',
      values
    });
  }
  if (!PUBLIC_ROLES.includes(role)) {
    return res.status(400).render('register', {
      error: 'Choose a valid account type. Staff and administrator accounts are provisioned by an administrator.',
      values
    });
  }

  await db.ready;
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).render('register', {
      error: 'An account with that email already exists.',
      values
    });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.run(
    'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
    [fullName, email, passwordHash, role]
  );
  req.session.notice = { type: 'success', message: 'Your account is ready. Sign in to continue.' };
  return res.redirect('/login');
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('campus.sid');
    return res.redirect('/login');
  });
};