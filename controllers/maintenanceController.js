const maintenance = require('../models/maintenance');
const accounts = require('../models/accounts');
const db = require('../config/db');
const {
  identifyImage,
  storeImage,
  removeImages,
  getImageContentType
} = require('../middleware/imageUploads');
const path = require('node:path');

const isStaff = (user) => ['staff', 'admin'].includes(user.role);
const validId = (value) => /^\d+$/.test(value) && Number(value) > 0;
const validLocations = [
  'Office of the President',
  'Administration Building',
  'CSPC Broadcast Center',
  'Laboratory and Shop Building',
  'Gymnasium',
  'School Canteen',
  'Library Building',
  'Auditorium',
  'Villafuerte Hall',
  'PaxS Office',
  'Center for Research and Development',
  'CSPC Theater',
  'College of Engineering and Architecture - Acad I',
  'CSPC Chapel',
  'Information and Communications Technology Unit',
  'Information, Broadcast, and Alumni Affairs',
  'Green Building',
  'College of Tourism, Hospitality and Business Management - Acad II',
  'Pearl Function Hall',
  'College of Technological and Development Education - Acad III',
  'College of Computer Studies - Acad IV',
  'Academic Building V',
  'College of Nursing - Acad VI'
];

exports.getDashboard = async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const status = maintenance.STATUSES.find(
    (candidate) => candidate.toLowerCase() === requestedStatus.toLowerCase()
  ) || (requestedStatus.toLowerCase() === 'resolve' ? 'Resolved' : '');
  const staffView = isStaff(req.session.user);
  const categories = req.session.user.role === 'staff'
    ? await accounts.getTechnicianCategories(req.session.user.id)
    : [];
  const [requests, stats, hotspots, slaStats] = await Promise.all([
    maintenance.listRequests({
      userId: req.session.user.id,
      isStaff: staffView,
      role: req.session.user.role,
      categories,
      search,
      status
    }),
    maintenance.getDashboardStats(req.session.user.id, staffView),
    maintenance.getPulse(),
    maintenance.getSlaStats(req.session.user.id, staffView)
  ]);
  return res.render('dashboard', {
    requests,
    stats,
    hotspots,
    slaStats,
    search,
    status,
    staffView,
    technicianView: req.session.user.role === 'staff',
    requestCta: ['student', 'faculty'].includes(req.session.user.role)
  });
};

exports.getNewRequest = (req, res) => {
  return res.render('request-form', {
    error: null,
    values: {},
    categories: maintenance.CATEGORIES,
    priorities: maintenance.PRIORITIES,
    buildings: validLocations
  });
};

exports.postRequest = async (req, res) => {
  const values = {};
  for (const field of ['title', 'category', 'building', 'room', 'priority', 'description']) {
    values[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : '';
  }
  const fail = (message) => res.status(400).render('request-form', {
    error: message,
    values,
    categories: maintenance.CATEGORIES,
    priorities: maintenance.PRIORITIES,
    buildings: validLocations
  });

  if (req.imageUploadError) return fail(req.imageUploadError);
  if (values.title.length < 5 || values.title.length > 100) {
    return fail('Add a clear title between 5 and 100 characters.');
  }
  if (!maintenance.CATEGORIES.includes(values.category)) {
    return fail('Choose a valid maintenance category.');
  }
  if (!validLocations.includes(values.building)) {
    return fail('Choose a campus building from the list.');
  }
  if (values.room.length > 40) return fail('Room or area must be 40 characters or fewer.');
  if (!maintenance.PRIORITIES.includes(values.priority)) {
    return fail('Choose a valid priority.');
  }
  if (values.description.length < 20 || values.description.length > 2000) {
    return fail('Describe the issue in 20 to 2,000 characters so the team can investigate.');
  }

  const reportFile = req.files && req.files.report_image && req.files.report_image[0];
  const reportType = reportFile && identifyImage(reportFile.buffer);
  if (reportFile && (!reportType || reportType.mimeType !== reportFile.mimetype)) {
    return fail('The area photo must be a valid JPEG, PNG, or WebP image.');
  }
  const reportImage = reportFile ? await storeImage(reportFile) : null;
  let createdRequest;
  try {
    createdRequest = await maintenance.createRequest(values, req.session.user.id, reportImage);
  } catch (err) {
    if (reportImage) await removeImages([reportImage]);
    throw err;
  }
  const { id, assigneeName } = createdRequest;
  req.session.notice = {
    type: 'success',
    message: assigneeName
      ? `Request #${id} has been submitted and scheduled with ${assigneeName}.`
      : `Request #${id} has been submitted. It will remain in the category queue until an eligible technician is available.`
  };
  return res.redirect(`/requests/${id}`);
};

exports.getRequest = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(404).render('error', { title: 'Request not found', message: 'That request does not exist.' });
  }
  const request = await maintenance.getRequest(Number(req.params.id));
  if (!request) {
    return res.status(404).render('error', { title: 'Request not found', message: 'That request does not exist.' });
  }
  const staffView = isStaff(req.session.user);
  const technicianCategories = req.session.user.role === 'staff'
    ? await accounts.getTechnicianCategories(req.session.user.id)
    : [];
  const isAssignedTechnician = req.session.user.role === 'staff' &&
    Number(request.assigned_to) === Number(req.session.user.id);
  const canReviewUnassigned = req.session.user.role === 'staff' &&
    request.assigned_to == null && technicianCategories.includes(request.category);
  if (
    req.session.user.role !== 'admin' &&
    !(req.session.user.role === 'staff' && (isAssignedTechnician || canReviewUnassigned)) &&
    request.created_by !== req.session.user.id
  ) {
    return res.status(403).render('error', {
      title: 'Access restricted',
      message: 'You can only view your own requests or requests within your assigned responsibilities.'
    });
  }
  const updates = await maintenance.getUpdates(request.id);
  return res.render('request-detail', {
    request,
    updates,
    staffView,
    canGiveFeedback: Number(request.created_by) === Number(req.session.user.id) &&
      request.status === 'Resolved',
    canClaim: canReviewUnassigned && request.status === 'Open',
    statuses: maintenance.STATUSES
  });
};

exports.postFeedback = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(404).render('error', {
      title: 'Request not found',
      message: 'That request does not exist.'
    });
  }
  const id = Number(req.params.id);
  const request = await maintenance.getRequest(id);
  if (!request) {
    return res.status(404).render('error', {
      title: 'Request not found',
      message: 'That request does not exist.'
    });
  }
  if (Number(request.created_by) !== Number(req.session.user.id)) {
    return res.status(403).render('error', {
      title: 'Feedback restricted',
      message: 'Only the person who reported this request can leave feedback.'
    });
  }
  if (request.status !== 'Resolved') {
    req.session.notice = { type: 'danger', message: 'Feedback is available after the request is resolved.' };
    return res.redirect(`/requests/${id}`);
  }
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 5 || comment.length > 1000) {
    req.session.notice = {
      type: 'danger',
      message: 'Choose a rating from 1 to 5 and write a message between 5 and 1,000 characters.'
    };
    return res.redirect(`/requests/${id}`);
  }
  await maintenance.saveFeedback(id, req.session.user.id, rating, comment);
  req.session.notice = { type: 'success', message: 'Thank you. Your service feedback has been saved.' };
  return res.redirect(`/requests/${id}`);
};

exports.getRequestImage = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(404).render('error', { title: 'Image not found', message: 'That request image does not exist.' });
  }
  const imageColumns = { report: 'report_image', before: 'before_image', after: 'after_image' };
  const column = imageColumns[req.params.type];
  if (!column) {
    return res.status(404).render('error', { title: 'Image not found', message: 'That request image does not exist.' });
  }
  const request = await maintenance.getRequest(Number(req.params.id));
  const technicianCategories = req.session.user.role === 'staff'
    ? await accounts.getTechnicianCategories(req.session.user.id)
    : [];
  const canView = request && (
    req.session.user.role === 'admin' ||
    request.created_by === req.session.user.id ||
    (req.session.user.role === 'staff' &&
      (Number(request.assigned_to) === Number(req.session.user.id) ||
        (request.assigned_to == null && technicianCategories.includes(request.category))))
  );
  if (!canView) {
    return res.status(404).render('error', { title: 'Image not found', message: 'That request image does not exist.' });
  }
  const filename = request[column];
  const contentType = filename && getImageContentType(filename);
  if (!contentType || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
    return res.status(404).render('error', { title: 'Image not found', message: 'That request image does not exist.' });
  }
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(path.join(db.uploadsDirectory, filename), {
    headers: { 'Content-Type': contentType }
  }, (err) => {
    if (err && !res.headersSent) return res.status(404).render('error', {
      title: 'Image not found',
      message: 'That request image does not exist.'
    });
  });
};

exports.postStatus = async (req, res) => {
  const id = Number(req.params.id);
  const status = typeof req.body.status === 'string' ? req.body.status : '';
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 240) : '';
  if (!validId(req.params.id) || !maintenance.STATUSES.includes(status)) {
    return res.status(400).render('error', {
      title: 'Invalid update',
      message: 'Choose a valid status before updating the request.'
    });
  }
  const request = await maintenance.getRequest(id);
  if (!request) {
    return res.status(404).render('error', { title: 'Request not found', message: 'That request does not exist.' });
  }
  if (req.session.user.role === 'staff' &&
      Number(request.assigned_to) !== Number(req.session.user.id)) {
    return res.status(403).render('error', {
      title: 'Request not assigned',
      message: 'Accept this request before updating its work status.'
    });
  }
  if (req.imageUploadError) {
    req.session.notice = { type: 'danger', message: req.imageUploadError };
    return res.redirect(`/requests/${id}`);
  }
  const beforeFile = req.files && req.files.before_image && req.files.before_image[0];
  const afterFile = req.files && req.files.after_image && req.files.after_image[0];
  if ([beforeFile, afterFile].some((file) => {
    if (!file) return false;
    const image = identifyImage(file.buffer);
    return !image || image.mimeType !== file.mimetype;
  })) {
    req.session.notice = { type: 'danger', message: 'Work photos must be valid JPEG, PNG, or WebP images.' };
    return res.redirect(`/requests/${id}`);
  }
  if (request.status !== status && !note) {
    req.session.notice = {
      type: 'danger',
      message: 'Add a short update note to explain this status change.'
    };
    return res.redirect(`/requests/${id}`);
  }
  if (status === 'In Progress' && !beforeFile && !request.before_image) {
    req.session.notice = { type: 'danger', message: 'Upload a before-work photo before marking this request In Progress.' };
    return res.redirect(`/requests/${id}`);
  }
  if (status === 'Resolved' && !beforeFile && !request.before_image) {
    req.session.notice = { type: 'danger', message: 'Upload a before-work photo before resolving this request.' };
    return res.redirect(`/requests/${id}`);
  }
  if (status === 'Resolved' && !afterFile && !request.after_image) {
    req.session.notice = { type: 'danger', message: 'Upload an after-work photo before marking this request Resolved.' };
    return res.redirect(`/requests/${id}`);
  }
  const beforeImage = beforeFile ? await storeImage(beforeFile) : null;
  let afterImage = null;
  try {
    afterImage = afterFile ? await storeImage(afterFile) : null;
    const images = { beforeImage, afterImage };
    const hasPhotos = Boolean(beforeImage || afterImage);
    await maintenance.updateStatus(
      id,
      req.session.user.id,
      status,
      note || (request.status !== status
        ? `Status changed to ${status}`
        : hasPhotos ? 'Work evidence photos uploaded' : `Status remains ${status}`),
      images
    );
  } catch (err) {
    await removeImages([beforeImage, afterImage]);
    throw err;
  }
  await removeImages([
    beforeImage ? request.before_image : null,
    afterImage ? request.after_image : null
  ]);
  req.session.notice = { type: 'success', message: `Request #${id} was updated.` };
  return res.redirect(`/requests/${id}`);
};

exports.postAcceptRequest = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(404).render('error', {
      title: 'Request not found',
      message: 'That request does not exist.'
    });
  }
  const request = await maintenance.getRequest(Number(req.params.id));
  if (!request) {
    return res.status(404).render('error', {
      title: 'Request not found',
      message: 'That request does not exist.'
    });
  }
  const categories = await accounts.getTechnicianCategories(req.session.user.id);
  if (!categories.includes(request.category)) {
    return res.status(403).render('error', {
      title: 'Category not assigned',
      message: 'Your technician profile is not assigned to this request category.'
    });
  }
  if (request.status !== 'Open' || request.assigned_to != null) {
    req.session.notice = {
      type: 'info',
      message: 'This request is no longer available to accept.'
    };
    return res.redirect('/dashboard');
  }
  const accepted = await maintenance.claimRequest(
    request.id,
    req.session.user.id,
    request.category,
    req.session.user.full_name
  );
  if (!accepted) {
    req.session.notice = {
      type: 'info',
      message: 'Another technician accepted this request first, or it is no longer open.'
    };
    return res.redirect('/dashboard');
  }
  req.session.notice = { type: 'success', message: `Campus request #${request.id} is now assigned to you.` };
  return res.redirect(`/requests/${request.id}`);
};

exports.postDelete = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(404).render('error', { title: 'Request not found', message: 'That request does not exist.' });
  }
  const request = await maintenance.getRequest(Number(req.params.id));
  if (!request) {
    return res.status(404).render('error', { title: 'Request not found', message: 'That request does not exist.' });
  }
  if (request.created_by !== req.session.user.id || request.status !== 'Open') {
    return res.status(403).render('error', {
      title: 'Request cannot be withdrawn',
      message: 'Only your own open requests can be withdrawn.'
    });
  }
  const deleted = await maintenance.deleteRequest(request.id, req.session.user.id);
  if (deleted) {
    await removeImages([request.report_image, request.before_image, request.after_image]);
  }
  req.session.notice = { type: 'success', message: 'The request was withdrawn.' };
  return res.redirect('/dashboard');
};
