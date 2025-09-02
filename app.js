// ======================== app.js ========================
// ===== Utilities =====
const pad = n => String(n).padStart(2,'0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtHM   = t => { const d=new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const addDays = (base, n)=> new Date(base.getFullYear(), base.getMonth(), base.getDate()+n);
const rid = () => Math.random().toString(36).slice(2,9);

// ---- blog用: タスク取得＆日付判定（追記） ----
const _getTasksForBlog = () => {
  try {
    return Array.isArray(window.tasks) ? window.tasks
      : JSON.parse(localStorage.getItem('todo.v2.daily') || '[]');
  } catch (e) { return []; }
};
const _ymdFromTs = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};


// === ラベル定義（起床/就寝 共通） ===
const LABELS_MENTAL   = ['すっきり','普通','どんより','しんどい','限界'];           // 心の疲れ具合
const LABELS_PHYSICAL = ['軽やか','普通','だるい','疲れた','動けない'];               // 体の疲れ具合
const LABELS_SLEEP    = ['ぐっすり寝れた','まあまあ寝れた','あまり寝れなかった','眠れなかった']; // 睡眠の質（起床のみ）

// 週・月範囲ヘルパ
const startOfWeekMon = (d)=>{ const day=d.getDay(); const diff=(day===0?-6:1-day); const nd=addDays(d,diff); return new Date(nd.getFullYear(),nd.getMonth(),nd.getDate()); };
const endOfWeekMon   = (d)=> addDays(startOfWeekMon(d),6);
const startOfMonth   = (d)=> new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth     = (d)=> new Date(d.getFullYear(), d.getMonth()+1, 0);

// 時間(ミリ秒) → “H時間M分”
const msToHMM = (ms)=>{
  const m = Math.max(0, Math.floor(ms/60000));
  const h = Math.floor(m/60);
  const mm = m % 60;
  return `${h}時間${mm}分`;
};

// 時間帯バケット（※将来用に残置）
const bucketOf = (t)=>{
  const h = new Date(t).getHours();
  if (h < 4)  return '深夜';
  if (h < 12) return '朝';
  if (h < 18) return '昼';
  if (h < 22) return '夕';
  return '夜';
};

// hex -> rgba
function hexToRgba(hex, a=1){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'#000000');
  const r = m ? parseInt(m[1],16) : 0;
  const g = m ? parseInt(m[2],16) : 0;
  const b = m ? parseInt(m[3],16) : 0;
  return `rgba(${r},${g},${b},${a})`;
}

// === ラベル → 色（モーダルと同じ青⇄赤グラデ）
// === ラベル → 色（モーダルと同じ系統に調整） ===
const LABEL_COLOR = {
  mental: {
    'すっきり':  '#3b82f6',
    '普通':      '#2dd4bf',
    'どんより':  '#22c55e',
    'しんどい':  '#f59e0b',
    '限界':      '#ef4444'
  },
  physical: {
    '軽やか':    '#3b82f6',
    '普通':      '#2dd4bf',
    'だるい':    '#22c55e',
    '疲れた':    '#f59e0b',
    '動けない':  '#ef4444'
  },
  sleep: {
    'ぐっすり寝れた':        '#3b82f6',
    'まあまあ寝れた':        '#2dd4bf',
    'あまり寝れなかった':    '#f59e0b',
    '眠れなかった':          '#ef4444'
  }
};

const colorForLabel = (kind, label) => LABEL_COLOR[kind]?.[label] || '#9ca3af';

// バッジ生成 & セット
function makeBadge(text, color){
  const el = document.createElement('span');
  Object.assign(el.style, {
    display:'inline-block',
    padding:'4px 10px',
    borderRadius:'999px',
    background: hexToRgba(color, 0.16),
    border: `1px solid ${hexToRgba(color, 0.55)}`,
    color:'#111827',
    fontSize:'12px',
    fontWeight:'700',
    whiteSpace:'nowrap'
  });
  el.textContent = text;
  return el;
}
function setBadges(container, items){
  container.textContent = '';
  items.forEach(it => {
    const b = makeBadge(it.text, it.color);
    b.style.margin = '0 0 6px 0'; // 縦並びなので下マージン
    container.appendChild(b);
  });
}

// ===== Colors (カテゴリ色パレット) =====
const COLORS = ['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e','#0ea5e9','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#a3e635','#eab308'];

// ===== Storage keys =====
const LS_ENTRIES='s_min_entries_v2', LS_META='s_min_meta_v2', LS_TREE='s_min_tree_v3';

// ===== State =====
let entries = JSON.parse(localStorage.getItem(LS_ENTRIES)||'[]'); // {id,date,categoryId,categoryName,name,start,end}
let meta    = JSON.parse(localStorage.getItem(LS_META)||'[]');    // {date,wakeAt,sleepAt,*,*...}
let tree    = JSON.parse(localStorage.getItem(LS_TREE)||'null') || [
  { id:rid(), name:'趣味', color:'#3b82f6', actions:[{id:rid(),name:'ゲーム'},{id:rid(),name:'読書'}] },
  { id:rid(), name:'日常', color:'#22c55e', actions:[{id:rid(),name:'掃除'},{id:rid(),name:'風呂'}] },
  { id:rid(), name:'外出', color:'#f59e0b', actions:[{id:rid(),name:'散歩'}] },
];
const save = ()=>{ localStorage.setItem(LS_ENTRIES, JSON.stringify(entries)); localStorage.setItem(LS_META, JSON.stringify(meta)); localStorage.setItem(LS_TREE, JSON.stringify(tree)); };

let selectedDate = fmtDate(new Date());
let checkTab = 'day'; // 'day' | 'week' | 'month'

// ===== Day meta helpers =====
const dayMeta = (date)=> meta.find(m=>m.date===date) || {date};
const setDayMeta = (date, patch)=>{ const others=meta.filter(x=>x.date!==date); meta=[...others,{...dayMeta(date),...patch}]; save(); updateHome(); renderBlog(); };

// ===== Views =====
const showView = name=>{
  ['home','check','blog'].forEach(v=>document.getElementById('view-'+v)?.classList.toggle('hidden', v!==name));
  if(name==='home') updateHome();
  if(name==='check') renderCheck();
  if(name==='blog') renderBlog();
};

// ===== Home =====
function updateHome(){
  const m  = dayMeta(selectedDate);
  const w  = document.getElementById('wakeTime');
  const s  = document.getElementById('sleepTime');
  const wf = document.getElementById('wakeFatigue');   // 起床：心・体・睡眠の質（バッジ縦並び）
  const sf = document.getElementById('sleepFatigue');  // 就寝：心・体（バッジ縦並び）

  // 時刻
  if (w) w.textContent = m.wakeAt  ? fmtHM(m.wakeAt)  : '—';
  if (s) s.textContent = m.sleepAt ? fmtHM(m.sleepAt) : '—';

  // 起床：心/体/睡眠の質 → バッジ（モーダルと同じ色味）
  if (wf){
    if (m.wakeAt){
      const items = [];
      const wmL = m.wakeMentalLabel   ?? null;
      const wpL = m.wakePhysicalLabel ?? null;
      const sqL = m.wakeSleepQuality  ?? null;   // 起床のみ
      const wmText = wmL ?? (m.wakeMental   != null ? `レベル${m.wakeMental}`   : null);
      const wpText = wpL ?? (m.wakePhysical != null ? `レベル${m.wakePhysical}` : null);
      if (wmText) items.push({ text: `心の疲れ具合:${wmText}`, color: colorForLabel('mental', wmL) });
      if (wpText) items.push({ text: `体の疲れ具合:${wpText}`, color: colorForLabel('physical', wpL) });
      if (sqL)    items.push({ text: `睡眠の質:${sqL}`,        color: colorForLabel('sleep', sqL) });
      setBadges(wf, items);
    } else {
      wf.textContent = '';
    }
  }

  // 就寝：心/体 → バッジ（モーダルと同じ色味）
  if (sf){
    if (m.sleepAt){
      const items = [];
      const smL = m.sleepMentalLabel   ?? null;
      const spL = m.sleepPhysicalLabel ?? null;
      const smText = smL ?? (m.sleepMental   != null ? `レベル${m.sleepMental}`   : null);
      const spText = spL ?? (m.sleepPhysical != null ? `レベル${m.sleepPhysical}` : null);
      if (smText) items.push({ text: `心の疲れ具合:${smText}`, color: colorForLabel('mental', smL) });
      if (spText) items.push({ text: `体の疲れ具合:${spText}`, color: colorForLabel('physical', spL) });
      setBadges(sf, items);
    } else {
      sf.textContent = '';
    }
  }

  // 記録中カード
  renderNowCard();
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
let editMode = !!toggleEdit?.checked; // ← 初期状態をチェックボックスに同期

const openSheet = ()=>{
  sheetWrap?.classList.remove('hidden');
  buildColorPalette();
  renderCats();
  if(!currentCatId && tree[0]) selectCat(tree[0].id);
};
const closeSheet= ()=> sheetWrap?.classList.add('hidden');
sheetWrap?.addEventListener('click', e=>{ if(e.target===sheetWrap || e.target.closest('[data-close="sheet"]')) closeSheet(); });

function buildColorPalette(){
  if(!colorPalette) return;
  colorPalette.innerHTML = '';
  COLORS.forEach(col=>{
    const d = document.createElement('button');
    d.type='button';
    d.className='color-dot';
    d.style.cssText='width:22px;height:22px;border-radius:999px;border:2px solid #0002;margin:4px;';
    d.style.background = col;
    d.dataset.color = col;
    d.addEventListener('click', ()=>{
      const cat = tree.find(c=>c.id===currentCatId);
      if(!cat) return;
      cat.color = col;
      save();
      for(const x of colorPalette.querySelectorAll('.color-dot')) x.classList.toggle('active', x.dataset.color===col);
      renderCats(); renderActions(); renderTodayMini(); renderCheck();
    });
    colorPalette.appendChild(d);
  });
}

// --- カテゴリ pill（枠→選択時だけ塗り） ---
function makeCatChip(cat){
  const chip = document.createElement('button');
  chip.type = 'button';
  const active = (cat.id === currentCatId);
  const col = cat.color || '#e5e7eb';
  Object.assign(chip.style, {
    display:'inline-flex', alignItems:'center', gap:'8px',
    padding:'6px 12px', margin:'4px 6px',
    borderRadius:'999px', border:`2px solid ${col}`,
    background: active ? col : '#ffffff',
    color: active ? '#ffffff' : col,
    fontWeight:'800', fontSize:'14px', lineHeight:'1',
    boxShadow:'inset 0 -1px 0 rgba(0,0,0,.06)',
    cursor:'pointer'
  });
  chip.textContent = cat.name;
  chip.addEventListener('click', ()=> selectCat(cat.id));
  return chip;
}

function renderCats(){
  if(!catList) return;
  catList.innerHTML='';

  tree.forEach((cat, idx)=>{
    const row = document.createElement('div');
    row.style.display='flex';
    row.style.alignItems='center';
    row.style.flexWrap='wrap';
    row.appendChild(makeCatChip(cat));

    if (editMode){
      // Safari向け：▲▼＋削除（D&Dなし）
      const mkMini = (label)=>{
        const b = document.createElement('button');
        b.type='button';
        Object.assign(b.style,{
          padding:'4px 8px', border:'1px solid #e5e7eb', borderRadius:'8px',
          background:'#fff', fontSize:'12px', lineHeight:'1', cursor:'pointer', margin:'0 4px'
        });
        b.textContent = label;
        return b;
      };
      const tools = document.createElement('div');
      tools.style.display='flex';
      tools.style.alignItems='center';
      tools.style.marginLeft='6px';

      const up   = mkMini('▲');
      const down = mkMini('▼');
      const del  = mkMini('削除');
      del.style.background = '#e11d48'; del.style.color = '#fff'; del.style.borderColor='#e11d48';

      up.disabled   = (idx===0);
      down.disabled = (idx===tree.length-1);

      up.addEventListener('click',   ()=>{ if(idx>0){ const [mv]=tree.splice(idx,1); tree.splice(idx-1,0,mv); save(); renderCats(); if(currentCatId===cat.id) renderActions(); }});
      down.addEventListener('click', ()=>{ if(idx<tree.length-1){ const [mv]=tree.splice(idx,1); tree.splice(idx+1,0,mv); save(); renderCats(); if(currentCatId===cat.id) renderActions(); }});
      del.addEventListener('click',  ()=>{
        if(!confirm(`カテゴリ「${cat.name}」を削除しますか？（記録は残ります）`)) return;
        const delIdx = tree.findIndex(c=>c.id===cat.id);
        tree.splice(delIdx,1);
        if(currentCatId===cat.id){ currentCatId=null; actionArea?.classList.add('hidden'); }
        save(); renderCats(); renderActions(); renderTodayMini(); renderCheck();
      });

      tools.append(up, down, del);
      row.appendChild(tools);
    }

    catList.appendChild(row);
  });

  // パレットのactive更新
  const sel = tree.find(c=>c.id===currentCatId);
  if(sel && colorPalette){
    for(const x of colorPalette.querySelectorAll('.color-dot')){
      x.classList.toggle('active', x.dataset.color === (sel.color||''));
      x.style.outline = x.classList.contains('active') ? '2px solid #111' : 'none';
    }
  }
}

function selectCat(id){
  currentCatId=id; const cat=tree.find(c=>c.id===id); if(!cat) return;
  selectedCatLabel && (selectedCatLabel.textContent=cat.name);
  actionArea?.classList.remove('hidden');
  if(catEditName) catEditName.value = cat.name;
  renderCats();
  renderActions();
  renderTodayMini();
}

// 行動ボタン（タイトル色＝カテゴリ色、編集モード時は ↑↓削除）
function renderActions(){
  const cat=tree.find(c=>c.id===currentCatId); if(!cat || !actionList) return;
  actionList.innerHTML='';
  const ongoing=entries.find(e=>!e.end && e.date===selectedDate);

  cat.actions.forEach(act=>{
    const b=document.createElement('div');
    Object.assign(b.style,{padding:'12px 14px',borderRadius:'12px',border:'1px solid var(--line)',background:'#fff',textAlign:'left',width:'100%',position:'relative',margin:'6px 0'});

    const title=document.createElement('span'); title.className='title'; title.textContent=act.name;
    title.style.cssText = `font-weight:800;display:block;color:${cat.color||'#111827'}`;
    const sub=document.createElement('span'); sub.className='sub'; sub.style.fontSize='12px'; sub.style.opacity='.85';
    b.append(title,sub);

    const isActive = ongoing && ongoing.name===act.name && ongoing.categoryId===cat.id;
    if(isActive){
      Object.assign(b.style,{background:cat.color,borderColor:cat.color,color:'#fff'});
      title.style.color='#fff';
      sub.textContent=`■ 停止 ・開始 ${fmtHM(ongoing.start)}`;
    }else{
      sub.textContent='▶ 開始';
      Object.assign(b.style,{borderColor:'#e5e7eb',background:'#fff',color:'#111827'});
    }

    if (editMode){
      const mkMini = (label)=>{
        const btn = document.createElement('button');
        btn.type='button';
        Object.assign(btn.style,{padding:'4px 8px',border:'1px solid #e5e7eb',borderRadius:'8px',background:'#fff',fontSize:'12px',cursor:'pointer',marginLeft:'6px'});
        btn.textContent = label;
        return btn;
      };
      const tools = document.createElement('div');
      tools.style.position='absolute';
      tools.style.right='10px';
      tools.style.top='10px';
      tools.style.display='flex';

      const idx = cat.actions.findIndex(a=>a.id===act.id);
      const up   = mkMini('↑'); up.disabled = (idx===0);
      const down = mkMini('↓'); down.disabled = (idx===cat.actions.length-1);
      const del  = mkMini('削除'); del.style.background='#e11d48'; del.style.color='#fff'; del.style.borderColor='#e11d48';

      up.onclick   = ()=>{ if(idx>0){ const [mv]=cat.actions.splice(idx,1); cat.actions.splice(idx-1,0,mv); save(); renderActions(); } };
      down.onclick = ()=>{ if(idx<cat.actions.length-1){ const [mv]=cat.actions.splice(idx,1); cat.actions.splice(idx+1,0,mv); save(); renderActions(); } };
      del.onclick  = ()=>{ if(confirm(`行動「${act.name}」を削除しますか？`)){ cat.actions = cat.actions.filter(a=>a.id!==act.id); save(); renderActions(); } };

      tools.append(up,down,del);
      b.appendChild(tools);
    }else{
      b.style.cursor='pointer';
      b.onclick=()=> toggleAction(cat, act);
    }

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
  renderNowCard();
}

// 行動の追加
document.getElementById('addActionBtn')?.addEventListener('click', ()=>{
  const el=document.getElementById('newActionName'); const name=(el.value||'').trim(); if(!name) return;
  const cat=tree.find(c=>c.id===currentCatId); if(!cat) return;
  cat.actions.push({id:rid(), name}); el.value=''; save(); renderActions();
});

// 編集モードトグル / 名前編集
toggleEdit?.addEventListener('change', ()=>{ editMode = toggleEdit.checked; renderCats(); renderActions(); renderTodayMini(); renderCheck(); });
catEditName?.addEventListener('input', ()=>{
  const cat=tree.find(c=>c.id===currentCatId); if(!cat) return;
  const v = catEditName.value.trim(); if(!v) return;
  cat.name = v; save(); selectedCatLabel && (selectedCatLabel.textContent = v); renderCats(); renderActions(); renderTodayMini(); renderCheck();
});

// カテゴリ追加・削除
addCatBtn?.addEventListener('click', ()=>{
  const name = (newCatName.value||'').trim(); if(!name) return;
  const color = COLORS[ tree.length % COLORS.length ];
  const cat = { id:rid(), name, color, actions:[] };
  tree.push(cat);
  save();
  newCatName.value='';
  selectCat(cat.id);
});
delCatBtn?.addEventListener('click', ()=>{
  if(!currentCatId) return;
  const cat = tree.find(c=>c.id===currentCatId);
  if(!cat) return;
  if(!confirm(`カテゴリ「${cat.name}」を削除しますか？\n（既存の記録は残ります）`)) return;
  const idx = tree.findIndex(c=>c.id===currentCatId);
  tree.splice(idx,1);
  save();
  currentCatId = tree[0]?.id || null;
  if(currentCatId){ selectCat(currentCatId); } else { renderCats(); actionArea?.classList.add('hidden'); renderTodayMini(); }
});

// ===== エントリー行（確認画面／本日の記録 共通デザイン） =====
function makeEntryCard(e, withDelete){
  const catColor = tree.find(c=>c.id===e.categoryId)?.color || '#3b82f6';
  const bg = hexToRgba(catColor, 0.06);

  const row = document.createElement('div');
  row.className='item';
  Object.assign(row.style,{
    position:'relative',
    background:bg,
    border:`1px solid ${hexToRgba(catColor,0.4)}`, // ← 枠もカテゴリ色の薄色
    borderRadius:'12px',
    padding:'14px',
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between',
    margin:'8px 0'
  });

  // 左の太い色ストライプ
  const stripe = document.createElement('span');
  Object.assign(stripe.style,{
    position:'absolute',left:'8px',top:'10px',bottom:'10px',width:'6px',
    borderRadius:'999px',background:catColor
  });
  row.appendChild(stripe);

  const left = document.createElement('div');
  left.style.marginLeft='16px';
  left.textContent = `${fmtHM(e.start)}〜${e.end?fmtHM(e.end):'(進行中)'}  ${e.categoryName} / ${e.name}`;
  row.appendChild(left);

  if(withDelete){
    const del=document.createElement('button');
    del.type='button';
    Object.assign(del.style,{marginLeft:'8px',padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:'8px',background:'#fff',cursor:'pointer'});
    del.textContent='削除';
    del.onclick=()=>{
      if(!confirm('この記録を削除しますか？')) return;
      entries=entries.filter(x=>x.id!==e.id); save();
      renderCheck(); renderTodayMini();
    };
    row.appendChild(del);
  }
  return row;
}

function renderTodayMini(){
  if(!todayMini) return;
  todayMini.innerHTML='';
  const todays=entries.filter(e=>e.date===selectedDate).sort((a,b)=>b.start-a.start);
  if(todays.length===0){
    const p=document.createElement('p'); p.className='muted'; p.textContent='まだ記録がありません。'; todayMini.appendChild(p); return;
  }
  todays.forEach(e=> todayMini.appendChild(makeEntryCard(e, editMode))); // 編集モード時だけ削除ボタン
}

// ===== 集計ロジック =====
function summarizeEntries(list){
  const byCat = {};
  const byAct = {};
  const byBucket = {};
  let total = 0;
  for(const e of list){
    if(!e.end || e.end <= e.start) continue;
    const dur = e.end - e.start;
    total += dur;
    byCat[e.categoryName] = (byCat[e.categoryName]||0) + dur;
    const actKey = `${e.categoryName} / ${e.name}`;
    byAct[actKey] = (byAct[actKey]||0) + dur;
    byBucket[bucketOf(e.start)] = (byBucket[bucketOf(e.start)]||0) + dur;
  }
  const topActs = Object.entries(byAct).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return { total, byCat, byBucket, topActs };
}

function collectRange(tab, baseDateStr){
  const d = new Date(baseDateStr+'T00:00:00');
  if (tab==='day'){
    return entries.filter(e=>e.date===baseDateStr);
  }else if(tab==='week'){
    const s = startOfWeekMon(d), en = endOfWeekMon(d);
    return entries.filter(e=>{
      const ed = new Date(e.date+'T00:00:00');
      return ed>=s && ed<=en;
    });
  }else{ // month
    const s = startOfMonth(d), en = endOfMonth(d);
    return entries.filter(e=>{
      const ed = new Date(e.date+'T00:00:00');
      return ed>=s && ed<=en;
    });
  }
}

// ===== 確認（一覧＋日/週/月サマリー） =====
function ensureCheckTabs(){
  let tabs = document.getElementById('checkTabs');
  if (tabs) return tabs;
  const datebar = document.querySelector('#view-check .datebar');
  if(!datebar) return null;
  tabs = document.createElement('div');
  tabs.id = 'checkTabs';
  tabs.className = 'tabs';
  tabs.style.margin = '8px 0';
  tabs.innerHTML = `
    <button class="tab" data-tab="day">日</button>
    <button class="tab" data-tab="week">週</button>
    <button class="tab" data-tab="month">月</button>
  `;
  datebar.after(tabs);
  tabs.querySelectorAll('.tab').forEach(b=>{
    b.addEventListener('click', ()=>{
      checkTab = b.dataset.tab;
      renderCheck();
    });
  });
  return tabs;
}

function renderCheck(){
  const dateEl=document.getElementById('datePick');
  if(dateEl && dateEl.value!==selectedDate) dateEl.value=selectedDate;

  const list=document.getElementById('checkList'); if(!list) return;
  list.innerHTML='';

  const tabs = ensureCheckTabs();
  if (tabs){ tabs.querySelectorAll('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===checkTab)); }

  const range = collectRange(checkTab, selectedDate);
  range.sort((a,b)=> (a.start||0)-(b.start||0));

  if(range.length===0){
    const p=document.createElement('p'); p.className='muted'; p.textContent='該当期間の記録はありません。'; list.appendChild(p);
  }else{
    for(const e of range){ list.appendChild(makeEntryCard(e, true)); }
  }

  // --- サマリーカード（バッジ）※時間帯は非表示 ---
  const s = summarizeEntries(range);

  const badge = (text, color) => {
    const span = document.createElement('span');
    Object.assign(span.style, {
      display:'inline-block',
      padding:'6px 12px',
      borderRadius:'999px',
      background: color ? hexToRgba(color,0.25) : '#f3f4f6',
      border:`1px solid ${color ? hexToRgba(color,0.6) : '#e5e7eb'}`,
      color:'#111827',
      fontSize:'12px',
      fontWeight:'700',
      margin:'4px 6px',
      whiteSpace:'nowrap'
    });
    span.textContent = text;
    return span;
  };
  const group = (title) => {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '10px';
    const head = document.createElement('div');
    head.textContent = title;
    head.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:6px';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center';
    wrap.append(head, body);
    return { wrap, body };
  };

  const card = document.createElement('div');
  Object.assign(card.style, {
    border:'1px solid #e5e7eb',
    borderRadius:'12px',
    padding:'14px',
    marginTop:'12px',
    background:'#fff'
  });

  const titleTxt = (checkTab==='day' ? '本日の集計' : checkTab==='week' ? '今週の集計' : '今月の集計');
  const titleEl = document.createElement('div');
  titleEl.textContent = titleTxt;
  titleEl.style.cssText = 'text-align:center;color:#6b7280;font-size:13px;margin-bottom:6px';
  const totalEl = document.createElement('div');
  totalEl.textContent = `合計: ${msToHMM(s.total)}`;
  totalEl.style.cssText = 'font-weight:800;font-size:22px;text-align:center;margin-bottom:2px';

  card.append(titleEl, totalEl);

  // カテゴリ別
  const { wrap: catWrap, body: catBody } = group('カテゴリ別');
  const catEntries = Object.entries(s.byCat);
  if (catEntries.length) {
    catEntries.forEach(([k, v])=>{
      const color = tree.find(c => c.name === k)?.color;
      catBody.append(badge(`${k}: ${msToHMM(v)}`, color));
    });
  } else { catBody.append(badge('—')); }
  card.append(catWrap);

  // トップ行動（カテゴリ色付きバッジ）
  const { wrap: actWrap, body: actBody } = group('トップ行動');
  if (s.topActs.length) {
    s.topActs.forEach(([k, v])=>{
      const catName = String(k).split(' / ')[0] || '';
      const color = tree.find(c => c.name === catName)?.color;
      actBody.append(badge(`${k}: ${msToHMM(v)}`, color));
    });
  } else { actBody.append(badge('—')); }
  card.append(actWrap);

  list.append(card);
}

// ===== ブログ（テンプレ：時間帯行は削除） =====
function buildBlogText(date){
  const m=dayMeta(date);
  const todays=entries.filter(e=>e.date===date).sort((a,b)=>a.start-b.start);
  const d=new Date(date+'T00:00:00');

  const lines=[];
  lines.push(`【${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日】`);
  lines.push('');
  lines.push('— 体調 —');
  if(m.wakeAt || m.sleepAt){
    if(m.wakeAt){
      const wm = (m.wakeMentalLabel   ?? (m.wakeMental   != null ? String(m.wakeMental)   : '-'));
      const wp = (m.wakePhysicalLabel ?? (m.wakePhysical != null ? String(m.wakePhysical) : '-'));
      const sq = (m.wakeSleepQuality  ?? '-');
      lines.push(`起床: ${fmtHM(m.wakeAt)}　心の疲れ具合:${wm}／体の疲れ具合:${wp}／睡眠の質:${sq}`);
    }
    if(m.sleepAt){
      const sm = (m.sleepMentalLabel   ?? (m.sleepMental   != null ? String(m.sleepMental)   : '-'));
      const sp = (m.sleepPhysicalLabel ?? (m.sleepPhysical != null ? String(m.sleepPhysical) : '-'));
      lines.push(`就寝: ${fmtHM(m.sleepAt)}　心の疲れ具合:${sm}／体の疲れ具合:${sp}`);
    }
  }else{
    lines.push('体調の記録はありません。');
  }
  lines.push('');

  lines.push('— 行動ログ —');
  if(todays.length===0){
    lines.push('本日の行動記録はありません。');
  }else{
    for(const e of todays){
      const range = `${fmtHM(e.start)}〜${e.end?fmtHM(e.end):'(進行中)'}`;
      const cat   = e.categoryName?`（${e.categoryName}）`:'';
      lines.push(`・${range} ${e.name}${cat}`);
    }
  }

  const s = summarizeEntries(todays);
  lines.push('');
  lines.push('— 本日の集計 —');
  lines.push(`合計: ${msToHMM(s.total)}`);
  if (Object.keys(s.byCat).length){
    lines.push('カテゴリ別: ' + Object.entries(s.byCat).map(([k,v])=>`${k}:${msToHMM(v)}`).join(' / '));
  }
  if (s.topActs.length){
    lines.push('トップ行動: ' + s.topActs.map(([k,v])=>`${k}:${msToHMM(v)}`).join(' / '));
  }
    // --- 追記：完了したタスク（その日） ---
  const dayStr = date; // YYYY-MM-DD
  const tks = _getTasksForBlog();

  const doneDaily   = tks.filter(t => t.repeat === 'daily' && Array.isArray(t.doneDates) && t.doneDates.includes(dayStr));
  const doneSingles = tks.filter(t =>
    t.repeat === 'none' && t.completed &&
    (_ymdFromTs(t.completedAt) === dayStr || (!t.completedAt && t.due === dayStr))  // 互換フォールバック
  );
  const doneTasks = [...doneDaily, ...doneSingles];

  lines.push('');
  lines.push('— 完了したタスク —');
  if (doneTasks.length === 0) {
    lines.push('なし');
  } else {
    for (const t of doneTasks) {
      if (t.repeat === 'daily') {
        lines.push(`・${t.title}（毎日）`);
      } else {
        lines.push(`・${t.title}${t.due ? `（予定日:${t.due}）` : ''}`);
      }
    }
  }

  const cEl = document.getElementById('blogComment');
  const c = cEl ? (cEl.value.trim()) : '';
  if(c){ lines.push(''); lines.push('— 今日のコメント —'); lines.push(c); }

  return lines.join('\n');
}
function renderBlog(){
  const el=document.getElementById('blogDate'); if(el && el.value!==selectedDate) el.value=selectedDate;
  const prev=document.getElementById('blogPreview'); if(prev) prev.textContent=buildBlogText(selectedDate);
}
document.getElementById('copyBlog')?.addEventListener('click', ()=>{
  const txt=buildBlogText(selectedDate);
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(txt);
  const t=document.getElementById('toast'); const m=document.getElementById('toastMsg');
  if(t&&m){ m.textContent='ブログ文をコピーしました'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),1500); }
});

// ===== Wake / Sleep modals（ラベル選択UI） =====
function openWake(){
  // 起床時：心/体/睡眠の質（ラベル）
  let mental = null, physical = null, sleepQ = null;
  const w = document.getElementById('modalWake');

  renderChoices(document.getElementById('mentalScaleWake'),   LABELS_MENTAL,   null, v=> mental  = v);
  renderChoices(document.getElementById('physicalScaleWake'), LABELS_PHYSICAL, null, v=> physical= v);
  renderChoices(document.getElementById('sleepQualityWake'),  LABELS_SLEEP,    null, v=> sleepQ  = v); // コンテナが無ければ何もしない

  const btn = document.getElementById('confirmWake');
  if(btn){
    btn.onclick = ()=>{
      setDayMeta(selectedDate, {
        wakeAt: Date.now(),
        wakeMentalLabel:   mental,
        wakePhysicalLabel: physical,
        wakeSleepQuality:  sleepQ
      });
      w.classList.add('hidden');
    };
  }
  w.classList.remove('hidden');
}

function openSleep(){
  // 就寝時：心/体（ラベル）
  let mental = null, physical = null;
  const w = document.getElementById('modalSleep');

  renderChoices(document.getElementById('mentalScaleSleep'),   LABELS_MENTAL,   null, v=> mental  = v);
  renderChoices(document.getElementById('physicalScaleSleep'), LABELS_PHYSICAL, null, v=> physical= v);

  const btn = document.getElementById('confirmSleep');
  if(btn){
    btn.onclick = ()=>{
      setDayMeta(selectedDate, {
        sleepAt: Date.now(),
        sleepMentalLabel:   mental,
        sleepPhysicalLabel: physical
      });
      w.classList.add('hidden');
    };
  }
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
document.getElementById('btnExport')?.addEventListener('click', ()=>{ download(`tracker-backup-${selectedDate}.json`, JSON.stringify(snapshot(),null,2)); });
document.getElementById('fileImport')?.addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const json = JSON.parse(await f.text());
    if(!confirm('現在のデータを置き換えます。よろしいですか？')) return;
    tree    = Array.isArray(json.tree)    ? json.tree    : tree;
    entries = Array.isArray(json.entries) ? json.entries : entries;
    meta    = Array.isArray(json.meta)    ? json.meta    : meta;
    save(); updateHome(); renderCheck(); renderBlog(); renderCats(); renderActions(); renderTodayMini();
    alert('読み込みが完了しました。');
  }catch(err){ alert('読み込みに失敗しました。ファイルをご確認ください。'); }
  e.target.value='';
});

// ===== Navigation & binds =====
function bindTap(el, handler){ if(!el) return; el.addEventListener('click', handler); }

// iOSズーム抑止 + ホームのバッジ縦並び（右寄せ）を注入
function injectRuntimeCss(){
  const css = `
    input,select,textarea{ font-size:16px; } /* iOSのズーム抑止 */
    .tab.active{ background:#111827;color:#fff;border-color:#111827; }

    /* 起床/就寝のラベル：右寄せ・縦並び */
    #wakeFatigue, #sleepFatigue{
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap:6px;
      margin-top:6px;
    }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

function boot(){
  injectRuntimeCss();

  bindTap(document.getElementById('btnHome'),  ()=>showView('home'));
  bindTap(document.getElementById('btnRecord'), openSheet);
  bindTap(document.getElementById('goCheck'),  ()=>showView('check'));
  bindTap(document.getElementById('goBlog'),   ()=>showView('blog'));
  bindTap(document.getElementById('toBlog'),   ()=>showView('blog'));
  bindTap(document.getElementById('toCheck'),  ()=>showView('check'));
  bindTap(document.getElementById('btnWake'),  openWake);
  bindTap(document.getElementById('btnSleep'), openSleep);
  bindTap(document.getElementById('goTodo'), openTaskSheet);


  const dp=document.getElementById('datePick');
  if(dp) dp.addEventListener('change', e=>{ selectedDate=e.target.value; updateHome(); renderCheck(); renderBlog(); renderTodayMini(); });
  document.getElementById('prevDate')?.addEventListener('click', ()=>{
    selectedDate=fmtDate(addDays(new Date(selectedDate),-1));
    renderCheck(); renderBlog(); updateHome(); if(dp) dp.value=selectedDate; renderTodayMini();
  });
  document.getElementById('nextDate')?.addEventListener('click', ()=>{
    selectedDate=fmtDate(addDays(new Date(selectedDate),+1));
    renderCheck(); renderBlog(); updateHome(); if(dp) dp.value=selectedDate; renderTodayMini();
  });

  const bd=document.getElementById('blogDate'); if(bd) bd.addEventListener('change', e=>{ selectedDate=e.target.value; renderBlog(); updateHome(); renderTodayMini(); });

  updateHome(); renderCheck(); renderBlog(); renderCats(); renderActions(); renderTodayMini(); showView('home');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();

// === 1タップ停止用：ホーム先頭に「記録中カード」を出す ===
function renderNowCard(){
  const host =
    document.querySelector('#view-home .home') ||
    document.querySelector('#view-home .container') ||
    document.getElementById('view-home');
  if (!host) return;

  let wrap = document.getElementById('nowCardWrap');
  const on = entries.find(e => !e.end);

  if (!on) {
    if (wrap) { if (wrap._timer) clearInterval(wrap._timer); wrap.remove(); }
    return;
  }

  const cat   = tree.find(c => c.id === on.categoryId);
  const color = (cat && cat.color) || '#3b82f6';
  const bg    = hexToRgba(color, 0.08);

  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'nowCardWrap';
    wrap.style.margin = '8px 0 12px';
    host.insertBefore(wrap, host.firstChild);
  } else {
    wrap.innerHTML = '';
  }

  const card = document.createElement('div');
  Object.assign(card.style, {
    position:'relative',
    background:bg,
    border:'1px solid #e5e7eb',
    borderRadius:'14px',
    padding:'14px',
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between'
  });

  const stripe = document.createElement('span');
  Object.assign(stripe.style,{
    position:'absolute', left:'8px', top:'10px', bottom:'10px', width:'6px',
    borderRadius:'999px', background:color
  });
  card.appendChild(stripe);

  const left = document.createElement('div');
  left.style.marginLeft = '16px';

  const title = document.createElement('div');
  title.style.fontWeight = '800';
  title.style.fontSize   = '16px';
  title.textContent = `${on.categoryName} / ${on.name}`;

  const meta  = document.createElement('div');
  meta.style.fontSize = '12px';
  meta.style.opacity  = '.8';

  const tick = () => {
    const ms = Date.now() - on.start;
    const m  = Math.floor(ms/60000), h = Math.floor(m/60), mm = m % 60;
    meta.textContent = `開始 ${fmtHM(on.start)} ・ 経過 ${h}時間${mm}分`;
  };
  tick();
  if (wrap._timer) clearInterval(wrap._timer);
  wrap._timer = setInterval(tick, 30000);

  left.append(title, meta);
  card.appendChild(left);

  const btnStop = document.createElement('button');
  btnStop.className = 'btn btn-danger';
  btnStop.textContent = '停止';
  Object.assign(btnStop.style,{
    minWidth:'88px', height:'40px',
    background:color, borderColor:color
  });
  btnStop.onclick = () => {
    const target = entries.find(e => !e.end);
    if (!target) return;
    target.end = Date.now();
    save();

    const t = document.getElementById('toast'), m = document.getElementById('toastMsg');
    if (t && m) { m.textContent = '記録を停止しました'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),1500); }

    renderTodayMini();
    renderCheck();
    updateHome();
  };

  const btnOpen = document.createElement('button');
  btnOpen.className = 'btn';
  btnOpen.textContent = '記録シート';
  btnOpen.style.marginLeft = '8px';
  btnOpen.onclick = openSheet;

  const right = document.createElement('div');
  right.append(btnStop, btnOpen);
  card.appendChild(right);

  wrap.appendChild(card);
}

// ---- ラベル選択（モーダル用）: 青→赤グラデ & 単一選択 ----
const hueFromIdx = (idx, len) => {
  if (len <= 1) return 220;
  const t = idx / (len - 1);       // 0..1 (良い→悪い)
  return Math.round(220 - 220*t);  // 220(青) → 0(赤)
};
const hsl = (h, s=70, l=50, a=1) => `hsla(${h},${s}%,${l}%,${a})`;

/**
 * ラベル配列を丸ピルで描画（良い→悪いで青→赤）。単一選択。
 * @param {HTMLElement} host
 * @param {string[]}    opts
 * @param {string|null} current
 * @param {(val:string)=>void} onChange
 */
function renderChoices(host, opts, current, onChange){
  if(!host) return;
  host.innerHTML = '';

  opts.forEach((label, idx)=>{
    const h = hueFromIdx(idx, opts.length);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = label;
    Object.assign(chip.style, {
      display:'inline-block',
      padding:'6px 12px',
      margin:'4px 6px',
      borderRadius:'999px',
      fontSize:'13px',
      fontWeight:'700',
      cursor:'pointer',
      whiteSpace:'nowrap'
    });

    const selected = (label === current);
    if(selected){
      chip.style.background = hsl(h, 72, 48, 1);
      chip.style.border = `1px solid ${hsl(h,72,48,1)}`;
      chip.style.color = '#fff';
    }else{
      chip.style.background = hsl(h, 72, 50, 0.12);
      chip.style.border = `1px solid ${hsl(h,65,52,0.65)}`;
      chip.style.color = '#111827';
    }

    chip.addEventListener('click', ()=>{
      onChange(label);
      renderChoices(host, opts, label, onChange);
    });
    host.appendChild(chip);
  });
}
/* ==== Tasks (TODO) モジュール：追記だけ ==== */
const LS_TASKS = 'todo.v2.daily';
let tasks = [];
try { tasks = JSON.parse(localStorage.getItem(LS_TASKS) || '[]'); } catch(e){ tasks = []; }
function saveTasks(){ localStorage.setItem(LS_TASKS, JSON.stringify(tasks)); }
const todayStr_T = ()=> fmtDate(new Date());

// 置き換え
function openTaskSheet(){
  renderTaskSheet();
  const wrap = document.getElementById('taskSheetWrap');
  if (!wrap) return;
  wrap.classList.remove('hidden');

  // モーダル内スクロール位置を先頭に戻す（閉じるが画面外に行かないように）
  const modal = wrap.querySelector('.modal');
  if (modal) modal.scrollTop = 0;

  // （必要なら）背景のスクロールをロック
  // document.documentElement.style.overflow = 'hidden';
}

// 併せて閉じる側でロック解除したい場合
function closeTaskSheet(){
  const wrap = document.getElementById('taskSheetWrap');
  if (wrap) wrap.classList.add('hidden');
  // document.documentElement.style.overflow = '';
}
function closeTaskSheet(){ document.getElementById('taskSheetWrap')?.classList.add('hidden'); }

// 起動バインド（既存 boot() を触らずに安全にバインド）
bindTap(document.getElementById('btnTasks'), openTaskSheet);
document.getElementById('taskAddBtn')?.addEventListener('click', addTaskFromForm);
document.querySelectorAll('[data-close="taskSheet"]').forEach(b=> b.addEventListener('click', closeTaskSheet));

function addTaskFromForm(){
  const title = (document.getElementById('taskTitle')?.value || '').trim();
  const date  = document.getElementById('taskDate')?.value || null;
  const daily = !!document.getElementById('taskDaily')?.checked;
  if(!title) return;

  tasks.push({
    id: rid(),
    title,
    repeat: daily ? 'daily' : 'none',
    due: daily ? null : date,
    startDate: daily ? (date || todayStr_T()) : null,
    completed: false,
    completedAt: null,
    doneDates: []
  });
  saveTasks();
  document.getElementById('taskTitle').value = '';
  renderTaskSheet();
}

function toggleTaskDone(t){
  const today = todayStr_T();
  if(t.repeat==='daily'){
    const i = t.doneDates.indexOf(today);
    if(i===-1) t.doneDates.push(today); else t.doneDates.splice(i,1);
  }else{
    t.completed = !t.completed;
    t.completedAt = t.completed ? Date.now() : null;
  }
  saveTasks(); renderTaskSheet();
}
function removeTask(t){
  if(!confirm('このタスクを削除しますか？')) return;
  tasks = tasks.filter(x=>x.id!==t.id);
  saveTasks(); renderTaskSheet();
}
function escHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

function renderTaskSheet(){
  const list = document.getElementById('taskList');
  const prog = document.getElementById('taskProgress');
  if(!list) return;

  const today = todayStr_T();

  // 表示順：毎日 → 単発（予定日昇順）
  const sorted = [...tasks].sort((a,b)=>{
    if(a.repeat!==b.repeat) return a.repeat==='daily' ? -1 : 1;
    const ad = a.repeat==='daily' ? a.startDate : a.due;
    const bd = b.repeat==='daily' ? b.startDate : b.due;
    return (ad||'').localeCompare(bd||'');
  });

  list.innerHTML='';
  let total=0, done=0;

  for(const t of sorted){
    const isDaily = t.repeat==='daily';
    const isDone  = isDaily ? t.doneDates.includes(today) : !!t.completed;
    total++; if(isDone) done++;

    const row = document.createElement('div');
    row.className = 'item';
    row.style.gridTemplateColumns = 'auto 1fr auto';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <input type="checkbox" ${isDone?'checked':''} aria-label="complete">
      <div>
        <div class="title">${escHtml(t.title)}</div>
        <div class="muted" style="margin-top:2px;">
          ${isDaily
            ? `毎日（開始: ${t.startDate||'-'}） / 今日: ${isDone?'完了':'未完了'}`
            : (t.due ? `予定日: ${t.due}` : '予定日なし')}
        </div>
      </div>
      <div class="actions">
        <button class="icon-btn" data-del>削除</button>
      </div>
    `;
    row.querySelector('input').addEventListener('change', ()=>toggleTaskDone(t));
    row.querySelector('[data-del]').addEventListener('click', ()=>removeTask(t));
    list.appendChild(row);
  }

  if(prog){
    const pct = total ? Math.round(done/total*100) : 0;
    prog.querySelector('span').style.width = pct + '%';
    prog.setAttribute('aria-valuenow', pct);
    const t = document.getElementById('taskProgressText');
    if(t) t.textContent = total ? `${done} / ${total}（${pct}%）` : '対象なし';
  }
}

// ▼ カレンダー🗓ボタンで date picker を開く & バッジ表示を同期
const dateInput = document.getElementById('taskDate');
const dateBtn   = document.getElementById('taskDateBtn');
const dateText  = document.getElementById('taskDateText');

function fmtDateBadge(v){
  if(!v) return '';
  const [y,m,d] = v.split('-');
  return `${Number(m)}/${('0'+d).slice(-2)}`; // 例: 9/02
}
function syncTaskDateBadge(){
  if(dateText && dateInput) dateText.textContent = fmtDateBadge(dateInput.value);
}
dateBtn?.addEventListener('click', ()=>{
  if(!dateInput) return;
  if (dateInput.showPicker) dateInput.showPicker(); // Safari/Chrome/Edge
  else dateInput.click();                            // フォールバック
});
dateInput?.addEventListener('change', syncTaskDateBadge);
syncTaskDateBadge();
// ====================== end of app.js ====================
