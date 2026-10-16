const bcrypt = require('bcrypt');
const db = require('../config/db');
const accounts = require('../models/accounts');
const maintenance = require('../models/maintenance');

const PUBLIC_ROLES = ['student', 'faculty', 'staff'];

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
  if (user.verification_status !== 'Accepted') {
    const message = user.verification_status === 'Rejected'
      ? 'Your account verification was rejected. Contact the campus administrator for assistance.'
      : 'Your account is awaiting administrator verification. Please try again later.';
    return res.status(403).render('login', {
      error: message,
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
    unique_id: user.unique_id,
    profile_image: user.profile_image,
    role: user.role,
    verification_status: user.verification_status
  };
  return res.redirect('/dashboard');
};

exports.getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { error: null, values: {}, categories: maintenance.CATEGORIES });
};

exports.postRegister = async (req, res) => {
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const uniqueId = typeof req.body.unique_id === 'string' ? req.body.unique_id.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = typeof req.body.role === 'string' ? req.body.role : '';
  const postedCategories = Array.isArray(req.body.categories)
    ? req.body.categories
    : typeof req.body.categories === 'string' ? [req.body.categories] : [];
  const categories = [...new Set(postedCategories)];
  const values = { full_name: fullName, email, unique_id: uniqueId, role, categories };
  const renderRegistrationError = (error, status = 400) => res.status(status).render('register', {
    error,
    values,
    categories: maintenance.CATEGORIES
  });

  if (fullName.length < 2 || fullName.length > 80 || !/^[\p{L}\p{M} .'-]+$/u.test(fullName)) {
    return renderRegistrationError('Enter a name between 2 and 80 characters using letters, spaces, apostrophes, periods, or hyphens.');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return renderRegistrationError('Enter a valid email address.');
  }
  if (!/^\d{4,32}$/.test(uniqueId)) {
    return renderRegistrationError('Enter your campus ID number using 4 to 32 digits.');
  }
  if (password.length < 8 || password.length > 200) {
    return renderRegistrationError('Your password must be at least 8 characters long.');
  }
  if (!PUBLIC_ROLES.includes(role)) {
    return renderRegistrationError('Choose a valid account type. Administrator accounts are provisioned securely.');
  }
  if (role === 'staff' && (!categories.length || categories.some((category) => !maintenance.CATEGORIES.includes(category)))) {
    return renderRegistrationError('Choose at least one valid maintenance category for the technical team account.');
  }
  if (role !== 'staff' && categories.length) {
    return renderRegistrationError('Only technical team accounts can select maintenance categories.');
  }

  await db.ready;
  const existing = await db.get('SELECT id FROM users WHERE email = ? OR unique_id = ?', [email, uniqueId]);
  if (existing) {
    return renderRegistrationError('An account with that email or campus ID number already exists.', 409);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.run(
    'INSERT INTO users (full_name, email, unique_id, password, role, verification_status) VALUES (?, ?, ?, ?, ?, ?)',
    [fullName, email, uniqueId, passwordHash, role, role === 'staff' ? 'Pending' : 'Accepted']
  );
  if (role === 'staff') await accounts.setTechnicianCategories(result.lastID, categories);
  req.session.notice = {
    type: 'success',
    message: role === 'staff'
      ? 'Your technician account was submitted for administrator verification.'
      : 'Your account was created. You can sign in now.'
  };
  return res.redirect('/login');
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('campus.sid');
    return res.redirect('/login');
  });
};