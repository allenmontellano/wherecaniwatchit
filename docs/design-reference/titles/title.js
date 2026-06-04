// ── State ──
const T = TITLES[0]; // Parks and Recreation
let selected = localStorage.getItem('wciwi-country') || 'PH';
if (!REGIONS.some(r => r.code === selected)) selected = 'PH';
const regionByCode = Object.fromEntries(REGIONS.map(r => [r.code, r]));

// ── Icons ──
const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const xIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const starIcon = '<svg viewBox="0 0 24 24" fill="#F5C518" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
const extIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

function badge(slug) {
  const p = PLATFORMS[slug] || { label: slug, bg: '#F1F5F9', text: '#475569' };
  return `<span class="badge" style="background:${p.bg};color:${p.text}">${p.label}</span>`;
}

// ── Hero ──
function renderHero() {
  document.getElementById('hero').innerHTML = `
    <div class="backdrop" style="--backdrop:${T.backdropBg}"></div>
    <span class="backdrop-tag">Backdrop image</span>
    <div class="hero-inner">
      <div class="hero-poster" style="--poster-bg:${T.posterBg}">
        <span class="pt">${T.title}</span>
        <span class="ptag">Poster</span>
      </div>
      <div class="hero-info">
        <h1 class="hero-title">${T.title}</h1>
        <div class="hero-meta">
          ${[T.network, T.year, T.type, T.genre, T.extent].map(b=>`<span>${b}</span>`).join('<span class="dot">·</span>')}
          <span class="dot">·</span>
          <span class="imdb">${starIcon}${T.rating.toFixed(1)}</span>
        </div>
        <p class="hero-synopsis">${T.synopsis}</p>
        <div class="hero-credits">
          <div><span class="credit-label">Starring</span><span class="credit-val">${T.cast.slice(0,3).join(' · ')}</span></div>
          <div><span class="credit-label">Created by</span><span class="credit-val">${T.creators.join(' · ')}</span></div>
        </div>
      </div>
    </div>`;
}

// ── Dominant answer ──
function renderAnswer() {
  const region = regionByCode[selected];
  const here = T.availability[selected];
  const available = Array.isArray(here) && here.length > 0;

  let detail;
  if (available) {
    detail = '<div class="answer-detail">' + here.map(a =>
      badge(a.platform) + (a.seasons ? `<span class="seasons">${a.seasons}</span>` : '') +
      `<a class="platform-link">Watch on ${(PLATFORMS[a.platform]||{}).label||a.platform} ${extIcon}</a>`
    ).join('') + '</div>';
  } else {
    detail = '<p class="answer-note">Not currently streaming on any service here.</p>';
  }

  document.getElementById('answerSlot').innerHTML = `
    <div class="answer ${available ? 'available' : 'unavailable'}">
      <span class="answer-icon">${available ? checkIcon : xIcon}</span>
      <div class="answer-body">
        <div class="answer-head">
          <img class="flag" src="https://flagcdn.com/24x18/${region.flag}.png" alt="${region.name}" />
          <span>${available ? 'Available' : 'Not available'} in ${region.name}</span>
        </div>
        ${detail}
      </div>
    </div>`;
}

// ── Other regions table ──
function renderRegions() {
  const others = REGIONS.filter(r => r.code !== selected);
  document.getElementById('regionRows').innerHTML = others.map(r => {
    const av = T.availability[r.code];
    const has = Array.isArray(av) && av.length > 0;
    const mid = has ? av.map(a => badge(a.platform)).join('') : '<span class="region-na">Not available</span>';
    const right = has ? av.map(a => a.seasons || '').filter(Boolean).join(', ') : '';
    return `
      <div class="region-row">
        <div class="region-left">
          <img class="flag" src="https://flagcdn.com/24x18/${r.flag}.png" alt="${r.name}" />
          <span class="region-name">${r.name}</span>
        </div>
        <div class="region-mid">${mid}</div>
        <div class="region-right">${right}</div>
      </div>`;
  }).join('');
}

// ── Title details ──
function renderDetails() {
  const d = T.details;
  document.getElementById('detailsGrid').innerHTML = `
    <div class="detail-card">
      <div class="detail-row">
        <div class="detail-key">Cast</div>
        <div class="cast-list">
          ${T.cast.map(c=>`<span class="cast-item">${c}</span>`).join('')}
          ${T.creators.map(c=>`<span class="cast-item creator">${c} — Creator</span>`).join('')}
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-key">Genre</div>
        <div class="pills"><span class="pill">${T.genre}</span><span class="pill">Sitcom</span><span class="pill">Mockumentary</span></div>
      </div>
      <div class="detail-row"><div class="detail-key">Release year</div><div class="detail-val">${T.year}</div></div>
      <div class="detail-row"><div class="detail-key">Network</div><div class="detail-val">${T.network}</div></div>
      <div class="detail-row"><div class="detail-key">Country of origin</div><div class="detail-val">${d.country}</div></div>
    </div>
    <div class="detail-card">
      <div class="detail-row"><div class="detail-key">Runtime per episode</div><div class="detail-val">${d.runtime}</div></div>
      <div class="detail-row"><div class="detail-key">Total episodes</div><div class="detail-val">${d.episodes}</div></div>
      <div class="detail-row"><div class="detail-key">Status</div><div class="detail-val">${d.status}</div></div>
      <div class="detail-row"><div class="detail-key">Language</div><div class="detail-val">${d.language}</div></div>
      <div class="detail-row"><div class="detail-key">Content rating</div><div class="detail-val">${d.rating}</div></div>
    </div>`;
}

// ── Country selector ──
const countryEl = document.getElementById('country');
const countryBtn = document.getElementById('countryBtn');
const dropdown = document.getElementById('dropdown');
const selFlag = document.getElementById('selFlag');
const selName = document.getElementById('selName');

function renderSelected() {
  const r = regionByCode[selected];
  selFlag.src = `https://flagcdn.com/24x18/${r.flag}.png`;
  selFlag.alt = r.name; selName.textContent = r.name;
}
function renderDropdown() {
  dropdown.innerHTML = REGIONS.map(r => `
    <button type="button" class="opt ${r.code===selected?'selected':''}" role="option" aria-selected="${r.code===selected}" data-code="${r.code}">
      <img class="flag" src="https://flagcdn.com/24x18/${r.flag}.png" alt="${r.name}" /><span>${r.name}</span>
    </button>`).join('');
}
function setOpen(o){ countryEl.classList.toggle('open', o); countryBtn.setAttribute('aria-expanded', String(o)); }

countryBtn.addEventListener('click', e => { e.stopPropagation(); setOpen(!countryEl.classList.contains('open')); });
dropdown.addEventListener('click', e => {
  const btn = e.target.closest('.opt'); if (!btn) return;
  selected = btn.dataset.code;
  localStorage.setItem('wciwi-country', selected);
  renderSelected(); renderDropdown(); setOpen(false);
  renderAnswer(); renderRegions();
});
document.addEventListener('mousedown', e => { if (!countryEl.contains(e.target)) setOpen(false); });

// ── Modal ──
const overlay = document.getElementById('modalOverlay');
const issueSelect = document.getElementById('issueSelect');
const platformField = document.getElementById('platformField');
const noteInput = document.getElementById('noteInput');
const counter = document.getElementById('counter');
const modalFlag = document.getElementById('modalFlag');

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

function openModal() {
  document.getElementById('modalForm').style.display = '';
  document.getElementById('modalDone').style.display = 'none';
  const r = regionByCode[selected];
  modalFlag.src = `https://flagcdn.com/24x18/${r.flag}.png`;
  modalFlag.alt = r.name;
  issueSelect.value = 'not-here';
  noteInput.value = '';
  document.getElementById('platformInput').value = '';
  counter.textContent = '0 / 280';
  counter.classList.remove('warn');
  syncConditional();
  overlay.classList.add('open');
}
function closeModal() { overlay.classList.remove('open'); }

document.addEventListener('click', e => {
  if (e.target.closest('[data-open-modal]')) openModal();
  if (e.target.closest('[data-close-modal]')) closeModal();
  if (e.target === overlay) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.getElementById('submitReport').addEventListener('click', () => {
  document.getElementById('modalForm').style.display = 'none';
  document.getElementById('modalDone').style.display = '';
});

// ── Refine search → back to results ──
document.getElementById('refine').addEventListener('submit', e => {
  e.preventDefault();
  window.location.href = '../search-results/Search Results.html';
});
const ri = document.getElementById('refineInput');
ri.addEventListener('focus', () => document.getElementById('refine').classList.add('focused'));
ri.addEventListener('blur', () => document.getElementById('refine').classList.remove('focused'));

// ── Init ──
renderSelected();
renderDropdown();
renderHero();
renderAnswer();
renderRegions();
renderDetails();
