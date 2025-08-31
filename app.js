// ===== Utilities =====
const pad = n => String(n).padStart(2,'0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtHM   = t => { const d=new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const addDays = (base, n)=> new Date(base.getFullYear(), base.getMonth(), base.getDate()+n);
const rid = () => Math.random().toString(36).slice(2,9);

// ===== Colors (カテゴリ色パレット) =====
const COLORS = ['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e','#0ea5e9','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#a3e635','#eab308'];

// ===== Storage keys =====
const LS_ENTRIES='s_min_entries_v2', LS_META='s_min_meta_v2', LS_TREE='s_min_tree_v3';

// ===== State =====
let entries = JSON.parse(localStorage.getItem(LS_ENTRIES)||'[]'); // {id,date,categoryId,categoryName,name,start,end}
let meta    = JSON.parse(localStorage.getItem(LS_META)||'[]');    // {date,wakeAt,sleepAt,wakeMental,wakePhysical,sleepMental,sleepPhysical}
let tree    = JSON.parse(localStorage.getItem(LS_TREE)||'null') || [
  { id:rid(), name:'趣味', color:'#3b82f6', actions:[{id:rid(),name:'ゲーム'},{id:rid(),name:'読書'}] },
  { id:rid(), name:'日常', color:'#22c55e', actions:[{id:rid(),name:'掃除'},{id:rid(),name:'風呂'}] },
  { id:rid(), name:'外出', color:'#f59e0b', actions:[{id:rid(),name:'散歩'}] },
];

const save = ()=>{
  localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
  localStorage.setItem(LS_META,    JSON.stringify(meta));
  localStorage.setItem(LS_TREE,    JSON.stringify(tree));
};

let selectedDate = fmtDate(new Date());

// ===== Day meta helpers =====
const dayMeta = (date)=> meta.find(m=>m.date===date) || {date};
const setDayMeta = (date, patch)=>{ const others=meta.filter(x=>x.date!==date); meta=[...others,{...dayMeta(date),...patch}]; save(); updateHome(); renderBlog(); };

// ===== Views =====
const showView = name=>{
  ['home','check','blog'].forEach(v=>document.getElementById('view-'+v).classList.toggle('hidden', v!==name));
  if(name==='home') updateHome();
  if(name==='check') renderCheck();
  if(name==='blog') renderBlog();
};

// ===== Home =====
function updateHome(){
  const m = dayMeta(selectedDate);
  const w = document.getElementById('wakeTime');
  const s = document.getElementById('sleepTime');
  const wf= document.getElementById('wakeFatigue');
  const sf= document.getElementById('sleepFatigue');
  if(w)  w.textContent  = m.wakeAt  ? fmtHM(m.wakeAt)  : '—';
  if(s)  s.textContent  = m.sleepAt ? fmtHM(m.sleepAt) : '—';
  if(wf) wf.textContent = m.wakeMental  ? `（心${m.wakeMental}/体${m.wakePhysical}）`  : '';
  if(sf) sf.textContent = m.sleepMental ? `（心${m.sleepMental}/体${m.sleepPhysical}）`: '';
}

// ===== Record Sheet =====
const sheetWrap = document.getElementById('sheetWrap');
const catList = document.getElementById('catList');
const actionArea = document.getElementById('actionArea');
const actionList = document.getElementById('actionList');
const selectedCatLabel = document.getElementById('selectedCatLabel');
const todayMini = document.getElementById('todayMini');
const toggleEdit = document.getElementById('toggleEdit');
const catEditName = document.getElementById('catEditName');
const colorPalette = document.getElementById('colorPalette');
const newCatName = document.getElementById('newCatName');
const addCatBtn = document.getElementById('addCatBtn');
const delCatBtn = document.getElementById('delCatBtn');

let currentCatId = null;
let editMode = false;
let draggingCatId = null;

const openSheet = ()=>{
  sheetWrap.classList.remove('hidden');
  buildColorPalette();
  renderCats();
  if(!currentCatId && tree[0]) selectCat(tree[0].id);
};
const closeSheet= ()=> sheetWrap.classList.add('hidden');
sheetWrap.addEventListener('click', e=>{ if(e.target===sheetWrap || e.target.closest('[data-close="sheet"]')) closeSheet(); });

function buildColorPalette(){
  if(!colorPalette) return;
  colorPalette.innerHTML = '';
  COLORS.forEach(col=>{
    const d = document.createElement('button');
    d.type='button';
    d.className='color-dot';
    d.style.background = col;
    d.dataset.color = col;
    d.addEventListener('click', ()=>{
      const cat = tree.find(c=>c.id===currentCatId);
      if(!cat) return;
      cat.color = col;
      save();
      for(const x of colorPalette.querySelectorAll('.color-dot')) x.classList.toggle('active', x.dataset.color===col);
      renderCats();
    });
    colorPalette.appendChild(d);
  });
}

function renderCats(){
  catList.innerHTML='';
  tree.forEach(cat=>{
    const chip=document.createElement('div');
    chip.className='cat-chip';
    chip.dataset.id=cat.id;

    const sw=document.createElement('span');
    sw.className='swatch';
    sw.style.background = cat.color || '#e5e7eb';

    const name=document.createElement('span');
    name.textContent = cat.name;

    chip.append(sw,name);
    chip.classList.toggle('active', cat.id===currentCatId);

    chip.addEventListener('click', ()=> selectCat(cat.id));

    if(editMode){
      chip.draggable = true;
      chip.addEventListener('dragstart', e=>{
        draggingCatId = cat.id;
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain', cat.id);
      });
      chip.addEventListener('dragend', ()=> chip.classList.remove('dragging'));
      chip.addEventListener('dragover', e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; });
      chip.addEventListener('drop', e=>{
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain') || draggingCatId;
        const from = tree.findIndex(x=>x.id===fromId);
        const to   = tree.findIndex(x=>x.id===cat.id);
        if(from>-1 && to>-1 && from!==to){
          const [mv] = tree.splice(from,1);
          tree.splice(to,0,mv);
          save();
          renderCats();
        }
        draggingCatId=null;
      });
    }

    catList.appendChild(chip);
  });

  // パレットのactive更新
  const sel = tree.find(c=>c.id===currentCatId);
  if(sel && colorPalette){
    for(const x of colorPalette.querySelectorAll('.color-dot')){
      x.classList.toggle('active', x.dataset.color === (sel.color||''));
    }
  }
}

function selectCat(id){
  currentCatId=id; const cat=tree.find(c=>c.id===id); if(!cat) return;
  selectedCatLabel.textContent=cat.name;
  actionArea.classList.remove('hidden');
  if(catEditName) catEditName.value = cat.name;
  renderCats();
  renderActions();
  renderTodayMini();
}

function renderActions(){
  const cat=tree.find(c=>c.id===currentCatId); if(!cat) return;
  actionList.innerHTML='';
  const ongoing=entries.find(e=>!e.end && e.date===selectedDate);
  cat.actions.forEach(act=>{
    const b=document.createElement('button'); b.type='button'; b.className='action-btn';
    const title=document.createElement('span'); title.className='title'; title.textContent=act.name;
    const sub=document.createElement('span'); sub.className='sub'; b.append(title,sub);

    const isActive = ongoing && ongoing.name===act.name && ongoing.categoryId===cat.id;
    if(isActive){
      b.classList.add('active'); b.style.background = cat.color || 'var(--accent)';
      sub.textContent=`■ 停止 ・開始 ${fmtHM(ongoing.start)}`;
    }else{
      sub.textContent='▶ 開始';
    }
    b.onclick=()=> toggleAction(cat, act);
    actionList.appendChild(b);
  });
}

function toggleAction(cat, act){
  const ongoing=entries.find(e=>!e.end && e.date===selectedDate);
  if(ongoing){
    if(ongoing.name===act.name && ongoing.categoryId===cat.id){ ongoing.end=Date.now(); save(); renderActions(); renderTodayMini(); return; }
    ongoing.end=Date.now();
  }
  entries.push({id:rid(),date:selectedDate,categoryId:cat.id,categoryName:cat.name,name:act.name,start:Date.now(),end:null});
  save(); renderActions(); renderTodayMini();
}

// 行動の追加
document.getElementById('addActionBtn').onclick=()=>{
  const el=document.getElementById('newActionName'); const name=(el.value||'').trim(); if(!name) return;
  const cat=tree.find(c=>c.id===currentCatId); if(!cat) return;
  cat.actions.push({id:rid(), name}); el.value=''; save(); renderActions();
};

// 編集モードトグル / 名前編集
if(toggleEdit){
  toggleEdit.addEventListener('change', ()=>{
    editMode = toggleEdit.checked;
    renderCats();
  });
}
if(catEditName){
  catEditName.addEventListener('input', ()=>{
    const cat=tree.find(c=>c.id===currentCatId); if(!cat) return;
    const v = catEditName.value.trim();
    if(!v) return;
    cat.name = v;
    save();
    selectedCatLabel.textContent = v;
    renderCats();
  });
}

// カテゴリ追加・削除
if(addCatBtn){
  addCatBtn.addEventListener('click', ()=>{
    const name = (newCatName.value||'').trim(); if(!name) return;
    const color = COLORS[ tree.length % COLORS.length ];
    const cat = { id:rid(), name, color, actions:[] };
    tree.push(cat);
    save();
    newCatName.value='';
    selectCat(cat.id);
  });
}
if(delCatBtn){
  delCatBtn.addEventListener('click', ()=>{
    if(!currentCatId) return;
    const cat = tree.find(c=>c.id===currentCatId);
    if(!cat) return;
    if(!confirm(`カテゴリ「${cat.name}」を削除しますか？\n（既存の記録は残ります）`)) return;
    const idx = tree.findIndex(c=>c.id===currentCatId);
    tree.splice(idx,1);
    save();
    currentCatId = tree[0]?.id || null;
    if(currentCatId){ selectCat(currentCatId); } else { renderCats(); actionArea.classList.add('hidden'); }
  });
}

function renderTodayMini(){
  todayMini.innerHTML='';
  const todays=entries.filter(e=>e.date===selectedDate).sort((a,b)=>b.start-a.start);
  if(todays.length===0){ const p=document.createElement('p'); p.className='muted'; p.textContent='まだ記録がありません。'; todayMini.appendChild(p); return; }
  todays.forEach(e=>{
    const div=document.createElement('div'); div.className='item';
    div.textContent = `${fmtHM(e.start)}〜${e.end?fmtHM(e.end):'(進行中)'}  ${e.categoryName} / ${e.name}`;
    todayMini.appendChild(div);
  });
}

// ===== Check =====
function renderCheck(){
  const dateEl=document.getElementById('datePick');
  if(dateEl && dateEl.value!==selectedDate) dateEl.value=selectedDate;
  const list=document.getElementById('checkList'); list.innerHTML='';
  const filtered=entries.filter(e=>e.date===selectedDate).sort((a,b)=>a.start-b.start);
  if(filtered.length===0){ const p=document.createElement('p'); p.className='muted'; p.textContent='該当日の記録はありません。'; list.appendChild(p); return; }
  filtered.forEach(e=>{
    const div=document.createElement('div'); div.className='item';
    const left=document.createElement('div'); left.textContent=`${fmtHM(e.start)}〜${e.end?fmtHM(e.end):'(進行中)'}  ${e.categoryName} / ${e.name}`;
    const del=document.createElement('button'); del.className='btn'; del.type='button'; del.textContent='削除';
    del.onclick=()=>{ entries=entries.filter(x=>x.id!==e.id); save(); renderCheck(); renderTodayMini(); };
    div.append(left,del); list.appendChild(div);
  });
}

// ===== Blog =====
function buildBlogText(date){
  const m=dayMeta(date);
  const todays=entries.filter(e=>e.date===date).sort((a,b)=>a.start-b.start);
  const d=new Date(date+'T00:00:00');
  const lines=[`【${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日】`];
  if(m.wakeAt)  lines.push(`起床: ${fmtHM(m.wakeAt)} / 疲労(心:${m.wakeMental??'-'} 体:${m.wakePhysical??'-'})`);
  if(m.sleepAt) lines.push(`就寝: ${fmtHM(m.sleepAt)} / 疲労(心:${m.sleepMental??'-'} 体:${m.sleepPhysical??'-'})`);
  lines.push('');
  if(todays.length===0) lines.push('本日の行動記録はありません。');
  else{
    lines.push('■ 行動記録');
    todays.forEach(e=>{ lines.push(`・${fmtHM(e.start)}〜${e.end?fmtHM(e.end):'(進行中)'} ${e.name}（${e.categoryName}）`); });
  }
  const c=document.getElementById('blogComment').value.trim();
  if(c){ lines.push(''); lines.push('■ 今日のコメント'); lines.push(c); }
  return lines.join('\n');
}
function renderBlog(){
  const el=document.getElementById('blogDate'); if(el && el.value!==selectedDate) el.value=selectedDate;
  document.getElementById('blogPreview').textContent=buildBlogText(selectedDate);
}
document.getElementById('copyBlog').onclick=()=>{
  const txt=buildBlogText(selectedDate);
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(txt);
  const t=document.getElementById('toast'); const m=document.getElementById('toastMsg');
  m.textContent='ブログ文をコピーしました'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),1500);
};

// ===== Wake / Sleep modals =====
function renderScale(el, current, onSelect){
  el.innerHTML=''; for(let n=1;n<=5;n++){ const b=document.createElement('button');
    b.type='button'; b.className='btn'; b.style.width='44px'; b.style.height='44px'; b.textContent=n;
    if(n===current){ b.style.background='var(--accent)'; b.style.color='#fff'; b.style.borderColor='var(--accent)'; }
    b.onclick=()=>{ onSelect(n); renderScale(el,n,onSelect); };
    el.appendChild(b);
  }
}
function openWake(){
  let m=3,p=3; const w=document.getElementById('modalWake');
  renderScale(document.getElementById('mentalScaleWake'),m,v=>m=v);
  renderScale(document.getElementById('physicalScaleWake'),p,v=>p=v);
  document.getElementById('confirmWake').onclick=()=>{ setDayMeta(selectedDate,{wakeAt:Date.now(),wakeMental:m,wakePhysical:p}); w.classList.add('hidden'); };
  w.classList.remove('hidden');
}
function openSleep(){
  let m=3,p=3; const w=document.getElementById('modalSleep');
  renderScale(document.getElementById('mentalScaleSleep'),m,v=>m=v);
  renderScale(document.getElementById('physicalScaleSleep'),p,v=>p=v);
  document.getElementById('confirmSleep').onclick=()=>{ setDayMeta(selectedDate,{sleepAt:Date.now(),sleepMental:m,sleepPhysical:p}); w.classList.add('hidden'); };
  w.classList.remove('hidden');
}
document.querySelectorAll('[data-close="modalWake"]').forEach(b=>b.addEventListener('click',()=>document.getElementById('modalWake').classList.add('hidden')));
document.querySelectorAll('[data-close="modalSleep"]').forEach(b=>b.addEventListener('click',()=>document.getElementById('modalSleep').classList.add('hidden')));

// ===== Export / Import（確認画面） =====
function snapshot(){ return { v:2, exportedAt:new Date().toISOString(), selectedDate, tree, entries, meta }; }
function download(filename, text){
  const blob = new Blob([text], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
document.getElementById('btnExport').addEventListener('click', ()=>{
  download(`tracker-backup-${selectedDate}.json`, JSON.stringify(snapshot(),null,2));
});
document.getElementById('fileImport').addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const json = JSON.parse(await f.text());
    if(!confirm('現在のデータを置き換えます。よろしいですか？')) return;
    tree    = Array.isArray(json.tree)    ? json.tree : tree;
    entries = Array.isArray(json.entries) ? json.entries : entries;
    meta    = Array.isArray(json.meta)    ? json.meta : meta;
    save(); updateHome(); renderCheck(); renderBlog();
    alert('読み込みが完了しました。');
  }catch(err){ alert('読み込みに失敗しました。ファイルをご確認ください。'); }
  e.target.value='';
});

// ===== Navigation & binds =====
function bindTap(el, handler){ if(!el) return; el.addEventListener('click', handler); }
function boot(){
  bindTap(document.getElementById('btnHome'), ()=>showView('home'));
  bindTap(document.getElementById('btnRecord'), openSheet);
  bindTap(document.getElementById('goCheck'), ()=>showView('check'));
  bindTap(document.getElementById('goBlog'),  ()=>showView('blog'));
  bindTap(document.getElementById('toBlog'),  ()=>showView('blog'));
  bindTap(document.getElementById('toCheck'), ()=>showView('check'));
  bindTap(document.getElementById('btnWake'),  openWake);
  bindTap(document.getElementById('btnSleep'), openSleep);

  // date
  const dp=document.getElementById('datePick');
  if(dp) dp.addEventListener('change', e=>{ selectedDate=e.target.value; updateHome(); renderCheck(); renderBlog(); });
  document.getElementById('prevDate').onclick=()=>{ selectedDate=fmtDate(addDays(new Date(selectedDate),-1)); renderCheck(); renderBlog(); updateHome(); document.getElementById('datePick').value=selectedDate; };
  document.getElementById('nextDate').onclick=()=>{ selectedDate=fmtDate(addDays(new Date(selectedDate),+1)); renderCheck(); renderBlog(); updateHome(); document.getElementById('datePick').value=selectedDate; };

  // blog date
  const bd=document.getElementById('blogDate'); if(bd) bd.addEventListener('change', e=>{ selectedDate=e.target.value; renderBlog(); updateHome(); });

  updateHome(); renderCheck(); renderBlog(); showView('home');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
