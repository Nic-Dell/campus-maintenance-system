function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();
  req.session.notice = { type: 'info', message: 'Please sign in to continue.' };
  return res.redirect('/login');
}

function hasRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.notice = { type: 'info', message: 'Please sign in to continue.' };
      return res.redirect('/login');
    }
    if (roles.includes(req.session.user.role)) return next();
    return res.status(403).render('error', {
      title: 'Access restricted',
      message: 'Your account does not have permission to access this page.'
    });
  };
}

module.exports = { isLoggedIn, hasRole };