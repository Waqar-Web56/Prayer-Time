const PRAYERS = [
  {key:'Fajr',   ar:'الفجر',  label:'Fajr',    hint:'Dawn'},
  {key:'Sunrise',ar:'الشروق', label:'Sunrise', hint:'Not a prayer time'},
  {key:'Dhuhr',  ar:'الظهر',  label:'Dhuhr',   hint:'Midday'},
  {key:'Asr',    ar:'العصر',  label:'Asr',     hint:'Afternoon'},
  {key:'Maghrib',ar:'المغرب', label:'Maghrib', hint:'Sunset'},
  {key:'Isha',   ar:'العشاء', label:'Isha',    hint:'Night'}
];
const $ = id => document.getElementById(id);
const state = { city: 'Lahore', method: '1', school: '1', times: null, timer: null };

// ---------- helpers ----------
const pkt = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
function toDate(dateStr, hhmm, addDays = 0) {
  const d = new Date(`${dateStr}T${hhmm.slice(0, 5)}:00+05:00`);
  d.setDate(d.getDate() + addDays);
  return d;
}
const fmt12 = hhmm => {
  let [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};
const pad = n => String(n).padStart(2, '0');

// ---------- UI setup ----------
function initControls() {
  const saved = JSON.parse(localStorage.getItem('namaz') || '{}');
  Object.assign(state, saved);
  $('city').innerHTML = CITIES.map(c => `<option>${c[0]}</option>`).join('');
  $('city').value = state.city; $('method').value = state.method; $('school').value = state.school;
  $('cityGrid').innerHTML = CITIES.map(c => `<button class="chip" data-city="${c[0]}">${c[0]}</button>`).join('');

  $('city').onchange = e => setCity(e.target.value);
  $('method').onchange = e => { state.method = e.target.value; load(); };
  $('school').onchange = e => { state.school = e.target.value; load(); };
  $('cityGrid').onclick = e => { const b = e.target.closest('[data-city]'); if (b) { setCity(b.dataset.city); scrollTo({ top: 0 }); } };

  $('search').oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    const list = q ? CITIES.filter(c => c[0].toLowerCase().includes(q)).slice(0, 8) : [];
    $('results').classList.toggle('hidden', !list.length);
    $('results').innerHTML = list.length ? list.map(c => `<li><button class="w-full text-left px-4 py-2.5 hover:bg-white/10" data-pick="${c[0]}">${c[0]}</button></li>`).join('') : '';
  };
  $('results').onclick = e => { const b = e.target.closest('[data-pick]'); if (b) { setCity(b.dataset.pick); $('search').value = ''; $('results').classList.add('hidden'); } };
  document.addEventListener('click', e => { if (!e.target.closest('#search,#results')) $('results').classList.add('hidden'); });
}

function setCity(name) { state.city = name; $('city').value = name; load(); }

// ---------- data ----------
async function load() {
  const c = CITIES.find(x => x[0] === state.city) || CITIES[0];
  localStorage.setItem('namaz', JSON.stringify({ city: state.city, method: state.method, school: state.school }));
  $('cityTitle').textContent = c[0].replace(/ \(.*\)/, '');
  document.title = `Prayer Times in ${c[0]} – Namaz Times Pakistan`;
  document.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.city === c[0]));
  $('error').classList.add('hidden');
  $('cards').innerHTML = Array(6).fill('<div class="skeleton"></div>').join('');

  const [y, m, d] = pkt().split('-');
  const url = `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${c[1]}&longitude=${c[2]}&method=${state.method}&school=${state.school}&timezonestring=Asia/Karachi`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Server error ' + r.status);
    const j = await r.json();
    state.times = j.data.timings;
    state.date = pkt();
    const h = j.data.date.hijri;
    $('hijri').textContent = `${h.day} ${h.month.en} ${h.year} AH`;
    $('dateLine').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });
    tick(true);
  } catch (err) {
    $('cards').innerHTML = '';
    $('error').textContent = 'Could not load prayer times. Check your internet connection and choose the city again.';
    $('error').classList.remove('hidden');
  }
}

// ---------- render ----------
function tick(rebuild) {
  if (!state.times) return;
  const now = new Date();
  const list = PRAYERS.filter(p => p.key !== 'Sunrise').map(p => ({ ...p, at: toDate(state.date, state.times[p.key]) }));
  let next = list.find(p => p.at > now), prev;
  if (!next) { next = { ...list[0], at: toDate(state.date, state.times.Fajr, 1) }; prev = list[list.length - 1]; }
  else { const i = list.indexOf(next); prev = i ? list[i - 1] : { at: new Date(list[0].at.getTime() - 86400000 * 0.25) }; }

  const left = Math.max(0, next.at - now);
  $('nextName').textContent = next.label;
  $('nextTime').textContent = fmt12(state.times[next.key]);
  $('countdown').textContent = `${pad(Math.floor(left / 3600000))}:${pad(Math.floor(left / 60000) % 60)}:${pad(Math.floor(left / 1000) % 60)}`;
  const span = next.at - prev.at, done = Math.min(1, Math.max(0, (now - prev.at) / span));
  $('ring').style.strokeDashoffset = 565.5 * (1 - done);

  if (rebuild || state.activeKey !== next.key) {
    state.activeKey = next.key;
    $('cards').innerHTML = PRAYERS.map(p => {
      const at = toDate(state.date, state.times[p.key]);
      const cls = p.key === next.key ? 'active' : (at < now ? 'past' : '');
      return `<article class="card ${cls}"><div class="flex items-center justify-between"><span class="font-medium">${p.label}</span><span class="ar">${p.ar}</span></div>
        <div class="time mt-5">${fmt12(state.times[p.key])}</div><div class="sub text-mist text-sm mt-1">${p.hint}</div></article>`;
    }).join('');
  }
  if (pkt() !== state.date) load(); // new day
}

initControls();
load();
setInterval(() => tick(false), 1000);
