export const $=id=>document.getElementById(id);
export const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const art=id=>'https://images.ygoprodeck.com/images/cards/'+id+'.jpg';
export function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hidden'),5500);}
export function modal(title,html){$('modal-title').textContent=title;$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
export const closeModal=()=>$('modal').close();
export function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function image(id,cls='',attributes=''){return `<img class="${cls}" src="${art(id)}" alt="" loading="lazy" ${attributes}>`;}
export function typeName(c){if(!c)return '';return [c.type&1?'Monster':c.type&2?'Spell':'Trap',c.type&0x40?'Fusion':'',c.type&0x2000?'Synchro':'',c.type&0x800000?'Xyz':'',c.type&0x4000000?'Link':'',c.type&0x1000000?'Pendulum':'',c.type&0x1000?'Tuner':'',c.type&0x20?'Effect':'',c.type&0x10000?'Quick-Play':'',c.type&0x20000?'Continuous':''].filter(Boolean).join(' / ');}
