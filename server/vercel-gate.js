import {createSessionCodec, publicPath, signInPath, vercelIpHeader} from './session.js';
import {secret} from './build-secret.js';

const {session} = createSessionCodec(secret);

export default async function gate(request) {
  const url = new URL(request.url);
  if (!publicPath(url.pathname) && !await session(request.headers.get('cookie'), request.headers.get(vercelIpHeader))) {
    return new Response(null, {status: 303, headers: {Location: signInPath, 'Cache-Control': 'no-store'}});
  }
  return new Response(null, {headers: {'x-middleware-next': '1'}});
}
