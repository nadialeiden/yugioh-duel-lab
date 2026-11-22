import {enterLab} from './browser-entry.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
try{
  const hostContext=await browser.newContext({viewport:{width:1440,height:1000}}),guestContext=await browser.newContext({viewport:{width:1280,height:900}});
  const host=await hostContext.newPage(),guest=await guestContext.newPage(),errors=[],guestStates=[];
  for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
  guest.on('websocket',socket=>socket.on('framereceived',frame=>{try{const value=JSON.parse(frame.payload);if(value.type==='state')guestStates.push(value);}catch{}}));
  for(const page of [host,guest]){await enterLab(page, undefined, page === host ? 'duelist1' : 'duelist2');await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);await page.getByRole('button',{name:'Local duel',exact:true}).click();}
  await host.locator('#create-room').click();await host.waitForFunction(()=>!!document.querySelector('.room-code-display'));
  const code=await host.locator('.room-code-display').textContent();console.log('Room created:',code);
  await guest.locator('#local-deck').selectOption('swordsoul');await guest.locator('#room-code').fill(code);await guest.locator('#join-room').click();
  await host.locator('#local-start').waitFor({state:'visible',timeout:10000});await host.locator('#local-start').click();
  await host.waitForFunction(()=>document.querySelector('#local-panel').classList.contains('hidden'));await guest.waitForFunction(()=>document.querySelector('#local-panel').classList.contains('hidden'));
  assert.ok(guestStates.length);const opening=guestStates.at(-1).state;
  assert.equal(opening.players[0].hand.length,5);assert.ok(opening.players[0].hand.every(c=>c.code===0));assert.ok(opening.players[1].hand.every(c=>c.code>0));assert.equal(opening.prompt,null);
  let endedTurn=false;
  for(let i=0;i<30;i++){
    const end=host.locator('.action-choice').filter({hasText:'End turn'});
    if(await end.count()){await end.click();endedTurn=true;break;}
    for(const page of [host,guest]){
      const decline=page.locator('.action-choice').filter({hasText:/^(Pass response|No)$/}).first();if(await decline.count())await decline.click();
    }
    await host.waitForTimeout(200);
  }
  if(!endedTurn)throw new Error('Host: '+await host.locator('#decision-panel').textContent()+' Guest: '+await guest.locator('#decision-panel').textContent());
  await guest.locator('.action-choice').first().waitFor({timeout:10000});console.log('Guest decision:',(await guest.locator('#decision-panel').textContent()).slice(0,180));
  const summon=guest.locator('.action-choice').filter({hasText:'Normal Summon'}).first();
  if(await summon.count()){
    await summon.click();await guest.locator('.action-choice').filter({hasText:'Your Monster Zone 3'}).click();await guest.locator('#confirm-selection').click();
    await guest.waitForTimeout(300);console.log('Guest summon sent.');
  }
  assert.deepEqual(errors,[]);console.log('Two-browser LAN test passed; private opening hand is redacted on the wire.');
}finally{await browser.close();}
