// Platform badge palette — lifted from the app's lib/platforms.ts, plus a few extras.
const PLATFORMS = {
  netflix:   { label: 'Netflix',    bg: '#FEE2E2', text: '#991B1B' },
  apple:     { label: 'Apple TV+',  bg: '#F1F5F9', text: '#334155' },
  prime:     { label: 'Prime Video',bg: '#DBEAFE', text: '#1E40AF' },
  disney:    { label: 'Disney+',    bg: '#EDE9FE', text: '#5B21B6' },
  hbo:       { label: 'HBO Max',    bg: '#F3E8FF', text: '#7E22CE' },
  hulu:      { label: 'Hulu',       bg: '#DCFCE7', text: '#15803D' },
  peacock:   { label: 'Peacock',    bg: '#FEF9C3', text: '#854D0E' },
  paramount: { label: 'Paramount+', bg: '#DBEAFE', text: '#1E40AF' },
  mubi:      { label: 'MUBI',       bg: '#FFF7ED', text: '#9A3412' },
  vivamax:   { label: 'Vivamax',    bg: '#FCE7F3', text: '#9D174D' },
  stan:      { label: 'Stan',       bg: '#CCFBF1', text: '#0F766E' },
  now:       { label: 'Now TV',     bg: '#DCFCE7', text: '#15803D' },
  crave:     { label: 'Crave',      bg: '#FFE4E6', text: '#9F1239' },
};

// Region order + display names. PH is the detected/home region.
const REGIONS = [
  { code: 'PH', name: 'Philippines',    flag: 'ph' },
  { code: 'US', name: 'United States',  flag: 'us' },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
  { code: 'AU', name: 'Australia',      flag: 'au' },
  { code: 'CA', name: 'Canada',         flag: 'ca' },
];

// availability[code] = null (not available) | [{ platform, seasons }]
const TITLES = [
  {
    title: 'Parks and Recreation',
    network: 'NBC', year: 2009, type: 'Series', genre: 'Comedy',
    extent: '7 seasons', rating: 8.6,
    posterBg: 'linear-gradient(150deg,#E8F0E4,#D6E6CF)',
    backdropBg: 'linear-gradient(135deg,#3d2f1e 0%,#6b4f2a 45%,#8a6b3a 100%)',
    synopsis: 'A tireless mid-level government employee works to turn an abandoned lot into a park in the small town of Pawnee, Indiana, alongside her lovably dysfunctional team.',
    cast: ['Amy Poehler', 'Nick Offerman', 'Aziz Ansari', 'Rashida Jones', 'Chris Pratt'],
    creators: ['Michael Schur', 'Greg Daniels'],
    details: {
      country: 'United States',
      runtime: '22 min / episode',
      episodes: '125 episodes',
      status: 'Ended',
      language: 'English',
      rating: 'TV-14',
    },
    availability: {
      PH: null,
      US: [{ platform: 'peacock', seasons: 'All 7 seasons' }],
      GB: [{ platform: 'now',     seasons: 'Seasons 1–5' }],
      AU: [{ platform: 'stan',    seasons: 'All 7 seasons' }],
      CA: [{ platform: 'crave',   seasons: 'Seasons 1–3' }],
    },
  },
  {
    title: 'Severance',
    network: 'Apple TV+', year: 2022, type: 'Series', genre: 'Drama',
    extent: '2 seasons', rating: 8.7,
    posterBg: 'linear-gradient(150deg,#E3EAF4,#CFD9E8)',
    synopsis: 'Office workers surgically divide their memories between work and personal life — then begin to question the arrangement.',
    availability: {
      PH: [{ platform: 'apple', seasons: 'All 2 seasons' }],
      US: [{ platform: 'apple', seasons: 'All 2 seasons' }],
      GB: [{ platform: 'apple', seasons: 'All 2 seasons' }],
      AU: [{ platform: 'apple', seasons: 'All 2 seasons' }],
      CA: [{ platform: 'apple', seasons: 'All 2 seasons' }],
    },
  },
  {
    title: 'Parasite',
    network: 'CJ Entertainment', year: 2019, type: 'Movie', genre: 'Thriller',
    extent: '2h 12min', rating: 8.5,
    posterBg: 'linear-gradient(150deg,#EDE7E0,#DED3C6)',
    synopsis: 'A destitute family schemes their way into the household of a wealthy clan, with darkly unraveling consequences.',
    availability: {
      PH: [{ platform: 'netflix' }],
      US: null,
      GB: [{ platform: 'mubi' }],
      AU: [{ platform: 'netflix' }],
      CA: null,
    },
  },
];
