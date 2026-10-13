const maintenance = require('../models/maintenance');

const isStaff = (user) => ['staff', 'admin'].includes(user.role);
const validId = (value) => /^\d+$/.test(value) && Number(value) > 0;
const validLocations = [
  'Administration Building',
  'Arts & Humanities',
  'Athletics Center',
  'Campus Library',
  'Engineering Hall',
  'Learning Commons',
  'North Residence Hall',
  'Science Center',
  'Student Union',
  'Other'
];

exports.getDashboard = async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const staffView = isStaff(req.session.user);
  const [requests, stats, hotspots] = await Promise.all([
    maintenance.listRequests({
      userId: req.session.user.id,
      isStaff: staffView,
      search,
      status
    }),
    maintenance.getDashboardStats(req.session.user.id, staffView),
    maintenance.getPulse()
  ]);
  return res.render('dashboard', {
    requests,
    stats,
    hotspots,
    search,
    status,
    staffView
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

  const id = await maintenance.createRequest(values, req.session.user.id);
  req.session.notice = { type: 'success', message: `Request #${id} has been submitted.` };
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
  if (!staffView && request.created_by !== req.session.user.id) {
    return res.status(403).render('error', {
      title: 'Access restricted',
      message: 'You can only view requests submitted from your account.'
    });
  }
  const updates = await maintenance.getUpdates(request.id);
  return res.render('request-detail', { request, updates, staffView, statuses: maintenance.STATUSES });
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
  if (request.status !== status) {
    await maintenance.updateStatus(id, req.session.user.id, status, note || `Status changed to ${status}`);
  }
  req.session.notice = { type: 'success', message: `Request #${id} was updated.` };
  return res.redirect(`/requests/${id}`);
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
  await maintenance.deleteRequest(request.id, req.session.user.id);
  req.session.notice = { type: 'success', message: 'The request was withdrawn.' };
  return res.redirect('/dashboard');
};
