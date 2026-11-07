(() => {
'use strict';
const OLD = 'keuanganku:v1', LKEY = 'keuanganku:v2', ITER = 250000, IDLE_MS = 5 * 60 * 1000;
const $ = s => document.querySelector(s);
const rp = n => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(n);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'});

const defaults = () => ({
  categories: [
    {id: uid(), name: 'Uang Makan',   color: '#d9822b', budget: 0},
    {id: uid(), name: 'Uang Jajan',   color: '#c2417a', budget: 0},
    {id: uid(), name: 'Uang Kuliah',  color: '#2f6fb5', budget: 0}
  ],
  transactions: []
});

let state = null, key = null, salt = null, mode = 'unlock', idleT, saveChain = Promise.resolve();
let month = localDate().slice(0, 7);
let editTx = null, editCat = null;

const te = new TextEncoder(), td = new TextDecoder();
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(pw, sl) {
  const m = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt: sl, iterations: ITER, hash: 'SHA-256'}, m, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function seal(k, sl, json) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, te.encode(json));
  localStorage.setItem(LKEY, JSON.stringify({v: 2, salt: b64(sl), iv: b64(iv), data: b64(new Uint8Array(ct))}));
}
async function openVault(pw) {
  const o = JSON.parse(localStorage.getItem(LKEY)), sl = unb64(o.salt), k = await derive(pw, sl);
  const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(o.iv)}, k, unb64(o.data));
  return {k, sl, st: JSON.parse(td.decode(pt))};
}
function save() {
  if (!key) return;
  const k = key, sl = salt, json = JSON.stringify(state);
  saveChain = saveChain.then(() => seal(k, sl, json)).catch(() => toast('Gagal menyimpan: penyimpanan browser penuh atau dinonaktifkan'));
}
async function createVault(pw) {
  salt = crypto.getRandomValues(new Uint8Array(16)); key = await derive(pw, salt);
  let st = null;
  try { const o = JSON.parse(localStorage.getItem(OLD)); if (o && Array.isArray(o.categories) && Array.isArray(o.transactions)) st = o; } catch (e) {}
  state = st || defaults();
  await seal(key, salt, JSON.stringify(state));
  localStorage.removeItem(OLD);   // hapus data lama yang belum terenkripsi
}

// ---------- Layar kunci ----------
const lockErr = m => { $('#lock-err').textContent = m; };
function showLock() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  clearTimeout(idleT);
  ['#app', '#actions', '#monthwrap'].forEach(s => $(s).hidden = true);
  $('#lock').hidden = false;
  const has = !!localStorage.getItem(LKEY);
  mode = has ? 'unlock' : 'setup';
  const migrating = !has && !!localStorage.getItem(OLD);
  $('#lock-title').textContent = has ? 'Keuanganku terkunci' : 'Buat password';
  $('#lock-desc').textContent = has ? 'Masukkan password untuk membuka catatan keuangan Anda.'
    : (migrating ? 'Data lama Anda akan diamankan dengan password ini. ' : '') + 'Data disimpan terenkripsi di perangkat ini. Jika password lupa, data tidak bisa dipulihkan kecuali Anda punya file cadangan.';
  $('#pw').autocomplete = has ? 'current-password' : 'new-password';
  $('#pw2').hidden = has; $('#pw2').required = !has;
  $('#lock-btn').textContent = has ? 'Buka' : 'Buat password';
  $('#forgot').hidden = !has;
  lockErr('');
  if (!window.crypto || !crypto.subtle) { lockErr('Browser ini tidak mendukung enkripsi. Buka lewat https atau localhost.'); $('#lock-btn').disabled = true; }
  $('#pw').focus();
}
function enter() {
  $('#lock').hidden = true;
  ['#app', '#actions', '#monthwrap'].forEach(s => $(s).hidden = false);
  render(); bump();
}
function lock() { key = null; salt = null; state = null; showLock(); }
function bump() { clearTimeout(idleT); if (key) idleT = setTimeout(lock, IDLE_MS); }
['click', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, bump, {passive: true}));

$('#lockform').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, pw = f.pw.value, btn = $('#lock-btn');
  lockErr('');
  if (mode === 'setup') {
    if (pw.length < 6) return lockErr('Password minimal 6 karakter');
    if (pw !== f.pw2.value) return lockErr('Konfirmasi password tidak sama');
  }
  btn.disabled = true;
  try {
    if (mode === 'setup') await createVault(pw);
    else { const r = await openVault(pw); key = r.k; salt = r.sl; state = r.st; }
  } catch (err) { btn.disabled = false; return lockErr(mode === 'setup' ? 'Gagal membuat password' : 'Password salah'); }
  btn.disabled = false; f.reset(); enter();
});

$('#fpw').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.n1.value !== f.n2.value) return toast('Konfirmasi password baru tidak sama');
  if (f.n1.value.length < 6) return toast('Password minimal 6 karakter');
  try { await openVault(f.old.value); } catch (err) { return toast('Password lama salah'); }
  salt = crypto.getRandomValues(new Uint8Array(16)); key = await derive(f.n1.value, salt);
  await seal(key, salt, JSON.stringify(state));
  f.reset(); $('#dpw').close(); toast('Password diganti');
});

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const cat = id => state.categories.find(c => c.id === id);
const sum = (arr, type) => arr.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);

function render() {
  const mTx = state.transactions.filter(t => t.date.startsWith(month));
  const inM = sum(mTx, 'in'), outM = sum(mTx, 'out');
  const all = sum(state.transactions, 'in') - sum(state.transactions, 'out');
  $('#summary').innerHTML = `
    <div><small>Saldo total</small><strong class="${all < 0 ? 'out' : ''}">${rp(all)}</strong></div>
    <div><small>Pemasukan bulan ini</small><strong class="in">${rp(inM)}</strong></div>
    <div><small>Pengeluaran bulan ini</small><strong class="out">${rp(outM)}</strong></div>`;

  // Kategori
  $('#cats').innerHTML = state.categories.length ? state.categories.map(c => {
    const tx = state.transactions.filter(t => t.categoryId === c.id);
    const bal = sum(tx, 'in') - sum(tx, 'out');
    const spent = sum(mTx.filter(t => t.categoryId === c.id), 'out');
    const pct = c.budget > 0 ? Math.min(100, spent / c.budget * 100) : 0;
    return `<article class="cat" style="--c:${esc(c.color)}">
      <div class="cat-head"><b>${esc(c.name)}</b>
        <span class="tools"><button class="ic" data-act="edit-cat" data-id="${c.id}">Edit</button><button class="ic" data-act="del-cat" data-id="${c.id}">Hapus</button></span></div>
      <p>Saldo: <b class="${bal < 0 ? 'out' : ''}">${rp(bal)}</b> · Terpakai bulan ini: ${rp(spent)}</p>
      ${c.budget > 0 ? `<div class="bar ${spent > c.budget ? 'over' : ''}"><i style="width:${pct}%"></i></div>
      <p>${spent > c.budget ? `Melebihi anggaran ${rp(spent - c.budget)}` : `Sisa anggaran ${rp(c.budget - spent)}`} dari ${rp(c.budget)}</p>` : ''}
    </article>`;
  }).join('') : '<div class="empty">Belum ada kategori. Tambahkan kategori pertama Anda.</div>';

  // Grafik
  const rows = state.categories.map(c => ({c, v: sum(mTx.filter(t => t.categoryId === c.id), 'out')})).filter(r => r.v > 0);
  const max = Math.max(...rows.map(r => r.v), 1);
  $('#chart').innerHTML = rows.length ? rows.sort((a, b) => b.v - a.v).map(r =>
    `<div class="r" style="--c:${esc(r.c.color)}"><span>${esc(r.c.name)}</span><div class="bar"><i style="width:${r.v / max * 100}%"></i></div><span>${rp(r.v)}</span></div>`).join('')
    : '<div class="empty">Belum ada pengeluaran di bulan ini.</div>';

  // Filter kategori
  const fc = $('#fcat'), cur = fc.value;
  fc.innerHTML = '<option value="">Semua kategori</option>' + state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  fc.value = state.categories.some(c => c.id === cur) ? cur : '';

  // Riwayat
  const q = $('#q').value.trim().toLowerCase(), ft = $('#ftype').value;
  const list = mTx.filter(t => (!fc.value || t.categoryId === fc.value) && (!ft || t.type === ft) && (!q || (t.note || '').toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  $('#list').innerHTML = list.length ? list.map(t => {
    const c = cat(t.categoryId);
    return `<div class="tx" style="--c:${esc(c ? c.color : '#888')}">
      <span class="dot"></span>
      <div class="t"><b>${esc(t.note || (c ? c.name : 'Tanpa kategori'))}</b><small>${fmtDate(t.date)} · ${esc(c ? c.name : 'Tanpa kategori')}</small></div>
      <span class="amt ${t.type}">${t.type === 'in' ? '+' : '−'}${rp(t.amount)}</span>
      <span class="tools"><button class="ic" data-act="edit-tx" data-id="${t.id}">Edit</button><button class="ic" data-act="del-tx" data-id="${t.id}">Hapus</button></span>
    </div>`;
  }).join('') + `<p class="foot">${list.length} transaksi · Masuk ${rp(sum(list, 'in'))} · Keluar ${rp(sum(list, 'out'))}</p>`
    : '<div class="empty">Tidak ada transaksi untuk filter ini. Klik “Tambah transaksi” untuk mencatat.</div>';
}

// ---- Transaksi
function openTx(id) {
  if (!state.categories.length) return toast('Buat kategori dulu sebelum mencatat transaksi');
  editTx = id ? state.transactions.find(t => t.id === id) : null;
  const f = $('#ftx');
  f.cat.innerHTML = state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  f.type.value = editTx ? editTx.type : 'out';
  f.amount.value = editTx ? editTx.amount : '';
  f.cat.value = editTx ? editTx.categoryId : ($('#fcat').value || state.categories[0].id);
  f.date.value = editTx ? editTx.date : (localDate().startsWith(month) ? localDate() : month + '-01');
  f.note.value = editTx ? editTx.note || '' : '';
  $('#dtx-title').textContent = editTx ? 'Edit transaksi' : 'Tambah transaksi';
  $('#dtx').showModal(); f.amount.focus();
}
$('#ftx').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, amount = Math.round(Number(f.amount.value));
  if (!(amount > 0)) return toast('Jumlah harus lebih dari 0');
  const data = {type: f.type.value, amount, categoryId: f.cat.value, date: f.date.value, note: f.note.value.trim()};
  if (editTx) Object.assign(editTx, data); else state.transactions.push({id: uid(), ...data});
  save(); $('#dtx').close(); toast(editTx ? 'Transaksi diperbarui' : 'Transaksi disimpan');
  if (!data.date.startsWith(month)) { month = data.date.slice(0, 7); $('#month').value = month; }
  render();
});

// ---- Kategori
function openCat(id) {
  editCat = id ? cat(id) : null;
  const f = $('#fcatform');
  f.name.value = editCat ? editCat.name : '';
  f.color.value = editCat ? editCat.color : '#2f6fb5';
  f.budget.value = editCat ? editCat.budget : 0;
  $('#dcat-title').textContent = editCat ? 'Edit kategori' : 'Tambah kategori';
  $('#dcat').showModal(); f.name.focus();
}
$('#fcatform').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, name = f.name.value.trim();
  if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c !== editCat)) return toast('Nama kategori sudah dipakai');
  const data = {name, color: f.color.value, budget: Math.max(0, Math.round(Number(f.budget.value) || 0))};
  if (editCat) Object.assign(editCat, data); else state.categories.push({id: uid(), ...data});
  save(); $('#dcat').close(); toast('Kategori disimpan'); render();
});

// ---- Ekspor / impor
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = v => '"' + String(v).replace(/"/g, '""') + '"';

// ---- Aksi (event delegation)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-close]');
  if (!b) { document.querySelector('.menu[open]')?.removeAttribute('open'); return; }
  if (b.dataset.close !== undefined) return b.closest('dialog').close();
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'new-tx': openTx(); break;
    case 'edit-tx': openTx(id); break;
    case 'del-tx':
      if (confirm('Hapus transaksi ini?')) { state.transactions = state.transactions.filter(t => t.id !== id); save(); render(); toast('Transaksi dihapus'); }
      break;
    case 'new-cat': openCat(); break;
    case 'edit-cat': openCat(id); break;
    case 'del-cat': {
      const n = state.transactions.filter(t => t.categoryId === id).length;
      const msg = n ? `Kategori ini punya ${n} transaksi. Menghapus kategori juga menghapus semua transaksinya. Lanjutkan?` : 'Hapus kategori ini?';
      if (confirm(msg)) { state.categories = state.categories.filter(c => c.id !== id); state.transactions = state.transactions.filter(t => t.categoryId !== id); save(); render(); toast('Kategori dihapus'); }
      break; }
    case 'export-json':
      if (!confirm('File cadangan TIDAK dienkripsi. Simpan di tempat yang aman. Lanjutkan?')) break;
      download(`keuanganku-${localDate()}.json`, JSON.stringify(state, null, 2), 'application/json'); break;
    case 'export-csv': {
      const rows = [['Tanggal','Jenis','Kategori','Jumlah','Catatan'], ...state.transactions.slice().sort((a, b) => a.date.localeCompare(b.date))
        .map(t => [t.date, t.type === 'in' ? 'Pemasukan' : 'Pengeluaran', cat(t.categoryId)?.name || '', t.amount, t.note || ''])];
      download(`transaksi-${localDate()}.csv`, '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv'); break; }
    case 'lock': lock(); return;
    case 'change-pw': $('#dpw').showModal(); break;
    case 'forgot':
      if (confirm('Menghapus semua data di perangkat ini agar bisa membuat password baru. Data hanya bisa dikembalikan lewat file cadangan. Lanjutkan?')) { localStorage.removeItem(LKEY); showLock(); }
      return;
    case 'import': $('#file').click(); break;
    case 'reset':
      if (confirm('Hapus SEMUA kategori dan transaksi? Tindakan ini tidak bisa dibatalkan.')) { state = defaults(); save(); render(); toast('Data direset'); }
      break;
  }
  document.querySelector('.menu[open]')?.removeAttribute('open');
});

$('#file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!Array.isArray(s.categories) || !Array.isArray(s.transactions)) throw 0;
    if (!confirm('Impor akan menimpa semua data saat ini. Lanjutkan?')) return;
    state = {categories: s.categories, transactions: s.transactions}; save(); render(); toast('Data berhasil diimpor');
  } catch (err) { toast('File tidak valid'); }
});

$('#month').addEventListener('change', e => { if (e.target.value) { month = e.target.value; render(); } });
['#q', '#fcat', '#ftype'].forEach(s => $(s).addEventListener('input', render));
$('#month').value = month;
showLock();
})();
