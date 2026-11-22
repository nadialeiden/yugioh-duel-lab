import {enterLab} from './browser-entry.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:900},isMobile:width<780});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await enterLab(page);await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);
    const selected=await page.locator('#practice-deck').inputValue();
    await page.locator('[data-preview-deck="practice-deck"]').click();
    await page.locator('[data-preview-card]').first().click();
    assert.ok((await page.locator('#modal .card-effect').textContent()).length>20);
    await page.locator('#back-deck-preview').click();assert.ok(await page.locator('[data-preview-card]').count());
    await page.locator('#close-modal').click();assert.equal(await page.locator('#practice-deck').inputValue(),selected);
    await page.evaluate(async()=>{
      const r=await import('./duel-render.mjs'),{cards}=await import('./data.mjs');
      const names=['Exosister Mikailis','Exosister Kaspitell'];
      const candidates=names.map((name,sequence)=>({code:[...cards.values()].find(c=>c.name===name&&!c.alias).code,controller:0,location:64,sequence,position:8}));
      const p={monsters:[],spells:[],hand:[],grave:[],banished:[],extra:candidates,deckCount:40};
      const state={duelId:'preview-test',players:[p,p],lp:[8000,8000],turn:3,turnPlayer:0,winner:null,chainEvents:[],prompt:{type:15,player:0,min:1,max:1,selects:candidates}};
      window.previewResponses=[];r.configureDuelRenderer({respond:response=>window.previewResponses.push(response)});
      document.body.classList.add('duel-visible');document.querySelector('#setup-panel').classList.add('hidden');
      window.showTurn=(turnPlayer,viewer=0,chain=false)=>{state.turnPlayer=turnPlayer;if(chain)state.prompt={type:16,player:0,forced:false,selects:candidates};r.renderBoard(state,viewer);r.renderDecision(state,viewer,{coach:false});};
      window.showTurn(0);
    });
    assert.equal(await page.locator('#room-title').textContent(),'Your turn');
    await page.locator('#decision-choices [data-choice="0"]').click();
    await page.locator('[data-read-choice="1"]').click();
    assert.ok((await page.locator('#modal .card-effect').textContent()).includes('Exosister'));
    await page.locator('#close-modal').click();
    assert.equal(await page.locator('#decision-choices [data-choice="0"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await page.evaluate(()=>window.previewResponses),[]);
    await page.evaluate(()=>window.showTurn(1,0,true));
    assert.equal(await page.locator('#room-title').textContent(),'Opponent’s turn');
    assert.ok((await page.locator('#mobile-decision-status').textContent()).includes('Opponent’s turn'));
    assert.ok((await page.locator('#turn-marker').textContent()).includes('Opponent’s turn'));
    await page.locator('[data-read-choice="0"]').click();assert.ok(await page.locator('#modal').isVisible());
    await page.locator('#close-modal').click();assert.deepEqual(await page.evaluate(()=>window.previewResponses),[],'Reading a chain response must not activate it.');
    await page.evaluate(()=>window.showTurn(1,1));assert.equal(await page.locator('#room-title').textContent(),'Your turn');
    await page.evaluate(()=>window.showTurn(0,1));assert.equal(await page.locator('#room-title').textContent(),'Opponent’s turn');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);console.log(width+'px: both turn perspectives, setup deck preview, and read-before-select/chain pass.');await page.close();
  }
}finally{await browser.close();}
