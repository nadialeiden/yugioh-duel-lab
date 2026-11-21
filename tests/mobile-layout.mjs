import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
try{
  for(const [width,height] of [[320,667],[390,844],[430,932]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
    await page.goto(process.env.BASE_URL||'http://localhost:4173');await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);
    // Component regression: render eight cards, independently of opening-hand
    // randomness. Real engine/decision and chain interactions have separate E2E tests.
    await page.evaluate(async()=>{
      const {renderBoard,renderDecision}=await import('./duel-render.mjs');const {cards}=await import('./data.mjs');
      const ids=[...cards.values()].filter(c=>c.ae).slice(0,8).map(c=>c.code);
      const player={monsters:[],spells:[],hand:ids.map(code=>({code,position:8})),grave:[],banished:[],extra:[],deckCount:32};
      const state={duelId:'mobile-layout',players:[player,{...player,hand:[]}],lp:[8000,8000],turn:1,phase:'Main 1',turnPlayer:0,winner:null,prompt:null,chainEvents:[]};
      document.body.classList.add('duel-visible');document.querySelector('#setup-panel').classList.add('hidden');
      renderBoard(state,0);renderDecision(state,0);
    });
    assert.equal(await page.locator('#own-hand .game-card').count(),8);
    assert.equal(await page.locator('#hand-count').textContent(),'8');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#mobile-panel-toggle').click();
    const dock=await page.locator('#mobile-panel-toggle').boundingBox();assert.ok(dock.y>=0&&dock.y+dock.height<=height+1);assert.ok(dock.height>=44);
    await page.locator('#own-hand .game-card').last().scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>{const hand=document.querySelector('#own-hand'),last=hand.lastElementChild;return last.getBoundingClientRect().right<=hand.getBoundingClientRect().right+2;}),'The last card can be reached by swiping/scrolling the hand.');
    await page.locator('#own-hand .game-card').last().click();await page.locator('#modal').waitFor({state:'visible'});
    await page.locator('#close-modal').click();console.log(width+'px: eight-card hand scrolls, inspector opens, decision drawer stays reachable.');await page.close();
  }
}finally{await browser.close();}
