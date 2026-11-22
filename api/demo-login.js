import {createHash, timingSafeEqual} from 'node:crypto';

// These are intentionally public demo credentials. The endpoint has no access
// to profile data, which lives in browser storage.
const accounts = new Map([
  ['duelist1', 'DuelLab-101!'],
  ['duelist2', 'DuelLab-102!'],
  ['duelist3', 'DuelLab-103!'],
]);
const digest = value => createHash('sha256').update(value).digest();

export default async function login(req, res) {
  const reply = (status, data) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, {error: 'Use the sign-in form.'});
  }
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    return reply(415, {error: 'Expected a sign-in request.'});
  }
  let credentials;
  try {
    credentials = req.body;
    if (credentials === undefined) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1024) return reply(413, {error: 'Sign-in request is too large.'});
      }
      credentials = JSON.parse(raw);
    } else if (typeof credentials === 'string' || Buffer.isBuffer(credentials)) {
      credentials = JSON.parse(credentials.toString());
    }
  } catch {
    return reply(400, {error: 'Could not read sign-in request.'});
  }
  const {username, password} = credentials ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 128) {
    return reply(400, {error: 'Enter a valid login ID and password.'});
  }
  const id = username.trim().toLowerCase();
  const expected = accounts.get(id);
  if (!timingSafeEqual(digest(password), digest(expected ?? '')) || !expected) {
    return reply(401, {error: 'Login ID or password is incorrect.'});
  }
  return reply(200, {id});
}
