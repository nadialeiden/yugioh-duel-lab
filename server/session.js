const encoder = new TextEncoder();
const base64url = value => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
const accounts = new Set(['duelist1', 'duelist2', 'duelist3']);

export const sessionCookie = 'duel_session';
export const deviceCookie = 'duel_guest_device';
export const sessionPath = '/api/demo-login';
export const signInPath = '/signin.html';
export const vercelIpHeader = 'x-vercel-forwarded-for';

export function cookie(header, name) {
  return header?.split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
}

export function publicPath(pathname) {
  return [sessionPath, signInPath, '/signin.css', '/signin.mjs', '/build-info.json'].includes(pathname);
}

export function createSessionCodec(secret, now = Date.now) {
  const key = crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
  async function sign(value) {
    const payload = base64url(encoder.encode(JSON.stringify(value)));
    const signature = await crypto.subtle.sign('HMAC', await key, encoder.encode(payload));
    return payload + '.' + base64url(new Uint8Array(signature));
  }
  async function read(token, kind) {
    if (!token || token.length > 600 || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
    try {
      const [payload, signature] = token.split('.');
      if (!await crypto.subtle.verify('HMAC', await key, decode(signature), encoder.encode(payload))) return null;
      const value = JSON.parse(new TextDecoder().decode(decode(payload)));
      return value.kind === kind && value.expires > now() ? value : null;
    } catch { return null; }
  }
  async function ipKey(ip) {
    const digest = await crypto.subtle.sign('HMAC', await key, encoder.encode('ip:' + ip));
    return base64url(new Uint8Array(digest));
  }
  async function session(header, ip) {
    const value = await read(cookie(header, sessionCookie), 'session');
    if (!value) return null;
    if (accounts.has(value.id)) return value;
    if (value.id !== 'guest' || !ip || value.ip !== await ipKey(ip)) return null;
    const device = await read(cookie(header, deviceCookie), 'device');
    return device?.id === value.device ? value : null;
  }
  return {sign, read, ipKey, session};
}
