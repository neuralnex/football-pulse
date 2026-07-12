/** ISO 3166-1 alpha-2 (or flagcdn subcodes for UK nations). */
const TEAM_TO_FLAG: Record<string, string> = {
  argentina: 'ar',
  australia: 'au',
  austria: 'at',
  belgium: 'be',
  brazil: 'br',
  cameroon: 'cm',
  canada: 'ca',
  chile: 'cl',
  colombia: 'co',
  'costa rica': 'cr',
  croatia: 'hr',
  'czech republic': 'cz',
  czechia: 'cz',
  denmark: 'dk',
  ecuador: 'ec',
  egypt: 'eg',
  england: 'gb-eng',
  france: 'fr',
  germany: 'de',
  ghana: 'gh',
  greece: 'gr',
  honduras: 'hn',
  hungary: 'hu',
  iran: 'ir',
  italy: 'it',
  'ivory coast': 'ci',
  "cote d'ivoire": 'ci',
  japan: 'jp',
  'korea republic': 'kr',
  'south korea': 'kr',
  mexico: 'mx',
  morocco: 'ma',
  netherlands: 'nl',
  'new zealand': 'nz',
  nigeria: 'ng',
  norway: 'no',
  panama: 'pa',
  paraguay: 'py',
  peru: 'pe',
  poland: 'pl',
  portugal: 'pt',
  qatar: 'qa',
  romania: 'ro',
  'saudi arabia': 'sa',
  scotland: 'gb-sct',
  senegal: 'sn',
  serbia: 'rs',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  tunisia: 'tn',
  turkey: 'tr',
  ukraine: 'ua',
  uruguay: 'uy',
  usa: 'us',
  'united states': 'us',
  venezuela: 've',
  wales: 'gb-wls',
};

function normalizeTeam(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '');
}

export function teamFlagCode(teamName: string): string | null {
  const key = normalizeTeam(teamName);
  if (TEAM_TO_FLAG[key]) return TEAM_TO_FLAG[key];

  // 3-letter FIFA codes sometimes appear in data (FRA, ESP, …)
  const upper = teamName.trim().toUpperCase();
  const fifaMap: Record<string, string> = {
    ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BRA: 'br', CMR: 'cm', CAN: 'ca',
    CHI: 'cl', COL: 'co', CRC: 'cr', CRO: 'hr', CZE: 'cz', DEN: 'dk', ECU: 'ec',
    EGY: 'eg', ENG: 'gb-eng', FRA: 'fr', GER: 'de', GHA: 'gh', GRE: 'gr', HON: 'hn',
    HUN: 'hu', IRN: 'ir', ITA: 'it', CIV: 'ci', JPN: 'jp', KOR: 'kr', MEX: 'mx',
    MAR: 'ma', NED: 'nl', NZL: 'nz', NGA: 'ng', NOR: 'no', PAN: 'pa', PAR: 'py',
    PER: 'pe', POL: 'pl', POR: 'pt', QAT: 'qa', ROU: 'ro', KSA: 'sa', SCO: 'gb-sct',
    SEN: 'sn', SRB: 'rs', ESP: 'es', SWE: 'se', SUI: 'ch', TUN: 'tn', TUR: 'tr',
    UKR: 'ua', URU: 'uy', USA: 'us', VEN: 've', WAL: 'gb-wls',
  };
  if (fifaMap[upper]) return fifaMap[upper];

  return null;
}

export function flagImageUrl(teamName: string, size: 24 | 40 | 80 = 40): string | null {
  const code = teamFlagCode(teamName);
  if (!code) return null;
  return `https://flagcdn.com/w${size}/${code}.png`;
}

export function teamInitials(teamName: string): string {
  const parts = teamName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
