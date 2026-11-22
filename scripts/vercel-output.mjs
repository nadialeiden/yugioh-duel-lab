import {randomBytes} from 'node:crypto';
import {cp, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

export async function writeVercelOutput(root) {
  const output = path.join(root, '.vercel/output');
  const gate = path.join(output, 'functions/entry-gate.func');
  const login = path.join(output, 'functions/api/demo-login.func');
  const secret = process.env.DUEL_SESSION_SECRET || randomBytes(32).toString('hex');
  const secretFile = 'export const secret = ' + JSON.stringify(secret) + ';\n';
  const json = (file, data) => writeFile(file, JSON.stringify(data));

  await Promise.all([mkdir(gate, {recursive: true}), mkdir(login, {recursive: true})]);
  await Promise.all([
    cp(path.join(root, 'dist'), path.join(output, 'static'), {recursive: true, filter: source => !source.endsWith('.gz')}),
    cp(path.join(root, 'server/vercel-gate.js'), path.join(gate, 'index.js')),
    cp(path.join(root, 'server/session.js'), path.join(gate, 'session.js')),
    cp(path.join(root, 'server/session.js'), path.join(login, 'session.js')),
    cp(path.join(root, 'server/login.js'), path.join(login, 'login.js')),
    cp(path.join(root, 'server/guest-quota.js'), path.join(login, 'guest-quota.js')),
    writeFile(path.join(gate, 'build-secret.js'), secretFile),
    writeFile(path.join(login, 'build-secret.js'), secretFile),
    writeFile(path.join(login, 'index.js'), `
import {createSessionCodec} from './session.js';
import {createLoginHandler} from './login.js';
import {secret} from './build-secret.js';
export default createLoginHandler(createSessionCodec(secret), {hosted: true});
`),
    json(path.join(gate, '.vc-config.json'), {runtime: 'edge', entrypoint: 'index.js'}),
    json(path.join(login, 'package.json'), {type: 'module'}),
    json(path.join(login, '.vc-config.json'), {runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs'}),
    json(path.join(output, 'config.json'), {
      version: 3,
      routes: [
        {src: '/(.*)', headers: {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin'}, continue: true},
        {src: '/(?:index\\.html|signin\\.html)?', headers: {'Cache-Control': 'no-store'}, continue: true},
        {src: '/(.*)', middlewareRawSrc: ['/:path*'], middlewarePath: 'entry-gate', continue: true},
        {src: '/', dest: '/index.html'},
        {handle: 'filesystem'},
      ],
    }),
  ]);
}
