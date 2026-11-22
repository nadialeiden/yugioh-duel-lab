import {enterLab} from './browser-entry.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
const base=process.env.BASE_URL||'http://localhost:4173';
const cards=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url),'utf8'));
const pax=cards.find(c=>c.name==='Exosister Pax').code;
const errors=[];
async function idle(page){await page.waitForFunction(()=>!document.body.classList.contains('chain-playing'),null,{timeout:25000});}
async function choose(page,text){await idle(page);await page.locator('#decision-panel .action-choice').filter({hasText:text}).first().click();}
try{
  for(const [width,height] of [[320,667],[390,844],[1440,1000]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<780});
    await context.addInitScript(()=>{
      const original=Crypto.prototype.getRandomValues;
      Crypto.prototype.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===4){array.set([164,1,2,3]);return array;}return original.call(this,array);};
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await enterLab(page, base);await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);
    await page.locator('#practice-deck').selectOption('exosister');
    await page.locator('#start-practice').click();await page.locator('#decision-choices .action-choice').first().waitFor();
    if(width<780){
      const toggle=page.locator('#mobile-panel-toggle');
      assert.ok(await toggle.isVisible());
      await toggle.click();await page.locator(`#own-hand [data-card="${pax}"]`).click();
      await page.locator('#modal .action-choice').filter({hasText:'Activate'}).click();
    }else {await idle(page);await page.locator('#decision-panel .action-choice').filter({hasText:'Exosister Pax'}).filter({hasText:'Activate'}).click();}
    await page.getByRole('button',{name:'Confirm play',exact:true}).click();
    await choose(page,'Your Spell / Trap Zone 3');await page.locator('#confirm-selection').click();
    await page.locator('.live-chain-card.opponent-link[data-link="2"]').waitFor({timeout:20000});
    const panel=page.locator('#chain-overlay'), reopen=page.locator('#chain-open');
    assert.ok((await panel.textContent()).includes('Ash Blossom'));
    assert.ok((await panel.textContent()).includes('OPPONENT'));
    await page.locator('#chain-hide').click();
    await panel.waitFor({state:'hidden'});
    await reopen.waitFor({state:'visible'});
    await idle(page);
    await page.locator('nav [data-mode="decks"]').click();
    await reopen.waitFor({state:'hidden'});
    await page.locator('nav [data-mode="practice"]').click();
    await panel.waitFor({state:'hidden'});
    await reopen.click();
    await panel.waitFor({state:'visible'});
    assert.ok(await page.locator('.live-chain-card.opponent-link[data-link="2"]').isVisible());
    for(const mode of ['decks','learn','local']){
      await page.locator(`nav [data-mode="${mode}"]`).click();
      await panel.waitFor({state:'hidden'});
      await reopen.waitFor({state:'hidden'});
      await page.locator('nav [data-mode="practice"]').click();
      await panel.waitFor({state:'visible'});
    }
    if(width<780){
      const box=await page.locator('#mobile-panel-toggle').boundingBox();assert.ok(box.y+box.height<=height+1,'Decision handle stays inside the viewport.');
      await page.screenshot({path:new URL('../qa/mobile-opponent-chain.png',import.meta.url).pathname.slice(process.platform==='win32'?1:0),fullPage:true});
    }
    await choose(page,'Called by the Grave');
    for(let i=0;i<140;i++){
      await page.waitForTimeout(150);
      if(await page.locator('#chain-overlay[data-kind="end"][data-busy="false"]').count())break;
      if(await page.evaluate(()=>document.body.classList.contains('chain-playing')))continue;
      const title=await page.locator('#decision-panel h2').textContent();
      if(/Choose card|Choose materials|Choose a zone/.test(title)){
        await page.locator('#decision-choices .action-choice').first().click();
        const confirm=page.locator('#confirm-selection');if(await confirm.count()&&await confirm.isEnabled())await confirm.click();
      }else{
        const no=page.locator('#decision-choices .action-choice').filter({hasText:/^(No|Pass response)$/}).first();if(await no.count())await no.click();
      }
    }
    if(!await page.locator('#chain-overlay[data-kind="end"][data-busy="false"]').count()){
      console.log('CHAIN DEBUG',await page.locator('#chain-overlay').textContent());console.log('DECISION DEBUG',await page.locator('#decision-panel').textContent());
      await page.screenshot({path:new URL('../qa/chain-debug.png',import.meta.url).pathname.slice(process.platform==='win32'?1:0),fullPage:true});
    }
    await page.locator('#chain-overlay[data-kind="end"][data-busy="false"]').waitFor({timeout:5000});
    await page.locator('#chain-details').click();
    assert.equal(await page.locator('.live-chain-card').count(),3,'Pax / Ash / Called by chain retains all three links.');
    assert.equal(await page.locator('.live-chain-card.negated[data-link="2"]').count(),1,'Ash is visibly negated.');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#surrender').click();
    await page.locator('#confirm-concede').click();
    await page.waitForFunction(()=>document.querySelector('#room-title').textContent==='Duel finished');
    await panel.waitFor({state:'hidden'});
    await reopen.waitFor({state:'hidden'});
    await idle(page);
    assert.equal(await page.locator('.live-chain-card').count(),0);
    console.log(width+'px: real chain hides, reopens, follows the Practice tab, and clears on concession.');
    await context.close();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
