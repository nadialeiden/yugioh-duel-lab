import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
import {cookie, deviceCookie, sessionCookie, vercelIpHeader} from './session.js';
import {createGuestQuota} from './guest-quota.js';

// Shared demo accounts. Profiles remain in browser storage.
const accounts = new Map([
  ['duelist1', process.env.DUELIST1_PASSWORD || 'DuelLab-101!'],
  ['duelist2', process.env.DUELIST2_PASSWORD || 'DuelLab-102!'],
  ['duelist3', process.env.DUELIST3_PASSWORD || 'DuelLab-103!'],
]);
const digest = value => createHash('sha256').update(value).digest();
const dayLength = 86400000;
const guestDuration = 30 * 60 * 1000;
const accountDuration = 12 * 60 * 60 * 1000;
const deviceDuration = 90 * dayLength;
const networkLimit = 3;

export function clientIp(req, hosted) {
  return hosted ? req.headers[vercelIpHeader] : req.socket.remoteAddress;
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024) return null;
  }
  return JSON.parse(raw);
}

export function createLoginHandler(codec, {hosted = false, now = Date.now, quota = createGuestQuota({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN,
})} = {}) {
  return async function login(req, res) {
    const reply = (status, data) => {
      res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
      res.end(JSON.stringify(data));
    };
    const header = req.headers.cookie;
    const ip = clientIp(req, hosted);
    const setCookie = (name, value, lifetime) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.ceil(lifetime / 1000)}${hosted ? '; Secure' : ''}`;
    const issue = async (fields, lifetime, extraCookies = []) => {
      const expires = now() + lifetime;
      const token = await codec.sign({kind: 'session', expires, ...fields});
      res.setHeader('Set-Cookie', [setCookie(sessionCookie, token, lifetime), ...extraCookies]);
      return reply(200, {id: fields.id, expires});
    };
    if (req.method === 'GET') {
      const session = await codec.session(header, ip);
      return session ? reply(200, {id: session.id, expires: session.expires}) : reply(401, {error: 'Choose how to enter the lab.'});
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') return reply(403, {error: 'Open the sign-in page to continue.'});
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', setCookie(sessionCookie, '', 0));
      return reply(200, {ok: true});
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return reply(405, {error: 'Use the sign-in form.'});
    }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
      return reply(415, {error: 'Expected a sign-in request.'});
    }
    let credentials;
    try { credentials = await readBody(req); }
    catch { return reply(400, {error: 'Could not read sign-in request.'}); }
    if (credentials?.guest === true) {
      const current = await codec.session(header, ip);
      if (current) return reply(200, {id: current.id, expires: current.expires});
      if (!ip) return reply(503, {error: 'Guest access is unavailable on this network. Sign in to continue.'});
      const day = Math.floor(now() / dayLength);
      const prior = await codec.read(cookie(header, deviceCookie), 'device');
      if (prior?.day === day) return reply(429, {error: 'This browser has used its guest pass for today. Sign in or try again tomorrow (UTC).'});
      const device = prior?.id ?? randomUUID();
      const network = await codec.ipKey(ip);
      try {
        const available = await quota({ip: network, device, day, limit: networkLimit, secondsUntilReset: Math.ceil(((day + 1) * dayLength - now()) / 1000)});
        if (!available) return reply(429, {error: 'This network or browser has used its guest passes for today. Sign in or try again tomorrow (UTC).'});
      } catch {
        return reply(503, {error: 'Guest passes are temporarily unavailable. You can still sign in.'});
      }
      const remember = await codec.sign({kind: 'device', id: device, day, expires: now() + deviceDuration});
      return issue({id: 'guest', device, ip: network}, guestDuration, [setCookie(deviceCookie, remember, deviceDuration)]);
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
    return issue({id}, accountDuration);
  };
}
