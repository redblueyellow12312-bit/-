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
  ['home','check','blog','analysis'].forEach(
    v=>document.getElementById('view-'+v)?.classList.toggle('hidden', v!==name)
  );
  if(name==='home') updateHome();
  if(name==='check') renderCheck();
  if(name==='blog') renderBlog();
  if(name==='analysis') renderAnalysis();
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
  // 削除ボタン
  const del=document.createElement('button');
  del.type='button';
  Object.assign(del.style,{marginLeft:'8px',padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:'8px',background:'#fff',cursor:'pointer'});
  del.textContent='削除';
  del.onclick=()=>{ if(!confirm('この記録を削除しますか？')) return;
    entries=entries.filter(x=>x.id!==e.id); save();
    renderCheck(); renderTodayMini();
  };
  row.appendChild(del);

  // 編集ボタン
  const edit=document.createElement('button');
  edit.type='button';
  Object.assign(edit.style,{marginLeft:'8px',padding:'6px 10px',border:'1px solid #3b82f6',borderRadius:'8px',background:'#fff',cursor:'pointer'});
  edit.textContent='編集';
  edit.onclick=()=> openEditEntryModal(e); // ← ②で定義するモーダルを開く
  row.appendChild(edit);
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
function openEditEntryModal(entry){
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'background:#fff;padding:20px;border-radius:8px;min-width:280px;';

  // --- カテゴリ選択肢を組み立て ---
  let catOptions = '';
  tree.forEach(cat=>{
    catOptions += `<option value="${cat.id}" ${cat.id===entry.categoryId ? 'selected' : ''}>${cat.name}</option>`;
  });

  modal.innerHTML = `
    <h3>行動を編集</h3>
    <label>カテゴリ:
      <select id="editCat">${catOptions}</select>
    </label><br>
    <label>行動名:
      <input type="text" id="editName" value="${entry.name}">
    </label><br>
    <label>開始:
      <input type="time" id="editStart" value="${fmtHM(entry.start)}">
    </label><br>
    <label>終了:
      <input type="time" id="editEnd" value="${entry.end ? fmtHM(entry.end) : ''}">
    </label><br>
    <div style="margin-top:10px;text-align:right">
      <button id="editCancel">キャンセル</button>
      <button id="editSave">保存</button>
    </div>
  `;

  wrap.appendChild(modal);
  document.body.appendChild(wrap);

  // --- イベント ---
  modal.querySelector('#editCancel').onclick = ()=> wrap.remove();
  modal.querySelector('#editSave').onclick = ()=>{
    const [sh,sm] = modal.querySelector('#editStart').value.split(':').map(Number);
    const [eh,em] = modal.querySelector('#editEnd').value ? modal.querySelector('#editEnd').value.split(':').map(Number) : [null,null];
    const d = new Date(entry.date+'T00:00:00');

    entry.start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).getTime();
    if(eh!=null) entry.end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em).getTime();

    entry.name = modal.querySelector('#editName').value.trim();

    // カテゴリ変更
    const newCatId = modal.querySelector('#editCat').value;
    const newCat   = tree.find(c => c.id===newCatId);
    if (newCat){
      entry.categoryId   = newCat.id;
      entry.categoryName = newCat.name;
    }

    save();
    renderCheck();
    renderTodayMini();
    wrap.remove();
  };
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
  const tabs = document.getElementById('checkTabs');
  if (!tabs) return null;
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

    // 📌 ここで meta を取得
  const m = dayMeta(selectedDate);

// コメントを表示
if (m.comments && m.comments.length > 0) {
  const cBox = document.createElement('div');
  cBox.style.cssText = 'margin:8px 0;padding:10px;border-radius:8px;background:#f3f4f6;color:#111827;font-size:14px;white-space:pre-wrap;';
  cBox.textContent = m.comments.join("\n");
  list.appendChild(cBox);
}

// === AIアドバイスを表示 ===
const allAdvice = loadAiAdvice();
if (allAdvice[selectedDate]) {
  const aiBox = document.createElement('div');
  aiBox.style.cssText = 'margin:8px 0;padding:10px;border-radius:8px;background:#eef6ff;color:#1e40af;font-size:14px;white-space:pre-wrap;';
  aiBox.textContent = allAdvice[selectedDate];
  list.appendChild(aiBox);
}


// --- 起床カード ---
if (m.wakeAt) {
  const row = document.createElement('div');
  row.className = 'item';
  row.style.cssText = `
    padding: 10px; margin: 6px 0;
    border:1px solid #3b82f6; border-radius:8px;
    background:${hexToRgba('#3b82f6',0.08)};
    color:#1e3a8a; font-weight:600;
  `;
  row.textContent = `起床: ${fmtHM(m.wakeAt)}`;
  list.appendChild(row);
}

// --- 就寝カード ---
if (m.sleepAt) {
  const row = document.createElement('div');
  row.className = 'item';
  row.style.cssText = `
    padding: 10px; margin: 6px 0;
    border:1px solid #6b7280; border-radius:8px;
    background:${hexToRgba('#6b7280',0.08)};
    color:#374151; font-weight:600;
  `;
  row.textContent = `就寝: ${fmtHM(m.sleepAt)}`;
  list.appendChild(row);
}



// --- 行動一覧は「日」固定で表示 ---
const dayEntries = collectRange('day', selectedDate);
dayEntries.sort((a,b)=> (a.start||0)-(b.start||0));

if(dayEntries.length===0){
  const p=document.createElement('p');
  p.className='muted';
  p.textContent='該当日の記録はありません。';
  list.appendChild(p);
}else{
  for(const e of dayEntries){ list.appendChild(makeEntryCard(e, true)); }
}

// --- サマリーカードはタブに応じて切り替え ---
const range = collectRange(checkTab, selectedDate);
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
  // ...既存の card.append(actWrap); list.append(card); の後など
  renderCharts(checkTab, selectedDate);

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

  // --- コメント出力（複数対応） ---
  const comments = m.comments || [];
  if (comments.length) {
    lines.push('');
    lines.push('— 今日のコメント —');
    comments.forEach(c => lines.push(c));
  }

  return lines.join('\n');

}
// --- コメント保存用のヘルパー ---
function saveComment(date, text, mode) {
  const m = dayMeta(date);
  let comments = m.comments || [];

  if (mode === 'append') {
    comments.push(text); // 追記
  } else if (mode === 'replace') {
    comments = [text];   // 置換（全文）
  } else if (mode === 'delete') {
    comments = [];       // 削除
  }

  setDayMeta(date, { comments });
  renderBlog();   // プレビュー更新
  renderCheck();  // 確認画面の表示更新
}

// --- ボタンイベント ---
document.getElementById('appendComment')?.addEventListener('click', () => {
  const text = document.getElementById('blogComment').value.trim();
  if (!text) { alert("追記する内容を入力してください"); return; }
  saveComment(selectedDate, text, 'append');
  document.getElementById('blogComment').value = '';
});

document.getElementById('replaceComment')?.addEventListener('click', () => {
  const text = document.getElementById('blogComment').value.trim();
  if (!text) { alert("置換する内容を入力してください"); return; }
  saveComment(selectedDate, text, 'replace');
  document.getElementById('blogComment').value = '';
});

document.getElementById('deleteComment')?.addEventListener('click', () => {
  if (!confirm("この日のコメントを削除しますか？")) return;
  saveComment(selectedDate, '', 'delete');
});

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

/* ===== Charts: data helpers ===== */
/* ===== Charts: data helpers ===== */

// --- 目標値の保存/読込 ---
// target: "cat:外出" や "act:散歩" のような識別子
// value: 数値 (時間[h])
function saveGoal(target, value) {
  localStorage.setItem('goal', JSON.stringify({ target, value }));
}

function loadGoal() {
  const raw = localStorage.getItem('goal');
  return raw ? JSON.parse(raw) : null;
}

// --- サイズ取得のフォールバック（幅・高さが 0 でも描けるように） ---
function _sizeOf(el, fw=320, fh=220){
  const r = el.getBoundingClientRect ? el.getBoundingClientRect() : {width:0,height:0};
  const W = Math.max(fw, Math.round(r.width || el.clientWidth || 0));
  const H = Math.max(fh, Math.round(r.height || el.clientHeight || 0));
  return { W, H };
}
// .chart-wrap に最低高さを強制（CSSが効いてなくても安全）
function _ensureWrapHeight(container, h=220){
  if (container && !container.style.height) container.style.height = h + 'px';
}

// 期間の日付配列（tab==='day' は直近7日）
function buildDateAxis(tab, ymd){
  const d = new Date(ymd + 'T00:00:00');
  const label = (dt)=> fmtDate(dt);
  const out = [];
  if (tab === 'day'){
    for(let i=6;i>=0;i--) out.push(label(addDays(d,-i)));
  } else if (tab === 'week'){
    const s = startOfWeekMon(d), e = endOfWeekMon(d);
    for(let t=new Date(s); t<=e; t=addDays(t,1)) out.push(label(t));
  } else {
    const s = startOfMonth(d), e = endOfMonth(d);
    for(let t=new Date(s); t<=e; t=addDays(t,1)) out.push(label(t));
  }
  return out;
}

// 1日×カテゴリの総時間(時間=H) を返す
function dayHoursByCategory(dateStr){
  const list = collectRange('day', dateStr);
  const s = summarizeEntries(list);
  const byCatH = {};
  for(const [k,v] of Object.entries(s.byCat)) byCatH[k] = v/3600000;
  return byCatH; // {カテゴリ名: 時間}
}

// 期間合計のカテゴリ別/行動別（時間）と合計
function totalsFor(tab, ymd){
  const s = summarizeEntries(collectRange(tab, ymd));
  const byCatH = Object.fromEntries(Object.entries(s.byCat).map(([k,v])=>[k, v/3600000]));
  const byActH = Object.fromEntries(s.topActs.map(([k,v])=>[k, v/3600000])); // 上位5
  const totalH = s.total/3600000;
  return { byCatH, byActH, totalH };
}

// 指定カテゴリの“日別推移”（時間）を配列で
function seriesForCategory(tab, ymd, catName){
  const days = buildDateAxis(tab, ymd);
  const ys = days.map(d => (dayHoursByCategory(d)[catName] || 0));
  return { xs: days, ys };
}

function colorOfCategory(catName){
  return (tree.find(c=>c.name===catName)?.color) || '#3b82f6';
}

// --- 7分割の期間バケット（日 / 週 / 月） ---
function buildBuckets(tab, ymd){
  const base = new Date(ymd + 'T00:00:00');
  const out = [];
  if (tab === 'day'){                     // 選択日を含む直近7日
    for (let i = 6; i >= 0; i--){
      const d = addDays(base, -i);
      out.push({ label: `${d.getMonth()+1}/${d.getDate()}`, start: d, end: d });
    }
  } else if (tab === 'week'){             // 選択週から過去7週
    const cur = startOfWeekMon(base);
    for (let i = 6; i >= 0; i--){
      const s = addDays(cur, -7*i);
      const e = endOfWeekMon(s);
      out.push({ label: `${s.getMonth()+1}/${s.getDate()}`, start: s, end: e });
    }
  } else {                                // 選択月から過去7か月
    const y = base.getFullYear(), m = base.getMonth();
    for (let i = 6; i >= 0; i--){
      const s = new Date(y, m - i, 1);
      const e = endOfMonth(s);
      out.push({ label: `${s.getMonth()+1}月`, start: s, end: e });
    }
  }
  return out;
}

// --- 指定期間内のカテゴリ別合計（時間[h]） ---
function hoursByCategoryInRange(d1, d2){
  const list = entries.filter(e=>{
    const dt = new Date(e.date + 'T00:00:00');
    return dt >= new Date(d1.getFullYear(), d1.getMonth(), d1.getDate())
        && dt <= new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  });
  const s = summarizeEntries(list);
  const out = {};
  for (const [k, v] of Object.entries(s.byCat)) out[k] = v / 3600000;
  return out; // {カテゴリ: 時間[h]}
}

/* ===== Charts: tiny SVG helpers ===== */
function svg(tag, attrs={}, children=[]){
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for(const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
  children.forEach(c=> el.appendChild(c));
  return el;
}
function fmtH(h){ return `${Math.round(h*10)/10}h`; }

/* ---- stacked vertical bars (category trend) ---- */
function drawStackedBars(container, xLabels, seriesList){ // series: [{name,color,values[]}]
  _ensureWrapHeight(container, 220);
  const { W, H } = _sizeOf(container, 320, 220);
  const P = 28, innerW = W - P*2, innerH = H - P*2;
  const bw = innerW / Math.max(1, xLabels.length);
  const totals = xLabels.map((_,i)=> seriesList.reduce((a,s)=> a + (s.values[i]||0), 0));
  const maxV = Math.max(1, ...totals);

  const g = svg('svg',{viewBox:`0 0 ${W} ${H}`, width:'100%', height:'100%'});

  // 軸
  g.appendChild(svg('line',{x1:P,y1:H-P,x2:W-P,y2:H-P,stroke:'#e5e7eb'}));
  g.appendChild(svg('line',{x1:P,y1:P,x2:P,y2:H-P,stroke:'#e5e7eb'}));

  // Yガイド&目盛り（時間）
  const ticks = 5;
  for(let t=1;t<=ticks;t++){
    const ratio = t/ticks;
    const y = H - P - innerH*ratio;
    g.appendChild(svg('line',{x1:P,y1:y,x2:W-P,y2:y,stroke:'#f1f5f9'}));
    const lab = Math.round(maxV * ratio * 10)/10;
    g.appendChild(svg('text',{x:P-6,y:y+3,'font-size':'9',fill:'#6b7280','text-anchor':'end'},[document.createTextNode(`${lab}h`)]));
  }

  // 積み上げ本体
  for (let i=0;i<xLabels.length;i++){
    let yTop = H - P;
    for (const s of seriesList){
      const v = s.values[i]||0;
      const h = innerH * (v/maxV);
      const y = yTop - h;
      if (h>0) g.appendChild(svg('rect', {x: P + i*bw + bw*0.15, y, width: bw*0.7, height: h, rx:0, fill: s.color}));
      yTop = y;
    }
  }

  // X ラベル（短縮済）
  xLabels.forEach((t,i)=>{
    const x = P + i*bw + bw*0.5;
    g.appendChild(svg('text',{x, y:H-8, 'text-anchor':'middle','font-size':'9', fill:'#6b7280'},[document.createTextNode(t)]));
  });

  container.innerHTML=''; container.appendChild(g);
}

/* ---- horizontal bars (top actions) ---- */
function drawHBar(container, labels, values, colors){
  _ensureWrapHeight(container, 220);
  const { W, H } = _sizeOf(container, 320, 220);
  const padL = 110, P = 14, innerW = W - P - padL;
  const rowH = Math.min(30, (H - P*2)/Math.max(1, labels.length));
  const maxV = Math.max(1,...values);
  const g = svg('svg',{viewBox:`0 0 ${W} ${H}`, width:'100%', height:'100%'});

  // 0ライン
  g.appendChild(svg('line',{x1:padL,y1:P,x2:padL,y2:H-P,stroke:'#e5e7eb'}));

  labels.forEach((t,i)=>{
    const y = P + i*rowH + rowH*0.15;
    const w = innerW*(values[i]/maxV);
    g.appendChild(svg('rect',{x:padL, y, width:w, height:rowH*0.7, rx:4, fill:colors[i]}));
    g.appendChild(svg('text',{x:P, y:y+rowH*0.6, 'font-size':'11'},[document.createTextNode(t)]));
    g.appendChild(svg('text',{x:padL+w*0.0, y:y+rowH*0.6, 'font-size':'10', fill:'#fcfdfdff'},[document.createTextNode(fmtH(values[i]))]));
  });
  container.innerHTML=''; container.appendChild(g);
}

/* ---- line series (daily/weekly/monthly; Xラベル縦) ---- */
function drawLineSeries(container, xLabels, values, color,goal=null){
  _ensureWrapHeight(container, 240);
  const { W, H } = _sizeOf(container, 320, 240);
  const Pleft = 32, Pright = 18, Ptop = 16, Pbottom = 30; // ←下マージン広め（縦ラベルが切れない）
  const innerW = W - Pleft - Pright, innerH = H - Ptop - Pbottom;
  const n = Math.max(1, xLabels.length-1);
  const maxV = Math.max(1, ...values);
  const g = svg('svg',{viewBox:`0 0 ${W} ${H}`, width:'100%', height:'100%'});

  // 軸
  g.appendChild(svg('line',{x1:Pleft,y1:H-Pbottom,x2:W-Pright,y2:H-Pbottom,stroke:'#e5e7eb'}));
  g.appendChild(svg('line',{x1:Pleft,y1:Ptop,x2:Pleft,y2:H-Pbottom,stroke:'#e5e7eb'}));

  // Yガイド
  const ticks = 4;
  for(let t=1;t<=ticks;t++){
    const y = H - Pbottom - innerH*(t/ticks);
    g.appendChild(svg('line',{x1:Pleft,y1:y,x2:W-Pright,y2:y,stroke:'#f1f5f9'}));
    const lab = Math.round(maxV*(t/ticks)*10)/10;
    g.appendChild(svg('text',{x:Pleft-6,y:y+3,'font-size':'9',fill:'#6b7280','text-anchor':'end'},[document.createTextNode(`${lab}h`)]));
  }

  // 折れ線
  const points = values.map((v,i)=>{
    const x = Pleft + innerW*(i/n);
    const y = H - Pbottom - innerH*(v/maxV);
    return {x,y};
  });

  for(let i=1;i<points.length;i++){
    const p0 = points[i-1], p1 = points[i];
    g.appendChild(svg('line',{x1:p0.x,y1:p0.y,x2:p1.x,y2:p1.y,stroke:color,'stroke-width':2}));
  }
  // 点
  points.forEach(p=> g.appendChild(svg('circle',{cx:p.x, cy:p.y, r:2.6, fill:color})));

  // Xラベル（縦）
  xLabels.forEach((t,i)=>{
    const x = Pleft + innerW*(i/n);
    const tx = svg('text',{'font-size':'9', fill:'#6b7280',
      transform:`translate(${x},${H-6}) rotate(0)`, 'text-anchor':'end'});
    tx.textContent = t;
    g.appendChild(tx);
  });
  // === 目標線を追加（例: 2h） ===
  if (goal != null) {
    const yTarget = H - Pbottom - innerH * (goal / maxV);
    g.appendChild(svg('line', {
      x1: Pleft, y1: yTarget, x2: W - Pright, y2: yTarget,
      stroke: '#ef4444', 'stroke-dasharray': '4,2', 'stroke-width': 1.5
    }));
    g.appendChild(svg('text', {
      x: W - Pright - 4, y: yTarget - 4, 'text-anchor': 'end',
      'font-size': '10', fill: '#ef4444'
    }, [document.createTextNode(`目標 ${goal}h`)]));
  }

  container.innerHTML=''; container.appendChild(g);
}

/* ---- donut (actions composition) ---- */
function drawPie(container, labels, values, colors){
  _ensureWrapHeight(container, 240);
  const { W, H } = _sizeOf(container, 320, 240);
  const R = Math.min(W,H)/2 - 10, hole = R*0.6;
  const cx=W/2, cy=H/2;
  const total = values.reduce((a,b)=>a+b,0) || 1;
  let a0 = -Math.PI/2;
  const g = svg('svg', {viewBox:`0 0 ${W} ${H}`, width:'100%', height:'100%'});
  values.forEach((v,i)=>{
    const a1 = a0 + (v/total)*Math.PI*2;
    const x0 = cx + R*Math.cos(a0), y0 = cy + R*Math.sin(a0);
    const x1 = cx + R*Math.cos(a1), y1 = cy + R*Math.sin(a1);
    const large = (a1-a0)>Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    g.appendChild(svg('path',{d:path, fill:colors[i]}));
    a0 = a1;
  });
  // 穴を開けてドーナツに
  g.appendChild(svg('circle',{cx, cy, r: hole, fill:'#fff'}));
  container.innerHTML=''; container.appendChild(g);
}

/* ===== Charts: main render ===== */
function renderCharts(tab, ymd){
  const host = document.getElementById('chartArea');
  if(!host) return;
  // 確認ビューが非表示（display:none）のときに描くとサイズ0になるのでスキップ
  const vcheck = document.getElementById('view-check');
  if (vcheck && vcheck.classList.contains('hidden')) return;

  host.innerHTML = '';

  // 期間バケット（7分割）
  const buckets = buildBuckets(tab, ymd);
  const xLabels = buckets.map(b=> b.label);

  // --- カードを「作るだけ」のローカル関数群（append は最後に順序指定） ---

  // 左上：カテゴリ別 推移（積み上げ棒）＋凡例を下に中央寄せ
  function buildCategoryTrendCard(){
    const allCats = tree.map(c=> c.name);
    const series = allCats.map(name=>{
      const vals = buckets.map(b=>{
        const m = hoursByCategoryInRange(b.start, b.end);
        return m[name] || 0;
      });
      return { name, color: colorOfCategory(name), values: vals,
        sum: vals.reduce((a,b)=> a+b, 0) };
    }).filter(s=> s.sum > 0);

    const card = document.createElement('div'); card.className='chart-card';
    card.innerHTML = `
      <div class="chart-title">カテゴリ別 推移（時間）</div>
      <div class="chart-wrap"></div>
      <div class="chart-legend" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px;"></div>`;
    drawStackedBars(card.querySelector('.chart-wrap'), xLabels, series);
    const leg = card.querySelector('.chart-legend');
    series.forEach(s=>{
      const el = document.createElement('span');
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
      el.style.gap = '6px';
      el.innerHTML = `<i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.color}"></i>${s.name}`;
      leg.appendChild(el);
    });
    return card;
  }

  // ★右上：外出（なければ最多カテゴリ）の推移（折れ線）
  function buildPreferredTrendCard() {
    // --- UIから現在の選択を取得
    const catSel = document.getElementById("goalCat");
    const actSel = document.getElementById("goalAct");
    const targetCat = catSel?.value || "";
    const targetAct = actSel?.value || "";

    // --- 値を集計
    let vals = [];

    if (targetCat && !targetAct) {
      // カテゴリ全体
      vals = buckets.map(b => {
        const m = hoursByCategoryInRange(b.start, b.end);
        return m[targetCat] || 0;
      });
    } else if (targetCat && targetAct) {
      // 行動ごとに集計
      vals = buckets.map(b => {
        const list = entries.filter(e => {
          const dt = new Date(e.date + "T00:00:00");
          return dt >= b.start && dt <= b.end &&
                 e.categoryName === targetCat && e.name === targetAct;
        });
        const sum = summarizeEntries(list).total; // ms
        return sum / 3600000; // h
      });
    }

    // --- 保存済み目標の読込
    let goal = null;
    const saved = loadGoal?.();
    if (saved) {
      if (saved.target.startsWith("cat:") && saved.target.slice(4) === targetCat && !targetAct) {
        goal = parseFloat(saved.value) || null;
      } else if (saved.target.startsWith("act:") && saved.target.slice(4) === `${targetCat} / ${targetAct}`) {
        goal = parseFloat(saved.value) || null;
      }
    }

    // --- グラフ描画
    const card = document.createElement("div");
    card.className = "chart-card";
    const title = targetAct ? `${targetCat} / ${targetAct} の推移` : `${targetCat} の推移`;
    card.innerHTML = `<div class="chart-title">${title}</div><div class="chart-wrap"></div>`;

    drawLineSeries(card.querySelector(".chart-wrap"), xLabels, vals, colorOfCategory(targetCat), goal);

    return card;
  }

  // ★左下：トップ行動（横棒）
  function buildTopActionsCard(){
    const { byActH } = totalsFor(tab, ymd);
    const acts   = Object.entries(byActH).sort((a,b)=> b[1]-a[1]).slice(0,8);
    const labels = acts.map(([k])=> k);
    const values = acts.map(([,v])=> v);
    const colors = acts.map(([k])=> colorOfCategory(String(k).split(' / ')[0]||''));
    const card = document.createElement('div'); card.className='chart-card';
    card.innerHTML = `<div class="chart-title">トップ行動（期間合計・時間）</div><div class="chart-wrap"></div>`;
    drawHBar(card.querySelector('.chart-wrap'), labels, values, colors);
    return card;
  }

  // 右下：行動内訳（ドーナツ）＋凡例左
  function buildDonutCard(){
    const { byActH } = totalsFor(tab, ymd);
    const sorted = Object.entries(byActH).sort((a,b)=> b[1]-a[1]);
    const top = sorted.slice(0,6);
    const rest = sorted.slice(6).reduce((a,[,v])=> a+v, 0);
    if (rest>0) top.push(['その他', rest]);

    const labels = top.map(([k])=> k);
    const values = top.map(([,v])=> v);
    const colors = labels.map(k => k==='その他'
      ? '#9ca3af' : colorOfCategory(String(k).split(' / ')[0]||''));

    const card = document.createElement('div'); card.className='chart-card';
    card.innerHTML = `
      <div class="chart-title">行動内訳（期間合計）</div>
      <div style="display:flex; gap:12px; align-items:center;">
        <div class="chart-legend" style="flex:0 0 45%; display:flex; flex-direction:column; gap:6px;"></div>
        <div style="flex:1 1 55%;"><div class="chart-wrap"></div></div>
      </div>`;
    const leg = card.querySelector('.chart-legend');
    labels.forEach((t,i)=>{
      const item = document.createElement('span');
      item.style.display = 'inline-flex';
      item.style.alignItems = 'center';
      item.style.gap = '6px';
      item.innerHTML = `<i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colors[i]}"></i>${t}（${fmtH(values[i])}）`;
      leg.appendChild(item);
    });
    drawPie(card.querySelector('.chart-wrap'), labels, values, colors);
    return card;
  }

  // === ここだけ順序を定義（DOM順＝表示位置） ===
  const cardsInOrder = [
    buildPreferredTrendCard(), // 右上（←外出/カテゴリ推移）
    buildCategoryTrendCard(),  // 左上
    buildTopActionsCard(),     // 左下（←トップ行動）
    buildDonutCard()           // 右下
  ];
  for (let i=0;i<cardsInOrder.length;i++) host.appendChild(cardsInOrder[i]);
}

// --- 目標UIのイベント処理 ---
// 目標UI：読み込み時にセレクトを用意し、保存で即再描画
function populateGoalSelectors() {
  const catSel = document.getElementById("goalCat");
  const actSel = document.getElementById("goalAct");
  if (!catSel || !actSel) return;

  // カテゴリ一覧を埋める
  catSel.innerHTML = "";
  tree.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    catSel.appendChild(opt);
  });

  // カテゴリ選択時に行動一覧を更新
  catSel.addEventListener("change", () => {
    const catName = catSel.value;
    const cat = tree.find(c => c.name === catName);
    actSel.innerHTML = "";

    // （カテゴリ全体）
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "全体";
    actSel.appendChild(allOpt);

    if (cat?.actions) {
      cat.actions.forEach(act => {
        const opt = document.createElement("option");
        opt.value = act.name;
        opt.textContent = act.name;
        actSel.appendChild(opt);
      });
    }
  });

  // 初期状態
  if (tree.length > 0) {
    catSel.value = tree[0].name;
    catSel.dispatchEvent(new Event("change"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const inputValue = document.getElementById("goalValue");
  const saveBtn    = document.getElementById("saveGoal");

  populateGoalSelectors();

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const catSel = document.getElementById("goalCat");
      const actSel = document.getElementById("goalAct");
      const v = parseFloat(inputValue.value);

      if (!catSel.value || isNaN(v)) {
        alert("カテゴリと数値を入力してください");
        return;
      }

      const target = actSel.value
        ? `act:${catSel.value} / ${actSel.value}`
        : `cat:${catSel.value}`;

      saveGoal(target, v);

      const ymd = document.getElementById("datePick")?.value || fmtDate(new Date());
      renderCharts("day", ymd);
    });
  }
});


function populateGoalSelect() {
  const sel = document.getElementById('goalTarget');
  const val = document.getElementById('goalValue');
  if (!sel) return;

  sel.innerHTML = '';

  tree.forEach(cat => {
    const og = document.createElement('optgroup');
    og.label = cat.name;

    // カテゴリ本体の option
    const catOpt = document.createElement('option');
    catOpt.value = `cat:${cat.name}`;
    catOpt.textContent = `（全体）${cat.name}`;
    og.appendChild(catOpt);

    // 行動の option
    (cat.actions || []).forEach(act => {
      const actOpt = document.createElement('option');
      actOpt.value = `act:${cat.name} / ${act.name}`;
      actOpt.textContent = `└ ${act.name}`;
      og.appendChild(actOpt);
    });

    sel.appendChild(og);
  });

  // 保存済み選択を復元
  const saved = loadGoal();
  if (saved) {
    if ([...sel.options].some(o => o.value === saved.target)) sel.value = saved.target;
    if (typeof saved.value === 'number' && val) val.value = saved.value;
  }
}
/* =========================================================
   ==== Gemini API 連携 ここから ===========================
   =======================================================*/

// ローカル保存キー
const LS_GEM_KEY    = 'gem.key';
const LS_GEM_MODEL  = 'gem.model';
const LS_GEM_PROMPT = 'gem.prompt';
const LS_GEM_SUMMARY_PROMPT = 'gem.summaryPrompt'; // ★追加

// 既定値
const DEFAULT_MODEL  = 'gemini-1.5-flash';
const DEFAULT_SYSTEM = '短く具体的に。褒め→改善→明日の一歩の順で3行以内。「〜しましょう」で優しく。';

// 設定の取得/保存
function getGeminiConfig(){
  return {
    key:    localStorage.getItem(LS_GEM_KEY)    || '',
    model:  localStorage.getItem(LS_GEM_MODEL)  || DEFAULT_MODEL,
    system: localStorage.getItem(LS_GEM_PROMPT) || DEFAULT_SYSTEM,
    summary: localStorage.getItem(LS_GEM_SUMMARY_PROMPT) || ''  // ★追加
  };
}
function setGeminiConfig({key, model, system, summary}) {
  if(key   != null) localStorage.setItem(LS_GEM_KEY, key);
  if(model != null) localStorage.setItem(LS_GEM_MODEL, model);
  if(system!= null) localStorage.setItem(LS_GEM_PROMPT, system);
  if(summary != null) localStorage.setItem(LS_GEM_SUMMARY_PROMPT, summary);
}


function openAiSettings(){
  const wrap = document.getElementById('aiSettingsWrap');
  if(!wrap) return;
  const {key,model,system,summary} = getGeminiConfig();
  document.getElementById('gemApiKey').value       = key;
  document.getElementById('gemModel').value        = model;
  document.getElementById('gemSystemPrompt').value = system;
  document.getElementById('gemSummaryPrompt').value = summary;
  wrap.classList.remove('hidden');
}

document.getElementById('saveGemSettings')?.addEventListener('click',()=>{
  const key     = document.getElementById('gemApiKey').value.trim();
  const model   = document.getElementById('gemModel').value;
  const system  = document.getElementById('gemSystemPrompt').value.trim();
  const summary = document.getElementById('gemSummaryPrompt').value.trim();
  setGeminiConfig({key,model,system,summary});
  document.getElementById('aiSettingsWrap').classList.add('hidden');
  alert('Gemini API設定を保存しました');
});



// プロンプト生成（その日のログをまとめてAIへ渡す）
function buildAdvicePrompt(dateStr){
  const txt = buildBlogText(dateStr);
  const { system } = getGeminiConfig();
  return `${system}\n\n--- 今日の記録 ---\n${txt}`;
}

// API呼び出し
async function fetchAdviceFromGemini(promptText, { signal } = {}){
  const { key, model } = getGeminiConfig();
  if(!key){ alert('Gemini APIキーを設定してください'); throw new Error('no key'); }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{ role:'user', parts:[{ text: promptText }] }],
    generationConfig: { temperature:0.7, maxOutputTokens:400 }
  };

  const res = await fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body), signal
  });
  if(!res.ok){ throw new Error(await res.text()); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '（AI応答なし）';
}

// ボタンにバインド
bindTap(document.getElementById('openAiSettingsBlog'), openAiSettings);
bindTap(document.getElementById('openAiSettingsAnalysis'), openAiSettings);

// 閉じるボタンも data-close に合わせる
document.querySelectorAll('[data-close="aiSettings"]').forEach(b =>
  b.addEventListener('click', () =>
    document.getElementById('aiSettingsWrap')?.classList.add('hidden')
  )
);

// ===== AIアドバイス保存・取得 =====
const LS_AI_ADVICE = "aiAdvice.v1";

function loadAiAdvice() {
  try {
    return JSON.parse(localStorage.getItem(LS_AI_ADVICE) || "{}");
  } catch {
    return {};
  }
}

function saveAiAdvice(obj) {
  localStorage.setItem(LS_AI_ADVICE, JSON.stringify(obj));
}
document.getElementById("genAdvice")?.addEventListener("click", async () => {
  const date = document.getElementById("blogDate").value || fmtDate(new Date());
  const prompt = buildAdvicePrompt(date);
  const advice = await fetchAdviceFromGemini(prompt);

  const all = loadAiAdvice();
  all[date] = advice;
  saveAiAdvice(all);

  renderAiAdvice(date);
  renderAiAdviceList();
});
function renderAiAdvice(date) {
  const all = loadAiAdvice();
  const advice = all[date] || "まだアドバイスはありません。";
  const el = document.getElementById("aiAdvicePreview");
  if (el) el.textContent = advice;
}
function renderAiAdviceList() {
  const list = document.getElementById("aiAdviceList");
  if (!list) return;
  list.innerHTML = "";

  const all = loadAiAdvice();
  const dates = Object.keys(all).sort().reverse();

  if (dates.length === 0) {
    list.textContent = "まだAIアドバイスはありません。";
    return;
  }

  dates.forEach(date => {
    const advice = all[date];
    const d = new Date(date + "T00:00:00");

    const wrapper = document.createElement("div");
    wrapper.className = "card";
    wrapper.style.margin = "8px 0";
    wrapper.style.overflow = "hidden";

    const header = document.createElement("div");
    header.style.cssText = `
      font-weight:bold; padding:8px; cursor:pointer;
      background:#f3f4f6; border-bottom:1px solid #ddd;
    `;
    header.textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

    const body = document.createElement("div");
    body.style.cssText = "padding:8px; display:none;";
    body.innerHTML = `<pre style="white-space:pre-wrap;margin:0;">${advice}</pre>`;

    header.addEventListener("click", () => {
      body.style.display = body.style.display === "block" ? "none" : "block";
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    list.appendChild(wrapper);
  });
}
const bd = document.getElementById("blogDate");
if (bd) {
  bd.addEventListener("change", e => renderAiAdvice(e.target.value));
  renderAiAdvice(bd.value || fmtDate(new Date()));
}
renderAiAdviceList();

function buildSummaryPrompt(tab, baseDate) {
  const days = collectRange(tab, baseDate).map(e => e.date);
  const uniqDays = [...new Set(days)].sort();

  let txt = "";
  uniqDays.forEach(d => {
    txt += "\n" + buildBlogText(d);
  });

  const { summary, system } = getGeminiConfig();
  const prompt = summary || system;  // ★自己分析用があれば優先

  return `${prompt}
--- 期間まとめ（${tab}） ---
${txt}`;
}


function renderAnalysis(){
  const ad = document.getElementById("analysisDate");
  if (ad && ad.value !== selectedDate) ad.value = selectedDate;
}

document.getElementById("analysisDate")?.addEventListener("change", e=>{
  selectedDate = e.target.value;
});

document.getElementById("genWeekSummary")?.addEventListener("click", async ()=>{
  const prompt = buildSummaryPrompt('week', selectedDate);
  const advice = await fetchAdviceFromGemini(prompt);
  document.getElementById("summaryAdvicePreview").textContent = advice;
});

document.getElementById("genMonthSummary")?.addEventListener("click", async ()=>{
  const prompt = buildSummaryPrompt('month', selectedDate);
  const advice = await fetchAdviceFromGemini(prompt);
  document.getElementById("summaryAdvicePreview").textContent = advice;
});

document.getElementById("copySummary")?.addEventListener("click", ()=>{
  const txt=document.getElementById("summaryAdvicePreview").textContent;
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(txt);
  alert("自己分析コメントをコピーしました");
});

bindTap(document.getElementById('goAnalysis'), ()=>showView('analysis'));
bindTap(document.getElementById('toHomeFromAnalysis'), ()=>showView('home'));

// ローカル保存キー
const LS_SUMMARIES = "aiSummaries.v1";

// 保存・読込
function loadSummaries() {
  try { return JSON.parse(localStorage.getItem(LS_SUMMARIES) || "[]"); }
  catch { return []; }
}
function saveSummaries(arr) {
  localStorage.setItem(LS_SUMMARIES, JSON.stringify(arr));
}

// まとめ生成（期間指定）
document.getElementById("genCustomSummary")?.addEventListener("click", async ()=>{
  const start = document.getElementById("summaryStart").value;
  const end   = document.getElementById("summaryEnd").value;
  if(!start || !end) { alert("開始日と終了日を入力してください"); return; }

  // 指定範囲の記録をまとめる
  const range = entries.filter(e => e.date >= start && e.date <= end);
  if(range.length === 0) { alert("この期間には記録がありません"); return; }

  let txt = "";
  [...new Set(range.map(e=>e.date))].sort().forEach(d=>{
    txt += "\n" + buildBlogText(d);
  });

  const { summary, system } = getGeminiConfig();
  const prompt = (summary || system) + `\n--- 記録まとめ (${start}〜${end}) ---\n${txt}`;

  const advice = await fetchAdviceFromGemini(prompt);
  document.getElementById("summaryAdvicePreview").textContent = advice;
});

// 保存
document.getElementById("saveSummary")?.addEventListener("click", ()=>{
  const start = document.getElementById("summaryStart").value;
  const end   = document.getElementById("summaryEnd").value;
  const txt   = document.getElementById("summaryAdvicePreview").textContent;
  if(!txt) { alert("まとめがありません"); return; }

  const all = loadSummaries();
  all.push({ id: rid(), start, end, text: txt, created: Date.now() });
  saveSummaries(all);
  renderSummaryList();
  alert("まとめを保存しました");
});

// 削除（プレビューのみ）
document.getElementById("deleteSummary")?.addEventListener("click", ()=>{
  document.getElementById("summaryAdvicePreview").textContent = "";
  alert("プレビューを削除しました");
});

// AIアドバイス削除
document.getElementById("deleteAiAdvice")?.addEventListener("click", ()=>{
  const date = document.getElementById("blogDate").value;
  if(!date){ alert("日付を選択してください"); return; }

  if(!confirm("この日のAIアドバイスを削除しますか？")) return;

  const all = loadAiAdvice();
  delete all[date];
  saveAiAdvice(all);

  document.getElementById("aiAdvicePreview").textContent = "";
  document.getElementById("checkAiAdvice").textContent = "（まだアドバイスはありません）";

  alert("AIアドバイスを削除しました。");
});

// 一覧描画
function renderSummaryList() {
  const list = document.getElementById("summaryList");
  if (!list) return;
  list.innerHTML = "";

  const all = loadSummaries().sort((a,b)=> b.created - a.created);
  if (all.length === 0) {
    list.textContent = "まだ保存されたまとめはありません。";
    return;
  }

  all.forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.margin = "6px 0";

    const head = document.createElement("div");
    head.style.cssText = `
      display:flex;
      justify-content:space-between;
      align-items:center;
      font-weight:bold;
      padding:6px;
      cursor:pointer;
      background:#f3f4f6;
      border-bottom:1px solid #ddd;
    `;
    head.innerHTML = `
      <span>${item.start}〜${item.end}</span>
      <button class="btn danger btn-small" data-del="${item.id}">削除</button>
    `;

    const body = document.createElement("div");
    body.style.cssText = "padding:8px;display:none;";
    body.innerHTML = `<pre style="white-space:pre-wrap;margin:0;">${item.text}</pre>`;

    // タイトルクリックで開閉
    head.querySelector("span").addEventListener("click", ()=> {
      body.style.display = (body.style.display==="block" ? "none" : "block");
    });

    // 削除ボタン
    head.querySelector("[data-del]").addEventListener("click", (e)=>{
      e.stopPropagation(); // 折り畳みイベントを防ぐ
      const id = e.target.getAttribute("data-del");
      const newAll = all.filter(s => s.id !== id);
      saveSummaries(newAll);
      renderSummaryList(); // 再描画
    });

    wrap.appendChild(head);
    wrap.appendChild(body);
    list.appendChild(wrap);
  });
}


// 起動時に一覧表示
renderSummaryList();


/* =========================================================
   ==== Gemini API 連携 ここまで ===========================
   =======================================================*/
