const db = require('../config/db');
const accounts = require('../models/accounts');
const maintenance = require('../models/maintenance');
const {
  identifyImage,
  storeImage,
  removeImages,
  getImageContentType
} = require('../middleware/imageUploads');
const path = require('node:path');

function stringField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function submittedCategories(value) {
  const categories = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return [...new Set(categories)];
}

function renderProfile(res, values, categories, error, status = 200) {
  return res.status(status).render('profile', {
    error,
    values,
    categories: maintenance.CATEGORIES,
    selectedCategories: categories
  });
}

exports.getProfile = async (req, res) => {
  await db.ready;
  const account = await db.get(
    'SELECT full_name, email, unique_id, role, verification_status, profile_image FROM users WHERE id = ?',
    [req.session.user.id]
  );
  if (!account) {
    return res.status(404).render('error', {
      title: 'Profile not found',
      message: 'Your account profile could not be found.'
    });
  }
  const selectedCategories = account.role === 'staff'
    ? await accounts.getTechnicianCategories(req.session.user.id)
    : [];
  return renderProfile(res, account, selectedCategories, null);
};

exports.postProfile = async (req, res) => {
  await db.ready;
  const values = {
    full_name: stringField(req.body.full_name),
    email: stringField(req.body.email).toLowerCase()
  };
  const selectedCategories = req.session.user.role === 'staff'
    ? submittedCategories(req.body.categories)
    : [];
  const existing = await db.get(
    'SELECT profile_image FROM users WHERE id = ?',
    [req.session.user.id]
  );
  if (!existing) {
    return res.status(404).render('error', {
      title: 'Profile not found',
      message: 'Your account profile could not be found.'
    });
  }
  const fail = (message, status = 400) => renderProfile(
    res,
    values,
    selectedCategories,
    message,
    status
  );

  if (req.imageUploadError) return fail(req.imageUploadError);
  if (values.full_name.length < 2 || values.full_name.length > 80 ||
      !/^[\p{L}\p{M} .'-]+$/u.test(values.full_name)) {
    return fail('Enter a name between 2 and 80 characters using letters, spaces, apostrophes, periods, or hyphens.');
  }
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return fail('Enter a valid campus email address.');
  }
  if (selectedCategories.some((category) => !maintenance.CATEGORIES.includes(category))) {
    return fail('Choose only valid maintenance specialties.');
  }
  const duplicate = await db.get(
    'SELECT id FROM users WHERE email = ? AND id != ?',
    [values.email, req.session.user.id]
  );
  if (duplicate) return fail('That email address is already in use.', 409);

  const profileFile = req.files && req.files.profile_image && req.files.profile_image[0];
  const image = profileFile && identifyImage(profileFile.buffer);
  if (profileFile && (!image || image.mimeType !== profileFile.mimetype)) {
    return fail('The profile photo must be a valid JPEG, PNG, or WebP image.');
  }

  const profileImage = profileFile ? await storeImage(profileFile) : existing.profile_image;
  try {
    await db.run(
      'UPDATE users SET full_name = ?, email = ?, profile_image = ? WHERE id = ?',
      [values.full_name, values.email, profileImage, req.session.user.id]
    );
    if (req.session.user.role === 'staff') {
      await accounts.setTechnicianCategories(req.session.user.id, selectedCategories);
    }
  } catch (err) {
    if (profileFile && profileImage) await removeImages([profileImage]);
    throw err;
  }

  if (profileFile && existing.profile_image) await removeImages([existing.profile_image]);
  req.session.user.full_name = values.full_name;
  req.session.user.email = values.email;
  req.session.user.profile_image = profileImage;
  req.session.notice = { type: 'success', message: 'Your profile was updated.' };
  return res.redirect('/profile');
};

exports.getProfileImage = async (req, res) => {
  await db.ready;
  const account = await db.get(
    'SELECT profile_image FROM users WHERE id = ?',
    [req.session.user.id]
  );
  const filename = account && account.profile_image;
  const contentType = filename && getImageContentType(filename);
  if (!contentType || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
    return res.status(404).render('error', {
      title: 'Photo not found',
      message: 'There is no profile photo available.'
    });
  }
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(path.join(db.uploadsDirectory, filename), {
    headers: { 'Content-Type': contentType }
  }, (err) => {
    if (err && !res.headersSent) return res.status(404).render('error', {
      title: 'Photo not found',
      message: 'There is no profile photo available.'
    });
  });
};
