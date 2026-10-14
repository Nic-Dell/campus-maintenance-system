const db = require('../config/db');

async function requireAcceptedAccount(req, res, next) {
  try {
    await db.ready;
    const account = await db.get(
      'SELECT role, verification_status FROM users WHERE id = ?',
      [req.session.user.id]
    );
    if (account && account.verification_status === 'Accepted' && account.role === req.session.user.role) {
      return next();
    }
    await new Promise((resolve, reject) => {
      req.session.destroy((err) => err ? reject(err) : resolve());
    });
    res.clearCookie('campus.sid');
    return res.status(403).render('login', {
      error: 'Your account is no longer approved. Contact the campus administrator for assistance.',
      values: {}
    });
  } catch (err) {
    return next(err);
  }
}

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) return requireAcceptedAccount(req, res, next);
  req.session.notice = { type: 'info', message: 'Please sign in to continue.' };
  return res.redirect('/login');
}

function hasRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.notice = { type: 'info', message: 'Please sign in to continue.' };
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Access restricted',
        message: 'Your account does not have permission to access this page.'
      });
    }
    return requireAcceptedAccount(req, res, next);
  };
}

module.exports = { isLoggedIn, hasRole };