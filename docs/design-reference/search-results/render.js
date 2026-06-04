// ── State ──
let selected = localStorage.getItem('wciwi-country') || 'PH';
if (!REGIONS.some(r => r.code === selected)) selected = 'PH';

const regionByCode = Object.fromEntries(REGIONS.map(r => [r.code, r]));

// ── Country selector ──
const countryEl = document.getElementById('country');
const countryBtn = document.getElementById('countryBtn');
const dropdown = document.getElementById('dropdown');
const selFlag = document.getElementById('selFlag');
const selName = document.getElementById('selName');

function renderSelected() {
  const r = regionByCode[selected];
  selFlag.src = `https://flagcdn.com/24x18/${r.flag}.png`;
  selFlag.alt = r.name;
  selName.textContent = r.name;
}
function renderDropdown() {
  dropdown.innerHTML = REGIONS.map(r => `
    <button type="button" class="opt ${r.code === selected ? 'selected' : ''}" role="option" aria-selected="${r.code === selected}" data-code="${r.code}">
      <img class="flag" src="https://flagcdn.com/24x18/${r.flag}.png" alt="${r.name}" />
      <span>${r.name}</span>
    </button>`).join('');
}
function setOpen(open) {
  countryEl.classList.toggle('open', open);
  countryBtn.setAttribute('aria-expanded', String(open));
}

countryBtn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!countryEl.classList.contains('open')); });
dropdown.addEventListener('click', (e) => {
  const btn = e.target.closest('.opt');
  if (!btn) return;
  selected = btn.dataset.code;
  localStorage.setItem('wciwi-country', selected);
  renderSelected();
  renderDropdown();
  setOpen(false);
  renderCards();
});
document.addEventListener('mousedown', (e) => { if (!countryEl.contains(e.target)) setOpen(false); });

// ── Icons ──
const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const xIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const starIcon = '<svg viewBox="0 0 24 24" fill="#F5C518" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
const flagIconSm = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
const emptyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>';

function badge(slug, size) {
  const p = PLATFORMS[slug] || { label: slug, bg: '#F1F5F9', text: '#475569' };
  return `<span class="badge ${size || ''}" style="background:${p.bg};color:${p.text}">${p.label}</span>`;
}

// ── Card ──
function cardHTML(t, idx) {
  const region = regionByCode[selected];
  const here = t.availability[selected];
  const available = Array.isArray(here) && here.length > 0;

  // Dominant answer box
  let answerDetail = '';
  if (available) {
    answerDetail = '<div class="answer-detail">' + here.map(a =>
      badge(a.platform, 'lg') + (a.seasons ? `<span class="seasons">${a.seasons}</span>` : '')
    ).join('') + '</div>';
  } else {
    answerDetail = '<div class="answer-detail"><span class="answer-note">Not currently streaming on any service here.</span></div>';
  }

  const answer = `
    <div class="answer ${available ? 'available' : 'unavailable'}">
      <span class="answer-icon">${available ? checkIcon : xIcon}</span>
      <div class="answer-body">
        <div class="answer-head">
          <img class="flag" src="https://flagcdn.com/24x18/${region.flag}.png" alt="${region.name}" />
          <span>${available ? 'Available' : 'Not available'} in ${region.name}</span>
        </div>
        ${answerDetail}
      </div>
    </div>`;

  // Other regions
  const others = REGIONS.filter(r => r.code !== selected);
  const rows = others.map(r => {
    const av = t.availability[r.code];
    const hasIt = Array.isArray(av) && av.length > 0;
    const right = hasIt
      ? av.map(a => badge(a.platform) + (a.seasons ? `<span class="seasons">${a.seasons}</span>` : '')).join('')
      : '<span class="region-na">Not available</span>';
    return `
      <div class="region-row">
        <div class="region-left">
          <img class="flag" src="https://flagcdn.com/24x18/${r.flag}.png" alt="${r.name}" />
          <span class="region-name">${r.name}</span>
        </div>
        <div class="region-right">${right}</div>
      </div>`;
  }).join('');

  const metaBits = [t.network, t.year, t.type, t.genre, t.extent]
    .map(b => `<span>${b}</span>`).join('<span class="dot">·</span>');

  return `
    <article class="card" data-nav>
      <div class="poster" style="--poster-bg:${t.posterBg}">
        <span class="poster-title">${t.title}</span>
        <span class="poster-tag">Poster</span>
      </div>
      <div class="info">
        <h2 class="title-name">${t.title}</h2>
        <div class="meta-row">
          ${metaBits}
          <span class="dot">·</span>
          <span class="imdb">${starIcon}${t.rating.toFixed(1)}</span>
        </div>
        <p class="synopsis">${t.synopsis}</p>
        ${answer}
        <div class="others-label">Available in other regions</div>
        ${rows}
        <div class="card-footer">
          <button type="button" class="report" data-report data-title="${t.title.replace(/"/g,'&quot;')}">${flagIconSm}<span>Report incorrect info</span></button>
        </div>
      </div>
    </article>`;
}

// ── Render ──
const cardsEl = document.getElementById('cards');
const summaryEl = document.getElementById('summary');

function renderCards() {
  if (!TITLES.length) {
    cardsEl.innerHTML = '';
    summaryEl.innerHTML = 'No results found.';
    cardsEl.insertAdjacentHTML('beforeend', `
      <div class="empty">
        <div class="empty-icon">${emptyIcon}</div>
        <h2 class="empty-title">We couldn't find that title</h2>
        <p class="empty-text">Try checking the spelling or searching for something else.</p>
      </div>`);
    return;
  }
  summaryEl.innerHTML = `<b>${TITLES.length} results</b> for “${TITLES[0].title}” · streaming availability in <b>${regionByCode[selected].name}</b>`;
  cardsEl.innerHTML = TITLES.map(cardHTML).join('');
}

renderSelected();
renderDropdown();
renderCards();

// Card click → title detail (report link opens modal instead of navigating)
cardsEl.addEventListener('click', (e) => {
  const reportBtn = e.target.closest('.report');
  if (reportBtn) { openModal(reportBtn.dataset.title); return; }
  if (e.target.closest('[data-nav]')) {
    window.location.href = '../titles/Title Detail.html';
  }
});

// ── Report modal ──
const overlay = document.getElementById('modalOverlay');
const issueSelect = document.getElementById('issueSelect');
const platformField = document.getElementById('platformField');
const noteInput = document.getElementById('noteInput');
const counter = document.getElementById('counter');
const modalFlag = document.getElementById('modalFlag');
const modalSub = document.getElementById('modalSub');

function syncConditional() {
  const show = issueSelect.value === 'wrong-platform' || issueSelect.value === 'is-here';
  platformField.classList.toggle('show', show);
}
issueSelect.addEventListener('change', syncConditional);
noteInput.addEventListener('input', () => {
  const n = noteInput.value.length;
  counter.textContent = `${n} / 280`;
  counter.classList.toggle('warn', n >= 260);
});

function openModal(titleName) {
  document.getElementById('modalForm').style.display = '';
  document.getElementById('modalDone').style.display = 'none';
  const r = regionByCode[selected];
  modalFlag.src = `https://flagcdn.com/24x18/${r.flag}.png`;
  modalFlag.alt = r.name;
  modalSub.textContent = titleName
    ? `“${titleName}” in ${r.name} — reports are reviewed daily.`
    : 'Help us keep availability data accurate. Reports are reviewed daily.';
  issueSelect.value = 'not-here';
  noteInput.value = '';
  document.getElementById('platformInput').value = '';
  counter.textContent = '0 / 280';
  counter.classList.remove('warn');
  syncConditional();
  overlay.classList.add('open');
}
function closeModal() { overlay.classList.remove('open'); }

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-modal]')) closeModal();
  if (e.target === overlay) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
document.getElementById('submitReport').addEventListener('click', () => {
  document.getElementById('modalForm').style.display = 'none';
  document.getElementById('modalDone').style.display = '';
});
