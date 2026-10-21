// หลัง deploy Worker แล้ว ใส่ URL ของ Worker ตรงนี้ เช่น "https://expense-ai.ชื่อคุณ.workers.dev"
const AI_URL = "https://expense-ai.phuriphat-zxc84.workers.dev";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const DEF_CATS = {
  exp: ['อาหาร', 'เดินทาง', 'ของใช้', 'บิล/ค่าบริการ', 'บันเทิง', 'สุขภาพ', 'อื่นๆ'],
  inc: ['เงินเดือน', 'รายได้เสริม', 'ของขวัญ', 'อื่นๆ']
};
const CATS = new Proxy({}, { get: (_, k) => cfg.cats[k] });
const KW = {
  'อาหาร': ['ข้าว', 'ก๋วยเตี๋ยว', 'กาแฟ', 'ชา', 'อาหาร', 'ขนม', 'น้ำ', 'หมู', 'ไก่', 'ส้มตำ', 'กิน', 'ชานม'],
  'เดินทาง': ['รถ', 'น้ำมัน', 'แท็กซี่', 'bts', 'mrt', 'วิน', 'เดินทาง', 'grab', 'ทางด่วน'],
  'ของใช้': ['ซื้อ', 'สบู่', 'เสื้อ', 'ของใช้', 'ตลาด', 'ห้าง'],
  'บิล/ค่าบริการ': ['ค่าไฟ', 'ค่าน้ำ', 'ค่าเช่า', 'เน็ต', 'โทรศัพท์', 'บิล', 'ผ่อน'],
  'บันเทิง': ['หนัง', 'เกม', 'เที่ยว', 'คอนเสิร์ต', 'netflix', 'ปาร์ตี้'],
  'สุขภาพ': ['ยา', 'หมอ', 'โรงพยาบาล', 'ฟิตเนส', 'วิตามิน'],
  'เงินเดือน': ['เงินเดือน', 'salary'],
  'รายได้เสริม': ['ขาย', 'ฟรีแลนซ์', 'งานเสริม', 'โบนัส'],
  'ของขวัญ': ['ของขวัญ', 'ได้รับ', 'แม่ให้', 'พ่อให้']
};
const GOALS = {
  save: { label: 'เก็บเงิน', rate: .3, wk: [1, 1, 1, 1, 1, .8, .8] },
  worth: { label: 'ใช้ให้คุ้ม', rate: .1, wk: [1, 1, 1, 1, 1.2, 1.4, 1.2] },
  bal: { label: 'สมดุล', rate: .2, wk: [1, 1, 1, 1, 1, 1, 1] }
};
const VIEWS = [['home', 'หน้าหลัก'], ['transactions', 'รายการ'], ['summary', 'สรุป'], ['planner', 'วางแผน'], ['accounts', 'บัญชี'], ['goals', 'เป้าหมาย'], ['settings', 'ตั้งค่า']];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
let tx = load('tx', []), plan = load('plan', { goal: 'bal', income: '', fixed: '' }), sync = load('sync', { code: '', del: {} }),
  cfg = load('cfg', null) || { cats: JSON.parse(JSON.stringify(DEF_CATS)), accs: [{ id: 'cash', name: 'เงินสด', open: 0 }], budgets: {}, goals: [], u: 0 };
cfg.goals = cfg.goals || []; cfg.budgets = cfg.budgets || {};
let type = 'exp', editId = null, lastId = null, catTouched = false, period = 'month';
const persist = () => { localStorage.setItem('tx', JSON.stringify(tx)); localStorage.setItem('plan', JSON.stringify(plan)); localStorage.setItem('sync', JSON.stringify(sync)); localStorage.setItem('cfg', JSON.stringify(cfg)); };
const save = () => { persist(); queueSync(); };
const iso = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const fmt = n => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = (a, t) => a.filter(x => x.type === t).reduce((s, x) => s + x.amount, 0);
const inRange = (days) => { const f = new Date(); f.setDate(f.getDate() - days + 1); return tx.filter(x => x.date >= iso(f)); };
const thisMonth = () => tx.filter(x => x.date.slice(0, 7) === today().slice(0, 7));

/* ---------- Smart Text Parser ---------- */
function parse(t) {
  const nums = t.match(/\d[\d,]*\.?\d*/g);
  if (!nums) return { name: t.trim(), amount: 0 };
  const last = nums[nums.length - 1];
  const i = t.lastIndexOf(last);
  const name = (t.slice(0, i) + t.slice(i + last.length)).replace(/บาท|฿|baht|บ\./gi, '').replace(/\s+/g, ' ').trim();
  return { name: name || 'ไม่ระบุชื่อ', amount: parseFloat(last.replace(/,/g, '')) || 0 };
}
function guess(name) {
  const n = name.toLowerCase(), all = [...cfg.cats.exp, ...cfg.cats.inc];
  const own = all.find(c => c !== 'อื่นๆ' && n.includes(c.toLowerCase()));
  if (own) return own;
  for (const c in KW) if (all.includes(c) && KW[c].some(k => n.includes(k))) return c;
  return null;
}
function fillCats() {
  const cur = $('#cat').value;
  $('#cat').innerHTML = CATS[type].map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (CATS[type].includes(cur)) $('#cat').value = cur;
}
function setType(t) {
  type = t;
  $$('.tg').forEach(b => b.classList.toggle('on', b.dataset.type === t));
  fillCats();
}

/* ---------- Form ---------- */
$('#text').addEventListener('input', e => {
  const p = parse(e.target.value);
  if (!e.target.value.trim()) { $('#preview').textContent = ''; $('#nameIn').value = ''; $('#amtIn').value = ''; return; }
  const g = guess(p.name);
  if (g && !catTouched) {
    const t = CATS.inc.includes(g) && !CATS.exp.includes(g) ? 'inc' : CATS.exp.includes(g) ? 'exp' : type;
    if (t !== type) setType(t);
    $('#cat').value = g;
  }
  $('#nameIn').value = p.name === 'ไม่ระบุชื่อ' ? '' : p.name; $('#amtIn').value = p.amount || '';
});
$('#cat').addEventListener('change', () => catTouched = true);
$$('.tg').forEach(b => b.onclick = () => setType(b.dataset.type));
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const p = { name: $('#nameIn').value.trim() || 'ไม่ระบุชื่อ', amount: parseFloat($('#amtIn').value) };
  if (!(p.amount > 0)) { $('#preview').innerHTML = '<span class="text-exp">ใส่จำนวนเงินด้วย เช่น ก๋วยเตี๋ยว 50</span>'; return; }
  const rec = { id: editId || Date.now(), name: p.name, amount: p.amount, type, cat: $('#cat').value, acc: $('#accSel').value, date: $('#date').value || today(), u: Date.now() };
  tx = editId ? tx.map(x => x.id === editId ? rec : x) : [...tx, rec];
  lastId = rec.id; save(); resetForm(); renderAll(); lastId = null; afterSave(rec);
});
$('#cancelEdit').onclick = resetForm;
function resetForm() {
  editId = null; catTouched = false;
  $('#text').value = ''; $('#nameIn').value = ''; $('#amtIn').value = ''; $('#preview').textContent = ''; $('#date').value = today();
  $('#saveBtn').textContent = 'บันทึกข้อมูล'; $('#cancelEdit').classList.add('hidden');
  setType('exp');
}
window.edit = id => {
  const x = tx.find(t => t.id === id); if (!x) return;
  editId = id; catTouched = true; setType(x.type);
  $('#text').value = ''; $('#nameIn').value = x.name; $('#amtIn').value = x.amount; if (![...$('#cat').options].some(o => o.value === x.cat)) $('#cat').add(new Option(x.cat, x.cat)); $('#cat').value = x.cat; $('#date').value = x.date; if (x.acc) $('#accSel').value = x.acc;
  $('#saveBtn').textContent = 'อัปเดตข้อมูล'; $('#cancelEdit').classList.remove('hidden');
  location.hash = 'home'; window.scrollTo({ top: 0, behavior: 'smooth' }); $('#text').focus();
};
window.del = id => { if (confirm('ลบรายการนี้?')) { tx = tx.filter(x => x.id !== id); sync.del[id] = Date.now(); save(); renderAll(); } };

/* ---------- Render ---------- */
const accName = id => cfg.accs.find(a => a.id === id)?.name || '';
const rowHTML = x => {
  const tf = x.type === 'tf', exp = x.type === 'exp';
  const sub = tf ? `ย้ายเงิน · ${x.date}` : `${esc(x.cat)}${accName(x.acc) ? ' · ' + esc(accName(x.acc)) : ''} · ${x.date}`;
  return `<div class="row ${x.id === lastId ? 'new' : ''} px-4 py-3 flex items-center gap-3">
  <span class="w-1.5 self-stretch rounded ${tf ? 'bg-tf' : exp ? 'bg-exp' : 'bg-inc'}"></span>
  <div class="flex-1 min-w-0"><div class="font-medium truncate">${tf ? esc(accName(x.from) + ' → ' + accName(x.to)) : esc(x.name)}</div><div class="text-xs text-mute">${sub}</div></div>
  <div class="font-bold ${tf ? 'text-mute' : exp ? 'text-exp' : 'text-inc'}">${tf ? '⇄ ' : exp ? '−' : '+'}${fmt(x.amount)}</div>
  ${tf ? '' : `<button onclick="edit(${x.id})" class="text-mute px-1" aria-label="แก้ไข">✎</button>`}
  <button onclick="del(${x.id})" class="text-mute px-1" aria-label="ลบ">✕</button></div>`;
};
const sorted = a => [...a].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const card = (l, v, c) => `<div class="bg-white border border-line rounded-xl p-3"><div class="text-xs text-mute">${l}</div><div class="font-bold text-base sm:text-xl ${c}">${fmt(v)}</div></div>`;

function renderHome() {
  const m = thisMonth(), i = sum(m, 'inc'), e = sum(m, 'exp');
  $('#cards').innerHTML = card('รายรับเดือนนี้', i, 'text-inc') + card('รายจ่ายเดือนนี้', e, 'text-exp') + card('คงเหลือเดือนนี้', i - e, i - e < 0 ? 'text-exp' : '');
  $('#recent').innerHTML = tx.length ? sorted(tx).slice(0, 5).map(rowHTML).join('') : '<p class="p-6 text-center text-mute">ยังไม่มีรายการ ลองพิมพ์ “กาแฟ 60” ด้านบน</p>';
}
function renderTx() {
  const q = $('#q').value.trim().toLowerCase(), f = $('#ftype').value;
  const list = sorted(tx).filter(x => (f === 'all' || x.type === f) && (!q || (x.name + x.cat).toLowerCase().includes(q)));
  if (!list.length) { $('#txList').innerHTML = '<p class="p-6 text-center text-mute bg-white border border-line rounded-xl">ไม่พบรายการ</p>'; return; }
  const byMonth = {};
  list.forEach(x => ((byMonth[x.date.slice(0, 7)] ??= {})[x.date] ??= []).push(x));
  $('#txList').innerHTML = Object.keys(byMonth).map(mo => {
    const label = new Date(mo + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const days = Object.keys(byMonth[mo]).map(d => {
      const arr = byMonth[mo][d], net = sum(arr, 'inc') - sum(arr, 'exp');
      return `<div class="px-4 py-2 bg-paper text-sm flex justify-between"><span>${new Date(d).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="text-mute">สุทธิ ${fmt(net)}</span></div>${arr.map(rowHTML).join('')}`;
    }).join('');
    return `<div><h2 class="font-bold mb-2">${label}</h2><div class="bg-white border border-line rounded-xl overflow-hidden">${days}</div></div>`;
  }).join('');
}
function renderSummary() {
  const P = { today: ['วันนี้', 1], month: ['เดือนนี้', 0], q: ['3 เดือน', 90] };
  $('#periodTabs').innerHTML = Object.entries(P).map(([k, v]) => `<button class="tab ${k === period ? 'on' : ''}" data-p="${k}">${v[0]}</button>`).join('');
  $$('#periodTabs .tab').forEach(b => b.onclick = () => { period = b.dataset.p; renderSummary(); });
  const data = period === 'today' ? tx.filter(x => x.date === today()) : period === 'month' ? thisMonth() : inRange(90);
  const ex = data.filter(x => x.type === 'exp'), e = sum(data, 'exp'), i = sum(data, 'inc');
  if (!data.length) { $('#sumBody').innerHTML = '<p class="p-6 text-center text-mute bg-white border border-line rounded-xl">ช่วงนี้ยังไม่มีรายการ</p>'; return; }
  const cats = {}; ex.forEach(x => cats[x.cat] = (cats[x.cat] || 0) + x.amount);
  const days = new Set(ex.map(x => x.date)).size || 1;
  const top = [...ex].sort((a, b) => b.amount - a.amount).slice(0, 5);
  $('#sumBody').innerHTML = `
  <div class="grid grid-cols-3 gap-2">${card('รายรับ', i, 'text-inc')}${card('รายจ่าย', e, 'text-exp')}${card('เฉลี่ย/วัน', e / days, '')}</div>
  <div class="bg-white border border-line rounded-xl p-4 space-y-3"><h2 class="font-bold">ใช้เงินไปกับอะไรบ้าง</h2>
  ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div><div class="flex justify-between text-sm mb-1"><span>${esc(c)}</span><span>${fmt(v)} (${Math.round(v / e * 100)}%)</span></div><div class="bar" style="width:${v / e * 100}%"></div></div>`).join('') || '<p class="text-mute text-sm">ไม่มีรายจ่าย</p>'}</div>
  <div class="bg-white border border-line rounded-xl"><h2 class="font-bold px-4 py-3 border-b border-line">รายจ่ายสูงสุด</h2>${top.map(rowHTML).join('') || '<p class="p-4 text-mute text-sm">ไม่มีรายจ่าย</p>'}</div>`;
}

/* ---------- Planner (rule-based advisor) ---------- */
function renderPlan() {
  $('#goalTabs').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button class="tab ${k === plan.goal ? 'on' : ''}" data-g="${k}">${g.label}</button>`).join('');
  $$('#goalTabs .tab').forEach(b => b.onclick = () => { plan.goal = b.dataset.g; plan.u = Date.now(); save(); renderPlan(); });
  const g = GOALS[plan.goal], now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const dim = new Date(y, mo + 1, 0).getDate(), left = dim - now.getDate() + 1;
  const m = thisMonth(), income = +plan.income || sum(m, 'inc'), fixed = +plan.fixed || 0;
  if (!income) { $('#planBody').innerHTML = '<p class="p-6 text-center text-mute bg-white border border-line rounded-xl">ใส่รายได้ต่อเดือน หรือบันทึกรายรับเดือนนี้ก่อน เพื่อให้ระบบคำนวณแผน</p>'; return; }
  const goalSave = income * g.rate, budget = income - fixed - goalSave, spent = sum(m, 'exp') - fixed * 0, remain = budget - sum(m, 'exp');
  // spending mix from last 3 months
  const ex = inRange(90).filter(x => x.type === 'exp'), tot = sum(ex, 'exp'), mix = {};
  ex.forEach(x => mix[x.cat] = (mix[x.cat] || 0) + x.amount);
  const share = tot ? Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, v / tot]) : [['อาหาร', .4], ['เดินทาง', .2], ['ของใช้', .15], ['บันเทิง', .15], ['อื่นๆ', .1]];
  const ws = [], dates = [];
  for (let d = now.getDate(); d <= dim; d++) { const dt = new Date(y, mo, d); dates.push(dt); ws.push(g.wk[(dt.getDay() + 6) % 7]); }
  const wsum = ws.reduce((a, b) => a + b, 0), perUnit = Math.max(remain, 0) / wsum;
  const todaySpent = sum(tx.filter(x => x.date === today()), 'exp'), todayBudget = perUnit * ws[0];
  const tips = [];
  if (remain < 0) tips.push(`เดือนนี้ใช้เกินงานไปแล้ว ${fmt(-remain)} บาท ลองงดรายจ่ายที่ไม่จำเป็นหรือลดเป้าออม`);
  if (share[0] && tot && share[0][1] > .4) tips.push(`“${share[0][0]}” กินสัดส่วน ${Math.round(share[0][1] * 100)}% ของรายจ่าย 3 เดือนล่าสุด เป็นหมวดที่ลดได้ผลที่สุด`);
  if (plan.goal === 'save') tips.push(`เป้าออมเดือนนี้ ${fmt(goalSave)} บาท โอนเข้าบัญชีออมทันทีที่เงินเข้า จะง่ายกว่าเก็บทีหลัง`);
  if (plan.goal === 'worth') tips.push('วันศุกร์–เสาร์ได้งบมากกว่าปกติ เก็บไว้ใช้กับสิ่งที่ชอบจริงๆ และตัดรายจ่ายเล็กๆ ที่ไม่ได้ใช้');
  if (plan.goal === 'bal') tips.push('แบ่งงบเท่ากันทุกวัน ถ้าวันไหนเหลือ ระบบจะกระจายให้วันที่เหลือเอง');
  $('#planBody').innerHTML = `
  <div class="bg-ink text-white rounded-xl p-5"><div class="text-sm opacity-80">งบวันนี้</div>
    <div class="text-4xl font-bold">${fmt(Math.max(todayBudget - todaySpent, 0))} <span class="text-lg font-normal">บาท</span></div>
    <div class="text-sm opacity-80 mt-1">ใช้ไปแล้ว ${fmt(todaySpent)} จากงบ ${fmt(todayBudget)} · เหลืออีก ${left} วัน</div></div>
  <div class="grid grid-cols-3 gap-2">${card('เป้าออม/เดือน', goalSave, 'text-inc')}${card('งบใช้จ่าย/เดือน', budget, '')}${card('งบเหลือ', remain, remain < 0 ? 'text-exp' : '')}</div>
  <div class="bg-white border border-line rounded-xl p-4"><h2 class="font-bold mb-2">เคล็ดลับสำหรับคุณ</h2><ul class="list-disc pl-5 space-y-1 text-sm">${tips.map(t => `<li>${t}</li>`).join('')}</ul></div>
  <div class="bg-white border border-line rounded-xl"><h2 class="font-bold px-4 py-3 border-b border-line">แผนรายวัน (แบ่งตามสัดส่วนที่คุณใช้จริง)</h2>
   <div class="max-h-96 overflow-y-auto">${dates.map((dt, i) => {
    const b = perUnit * ws[i];
    return `<div class="row px-4 py-3"><div class="flex justify-between"><b>${dt.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</b><b>${fmt(b)} บาท</b></div>
    <div class="text-xs text-mute mt-1">${share.slice(0, 4).map(([c, s]) => `${esc(c)} ${fmt(b * s)}`).join(' · ')}</div></div>`;
  }).join('')}</div></div>`;
}
$('#pIncome').oninput = e => { plan.income = e.target.value; plan.u = Date.now(); save(); renderPlan(); };
$('#pFixed').oninput = e => { plan.fixed = e.target.value; plan.u = Date.now(); save(); renderPlan(); };

/* ---------- Settings ---------- */
$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'expense-tracker', v: 2, exportedAt: new Date().toISOString(), tx, del: sync.del, plan, cfg }, null, 2)], { type: 'application/json' }));
  a.download = `expense-${today()}.json`; a.click();
};
$('#clearBtn').onclick = () => { if (confirm('ลบข้อมูลทั้งหมดถาวร?')) { tx.forEach(x => sync.del[x.id] = Date.now()); tx = []; save(); renderAll(); } };

/* ---------- หมวดหมู่ / บัญชี / งบ / เอฟเฟกต์ ---------- */
function keepSel(el, html) { const v = el.value; el.innerHTML = html; if ([...el.options].some(o => o.value === v)) el.value = v; }
function touchCfg() { cfg.u = Date.now(); save(); }
const bal = a => tx.reduce((s, x) => {
  if (x.type === 'tf') { if (x.to === a.id) s += x.amount; if (x.from === a.id) s -= x.amount; }
  else if (x.acc === a.id) s += x.type === 'inc' ? x.amount : -x.amount;
  return s;
}, +a.open || 0);
let toastT;
function toast(m) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = m; void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}
function confetti() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c = ['#8FADEB', '#B9B2F0', '#F4A9C2', '#6FD6B8', '#FFD27A'];
  for (let i = 0; i < 48; i++) {
    const d = document.createElement('i'); d.className = 'cf';
    d.style.cssText = `left:${Math.random() * 100}vw;background:${c[i % 5]};--x:${Math.random() * 160 - 80}px;animation-delay:${Math.random() * .3}s`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2400);
  }
}
function afterSave(rec) {
  if (rec.type === 'inc') { confetti(); toast('บันทึกรายรับแล้ว 🎉'); return; }
  const b = +cfg.budgets[rec.cat];
  if (!b) { toast('บันทึกแล้ว ✓'); return; }
  const pct = sum(thisMonth().filter(x => x.cat === rec.cat), 'exp') / b * 100;
  toast(pct >= 100 ? `เกินงบ “${rec.cat}” แล้ว (${Math.round(pct)}%)` : pct >= 80 ? `ใกล้เต็มงบ “${rec.cat}” แล้ว (${Math.round(pct)}%)` : 'บันทึกแล้ว ✓');
}
function checkSaved() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const pm = iso(d).slice(0, 7); if (localStorage.getItem('cm') === pm) return;
  const m = tx.filter(x => x.date.slice(0, 7) === pm), i = sum(m, 'inc'); if (!i) return;
  localStorage.setItem('cm', pm);
  const r = (i - sum(m, 'exp')) / i;
  if (r >= GOALS[plan.goal].rate) { confetti(); toast(`เดือนที่แล้วออมได้ ${Math.round(r * 100)}% ถึงเป้าแล้ว 🎉`); }
}
function chips(el, target, vals) {
  el.innerHTML = vals.map(v => `<button type="button" data-v="${v}" class="chip">+${v}</button>`).join('') + '<button type="button" data-v="0" class="chip">ล้าง</button>';
  el.onclick = e => {
    const v = e.target.dataset.v; if (v == null) return;
    const i = $(target); i.value = v === '0' ? '' : (Math.round(((+i.value || 0) + +v) * 100) / 100 || '');
  };
}
chips($('#chips'), '#amtIn', [50, 100, 500, 1000]);
chips($('#tfChips'), '#tfAmt', [100, 500, 1000, 2000, 5000]);

function fillAccs() { keepSel($('#accSel'), cfg.accs.map(a => `<option value="${esc(a.id)}">บัญชี: ${esc(a.name)}</option>`).join('')); }
function renderAccounts() {
  const tot = cfg.accs.reduce((s, a) => s + bal(a), 0);
  $('#accBody').innerHTML = `<div class="bg-ink text-white rounded-xl p-5"><div class="text-sm opacity-90">ยอดรวมทุกบัญชี</div><div class="text-3xl font-bold">${fmt(tot)} <span class="text-base font-normal">บาท</span></div></div>
  <div class="grid sm:grid-cols-2 gap-3">${cfg.accs.map(a => `<div class="bg-white border border-line rounded-xl p-4">
    <div class="flex justify-between items-start gap-2"><div class="font-medium truncate">${esc(a.name)}</div><div class="shrink-0">
    <button onclick="accEdit('${a.id}')" class="text-mute px-1" aria-label="เปลี่ยนชื่อ">✎</button><button onclick="accDel('${a.id}')" class="text-mute px-1" aria-label="ลบ">✕</button></div></div>
    <div class="text-2xl font-bold ${bal(a) < 0 ? 'text-exp' : ''}">${fmt(bal(a))}</div>
    <button onclick="accAdjust('${a.id}')" class="text-xs text-mute underline mt-1">ปรับยอดให้ตรงกับของจริง</button></div>`).join('')}</div>`;
  const o = cfg.accs.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  keepSel($('#tfFrom'), o); keepSel($('#tfTo'), o);
  if ($('#tfFrom').value === $('#tfTo').value && cfg.accs.length > 1) $('#tfTo').selectedIndex = ($('#tfFrom').selectedIndex + 1) % cfg.accs.length;
}
window.accEdit = id => { const a = cfg.accs.find(x => x.id === id); const n = (prompt('ชื่อบัญชี', a.name) || '').trim(); if (n) { a.name = n; touchCfg(); renderAll(); } };
window.accAdjust = id => {
  const a = cfg.accs.find(x => x.id === id), v = prompt('ยอดเงินจริงตอนนี้ (บาท)', bal(a)); if (v === null) return;
  const n = parseFloat(v); if (isNaN(n)) return;
  a.open = Math.round(((+a.open || 0) + n - bal(a)) * 100) / 100; touchCfg(); renderAll();
};
window.accDel = id => {
  if (cfg.accs.length < 2) { toast('ต้องเหลืออย่างน้อย 1 บัญชี'); return; }
  if (cfg.goals.some(g => g.acc === id)) { toast('บัญชีนี้ผูกกับเป้าหมายอยู่ ลบหรือเปลี่ยนเป้าหมายก่อน'); return; }
  if (confirm('ลบบัญชีนี้? รายการเดิมยังอยู่ แต่จะไม่ถูกนับในยอดบัญชี')) { cfg.accs = cfg.accs.filter(x => x.id !== id); touchCfg(); renderAll(); }
};
$('#accAdd').onclick = () => {
  const n = $('#accName').value.trim(); if (!n) { toast('ใส่ชื่อบัญชีก่อน'); return; }
  cfg.accs.push({ id: 'a' + Date.now().toString(36), name: n, open: parseFloat($('#accOpen').value) || 0 });
  $('#accName').value = ''; $('#accOpen').value = ''; touchCfg(); renderAll(); toast('เพิ่มบัญชีแล้ว ✓');
};
$('#tfSwap').onclick = () => { const f = $('#tfFrom').value; $('#tfFrom').value = $('#tfTo').value; $('#tfTo').value = f; };
$('#tfGo').onclick = () => {
  const f = $('#tfFrom').value, t = $('#tfTo').value, amt = parseFloat($('#tfAmt').value);
  if (!(amt > 0)) { toast('ใส่จำนวนเงินก่อน'); return; }
  if (f === t) { toast('เลือกบัญชีต้นทางกับปลายทางให้ต่างกัน'); return; }
  tx.push({ id: Date.now(), type: 'tf', name: 'ย้ายเงิน', cat: 'ย้ายเงิน', amount: amt, from: f, to: t, date: today(), u: Date.now() });
  $('#tfAmt').value = ''; save(); renderAll(); toast('ย้ายเงินแล้ว ✓');
};

function renderBudget() {
  $('#catList').innerHTML = cfg.cats.exp.map(c => `<option value="${esc(c)}">`).join('');
  const spent = {}; thisMonth().filter(x => x.type === 'exp').forEach(x => spent[x.cat] = (spent[x.cat] || 0) + x.amount);
  const rows = Object.entries(cfg.budgets).map(([c, b]) => {
    b = +b || 0; const u = spent[c] || 0, p = b ? u / b * 100 : 0, col = p >= 100 ? '#E2557C' : p >= 80 ? '#F5A524' : '#6E8DE8';
    return `<div><div class="flex items-center gap-1 text-sm mb-1"><span class="flex-1 min-w-0 truncate font-medium">${esc(c)}</span>
      <button data-act="bedit" data-c="${esc(c)}" class="text-mute px-1" aria-label="แก้ชื่องบ">✎</button><button data-act="bdel" data-c="${esc(c)}" class="text-mute px-1" aria-label="ลบงบ">✕</button></div>
      <div class="flex items-center gap-2 text-xs text-mute mb-1"><span class="flex-1">ใช้ไป ${fmt(u)} จาก</span><input type="number" min="0" step="any" inputmode="decimal" data-c="${esc(c)}" value="${b}" aria-label="งบ ${esc(c)}" class="w-28 px-2 py-1.5 border border-line rounded-lg text-right text-ink"></div>
      <div class="pb"><i style="width:${Math.min(p, 100)}%;background:${col}"></i></div>
      <div class="text-xs mt-1" style="color:${col}">${p >= 100 ? 'เกินงบ ' + fmt(u - b) + ' บาท' : p >= 80 ? 'ใกล้เต็มงบแล้ว (' + Math.round(p) + '%)' : 'ใช้ไป ' + Math.round(p) + '%'}</div></div>`;
  });
  $('#budgetList').innerHTML = rows.join('') || '<p class="text-sm text-mute">ยังไม่มีงบ เพิ่มด้านล่างได้เลย เช่น อาหาร 5,000</p>';
}
$('#budgetList').onchange = e => {
  const c = e.target.dataset.c; if (c == null || e.target.tagName !== 'INPUT') return;
  const v = parseFloat(e.target.value);
  if (v > 0) { cfg.budgets[c] = v; touchCfg(); } else toast('ใส่งบมากกว่า 0 หรือกด ✕ เพื่อลบงบ');
  renderBudget();
};
$('#budgetList').onclick = e => {
  const b = e.target.closest('button[data-act]'); if (!b) return; const c = b.dataset.c;
  if (b.dataset.act === 'bdel') { if (confirm(`ลบงบ “${c}”? หมวดหมู่และรายการยังอยู่ครบ`)) { delete cfg.budgets[c]; touchCfg(); renderAll(); } return; }
  const i = cfg.cats.exp.indexOf(c);
  if (i >= 0) { window.catEdit('exp', i); return; }
  const n = (prompt('ชื่องบใหม่', c) || '').trim(); if (!n || n === c || cfg.budgets[n] != null) return;
  cfg.budgets[n] = cfg.budgets[c]; delete cfg.budgets[c]; touchCfg(); renderAll();
};
$('#budAdd').onclick = () => {
  const n = $('#budName').value.trim(), v = parseFloat($('#budAmt').value);
  if (!n) { toast('ใส่ชื่องบก่อน'); return; }
  if (!(v > 0)) { toast('ใส่จำนวนงบก่อน'); return; }
  if (cfg.budgets[n] != null) { toast('มีงบนี้อยู่แล้ว แก้ตัวเลขในรายการได้เลย'); return; }
  if (!cfg.cats.exp.includes(n)) cfg.cats.exp.push(n);
  cfg.budgets[n] = v; $('#budName').value = ''; $('#budAmt').value = ''; touchCfg(); renderAll(); toast('เพิ่มงบแล้ว ✓');
};

function renderCats() {
  const sec = (t, title) => `<div><h3 class="font-medium mb-2">${title}</h3><div class="space-y-1.5">${cfg.cats[t].map((c, i) => `<div class="item"><span class="flex-1 truncate">${esc(c)}</span>
    <button onclick="catEdit('${t}',${i})" class="text-mute px-1" aria-label="แก้ชื่อ">✎</button><button onclick="catDel('${t}',${i})" class="text-mute px-1" aria-label="ลบ">✕</button></div>`).join('')}</div>
    <div class="flex gap-2 mt-2"><input data-add="${t}" maxlength="20" placeholder="เพิ่มหมวดใหม่" class="flex-1 min-w-0 px-3 py-2.5 border border-line rounded-lg"><button onclick="catAdd('${t}')" class="px-4 rounded-lg bg-ink text-white">เพิ่ม</button></div></div>`;
  $('#catBox').innerHTML = '<h2 class="font-semibold">จัดการหมวดหมู่</h2>' + sec('exp', 'หมวดรายจ่าย') + sec('inc', 'หมวดรายรับ');
}
window.catAdd = t => {
  const n = document.querySelector(`[data-add="${t}"]`).value.trim(); if (!n) return;
  if (cfg.cats[t].includes(n)) { toast('มีหมวดนี้อยู่แล้ว'); return; }
  cfg.cats[t].push(n); touchCfg(); renderAll();
};
window.catEdit = (t, i) => {
  const o = cfg.cats[t][i], n = (prompt('ชื่อหมวดใหม่', o) || '').trim(); if (!n || n === o) return;
  if (cfg.cats[t].includes(n)) { toast('มีหมวดนี้อยู่แล้ว'); return; }
  cfg.cats[t][i] = n;
  tx.forEach(x => { if (x.type === t && x.cat === o) { x.cat = n; x.u = Date.now(); } });
  if (t === 'exp' && cfg.budgets[o] != null) { cfg.budgets[n] = cfg.budgets[o]; delete cfg.budgets[o]; }
  touchCfg(); renderAll();
};
window.catDel = (t, i) => {
  if (cfg.cats[t].length < 2) { toast('ต้องเหลืออย่างน้อย 1 หมวด'); return; }
  const o = cfg.cats[t][i]; if (!confirm(`ลบหมวด “${o}”? รายการเดิมยังอยู่ในชื่อเดิม`)) return;
  cfg.cats[t].splice(i, 1); delete cfg.budgets[o]; touchCfg(); renderAll();
};

/* ---------- เป้าหมายการออม ---------- */
let goalEditId = null;
const goalAcc = g => cfg.accs.find(a => a.id === g.acc);
const goalNow = g => { const a = goalAcc(g); return a ? bal(a) : 0; };
function fillGoalAccs() {
  const used = new Set(cfg.goals.filter(g => g.id !== goalEditId).map(g => g.acc));
  const free = cfg.accs.filter(a => !used.has(a.id));
  keepSel($('#gAcc'), free.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join(''));
  $('#gHint').textContent = free.length ? '' : 'ทุกบัญชีมีเป้าหมายแล้ว ไปเพิ่มบัญชีใหม่ในหน้า “บัญชี” ก่อน';
}
function resetGoalForm() {
  goalEditId = null; $('#gName').value = ''; $('#gTarget').value = '';
  $('#gSave').textContent = 'สร้างเป้าหมาย'; $('#gTitle').textContent = 'สร้างเป้าหมายใหม่'; $('#gCancel').classList.add('hidden'); fillGoalAccs();
}
function renderGoals() {
  fillGoalAccs();
  $('#goalList').innerHTML = cfg.goals.map(g => {
    const a = goalAcc(g), now = goalNow(g), p = g.target > 0 ? now / g.target * 100 : 0, done = p >= 100;
    return `<div class="bg-white border border-line rounded-xl p-4 ${done ? 'goal-done' : ''}">
      <div class="flex justify-between items-start gap-2"><div class="font-medium truncate">${esc(g.name)}</div><div class="shrink-0">
      <button data-act="gedit" data-id="${esc(g.id)}" class="text-mute px-1" aria-label="แก้ไข">✎</button><button data-act="gdel" data-id="${esc(g.id)}" class="text-mute px-1" aria-label="ลบ">✕</button></div></div>
      <div class="text-xs text-mute mb-2">${a ? 'บัญชี: ' + esc(a.name) : '⚠ บัญชีที่ผูกไว้ถูกลบแล้ว กดแก้ไขเพื่อเลือกบัญชีใหม่'}</div>
      <div class="pb goal-bar"><i style="width:${Math.max(0, Math.min(p, 100))}%"></i></div>
      <div class="flex justify-between items-baseline mt-2 text-sm"><span><b>${fmt(now)}</b> / ${fmt(g.target)} บาท</span><b class="${done ? 'text-inc' : ''}">${Math.max(0, Math.floor(p))}%</b></div>
      ${done ? '<div class="badge-done">เป้าหมายสำเร็จแล้ว! 🎉</div>' : `<div class="text-xs text-mute mt-1">อีก ${fmt(g.target - now)} บาทจะถึงเป้า</div>`}</div>`;
  }).join('') || '<p class="p-6 text-center text-mute bg-white border border-line rounded-xl">ยังไม่มีเป้าหมาย ลองสร้างด้านล่าง เช่น “เก็บเงินซื้อรถ”</p>';
}
function checkGoals() {
  let ch = false;
  cfg.goals.forEach(g => {
    const p = goalAcc(g) && g.target > 0 ? goalNow(g) / g.target * 100 : 0;
    if (p >= 100 && !g.done) { g.done = true; ch = true; confetti(); toast(`เป้าหมาย “${g.name}” สำเร็จแล้ว! 🎉`); }
    else if (p < 100 && g.done) { g.done = false; ch = true; }
  });
  if (ch) touchCfg();
}
$('#goalList').onclick = e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const g = cfg.goals.find(x => x.id === b.dataset.id); if (!g) return;
  if (b.dataset.act === 'gdel') {
    if (confirm(`ลบเป้าหมาย “${g.name}”? เงินในบัญชีจะไม่หายไปไหน`)) { cfg.goals = cfg.goals.filter(x => x.id !== g.id); if (goalEditId === g.id) resetGoalForm(); touchCfg(); renderAll(); }
    return;
  }
  goalEditId = g.id; fillGoalAccs();
  $('#gName').value = g.name; $('#gTarget').value = g.target; $('#gAcc').value = g.acc;
  $('#gSave').textContent = 'บันทึกการแก้ไข'; $('#gTitle').textContent = 'แก้ไขเป้าหมาย'; $('#gCancel').classList.remove('hidden'); $('#gName').focus();
};
$('#gCancel').onclick = resetGoalForm;
$('#gSave').onclick = () => {
  const n = $('#gName').value.trim(), t = parseFloat($('#gTarget').value), a = $('#gAcc').value;
  if (!n) { toast('ใส่ชื่อเป้าหมายก่อน'); return; }
  if (!(t > 0)) { toast('ใส่จำนวนเงินเป้าหมายก่อน'); return; }
  if (!a) { toast('เลือกบัญชีที่ผูกกับเป้าหมายก่อน (ถ้าไม่มีบัญชีว่าง ให้เพิ่มบัญชีใหม่)'); return; }
  if (cfg.goals.some(g => g.acc === a && g.id !== goalEditId)) { toast('บัญชีนี้ผูกกับเป้าหมายอื่นแล้ว'); return; }
  if (goalEditId) { const g = cfg.goals.find(x => x.id === goalEditId); if (g) Object.assign(g, { name: n, target: t, acc: a }); }
  else cfg.goals.push({ id: 'g' + Date.now().toString(36), name: n, target: t, acc: a, done: false });
  resetGoalForm(); touchCfg(); renderAll(); toast('บันทึกเป้าหมายแล้ว ✓');
};

/* ---------- นำเข้าข้อมูล JSON ---------- */
function importData(o) {
  if (Array.isArray(o)) o = { tx: o };
  if (!o || !Array.isArray(o.tx)) throw new Error('bad file');
  const r = { tx: o.tx.map(x => ({ ...x, amount: +x.amount, u: +x.u || 0 })).filter(x => x && x.id != null && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.amount > 0 && ['inc', 'exp', 'tf'].includes(x.type)), del: o.del || {} };
  const c = o.cfg;
  if (c && Array.isArray(c.accs) && c.accs.length && c.cats && Array.isArray(c.cats.exp) && Array.isArray(c.cats.inc))
    r.cfg = { cats: c.cats, accs: c.accs, budgets: c.budgets || {}, goals: Array.isArray(c.goals) ? c.goals : [], u: Date.now() };
  if (o.plan && GOALS[o.plan.goal]) r.plan = { ...o.plan, u: Date.now() };
  merge(r); save(); renderAll();
  return r.tx.length;
}
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const o = JSON.parse(rd.result);
      if (!confirm('นำเข้าข้อมูลจากไฟล์นี้? รายการจะถูกรวมกับที่มีอยู่ (ไม่ซ้ำ) ส่วนหมวดหมู่ บัญชี งบ และเป้าหมายในไฟล์จะใช้แทนของเครื่องนี้')) return;
      toast(`นำเข้าแล้ว ${importData(o)} รายการ ✓`);
    } catch (err) { toast('ไฟล์ไม่ถูกต้อง นำเข้าไม่ได้'); }
  };
  rd.readAsText(f);
};

/* ---------- Routing ---------- */
function route() {
  const v = VIEWS.some(x => x[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  $$('[data-view]').forEach(s => { const on = s.dataset.view === v; s.classList.toggle('hidden', !on); s.classList.remove('enter'); if (on) { void s.offsetWidth; s.classList.add('enter'); } });
  $$('#navTop a,#navBottom a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + v));
  renderAll();
}
function renderAll() { fillCats(); fillAccs(); renderHome(); renderTx(); renderSummary(); renderPlan(); renderBudget(); renderAccounts(); renderGoals(); renderCats(); checkGoals(); }
$('#q').oninput = renderTx; $('#ftype').onchange = renderTx;
$('#navTop').innerHTML = VIEWS.map(([k, l]) => `<a class="nav-a" href="#${k}">${l}</a>`).join('');
$('#navBottom').innerHTML = VIEWS.map(([k, l]) => `<a href="#${k}">${l}</a>`).join('');
$('#pIncome').value = plan.income; $('#pFixed').value = plan.fixed;
window.addEventListener('hashchange', route);
resetForm(); route();

/* ---------- AI advisor (เรียกผ่าน Worker ที่เก็บ API key) ---------- */
$('#aiBtn').onclick = async () => {
  const out = $('#aiOut'), btn = $('#aiBtn');
  if (!AI_URL) { out.textContent = 'ยังไม่ได้ตั้งค่า AI_URL ใน app.js (ดูขั้นตอนการ deploy Worker)'; return; }
  if (!tx.length) { out.textContent = 'บันทึกรายการสักหน่อยก่อน แล้วค่อยให้ AI วิเคราะห์'; return; }
  const m = thisMonth(), cats = {};
  inRange(90).filter(x => x.type === 'exp').forEach(x => cats[x.cat] = (cats[x.cat] || 0) + x.amount);
  const now = new Date();
  const summary = {
    goal: GOALS[plan.goal].label, monthlyIncome: +plan.income || sum(m, 'inc'), fixedCosts: +plan.fixed || 0,
    spentThisMonth: sum(m, 'exp'), dayOfMonth: now.getDate(), daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    spendByCategoryLast90Days: cats, categoryBudgets: cfg.budgets, savingGoals: cfg.goals.map(g => ({ name: g.name, target: g.target, saved: goalNow(g) })),
    recent: sorted(tx).slice(0, 20).map(x => ({ name: x.name, amount: x.amount, type: x.type, cat: x.cat, date: x.date }))
  };
  btn.disabled = true; out.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
  try {
    const r = await fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) });
    const j = await r.json();
    out.textContent = j.text || ('เกิดข้อผิดพลาด: ' + (j.error || r.status));
    out.classList.remove('enter'); void out.offsetWidth; out.classList.add('enter');
  } catch { out.textContent = 'เชื่อมต่อ AI ไม่ได้ ตรวจสอบ AI_URL และอินเทอร์เน็ต'; }
  btn.disabled = false;
};

/* ---------- ซิงค์ข้ามอุปกรณ์ (ผ่าน Worker + KV) ---------- */
const BASE = AI_URL.replace(/\/+$/, '');
let syncTimer = null, syncing = false;
const SS = { ok: ['ซิงค์แล้ว', '#22A383'], busy: ['กำลังซิงค์', '#F5A524'], err: ['ซิงค์ไม่สำเร็จ', '#E2557C'], off: ['ไม่ได้ซิงค์', '#B6BDD6'], offline: ['ออฟไลน์', '#B6BDD6'] };
function setState(k) { const [l, c] = SS[k]; $('#syncState').innerHTML = `<i class="dot ${k === 'busy' ? 'pulse' : ''}" style="background:${c}"></i><span class="hidden sm:inline">${l}</span>`; $('#syncState').title = l; }
const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function queueSync() { clearTimeout(syncTimer); if (sync.code) syncTimer = setTimeout(doSync, 1500); }
function merge(r) {
  const del = { ...(r.del || {}) };
  for (const k in sync.del) del[k] = Math.max(del[k] || 0, sync.del[k]);
  const m = new Map();
  [...(r.tx || []), ...tx].forEach(x => { const o = m.get(x.id); if (!o || (x.u || 0) >= (o.u || 0)) m.set(x.id, x); });
  tx = [...m.values()].filter(x => !(del[x.id] > (x.u || 0)));
  sync.del = del;
  if (r.plan && (r.plan.u || 0) > (plan.u || 0)) plan = r.plan;
  if (r.cfg && r.cfg.cats && r.cfg.accs && (r.cfg.u || 0) > (cfg.u || 0)) { const g = cfg.goals; cfg = r.cfg; cfg.goals = cfg.goals || g || []; cfg.budgets = cfg.budgets || {}; }
}
async function doSync() {
  if (!sync.code || !AI_URL || syncing) return;
  syncing = true; setState('busy');
  try {
    const g = await post('/sync/get', { code: sync.code });
    const r = await g.json(); if (!g.ok) throw new Error(r.error);
    merge(r.data || {});
    const p = await post('/sync/put', { code: sync.code, data: { tx, del: sync.del, plan, cfg } });
    if (!p.ok) throw new Error('put');
    persist(); renderAll();
    $('#pIncome').value = plan.income || ''; $('#pFixed').value = plan.fixed || '';
    setState('ok');
  } catch (e) { setState(navigator.onLine ? 'err' : 'offline'); }
  syncing = false;
}
function renderSync() {
  $('#syncNew').classList.toggle('hidden', !!sync.code);
  $('#syncActive').classList.toggle('hidden', !sync.code);
  $('#codeBox').textContent = sync.code;
}
function startSync(c) { sync.code = c; persist(); renderSync(); doSync(); }
$('#genCode').onclick = () => {
  const a = crypto.getRandomValues(new Uint8Array(16)), abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  startSync([...a].map(b => abc[b % abc.length]).join('').match(/.{4}/g).join('-'));
};
$('#joinBtn').onclick = () => {
  const c = $('#joinCode').value.trim().toLowerCase();
  if (c.replace(/-/g, '').length < 16) { alert('รหัสไม่ถูกต้อง ลองคัดลอกจากเครื่องแรกอีกครั้ง'); return; }
  startSync(c);
};
$('#copyCode').onclick = () => navigator.clipboard.writeText(sync.code).then(() => { $('#copyCode').textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => $('#copyCode').textContent = 'คัดลอกรหัส', 1500); });
$('#syncNow').onclick = doSync;
$('#leaveBtn').onclick = () => { if (confirm('ยกเลิกการซิงค์บนเครื่องนี้? ข้อมูลในเครื่องยังอยู่')) { sync.code = ''; persist(); renderSync(); setState('off'); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) doSync(); });
renderSync(); setState(sync.code ? (navigator.onLine ? 'busy' : 'offline') : 'off'); doSync();
window.addEventListener('online', doSync); window.addEventListener('offline', () => setState('offline'));
checkSaved();
