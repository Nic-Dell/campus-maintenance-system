const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const databasePath = path.join(os.tmpdir(), `campus-care-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = databasePath;
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';
process.env.ADMIN_EMAIL = 'operations@campus.test';
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
  if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await db.close();
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

function form(values) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values)
  };
}

test('accounts, request privacy, staff workflow, and Campus Pulse work end to end', async () => {
  const visitor = client();
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
    password: 'ValidPassword123',
    role: 'student'
  }));
  assert.equal(registered.status, 302);
  assert.equal(registered.headers.get('location'), '/login');

  const duplicate = await visitor('/register', form({
    full_name: 'Avery Student',
    email: 'AVERY@campus.test',
    password: 'ValidPassword123',
    role: 'student'
  }));
  assert.equal(duplicate.status, 409);

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

  const invalidRequest = await visitor('/requests', form({ title: 'x' }));
  assert.equal(invalidRequest.status, 400);

  const submitRequest = async (title) => visitor('/requests', form({
    title,
    category: 'Plumbing',
    building: 'Engineering Hall',
    room: 'Room 204',
    priority: 'High',
    description: 'The sink continues to leak under the counter.'
  }));
  const firstRequest = await submitRequest('Leaking study-room sink');
  assert.equal(firstRequest.status, 302);
  const firstRequestPath = firstRequest.headers.get('location');
  const firstId = Number(firstRequestPath.split('/').pop());

  const dashboard = await visitor('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Leaking study-room sink/);

  const secondRequest = await submitRequest('Another leaking sink');
  assert.equal(secondRequest.status, 302);
  const secondId = Number(secondRequest.headers.get('location').split('/').pop());

  const otherUser = client();
  await otherUser('/register', form({
    full_name: 'Casey Faculty',
    email: 'casey@campus.test',
    password: 'ValidPassword123',
    role: 'faculty'
  }));
  await otherUser('/login', form({
    email: 'casey@campus.test',
    password: 'ValidPassword123'
  }));
  const privateRequest = await otherUser(`/requests/${firstId}`);
  assert.equal(privateRequest.status, 403);

  const studentStatusAttempt = await visitor(`/requests/${firstId}/status`, form({ status: 'Resolved' }));
  assert.equal(studentStatusAttempt.status, 403);

  const staff = client();
  await staff('/login', form({
    email: 'operations@campus.test',
    password: 'TestAdminPassword2026!'
  }));
  const staffDashboard = await staff('/dashboard');
  const staffDashboardHtml = await staffDashboard.text();
  assert.equal(staffDashboard.status, 200);
  assert.match(staffDashboardHtml, /Campus Pulse/);
  assert.match(staffDashboardHtml, /Engineering Hall/);
  assert.match(staffDashboardHtml, /2 open reports/);

  const update = await staff(`/requests/${firstId}/status`, form({
    status: 'In Progress',
    note: 'Facilities team assigned to investigate.'
  }));
  assert.equal(update.status, 302);

  const detail = await visitor(`/requests/${firstId}`);
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200);
  assert.match(detailHtml, /In Progress/);
  assert.match(detailHtml, /Facilities team assigned to investigate/);

  const withdraw = await visitor(`/requests/${secondId}/delete`, form({}));
  assert.equal(withdraw.status, 302);
  assert.equal(await db.get('SELECT id FROM maintenance_requests WHERE id = ?', [secondId]), undefined);

  const logout = await visitor('/logout');
  assert.equal(logout.status, 404);
  const loggedOut = await visitor('/logout', form({}));
  assert.equal(loggedOut.status, 302);
  assert.equal(loggedOut.headers.get('location'), '/login');
});
