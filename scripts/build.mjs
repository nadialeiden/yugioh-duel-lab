import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeVercelOutput} from './vercel-output.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(path.join(root,'dist/vendor'),{recursive:true});
await copyFile(path.join(root,'node_modules/peerjs/dist/peerjs.min.js'),path.join(root,'dist/vendor/peerjs.min.js'));
for(const [dependency,file] of [['fflate','LICENSE'],['peerjs','LICENSE'],['ws','LICENSE']]){
  try{await copyFile(path.join(root,'node_modules',dependency,file),path.join(root,'dist/vendor',dependency+'-LICENSE.txt'));}catch{}
}
const data=JSON.parse(await readFile(path.join(root,'dist/data/starters.json'),'utf8'));
const rules=JSON.parse(await readFile(path.join(root,'dist/data/ae-rules.json'),'utf8'));
if(!data.decks?.length||data.poolCount<1000||!rules.date)throw new Error('Verified AE data is missing. Run the documented preparation scripts.');
for(const name of ['index.html','signin.html','signin.css','signin.mjs','app.mjs','style.css','duel-feedback.css','learn.css','chain-events.mjs','chain-ui.mjs','profiles.mjs','account-ui.mjs','data/catalog.json','data/effects.bin','vendor/ocg/index.js'])await access(path.join(root,'dist',name));
await writeFile(path.join(root,'dist/build-info.json'),JSON.stringify({builtAt:new Date().toISOString(),commit:process.env.VERCEL_GIT_COMMIT_SHA||null,rules:rules.date,verified:rules.checkedAt}));
if(process.env.VERCEL || process.argv.includes('--vercel')) await writeVercelOutput(root);
console.log('Static app ready: '+data.poolCount+' verified AE identities; restriction list '+rules.date+'.');
