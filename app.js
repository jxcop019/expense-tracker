// หลัง deploy Worker แล้ว ใส่ URL ของ Worker ตรงนี้ เช่น "https://expense-ai.ชื่อคุณ.workers.dev"
const AI_URL = "https://expense-ai.phuriphat-zxc84.workers.dev";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CATS = {
  exp: ['อาหาร', 'เดินทาง', 'ของใช้', 'บิล/ค่าบริการ', 'บันเทิง', 'สุขภาพ', 'อื่นๆ'],
  inc: ['เงินเดือน', 'รายได้เสริม', 'ของขวัญ', 'อื่นๆ']
};
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
const VIEWS = [['home', 'หน้าหลัก'], ['transactions', 'รายการ'], ['summary', 'สรุป'], ['planner', 'วางแผน'], ['settings', 'ตั้งค่า']];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
let tx = load('tx', []), plan = load('plan', { goal: 'bal', income: '', fixed: '' });
let type = 'exp', editId = null, lastId = null, catTouched = false, period = 'month';
const save = () => { localStorage.setItem('tx', JSON.stringify(tx)); localStorage.setItem('plan', JSON.stringify(plan)); };
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
  const n = name.toLowerCase();
  for (const c in KW) if (KW[c].some(k => n.includes(k))) return c;
  return null;
}
function fillCats() {
  const cur = $('#cat').value;
  $('#cat').innerHTML = CATS[type].map(c => `<option>${c}</option>`).join('');
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
  if (!e.target.value.trim()) { $('#preview').textContent = ''; return; }
  const g = guess(p.name);
  if (g && !catTouched) {
    const t = CATS.inc.includes(g) && !CATS.exp.includes(g) ? 'inc' : CATS.exp.includes(g) ? 'exp' : type;
    if (t !== type) setType(t);
    $('#cat').value = g;
  }
  $('#preview').innerHTML = `ชื่อ: <b>${esc(p.name)}</b> · ยอด: <b class="${type === 'exp' ? 'text-exp' : 'text-inc'}">${fmt(p.amount)} บาท</b>`;
});
$('#cat').addEventListener('change', () => catTouched = true);
$$('.tg').forEach(b => b.onclick = () => setType(b.dataset.type));
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const p = parse($('#text').value);
  if (!p.amount) { $('#preview').innerHTML = '<span class="text-exp">ใส่จำนวนเงินด้วย เช่น ก๋วยเตี๋ยว 50</span>'; return; }
  const rec = { id: editId || Date.now(), name: p.name, amount: p.amount, type, cat: $('#cat').value, date: $('#date').value || today() };
  tx = editId ? tx.map(x => x.id === editId ? rec : x) : [...tx, rec];
  lastId = rec.id; save(); resetForm(); renderAll(); lastId = null;
});
$('#cancelEdit').onclick = resetForm;
function resetForm() {
  editId = null; catTouched = false;
  $('#text').value = ''; $('#preview').textContent = ''; $('#date').value = today();
  $('#saveBtn').textContent = 'บันทึกข้อมูล'; $('#cancelEdit').classList.add('hidden');
  setType('exp');
}
window.edit = id => {
  const x = tx.find(t => t.id === id); if (!x) return;
  editId = id; catTouched = true; setType(x.type);
  $('#text').value = `${x.name} ${x.amount}`; $('#cat').value = x.cat; $('#date').value = x.date;
  $('#saveBtn').textContent = 'อัปเดตข้อมูล'; $('#cancelEdit').classList.remove('hidden');
  location.hash = 'home'; window.scrollTo({ top: 0, behavior: 'smooth' }); $('#text').focus();
};
window.del = id => { if (confirm('ลบรายการนี้?')) { tx = tx.filter(x => x.id !== id); save(); renderAll(); } };

/* ---------- Render ---------- */
const rowHTML = x => `<div class="row ${x.id === lastId ? 'new' : ''} px-4 py-3 flex items-center gap-3">
  <span class="w-1.5 self-stretch rounded ${x.type === 'exp' ? 'bg-exp' : 'bg-inc'}"></span>
  <div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(x.name)}</div><div class="text-xs text-mute">${x.cat} · ${x.date}</div></div>
  <div class="font-bold ${x.type === 'exp' ? 'text-exp' : 'text-inc'}">${x.type === 'exp' ? '−' : '+'}${fmt(x.amount)}</div>
  <button onclick="edit(${x.id})" class="text-mute px-1" aria-label="แก้ไข">✎</button>
  <button onclick="del(${x.id})" class="text-mute px-1" aria-label="ลบ">✕</button></div>`;
const sorted = a => [...a].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const card = (l, v, c) => `<div class="bg-white border border-line rounded-xl p-3"><div class="text-xs text-mute">${l}</div><div class="font-bold text-base sm:text-xl ${c}">${fmt(v)}</div></div>`;

function renderHome() {
  const m = thisMonth(), i = sum(m, 'inc'), e = sum(m, 'exp');
  $('#cards').innerHTML = card('รายรับเดือนนี้', i, 'text-inc') + card('รายจ่ายเดือนนี้', e, 'text-exp') + card('คงเหลือ', i - e, i - e < 0 ? 'text-exp' : '');
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
  ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div><div class="flex justify-between text-sm mb-1"><span>${c}</span><span>${fmt(v)} (${Math.round(v / e * 100)}%)</span></div><div class="bar" style="width:${v / e * 100}%"></div></div>`).join('') || '<p class="text-mute text-sm">ไม่มีรายจ่าย</p>'}</div>
  <div class="bg-white border border-line rounded-xl"><h2 class="font-bold px-4 py-3 border-b border-line">รายจ่ายสูงสุด</h2>${top.map(rowHTML).join('') || '<p class="p-4 text-mute text-sm">ไม่มีรายจ่าย</p>'}</div>`;
}

/* ---------- Planner (rule-based advisor) ---------- */
function renderPlan() {
  $('#goalTabs').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button class="tab ${k === plan.goal ? 'on' : ''}" data-g="${k}">${g.label}</button>`).join('');
  $$('#goalTabs .tab').forEach(b => b.onclick = () => { plan.goal = b.dataset.g; save(); renderPlan(); });
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
    <div class="text-xs text-mute mt-1">${share.slice(0, 4).map(([c, s]) => `${c} ${fmt(b * s)}`).join(' · ')}</div></div>`;
  }).join('')}</div></div>`;
}
$('#pIncome').oninput = e => { plan.income = e.target.value; save(); renderPlan(); };
$('#pFixed').oninput = e => { plan.fixed = e.target.value; save(); renderPlan(); };

/* ---------- Settings ---------- */
$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(tx, null, 2)], { type: 'application/json' }));
  a.download = `expense-${today()}.json`; a.click();
};
$('#clearBtn').onclick = () => { if (confirm('ลบข้อมูลทั้งหมดถาวร?')) { tx = []; save(); renderAll(); } };

/* ---------- Routing ---------- */
function route() {
  const v = VIEWS.some(x => x[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  $$('[data-view]').forEach(s => { const on = s.dataset.view === v; s.classList.toggle('hidden', !on); s.classList.remove('enter'); if (on) { void s.offsetWidth; s.classList.add('enter'); } });
  $$('#navTop a,#navBottom a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + v));
  renderAll();
}
function renderAll() { renderHome(); renderTx(); renderSummary(); renderPlan(); }
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
    spendByCategoryLast90Days: cats,
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
