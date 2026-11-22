import {createSessionCodec, publicPath, signInPath} from './session.js';
import {secret} from './build-secret.js';

const {browserSession} = createSessionCodec(secret);

export default async function gate(request) {
  const url = new URL(request.url);
  // Vercel's login function receives the IP header used for guest admission.
  // The app checks that function before starting and while a guest pass is active.
  if (!publicPath(url.pathname) && !await browserSession(request.headers.get('cookie'))) {
    return new Response(null, {status: 303, headers: {Location: signInPath, 'Cache-Control': 'no-store'}});
  }
  return new Response(null, {headers: {'x-middleware-next': '1'}});
}
