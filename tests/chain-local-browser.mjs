import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
try{
  const hostContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await hostContext.addInitScript(()=>{const original=Crypto.prototype.getRandomValues;Crypto.prototype.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===4){a.set([164,1,2,3]);return a;}return original.call(this,a);};});
  const guestContext=await browser.newContext({viewport:{width:360,height:740},isMobile:true});
  const host=await hostContext.newPage(),guest=await guestContext.newPage(),errors=[];
  const idle=page=>page.waitForFunction(()=>!document.body.classList.contains('chain-playing'));
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:4173');await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);await page.locator('[data-mode="local"]').click();}
  await host.locator('#create-room').click();await host.locator('.room-code-display').waitFor();
  await guest.locator('#local-deck').selectOption('swordsoul');await guest.locator('#room-code').fill(await host.locator('.room-code-display').textContent());await guest.locator('#join-room').click();await host.locator('#local-start').waitFor({state:'visible'});await host.locator('#local-start').click();
  await host.locator('#decision-panel .action-choice').filter({hasText:'Exosister Pax'}).filter({hasText:'Activate'}).click();
  await host.locator('#decision-panel .action-choice').filter({hasText:'Your Spell / Trap Zone 3'}).click();await host.locator('#confirm-selection').click();
  await guest.locator('#decision-panel .action-choice').filter({hasText:'Ash Blossom'}).waitFor();await idle(guest);await guest.locator('#decision-panel .action-choice').filter({hasText:'Ash Blossom'}).click();
  await host.locator('.live-chain-card.opponent-link[data-link="2"]').waitFor();await guest.locator('.live-chain-card.your-link[data-link="2"]').waitFor();await idle(host);
  assert.ok((await host.locator('#chain-overlay').textContent()).includes('Ash Blossom'));
  await host.locator('#decision-panel .action-choice').filter({hasText:'Pass response'}).click();
  // Empty response windows pass automatically; a legal guest response, if any,
  // remains a real decision and is passed explicitly here.
  for(let i=0;i<100;i++){
    for(const page of [host,guest]){
      if(await page.evaluate(()=>document.body.classList.contains('chain-playing')))continue;
      const pass=page.locator('#decision-panel .action-choice').filter({hasText:/^Pass response$/});if(await pass.count())await pass.click();
    }
    if(await host.locator('#chain-overlay[data-kind="end"][data-busy="false"]').count()&&await guest.locator('#chain-overlay[data-kind="end"][data-busy="false"]').count())break;
    await host.waitForTimeout(150);
  }
  for(const page of [host,guest]){await page.locator('#chain-details').click();assert.equal(await page.locator('.live-chain-card').count(),2);assert.equal(await page.locator('.live-chain-card.negated[data-link="1"]').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.deepEqual(errors,[]);console.log('Two mobile clients: host Pax, guest Ash, visible reverse resolution and negation on both views.');
}finally{await browser.close();}
