const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const databasePath = path.join(os.tmpdir(), `campus-care-${process.pid}-${Date.now()}.sqlite`);
const samplePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/FXsAAAAASUVORK5CYII=',
  'base64'
);
process.env.DB_PATH = databasePath;
process.env.DB_DRIVER = 'sqlite';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';
process.env.ADMIN_EMAIL = 'operations@campus.test';
process.env.ADMIN_UNIQUE_ID = '20260000';
process.env.ADMIN_PASSWORD = 'TestAdminPassword2026!';

const app = require('../app');
const db = require('../config/db');
let server;
let baseUrl;

before(async () => {
  await db.ready;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
  const imageRows = await db.all(
    'SELECT report_image, before_image, after_image FROM maintenance_requests'
  );
  const imageNames = imageRows.flatMap((row) => [row.report_image, row.before_image, row.after_image]);
  const profileRows = await db.all('SELECT profile_image FROM users');
  imageNames.push(...profileRows.map((row) => row.profile_image));
  await require('../middleware/imageUploads').removeImages(imageNames);
  await db.close();
  if (fs.existsSync(db.uploadsDirectory)) fs.rmSync(db.uploadsDirectory, { recursive: true, force: true });
  for (const suffix of ['', '-shm', '-wal']) {
    const filename = `${databasePath}${suffix}`;
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
});

function client() {
  let cookie = '';
  return async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (cookie) headers.set('Cookie', cookie);
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers,
      redirect: 'manual'
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';', 1)[0];
    return response;
  };
}

function multipart(values, files = {}) {
  const body = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(name, item);
  }
  for (const [name, value] of Object.entries(files)) {
    body.append(name, new Blob([value], { type: 'image/png' }), 'campus.png');
  }
  return { method: 'POST', body };
}

function form(values) {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(name, item);
  }
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  };
}

test('accounts, request privacy, staff workflow, and Campus Pulse work end to end', async () => {
  const visitor = client();
  const loginPage = await visitor('/login');
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /aria-label="Show password"/);
  const registrationPage = await visitor('/register');
  assert.equal(registrationPage.status, 200);
  const registrationHtml = await registrationPage.text();
  assert.match(registrationHtml, /Students and faculty can sign in as soon as they register/);
  assert.match(registrationHtml, /aria-label="Show password"/);

  const denied = await visitor('/dashboard');
  assert.equal(denied.status, 302);
  assert.equal(denied.headers.get('location'), '/login');

  const privilegeEscalation = await visitor('/register', form({
    full_name: 'Unauthorized Admin',
    email: 'intruder@campus.test',
    password: 'ValidPassword123',
    role: 'admin'
  }));
  assert.equal(privilegeEscalation.status, 400);

  const registered = await visitor('/register', form({
    full_name: 'Avery Student',
    email: 'avery@campus.test',
    unique_id: '20260001',
    password: 'ValidPassword123',
    role: 'student'
  }));
  assert.equal(registered.status, 302);
  assert.equal(registered.headers.get('location'), '/login');
  assert.equal((await db.get('SELECT verification_status FROM users WHERE email = ?', ['avery@campus.test'])).verification_status, 'Accepted');

  const staff = client();
  await staff('/login', form({
    email: 'operations@campus.test',
    password: 'TestAdminPassword2026!'
  }));
  const verificationPage = await staff('/admin/verifications');
  assert.equal(verificationPage.status, 200);
  const verificationHtml = await verificationPage.text();
  assert.doesNotMatch(verificationHtml, /20260001/);
  assert.match(verificationHtml, /No technicians to review/);
  assert.match(verificationHtml, /Compare technician campus IDs/);
  assert.doesNotMatch(verificationHtml, /name="unique_id"/);
  const analyticsPage = await staff('/admin/analytics');
  assert.equal(analyticsPage.status, 200);
  assert.match(await analyticsPage.text(), /Maintenance analytics/);
  const studentId = (await db.get('SELECT id FROM users WHERE email = ?', ['avery@campus.test'])).id;
  const adminId = (await db.get('SELECT id FROM users WHERE email = ?', ['operations@campus.test'])).id;
  const adminChangeAttempt = await staff(`/admin/verifications/${adminId}`, form({
    status: 'Rejected'
  }));
  assert.equal(adminChangeAttempt.status, 404);

  const studentVerificationAttempt = await staff(`/admin/verifications/${studentId}`, form({ status: 'Rejected' }));
  assert.equal(studentVerificationAttempt.status, 404);

  const duplicate = await visitor('/register', form({
    full_name: 'Avery Student',
    email: 'AVERY@campus.test',
    unique_id: '20260001',
    password: 'ValidPassword123',
    role: 'student'
  }));
  assert.equal(duplicate.status, 409);
  const duplicateId = await visitor('/register', form({
    full_name: 'Morgan Student',
    email: 'morgan@campus.test',
    unique_id: '20260001',
    password: 'ValidPassword123',
    role: 'student'
  }));
  assert.equal(duplicateId.status, 409);

  const invalidLogin = await visitor('/login', form({
    email: 'avery@campus.test',
    password: 'incorrect'
  }));
  assert.equal(invalidLogin.status, 401);

  const signedIn = await visitor('/login', form({
    email: 'avery@campus.test',
    password: 'ValidPassword123'
  }));
  assert.equal(signedIn.status, 302);
  assert.equal(signedIn.headers.get('location'), '/dashboard');
  const studentProfile = await visitor('/profile');
  assert.equal(studentProfile.status, 200);
  assert.match(await studentProfile.text(), /Campus ID/);
  const campusRequestForm = await visitor('/requests/new');
  const campusRequestHtml = await campusRequestForm.text();
  const campusLocations = [
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
  for (const location of campusLocations) assert.ok(campusRequestHtml.includes(`value="${location}"`), location);
  assert.doesNotMatch(campusRequestHtml, /Engineering Hall|Campus Library|North Residence Hall/);

  const invalidRequest = await visitor('/requests', form({ title: 'x' }));
  assert.equal(invalidRequest.status, 400);

  const requestFields = (title) => ({
    title,
    category: 'Plumbing',
    building: 'College of Engineering and Architecture - Acad I',
    room: 'Room 204',
    priority: 'High',
    description: 'The sink continues to leak under the counter.'
  });
  const obsoleteCampusLocation = await visitor('/requests', form({
    ...requestFields('Request with an obsolete location'),
    building: 'Engineering Hall'
  }));
  assert.equal(obsoleteCampusLocation.status, 400);
  assert.match(await obsoleteCampusLocation.text(), /Choose a campus building from the list/);
  const invalidImage = await visitor('/requests', multipart(
    requestFields('Invalid image request'),
    { report_image: Buffer.from('not an image') }
  ));
  assert.equal(invalidImage.status, 400);
  const oversizedImage = await visitor('/requests', multipart(
    requestFields('Oversized image request'),
    { report_image: Buffer.alloc(5 * 1024 * 1024 + 1) }
  ));
  assert.equal(oversizedImage.status, 400);
  assert.match(await oversizedImage.text(), /5 MB or smaller/);
  const firstRequest = await visitor('/requests', multipart(
    requestFields('Leaking study-room sink'),
    { report_image: samplePng }
  ));
  assert.equal(firstRequest.status, 302);
  const firstRequestPath = firstRequest.headers.get('location');
  const firstId = Number(firstRequestPath.split('/').pop());
  const savedReport = await db.get(
    'SELECT report_image, due_at, created_at FROM maintenance_requests WHERE id = ?',
    [firstId]
  );
  assert.ok(savedReport.report_image);
  assert.ok(savedReport.due_at);
  const dueDelay = Date.parse(`${savedReport.due_at.replace(' ', 'T')}Z`) -
    Date.parse(`${savedReport.created_at.replace(' ', 'T')}Z`);
  assert.ok(Math.abs(dueDelay - 72 * 60 * 60 * 1000) <= 1000);
  const reportPhoto = await visitor(`/requests/${firstId}/images/report`);
  assert.equal(reportPhoto.status, 200);
  assert.equal(reportPhoto.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await reportPhoto.arrayBuffer()), samplePng);

  const dashboard = await visitor('/dashboard');
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /Leaking study-room sink/);
  assert.match(dashboardHtml, /Campus SLA Watch/);
  assert.match(dashboardHtml, /High 72h/);
  assert.match(dashboardHtml, /College of Engineering and Architecture - Acad I/);

  const secondRequest = await visitor('/requests', form(requestFields('Another leaking sink')));
  assert.equal(secondRequest.status, 302);
  const secondId = Number(secondRequest.headers.get('location').split('/').pop());
  await db.run("UPDATE maintenance_requests SET due_at = datetime('now', '-1 hour') WHERE id = ?", [secondId]);

  const otherUser = client();
  const facultyRegistration = await otherUser('/register', form({
    full_name: 'Casey Faculty',
    email: 'casey@campus.test',
    unique_id: '20260002',
    password: 'ValidPassword123',
    role: 'faculty'
  }));
  assert.equal(facultyRegistration.status, 302);
  const facultyId = (await db.get('SELECT id FROM users WHERE email = ?', ['casey@campus.test'])).id;
  assert.equal((await db.get(
    'SELECT verification_status FROM users WHERE id = ?',
    [facultyId]
  )).verification_status, 'Accepted');
  await otherUser('/login', form({
    email: 'casey@campus.test',
    password: 'ValidPassword123'
  }));
  const electricalRequest = await otherUser('/requests', form({
    ...requestFields('Urgent electrical panel fault'),
    category: 'Electrical',
    priority: 'Urgent'
  }));
  assert.equal(electricalRequest.status, 302);
  const electricalId = Number(electricalRequest.headers.get('location').split('/').pop());
  const privateRequest = await otherUser(`/requests/${firstId}`);
  assert.equal(privateRequest.status, 403);
  const privateImage = await otherUser(`/requests/${firstId}/images/report`);
  assert.equal(privateImage.status, 404);

  const studentStatusAttempt = await visitor(`/requests/${firstId}/status`, form({ status: 'Resolved' }));
  assert.equal(studentStatusAttempt.status, 403);
  const studentAdminAttempt = await visitor('/admin/verifications');
  assert.equal(studentAdminAttempt.status, 403);

  const staffDashboard = await staff('/dashboard');
  const staffDashboardHtml = await staffDashboard.text();
  assert.equal(staffDashboard.status, 200);
  assert.match(staffDashboardHtml, /Campus Pulse/);
  assert.match(staffDashboardHtml, /Campus SLA Watch/);
  assert.match(staffDashboardHtml, /Overdue/);
  assert.match(staffDashboardHtml, /College of Engineering and Architecture - Acad I/);
  assert.match(staffDashboardHtml, /2 open reports/);

  const missingStatusNote = await staff(`/requests/${firstId}/status`, form({
    status: 'In Progress'
  }));
  assert.equal(missingStatusNote.status, 302);
  assert.equal((await db.get('SELECT status FROM maintenance_requests WHERE id = ?', [firstId])).status, 'Open');
  const missingStatusNoteDetail = await staff(`/requests/${firstId}`);
  assert.match(await missingStatusNoteDetail.text(), /Add a short update note to explain this status change/);

  const missingBeforePhoto = await staff(`/requests/${firstId}/status`, form({
    status: 'In Progress',
    note: 'Facilities team assigned to investigate.'
  }));
  assert.equal(missingBeforePhoto.status, 302);
  assert.equal((await db.get('SELECT status FROM maintenance_requests WHERE id = ?', [firstId])).status, 'Open');
  const update = await staff(`/requests/${firstId}/status`, multipart({
    status: 'In Progress',
    note: 'Facilities team assigned to investigate.'
  }, { before_image: samplePng }));
  assert.equal(update.status, 302);

  const detail = await staff(`/requests/${firstId}`);
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200);
  assert.match(detailHtml, /Required for status changes/);
  assert.match(detailHtml, /data-current-status="In Progress"/);
  assert.match(detailHtml, /In Progress/);
  assert.match(detailHtml, /Facilities team assigned to investigate/);
  assert.match(detailHtml, /Before maintenance/);
  const prematureFeedback = await visitor(`/requests/${firstId}/feedback`, form({
    rating: '5',
    comment: 'Not resolved yet'
  }));
  assert.equal(prematureFeedback.status, 302);
  assert.equal(await db.get('SELECT id FROM request_feedback WHERE request_id = ?', [firstId]), undefined);
  assert.equal((await otherUser(`/requests/${firstId}/feedback`, form({
    rating: '5',
    comment: 'Not the reporter'
  }))).status, 403);
  const resolveUpdate = await staff(`/requests/${firstId}/status`, multipart({
    status: 'Resolved',
    note: 'Leak repaired and tested.'
  }, { after_image: samplePng }));
  assert.equal(resolveUpdate.status, 302);
  const resolvedRequest = await db.get(
    'SELECT status, before_image, after_image FROM maintenance_requests WHERE id = ?',
    [firstId]
  );
  assert.equal(resolvedRequest.status, 'Resolved');
  assert.ok(resolvedRequest.before_image);
  assert.ok(resolvedRequest.after_image);
  const afterPhoto = await visitor(`/requests/${firstId}/images/after`);
  assert.equal(afterPhoto.status, 200);
  const resolvedDetail = await visitor(`/requests/${firstId}`);
  const resolvedHtml = await resolvedDetail.text();
  assert.match(resolvedHtml, /After maintenance/);
  assert.match(resolvedHtml, /How was the maintenance service/);
  const feedbackSave = await visitor(`/requests/${firstId}/feedback`, form({
    rating: '5',
    comment: '=2+2'
  }));
  assert.equal(feedbackSave.status, 302);
  const formulaSafeCsv = await staff('/admin/analytics/export.csv');
  assert.match(await formulaSafeCsv.text(), /'=2\+2/);
  const feedbackEdit = await visitor(`/requests/${firstId}/feedback`, form({
    rating: '4',
    comment: 'Updated service feedback'
  }));
  assert.equal(feedbackEdit.status, 302);
  const savedFeedback = await db.get(
    'SELECT rating, comment FROM request_feedback WHERE request_id = ?',
    [firstId]
  );
  assert.equal(savedFeedback.rating, 4);
  assert.equal(savedFeedback.comment, 'Updated service feedback');
  assert.equal((await db.get(
    'SELECT COUNT(*) AS count FROM request_feedback WHERE request_id = ?',
    [firstId]
  )).count, 1);
  assert.equal((await visitor('/admin/analytics')).status, 403);
  assert.equal((await visitor('/admin/analytics/export.csv')).status, 403);
  const csvExport = await staff('/admin/analytics/export.csv');
  assert.equal(csvExport.status, 200);
  assert.match(csvExport.headers.get('content-type'), /text\/csv/);
  assert.match(await csvExport.text(), /Updated service feedback/);
  const pdfExport = await staff('/admin/analytics/export.pdf');
  assert.equal(pdfExport.status, 200);
  assert.match(pdfExport.headers.get('content-type'), /application\/pdf/);
  assert.match(Buffer.from(await pdfExport.arrayBuffer()).toString('ascii', 0, 5), /%PDF-/);

  const withdraw = await visitor(`/requests/${secondId}/delete`, form({}));
  assert.equal(withdraw.status, 302);
  assert.equal(await db.get('SELECT id FROM maintenance_requests WHERE id = ?', [secondId]), undefined);

  const logout = await visitor('/logout');
  assert.equal(logout.status, 404);
  const loggedOut = await visitor('/logout', form({}));
  assert.equal(loggedOut.status, 302);
  assert.equal(loggedOut.headers.get('location'), '/login');

  const technical = client();
  const missingSpecialty = await technical('/register', form({
    full_name: 'No Specialty Technician',
    email: 'no-specialty@campus.test',
    unique_id: '20260004',
    password: 'ValidPassword123',
    role: 'staff'
  }));
  assert.equal(missingSpecialty.status, 400);
  assert.match(await missingSpecialty.text(), /Choose at least one valid maintenance category/);
  const technicalRegistration = await technical('/register', form({
    full_name: 'Taylor Technician',
    email: 'taylor@campus.test',
    unique_id: '20260003',
    password: 'ValidPassword123',
    role: 'staff',
    categories: ['Electrical', 'Safety']
  }));
  assert.equal(technicalRegistration.status, 302);
  const technicalId = (await db.get('SELECT id FROM users WHERE email = ?', ['taylor@campus.test'])).id;
  assert.equal((await db.get(
    'SELECT verification_status FROM users WHERE id = ?',
    [technicalId]
  )).verification_status, 'Pending');
  const pendingTechnicianLogin = await technical('/login', form({
    email: 'taylor@campus.test',
    password: 'ValidPassword123'
  }));
  assert.equal(pendingTechnicianLogin.status, 403);
  assert.match(await pendingTechnicianLogin.text(), /awaiting administrator verification/);
  const technicianVerificationPage = await staff('/admin/verifications');
  assert.match(await technicianVerificationPage.text(), /Taylor Technician/);
  await staff(`/admin/verifications/${technicalId}`, form({ status: 'Rejected' }));
  const rejectedLogin = await technical('/login', form({
    email: 'taylor@campus.test',
    password: 'ValidPassword123'
  }));
  assert.equal(rejectedLogin.status, 403);
  await staff(`/admin/verifications/${technicalId}`, form({ status: 'Accepted' }));
  const acceptedTechnicalLogin = await technical('/login', form({
    email: 'taylor@campus.test',
    password: 'ValidPassword123'
  }));
  assert.equal(acceptedTechnicalLogin.status, 302);
  const technicalDashboard = await technical('/dashboard');
  assert.equal(technicalDashboard.status, 200);
  const technicalDashboardHtml = await technicalDashboard.text();
  assert.match(technicalDashboardHtml, /Urgent electrical panel fault/);
  assert.doesNotMatch(technicalDashboardHtml, /Leaking study-room sink/);
  assert.doesNotMatch(technicalDashboardHtml, /href="\/requests\/new"/);
  assert.match(technicalDashboardHtml, /Requests for your specialties/);
  assert.equal((await technical('/requests/new')).status, 403);

  const specialtyForbidden = await technical(`/requests/${firstId}`);
  assert.equal(specialtyForbidden.status, 403);
  assert.equal((await technical(`/requests/${firstId}/accept`, form({}))).status, 403);
  const eligibleRequest = await technical(`/requests/${electricalId}`);
  assert.equal(eligibleRequest.status, 200);
  assert.match(await eligibleRequest.text(), /Accept this campus request/);
  const profilePage = await technical('/profile');
  assert.equal(profilePage.status, 200);
  assert.match(await profilePage.text(), /Campus ID/);

  const profileUpdate = await technical('/profile', multipart({
    full_name: 'Taylor Electrical Technician',
    email: 'taylor@campus.test',
    categories: ['Electrical', 'Plumbing']
  }, { profile_image: samplePng }));
  assert.equal(profileUpdate.status, 302);
  const savedProfile = await db.get(
    'SELECT full_name, profile_image FROM users WHERE id = ?',
    [technicalId]
  );
  assert.equal(savedProfile.full_name, 'Taylor Electrical Technician');
  assert.ok(savedProfile.profile_image);
  assert.deepEqual(
    (await db.all('SELECT category FROM technician_categories WHERE user_id = ? ORDER BY category', [technicalId]))
      .map((row) => row.category),
    ['Electrical', 'Plumbing']
  );
  const profilePhoto = await technical('/profile/image');
  assert.equal(profilePhoto.status, 200);
  assert.deepEqual(Buffer.from(await profilePhoto.arrayBuffer()), samplePng);

  const removeSpecialty = await technical('/profile', multipart({
    full_name: 'Taylor Electrical Technician',
    email: 'taylor@campus.test',
    categories: ['Electrical']
  }));
  assert.equal(removeSpecialty.status, 302);
  assert.deepEqual(
    (await db.all('SELECT category FROM technician_categories WHERE user_id = ?', [technicalId]))
      .map((row) => row.category),
    ['Electrical']
  );

  const accept = await technical(`/requests/${electricalId}/accept`, form({}));
  assert.equal(accept.status, 302);
  const assignedRequest = await db.get(
    'SELECT assigned_to, status FROM maintenance_requests WHERE id = ?',
    [electricalId]
  );
  assert.equal(Number(assignedRequest.assigned_to), Number(technicalId));
  assert.equal(assignedRequest.status, 'Open');
  assert.equal((await db.get(
    "SELECT note FROM request_updates WHERE request_id = ? AND note LIKE 'Accepted by %'",
    [electricalId]
  )).note, 'Accepted by Taylor Electrical Technician');
  const acceptedDetail = await technical(`/requests/${electricalId}`);
  assert.match(await acceptedDetail.text(), /Update this request/);

  const secondTechnician = client();
  const secondTechRegistration = await secondTechnician('/register', form({
    full_name: 'Jordan Electrician',
    email: 'jordan@campus.test',
    unique_id: '20260005',
    password: 'ValidPassword123',
    role: 'staff',
    categories: ['Electrical']
  }));
  assert.equal(secondTechRegistration.status, 302);
  const secondTechId = (await db.get('SELECT id FROM users WHERE email = ?', ['jordan@campus.test'])).id;
  await staff(`/admin/verifications/${secondTechId}`, form({ status: 'Accepted' }));
  const automaticallyAssigned = await otherUser('/requests', form({
    ...requestFields('Second electrical maintenance issue'),
    category: 'Electrical',
    priority: 'Normal'
  }));
  assert.equal(automaticallyAssigned.status, 302);
  const automaticallyAssignedId = Number(automaticallyAssigned.headers.get('location').split('/').pop());
  const scheduledRequest = await db.get(
    'SELECT assigned_to FROM maintenance_requests WHERE id = ?',
    [automaticallyAssignedId]
  );
  assert.equal(Number(scheduledRequest.assigned_to), Number(secondTechId));
  const scheduledDetail = await otherUser(`/requests/${automaticallyAssignedId}`);
  assert.match(await scheduledDetail.text(), /SCHEDULED TECHNICIAN/);

  const urgentRequesterDashboard = await otherUser('/dashboard');
  const urgentRequesterHtml = await urgentRequesterDashboard.text();
  assert.match(urgentRequesterHtml, /request-row-urgent/);
  assert.match(urgentRequesterHtml, /priority-urgent-label/);
});
