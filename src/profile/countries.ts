// Countries for the nationality picker. Names come from the browser
// (Intl.DisplayNames) with football-friendly overrides, plus the four home
// nations, which play as separate national teams.

export interface Country {
  code: string;
  name: string;
  flag: string;
}

const ISO = (
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI ' +
  'CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FO FR GA GB GD GE GF GH GI GM GN GP GQ ' +
  'GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KN KP KR KW KY KZ LA LB LC LI LK LR LS ' +
  'LT LU LV LY MA MC MD ME MG MK ML MM MN MO MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NZ OM PA PE PF PG ' +
  'PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ ' +
  'TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW'
).split(' ');

const NAME_OVERRIDES: Record<string, string> = {
  CD: 'DR Congo',
  CG: 'Congo',
  CI: 'Ivory Coast',
  CV: 'Cape Verde',
  CZ: 'Czechia',
  KR: 'South Korea',
  KP: 'North Korea',
  MK: 'North Macedonia',
  PS: 'Palestine',
  SZ: 'Eswatini',
  TL: 'Timor-Leste',
  US: 'United States',
  XK: 'Kosovo',
};

const HOME_NATIONS: Country[] = [
  { code: 'GB-ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'GB-SCT', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { code: 'GB-WLS', name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'GB-NIR', name: 'Northern Ireland', flag: '🇬🇧' },
];

/** Regional-indicator flag emoji for a two-letter code. */
export function flagFor(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️';
}

let cached: Country[] | null = null;

export function countries(): Country[] {
  if (cached) return cached;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    /* very old browsers: fall back to codes */
  }
  const list = ISO.map((code) => ({
    code,
    name: NAME_OVERRIDES[code] ?? names?.of(code) ?? code,
    flag: flagFor(code),
  }));
  cached = [...list, ...HOME_NATIONS].sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

export function countryByCode(code: string | undefined): Country | undefined {
  return code ? countries().find((c) => c.code === code) : undefined;
}
