import {enterLab} from './browser-entry.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
try{
  const hostContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await hostContext.addInitScript(()=>{const original=Crypto.prototype.getRandomValues;Crypto.prototype.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===4){a.set([164,1,2,3]);return a;}return original.call(this,a);};});
  const guestContext=await browser.newContext({viewport:{width:360,height:740},isMobile:true});
  const host=await hostContext.newPage(),guest=await guestContext.newPage(),errors=[];
  const idle=page=>page.waitForFunction(()=>!document.body.classList.contains('chain-playing'));
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));await enterLab(page, undefined, page === host ? 'duelist1' : 'duelist2');await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);await page.locator('[data-mode="local"]').click();}
  await host.locator('#local-deck').selectOption('exosister');
  await host.locator('#create-room').click();await host.locator('.room-code-display').waitFor();
  await guest.locator('#local-deck').selectOption('swordsoul');await guest.locator('#room-code').fill(await host.locator('.room-code-display').textContent());await guest.locator('#join-room').click();await host.locator('#local-start').waitFor({state:'visible'});await host.locator('#local-start').click();
  await host.locator('#decision-panel .action-choice').filter({hasText:'Exosister Pax'}).filter({hasText:'Activate'}).click();
  await host.getByRole('button',{name:'Confirm play',exact:true}).click();
  await host.locator('#decision-panel .action-choice').filter({hasText:'Your Spell / Trap Zone 3'}).click();await host.locator('#confirm-selection').click();
  const ash=guest.locator('#decision-panel .action-choice').filter({hasText:'Ash Blossom'});
  await ash.waitFor();await idle(guest);
  assert.equal(await guest.locator('#room-title').textContent(),'Opponent’s turn');
  assert.equal(await guest.locator('#chain-status').textContent(),'Your response window');
  await guest.locator('#chain-hide').click();
  await guest.locator('#chain-overlay').waitFor({state:'hidden'});
  await guest.locator('#enemy-spells .game-card').click();
  assert.equal(await guest.locator('#modal-title').textContent(),'Exosister Pax');
  await guest.locator('#close-modal').click();
  await ash.click();
  await guest.locator('#chain-open').click();
  await host.locator('.live-chain-card.opponent-link[data-link="2"]').waitFor();await guest.locator('.live-chain-card.your-link[data-link="2"]').waitFor();await idle(host);
  assert.ok((await host.locator('#chain-overlay').textContent()).includes('Ash Blossom'));
  await host.locator('#decision-panel .action-choice').filter({hasText:'Pass response'}).click();
  // Empty response windows pass automatically; a legal guest response, if any,
  // remains a real decision and is passed explicitly here.
  for(let i=0;i<100;i++){
    for(const page of [host,guest]){
      if(await page.evaluate(()=>document.body.classList.contains('chain-playing')))continue;
      const choices=page.locator('#decision-panel .action-choice');
      const pass=choices.filter({hasText:/^Pass response$/});
      if(await choices.count()>1&&await pass.count())await pass.click();
    }
    if(await host.locator('#chain-overlay[data-kind="end"][data-busy="false"]').count()&&await guest.locator('#chain-overlay[data-kind="end"][data-busy="false"]').count())break;
    await host.waitForTimeout(150);
  }
  for(const page of [host,guest]){await page.locator('#chain-details').click();assert.equal(await page.locator('.live-chain-card').count(),2);assert.equal(await page.locator('.live-chain-card.negated[data-link="1"]').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await guest.locator('#surrender').click();await guest.locator('#confirm-concede').click();
  for(const page of [host,guest]){
    await page.waitForFunction(()=>document.querySelector('#room-title').textContent==='Duel finished');
    await page.locator('#chain-overlay').waitFor({state:'hidden'});
    await page.locator('#chain-open').waitFor({state:'hidden'});
    await idle(page);
  }
  assert.deepEqual(errors,[]);console.log('Two mobile clients: guest can hide the chain on the host’s turn, inspect Pax, and respond. Both panels close at duel end.');
}finally{await browser.close();}
