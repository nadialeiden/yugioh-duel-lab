import {enterLab} from './browser-entry.mjs';
﻿import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
const host=await browser.newPage(),guest=await browser.newPage();
for(const p of [host,guest]){p.on('pageerror',e=>console.log('PAGE',e.message));await enterLab(p, process.env.BASE_URL||'http://aedu.localhost:4173', p === host ? 'duelist1' : 'duelist2');await p.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);await p.locator('[data-mode="local"]').click();}
await host.locator('#create-room').click();
try{
 await host.locator('.room-code-display').waitFor({timeout:25000});const code=await host.locator('.room-code-display').textContent();console.log('PEER ROOM',code);
 await guest.locator('#room-code').fill(code);await guest.locator('#join-room').click();await host.locator('#local-start').waitFor({state:'visible',timeout:25000});console.log('PeerJS two-browser room connection passed.');
}catch(e){console.log('HOST',await host.locator('#room-status').textContent());console.log('GUEST',await guest.locator('#room-status').textContent());throw e;}
finally{await browser.close();}
