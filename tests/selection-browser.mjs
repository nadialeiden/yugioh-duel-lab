import {enterLab} from './browser-entry.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':undefined),headless:true});
const errors=[];
try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:900},isMobile:width<780,hasTouch:width<780});
    page.on('pageerror',e=>errors.push(e.message));
    await enterLab(page);
    await page.waitForFunction(()=>document.querySelector('#start-practice')&&!document.querySelector('#start-practice').disabled);
    await page.evaluate(async()=>{
      const renderer=await import('./duel-render.mjs');const {cards}=await import('./data.mjs');
      const names=['Exosister Mikailis','Exosister Kaspitell','Exosister Gibrine'];
      const candidates=names.map((name,sequence)=>({code:[...cards.values()].find(c=>c.name===name&&!c.alias).code,controller:0,location:64,sequence,position:8}));
      const player={monsters:[],spells:[],hand:[],grave:[],banished:[],extra:candidates,deckCount:40};
      const state={duelId:'selection-regression',players:[player,{...player,extra:[]}],lp:[8000,8000],turn:1,phase:'Main 1',turnPlayer:0,winner:null,chainEvents:[],prompt:{type:15,player:0,can_cancel:true,min:1,max:1,selects:candidates}};
      window.selectionResponses=[];
      renderer.configureDuelRenderer({respond:response=>window.selectionResponses.push(response)});
      document.body.classList.add('duel-visible');document.querySelector('#setup-panel').classList.add('hidden');
      window.showSelectionPrompt=prompt=>{state.prompt=prompt;renderer.renderBoard(state,0);renderer.renderDecision(state,0,{coach:false});};
      window.selectionCandidates=candidates;window.showSelectionPrompt(state.prompt);
    });
    const first=page.locator('#decision-choices [data-choice="0"]'),second=page.locator('#decision-choices [data-choice="1"]');
    await first.click();await second.click();
    assert.equal(await second.evaluate(b=>b.classList.contains('selected')),true,'Kaspitell must replace Mikailis before confirmation.');
    assert.equal(await first.evaluate(b=>b.classList.contains('selected')),false);
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[],'Clicking a candidate must not submit it.');
    await second.click();assert.equal(await page.locator('#confirm-selection').isDisabled(),true,'Clicking the selected card again deselects it.');
    await first.click();await second.click();await page.locator('#clear-selection').click();
    assert.equal(await page.locator('#decision-choices .selected').count(),0);
    assert.equal(await page.locator('#confirm-selection').isDisabled(),true);
    await first.click();await second.click();await page.locator('#confirm-selection').click();
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[{type:5,indicies:[1]}]);
    await page.evaluate(()=>{window.selectionResponses=[];window.showSelectionPrompt({type:18,player:0,count:1,field_mask:0xffffffe0});});
    await first.click();await second.click();await page.locator('#confirm-selection').click();
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[{type:10,places:[{player:0,location:4,sequence:1}]}]);
    await page.evaluate(()=>{window.selectionResponses=[];window.showSelectionPrompt({type:15,player:0,can_cancel:false,min:2,max:2,selects:window.selectionCandidates});});
    await first.click();await second.click();await page.locator('#clear-selection').click();
    assert.equal(await page.locator('#decision-choices .selected').count(),0);
    await page.locator('#decision-choices [data-choice="2"]').click();await second.click();await page.locator('#confirm-selection').click();
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[{type:5,indicies:[2,1]}]);
    await page.evaluate(()=>{
      window.selectionResponses=[];
      const [martha,elis]=[37343995,16474916].map((code,sequence)=>({code,sequence,controller:0,location:2,position:8}));
      window.showSelectionPrompt({type:11,player:0,summons:[martha,elis],activates:[{...martha,description:37343995n<<20n}],to_ep:true});
    });
    const confirmPlay=page.getByRole('button',{name:'Confirm play',exact:true});
    await first.click();await second.click();
    assert.equal(await first.getAttribute('aria-pressed'),'false');
    assert.match(await page.locator('#selection-count').textContent(),/Normal Summon.*Exosister Elis/);
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[]);
    await page.locator('#clear-selection').click();
    assert.equal(await confirmPlay.isDisabled(),true);
    await page.locator('#decision-choices [data-choice="2"]').click();
    assert.match(await page.locator('#selection-count').textContent(),/Special Summon Elis from your Deck/);
    await confirmPlay.click();
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[{type:1,action:5,index:0}]);
    await page.evaluate(()=>{
      window.selectionResponses=[];
      const mikailis={code:42741437,controller:0,location:4,sequence:0,position:1};
      const description=BigInt(mikailis.code)<<20n;
      window.showSelectionPrompt({type:11,player:0,activates:[{...mikailis,description},{...mikailis,description:description|1n}]});
    });
    assert.match(await first.textContent(),/Banish.*GY/);
    assert.match(await second.textContent(),/Detach 1 material.*Spell\/Trap/);
    await first.click();await second.click();
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[]);
    await confirmPlay.click();
    assert.deepEqual(await page.evaluate(()=>window.selectionResponses),[{type:1,action:5,index:1}]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    console.log(width+'px: swap cards and zones, clear pending plays, and select the intended Martha and Mikailis effects.');
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
