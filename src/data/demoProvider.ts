import type {
  Competition,
  CompetitionData,
  DataProvider,
  Match,
  NewsItem,
  NewsProvider,
  Player,
  Position,
  StandingGroup,
  Team,
  TeamData,
  TeamRef,
  Transfer,
  TransferType,
} from './types';
import { computeStandings } from './standings';
import { estimatePrice, fantasyPoints } from './pricing';

// Deterministic sample data so the app works fully without an API key.
// Club and nation names are real; players, fixtures and results are invented.

type TeamSeed = [name: string, shortName: string, tla: string, color: string, area?: string];

const COMPETITIONS: Competition[] = [
  { code: 'PL', name: 'Premier League', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league', featured: true },
  { code: 'ELC', name: 'Championship', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league', featured: true },
  { code: 'EL1', name: 'League One', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league', featured: true },
  { code: 'EL2', name: 'League Two', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league', featured: true },
  { code: 'PD', name: 'La Liga', area: 'Spain', flag: '🇪🇸', category: 'domestic', format: 'league', featured: true },
  { code: 'SD', name: 'LaLiga 2', area: 'Spain', flag: '🇪🇸', category: 'domestic', format: 'league', featured: true },
  { code: 'BL1', name: 'Bundesliga', area: 'Germany', flag: '🇩🇪', category: 'domestic', format: 'league', featured: true },
  { code: 'SA', name: 'Serie A', area: 'Italy', flag: '🇮🇹', category: 'domestic', format: 'league', featured: true },
  { code: 'FL1', name: 'Ligue 1', area: 'France', flag: '🇫🇷', category: 'domestic', format: 'league', featured: true },
  { code: 'FL2', name: 'Ligue 2', area: 'France', flag: '🇫🇷', category: 'domestic', format: 'league', featured: true },
  { code: 'MLS', name: 'Major League Soccer', area: 'United States', flag: '🇺🇸', category: 'domestic', format: 'league', featured: true },
  { code: 'SPL', name: 'Saudi Pro League', area: 'Saudi Arabia', flag: '🇸🇦', category: 'domestic', format: 'league', featured: true },
  { code: 'EFL', name: 'EFL Cup', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'cup', format: 'knockout', featured: true },
  { code: 'CL', name: 'UEFA Champions League', area: 'Europe', flag: '🇪🇺', category: 'europe', format: 'league', featured: true },
  { code: 'EL', name: 'UEFA Europa League', area: 'Europe', flag: '🇪🇺', category: 'europe', format: 'league', featured: true },
  { code: 'ECL', name: 'UEFA Conference League', area: 'Europe', flag: '🇪🇺', category: 'europe', format: 'league', featured: true },
  { code: 'WC', name: 'FIFA World Cup', area: 'World', flag: '🌍', category: 'international', format: 'groups', featured: true },
  { code: 'EC', name: 'European Championship', area: 'Europe', flag: '🇪🇺', category: 'international', format: 'groups', featured: true },
  { code: 'CA', name: 'Copa América', area: 'South America', flag: '🌎', category: 'international', format: 'groups', featured: true },
  { code: 'AFCON', name: 'Africa Cup of Nations', area: 'Africa', flag: '🌍', category: 'international', format: 'groups', featured: true },
  { code: 'UNL', name: 'UEFA Nations League', area: 'Europe', flag: '🇪🇺', category: 'international', format: 'groups', featured: true },
  { code: 'FRI', name: 'International Friendlies', area: 'World', flag: '🤝', category: 'international', format: 'knockout', featured: true },
];

interface LeagueSeed {
  idBase: number;
  nation: string;
  teams: TeamSeed[];
  /** UTC kick-off slots for a round, if not the usual European weekend times. */
  kickoffs?: [number, number][];
  /** Split the table into equal halves with these names (e.g. MLS conferences). */
  conferences?: string[];
  /** Season runs within one calendar year (e.g. MLS), so it's "2026" not "2026/27". */
  calendarYear?: boolean;
}

const LEAGUE_TEAMS: Record<string, LeagueSeed> = {
  PL: {
    idBase: 1,
    nation: 'England',
    teams: [
      ['Arsenal', 'Arsenal', 'ARS', '#ef0107'], ['Aston Villa', 'Villa', 'AVL', '#670e36'],
      ['Bournemouth', 'Bournemouth', 'BOU', '#da291c'], ['Brentford', 'Brentford', 'BRE', '#e30613'],
      ['Brighton & Hove Albion', 'Brighton', 'BHA', '#0057b8'], ['Chelsea', 'Chelsea', 'CHE', '#034694'],
      ['Crystal Palace', 'Palace', 'CRY', '#1b458f'], ['Everton', 'Everton', 'EVE', '#003399'],
      ['Fulham', 'Fulham', 'FUL', '#9ca3af'], ['Leeds United', 'Leeds', 'LEE', '#ffcd00'],
      ['Liverpool', 'Liverpool', 'LIV', '#c8102e'], ['Manchester City', 'Man City', 'MCI', '#6cabdd'],
      ['Manchester United', 'Man United', 'MUN', '#da291c'], ['Newcastle United', 'Newcastle', 'NEW', '#6b7280'],
      ['Nottingham Forest', "Nott'm Forest", 'NFO', '#dd0000'], ['Sunderland', 'Sunderland', 'SUN', '#eb172b'],
      ['Tottenham Hotspur', 'Spurs', 'TOT', '#132257'], ['West Ham United', 'West Ham', 'WHU', '#7a263a'],
      ['Wolverhampton Wanderers', 'Wolves', 'WOL', '#fdb913'], ['Burnley', 'Burnley', 'BUR', '#6c1d45'],
    ],
  },
  PD: {
    idBase: 101,
    nation: 'Spain',
    teams: [
      ['Real Madrid', 'Real Madrid', 'RMA', '#febe10'], ['FC Barcelona', 'Barcelona', 'FCB', '#a50044'],
      ['Atlético Madrid', 'Atlético', 'ATM', '#cb3524'], ['Athletic Club', 'Athletic', 'ATH', '#ee2523'],
      ['Villarreal', 'Villarreal', 'VIL', '#ffe667'], ['Real Betis', 'Betis', 'BET', '#0bb363'],
      ['Real Sociedad', 'Real Sociedad', 'RSO', '#0067b1'], ['Celta Vigo', 'Celta', 'CEL', '#8ac3ee'],
      ['Osasuna', 'Osasuna', 'OSA', '#d91a21'], ['Getafe', 'Getafe', 'GET', '#005999'],
      ['Rayo Vallecano', 'Rayo', 'RAY', '#e53027'], ['Mallorca', 'Mallorca', 'MLL', '#e20613'],
      ['Valencia', 'Valencia', 'VAL', '#ee3524'], ['Sevilla', 'Sevilla', 'SEV', '#d71920'],
      ['Girona', 'Girona', 'GIR', '#cd2534'], ['Espanyol', 'Espanyol', 'ESP', '#007fc8'],
      ['Deportivo Alavés', 'Alavés', 'ALA', '#0761af'], ['Elche', 'Elche', 'ELC', '#05642c'],
      ['Levante', 'Levante', 'LEV', '#b4053f'], ['Real Oviedo', 'Oviedo', 'OVI', '#0033a0'],
    ],
  },
  BL1: {
    idBase: 201,
    nation: 'Germany',
    teams: [
      ['FC Bayern München', 'Bayern', 'FCB', '#dc052d'], ['Borussia Dortmund', 'Dortmund', 'BVB', '#fde100'],
      ['Bayer 04 Leverkusen', 'Leverkusen', 'B04', '#e32221'], ['RB Leipzig', 'Leipzig', 'RBL', '#dd0741'],
      ['Eintracht Frankfurt', 'Frankfurt', 'SGE', '#e1000f'], ['VfB Stuttgart', 'Stuttgart', 'VFB', '#e32219'],
      ['SC Freiburg', 'Freiburg', 'SCF', '#b40a14'], ['Werder Bremen', 'Bremen', 'SVW', '#1d9053'],
      ["Borussia M'gladbach", "M'gladbach", 'BMG', '#16a34a'], ['VfL Wolfsburg', 'Wolfsburg', 'WOB', '#65b32e'],
      ['1. FSV Mainz 05', 'Mainz', 'M05', '#c3141e'], ['1. FC Union Berlin', 'Union Berlin', 'FCU', '#eb1923'],
      ['FC Augsburg', 'Augsburg', 'FCA', '#ba3733'], ['TSG Hoffenheim', 'Hoffenheim', 'TSG', '#1961b5'],
      ['1. FC Heidenheim', 'Heidenheim', 'HDH', '#e30613'], ['FC St. Pauli', 'St. Pauli', 'STP', '#624839'],
      ['1. FC Köln', 'Köln', 'KOE', '#ed1c24'], ['Hamburger SV', 'Hamburg', 'HSV', '#0a3f86'],
    ],
  },
  SA: {
    idBase: 301,
    nation: 'Italy',
    teams: [
      ['Inter', 'Inter', 'INT', '#0068a8'], ['AC Milan', 'Milan', 'MIL', '#fb090b'],
      ['Juventus', 'Juventus', 'JUV', '#6b7280'], ['Napoli', 'Napoli', 'NAP', '#12a0d7'],
      ['Atalanta', 'Atalanta', 'ATA', '#1e71b8'], ['AS Roma', 'Roma', 'ROM', '#8e1f2f'],
      ['Lazio', 'Lazio', 'LAZ', '#87d8f7'], ['Fiorentina', 'Fiorentina', 'FIO', '#482e92'],
      ['Bologna', 'Bologna', 'BOL', '#1a2f48'], ['Torino', 'Torino', 'TOR', '#881f19'],
      ['Genoa', 'Genoa', 'GEN', '#ad1919'], ['Udinese', 'Udinese', 'UDI', '#7d7d7d'],
      ['Como', 'Como', 'COM', '#1b3f8b'], ['Cagliari', 'Cagliari', 'CAG', '#a0102a'],
      ['Lecce', 'Lecce', 'LEC', '#f6c700'], ['Parma', 'Parma', 'PAR', '#ffd200'],
      ['Hellas Verona', 'Verona', 'VER', '#003e7e'], ['Sassuolo', 'Sassuolo', 'SAS', '#00a752'],
      ['Pisa', 'Pisa', 'PIS', '#1d3c8f'], ['Cremonese', 'Cremonese', 'CRE', '#c8102e'],
    ],
  },
  ELC: {
    idBase: 601,
    nation: 'England',
    teams: [
      ['Wrexham', 'Wrexham', 'WRX', '#c8102e'], ['Sheffield United', 'Sheffield Utd', 'SHU', '#ee2737'],
      ['Leicester City', 'Leicester', 'LEI', '#003090'], ['Southampton', 'Southampton', 'SOU', '#d71920'],
      ['Ipswich Town', 'Ipswich', 'IPS', '#0044a9'], ['Middlesbrough', 'Middlesbrough', 'MID', '#e11b22'],
      ['Coventry City', 'Coventry', 'COV', '#59cbe8'], ['Norwich City', 'Norwich', 'NOR', '#00a650'],
      ['Hull City', 'Hull', 'HUL', '#f5a12d'], ['Stoke City', 'Stoke', 'STK', '#e03a3e'],
      ['Millwall', 'Millwall', 'MIL', '#001d5e'], ['Watford', 'Watford', 'WAT', '#fbee23'],
      ['West Bromwich Albion', 'West Brom', 'WBA', '#122f67'], ['Bristol City', 'Bristol City', 'BRC', '#e21b23'],
      ['Swansea City', 'Swansea', 'SWA', '#6b7280'], ['Preston North End', 'Preston', 'PNE', '#1e3a8a'],
      ['Queens Park Rangers', 'QPR', 'QPR', '#1d5ba4'], ['Blackburn Rovers', 'Blackburn', 'BLB', '#009ee0'],
      ['Derby County', 'Derby', 'DER', '#1f2937'], ['Portsmouth', 'Portsmouth', 'POR', '#001489'],
      ['Sheffield Wednesday', 'Sheffield Wed', 'SHW', '#0e00f0'], ['Oxford United', 'Oxford', 'OXF', '#fff200'],
      ['Charlton Athletic', 'Charlton', 'CHA', '#d4021d'], ['Birmingham City', 'Birmingham', 'BIR', '#0000ff'],
    ],
  },
  EL1: {
    idBase: 701,
    nation: 'England',
    teams: [
      ['Bolton Wanderers', 'Bolton', 'BOL', '#263c7e'], ['Barnsley', 'Barnsley', 'BAR', '#d71920'],
      ['Huddersfield Town', 'Huddersfield', 'HUD', '#0e63ad'], ['Stockport County', 'Stockport', 'STO', '#1b458f'],
      ['Wigan Athletic', 'Wigan', 'WIG', '#1d59af'], ['Reading', 'Reading', 'REA', '#004494'],
      ['Peterborough United', 'Peterborough', 'PET', '#0055a5'], ['Blackpool', 'Blackpool', 'BPL', '#f68712'],
      ['Rotherham United', 'Rotherham', 'ROT', '#d71920'], ['Lincoln City', 'Lincoln', 'LIN', '#e2231a'],
      ['Mansfield Town', 'Mansfield', 'MAN', '#f5a12d'], ['Wycombe Wanderers', 'Wycombe', 'WYC', '#6cb4e4'],
      ['Leyton Orient', 'Leyton Orient', 'LEY', '#c8102e'], ['Exeter City', 'Exeter', 'EXE', '#d71920'],
      ['Burton Albion', 'Burton', 'BRT', '#fdb913'], ['Northampton Town', "N'hampton", 'NTN', '#8b1d41'],
      ['Stevenage', 'Stevenage', 'STE', '#e2231a'], ['Bristol Rovers', 'Bristol Rovers', 'BRR', '#1d4ed8'],
      ['Cardiff City', 'Cardiff', 'CAR', '#0070b5'], ['Plymouth Argyle', 'Plymouth', 'PLY', '#00563f'],
      ['Luton Town', 'Luton', 'LUT', '#f78f1e'], ['AFC Wimbledon', 'Wimbledon', 'WIM', '#1b3f8b'],
      ['Doncaster Rovers', 'Doncaster', 'DON', '#e2231a'], ['Port Vale', 'Port Vale', 'PVA', '#6b7280'],
    ],
  },
  EL2: {
    idBase: 1101,
    nation: 'England',
    teams: [
      ['Accrington Stanley', 'Accrington', 'ACC', '#c8102e'], ['Barnet', 'Barnet', 'BAR', '#f59e0b'],
      ['Barrow', 'Barrow', 'BRW', '#1d4ed8'], ['Bromley', 'Bromley', 'BRO', '#111827'],
      ['Cambridge United', 'Cambridge', 'CAM', '#f59e0b'], ['Cheltenham Town', 'Cheltenham', 'CHE', '#c8102e'],
      ['Chesterfield', 'Chesterfield', 'CHF', '#1d4ed8'], ['Colchester United', 'Colchester', 'COL', '#1d4ed8'],
      ['Crawley Town', 'Crawley', 'CRA', '#c8102e'], ['Crewe Alexandra', 'Crewe', 'CRE', '#c8102e'],
      ['Fleetwood Town', 'Fleetwood', 'FLE', '#c8102e'], ['Gillingham', 'Gillingham', 'GIL', '#1d4ed8'],
      ['Grimsby Town', 'Grimsby', 'GRI', '#111827'], ['Harrogate Town', 'Harrogate', 'HAR', '#eab308'],
      ['MK Dons', 'MK Dons', 'MKD', '#6b7280'], ['Newport County', 'Newport', 'NPT', '#f59e0b'],
      ['Notts County', 'Notts County', 'NCO', '#111827'], ['Oldham Athletic', 'Oldham', 'OLD', '#1d4ed8'],
      ['Salford City', 'Salford', 'SAL', '#c8102e'], ['Shrewsbury Town', 'Shrewsbury', 'SHR', '#1e3a8a'],
      ['Swindon Town', 'Swindon', 'SWI', '#c8102e'], ['Tranmere Rovers', 'Tranmere', 'TRA', '#1e3a8a'],
      ['Walsall', 'Walsall', 'WAL', '#c8102e'], ['Carlisle United', 'Carlisle', 'CAR', '#1d4ed8'],
    ],
  },
  SD: {
    idBase: 1201,
    nation: 'Spain',
    teams: [
      ['UD Almería', 'Almería', 'ALM', '#c8102e'], ['Cádiz CF', 'Cádiz', 'CAD', '#eab308'],
      ['Racing Santander', 'Racing', 'RAC', '#16a34a'], ['Sporting Gijón', 'Sporting', 'SPG', '#c8102e'],
      ['Real Zaragoza', 'Zaragoza', 'ZAR', '#1d4ed8'], ['Deportivo La Coruña', 'Deportivo', 'DEP', '#1d4ed8'],
      ['Málaga CF', 'Málaga', 'MAL', '#38bdf8'], ['Granada CF', 'Granada', 'GRA', '#c8102e'],
      ['UD Las Palmas', 'Las Palmas', 'LPA', '#eab308'], ['Real Valladolid', 'Valladolid', 'VLL', '#6b21a8'],
      ['SD Eibar', 'Eibar', 'EIB', '#1e3a8a'], ['SD Huesca', 'Huesca', 'HUE', '#1e3a8a'],
      ['Burgos CF', 'Burgos', 'BUR', '#111827'], ['Albacete', 'Albacete', 'ALB', '#6b7280'],
      ['CD Mirandés', 'Mirandés', 'MIR', '#c8102e'], ['CD Leganés', 'Leganés', 'LEG', '#1d4ed8'],
      ['CD Castellón', 'Castellón', 'CAS', '#111827'], ['Córdoba CF', 'Córdoba', 'COR', '#16a34a'],
      ['Cultural Leonesa', 'Cultural', 'CUL', '#6b7280'], ['AD Ceuta', 'Ceuta', 'CEU', '#1d4ed8'],
      ['FC Andorra', 'Andorra', 'AND', '#1e3a8a'], ['Real Sociedad B', 'Real Sociedad B', 'RSB', '#0067b1'],
    ],
  },
  FL2: {
    idBase: 1301,
    nation: 'France',
    teams: [
      ['AS Saint-Étienne', 'Saint-Étienne', 'ASSE', '#16a34a'], ['Montpellier HSC', 'Montpellier', 'MHSC', '#1e3a8a'],
      ['Stade de Reims', 'Reims', 'REI', '#c8102e'], ['ES Troyes AC', 'Troyes', 'TRO', '#1d4ed8'],
      ['Le Mans FC', 'Le Mans', 'LMA', '#c8102e'], ['EA Guingamp', 'Guingamp', 'EAG', '#c8102e'],
      ['Red Star FC', 'Red Star', 'RSF', '#16a34a'], ['Pau FC', 'Pau', 'PAU', '#eab308'],
      ['FC Annecy', 'Annecy', 'ANN', '#c8102e'], ['Grenoble Foot 38', 'Grenoble', 'GRE', '#1d4ed8'],
      ['Stade Lavallois', 'Laval', 'LAV', '#f97316'], ['Rodez AF', 'Rodez', 'ROD', '#c8102e'],
      ['Amiens SC', 'Amiens', 'AMI', '#6b7280'], ['SC Bastia', 'Bastia', 'BAS', '#1d4ed8'],
      ['Clermont Foot', 'Clermont', 'CLE', '#c8102e'], ['USL Dunkerque', 'Dunkerque', 'DUN', '#1d4ed8'],
      ['US Boulogne', 'Boulogne', 'BOU', '#c8102e'], ['AS Nancy Lorraine', 'Nancy', 'NAN', '#c8102e'],
    ],
  },
  MLS: {
    idBase: 1401,
    nation: 'United States',
    conferences: ['Eastern Conference', 'Western Conference'],
    calendarYear: true,
    kickoffs: [[23, 30], [23, 30], [23, 30], [24, 30], [24, 30], [25, 30], [26, 30], [20, 0], [22, 0], [26, 30]],
    teams: [
      // Eastern Conference
      ['Atlanta United', 'Atlanta', 'ATL', '#80000a'], ['Charlotte FC', 'Charlotte', 'CLT', '#1a85c8'],
      ['Chicago Fire', 'Chicago', 'CHI', '#c8102e'], ['FC Cincinnati', 'Cincinnati', 'CIN', '#f05323'],
      ['Columbus Crew', 'Columbus', 'CLB', '#fedd00'], ['D.C. United', 'D.C. United', 'DC', '#111827'],
      ['Inter Miami CF', 'Inter Miami', 'MIA', '#f7b5cd'], ['CF Montréal', 'Montréal', 'MTL', '#1d4ed8', 'Canada'],
      ['Nashville SC', 'Nashville', 'NSH', '#ece83a'], ['New England Revolution', 'New England', 'NE', '#0a2240'],
      ['New York City FC', 'NYCFC', 'NYC', '#6cace4'], ['New York Red Bulls', 'NY Red Bulls', 'RBNY', '#ed1e36'],
      ['Orlando City', 'Orlando', 'ORL', '#633492'], ['Philadelphia Union', 'Philadelphia', 'PHI', '#071b2c'],
      ['Toronto FC', 'Toronto', 'TOR', '#b81137', 'Canada'],
      // Western Conference
      ['Austin FC', 'Austin', 'ATX', '#00b140'], ['Colorado Rapids', 'Colorado', 'COL', '#960a2c'],
      ['FC Dallas', 'Dallas', 'DAL', '#e81f3e'], ['Houston Dynamo', 'Houston', 'HOU', '#ff6b00'],
      ['LA Galaxy', 'LA Galaxy', 'LA', '#00245d'], ['Los Angeles FC', 'LAFC', 'LAFC', '#111827'],
      ['Minnesota United', 'Minnesota', 'MIN', '#8cd2f4'], ['Portland Timbers', 'Portland', 'POR', '#004812'],
      ['Real Salt Lake', 'Salt Lake', 'RSL', '#b30838'], ['San Diego FC', 'San Diego', 'SD', '#1e3a8a'],
      ['San Jose Earthquakes', 'San Jose', 'SJ', '#0067b1'], ['Seattle Sounders', 'Seattle', 'SEA', '#5d9741'],
      ['Sporting Kansas City', 'Sporting KC', 'SKC', '#91b0d5'], ['St. Louis City SC', 'St. Louis', 'STL', '#dd004a'],
      ['Vancouver Whitecaps', 'Vancouver', 'VAN', '#00245e', 'Canada'],
    ],
  },
  SPL: {
    idBase: 1501,
    nation: 'Saudi Arabia',
    kickoffs: [[15, 0], [15, 35], [16, 0], [17, 0], [18, 0], [18, 0], [16, 30], [17, 30], [19, 0], [18, 0]],
    teams: [
      ['Al-Hilal', 'Al-Hilal', 'HIL', '#1d4ed8'], ['Al-Nassr', 'Al-Nassr', 'NAS', '#eab308'],
      ['Al-Ittihad', 'Al-Ittihad', 'ITT', '#111827'], ['Al-Ahli', 'Al-Ahli', 'AHL', '#16a34a'],
      ['Al-Qadsiah', 'Al-Qadsiah', 'QAD', '#c8102e'], ['Al-Ettifaq', 'Al-Ettifaq', 'ETT', '#16a34a'],
      ['Al-Taawoun', 'Al-Taawoun', 'TAA', '#eab308'], ['Al-Shabab', 'Al-Shabab', 'SHB', '#6b7280'],
      ['Al-Fateh', 'Al-Fateh', 'FAT', '#1d4ed8'], ['Al-Khaleej', 'Al-Khaleej', 'KHA', '#eab308'],
      ['Al-Riyadh', 'Al-Riyadh', 'RIY', '#c8102e'], ['Al-Fayha', 'Al-Fayha', 'FAY', '#f97316'],
      ['Al-Kholood', 'Al-Kholood', 'KHO', '#c8102e'], ['Al-Hazem', 'Al-Hazem', 'HAZ', '#b91c1c'],
      ['Al-Okhdood', 'Al-Okhdood', 'OKH', '#eab308'], ['Damac', 'Damac', 'DAM', '#b91c1c'],
      ['Al-Najma', 'Al-Najma', 'NAJ', '#1e3a8a'], ['NEOM SC', 'NEOM', 'NEO', '#0e7490'],
    ],
  },
  FL1: {
    idBase: 401,
    nation: 'France',
    teams: [
      ['Paris Saint-Germain', 'PSG', 'PSG', '#004170'], ['Olympique de Marseille', 'Marseille', 'OM', '#2faee0'],
      ['AS Monaco', 'Monaco', 'ASM', '#e51b22'], ['LOSC Lille', 'Lille', 'LIL', '#e01e13'],
      ['Olympique Lyonnais', 'Lyon', 'OL', '#1b3d8f'], ['OGC Nice', 'Nice', 'NIC', '#c8102e'],
      ['RC Lens', 'Lens', 'RCL', '#fcd116'], ['Stade Rennais', 'Rennes', 'REN', '#e13327'],
      ['RC Strasbourg', 'Strasbourg', 'RCS', '#009fe3'], ['FC Nantes', 'Nantes', 'NAN', '#fcd405'],
      ['Toulouse FC', 'Toulouse', 'TFC', '#6a2c91'], ['Stade Brestois', 'Brest', 'SB29', '#e30613'],
      ['AJ Auxerre', 'Auxerre', 'AJA', '#0066b3'], ['Angers SCO', 'Angers', 'SCO', '#6b7280'],
      ['Le Havre AC', 'Le Havre', 'HAC', '#1d9bd7'], ['FC Lorient', 'Lorient', 'FCL', '#f58220'],
      ['Paris FC', 'Paris FC', 'PFC', '#1e3a8a'], ['FC Metz', 'Metz', 'FCM', '#7c1d3f'],
    ],
  },
};

// Clubs in the Champions League from outside the five leagues above.
const EXTRA_CL: { area: string; team: TeamSeed }[] = [
  { area: 'Portugal', team: ['SL Benfica', 'Benfica', 'SLB', '#e20e0e'] },
  { area: 'Portugal', team: ['FC Porto', 'Porto', 'FCP', '#00428c'] },
  { area: 'Portugal', team: ['Sporting CP', 'Sporting', 'SCP', '#008057'] },
  { area: 'Netherlands', team: ['PSV', 'PSV', 'PSV', '#ed1c24'] },
  { area: 'Netherlands', team: ['Ajax', 'Ajax', 'AJA', '#d2122e'] },
  { area: 'Netherlands', team: ['Feyenoord', 'Feyenoord', 'FEY', '#e30613'] },
  { area: 'Scotland', team: ['Celtic', 'Celtic', 'CEL', '#018749'] },
  { area: 'Belgium', team: ['Club Brugge', 'Club Brugge', 'CLB', '#0065b3'] },
  { area: 'Turkey', team: ['Galatasaray', 'Galatasaray', 'GAL', '#a90432'] },
  { area: 'Austria', team: ['Red Bull Salzburg', 'Salzburg', 'RBS', '#d0021b'] },
  { area: 'Croatia', team: ['Dinamo Zagreb', 'Dinamo Zagreb', 'DZG', '#0033a0'] },
  { area: 'Switzerland', team: ['BSC Young Boys', 'Young Boys', 'YB', '#fbd200'] },
  { area: 'Czechia', team: ['Slavia Praha', 'Slavia Praha', 'SLA', '#c8102e'] },
  { area: 'Greece', team: ['Olympiacos', 'Olympiacos', 'OLY', '#d71920'] },
  { area: 'Denmark', team: ['FC København', 'København', 'FCK', '#1e3a8a'] },
  { area: 'Norway', team: ['Bodø/Glimt', 'Bodø/Glimt', 'BOD', '#fcd116'] },
];


// Clubs in the Europa League and Conference League from outside the leagues above.
const EXTRA_EL: { area: string; team: TeamSeed }[] = (
  [
    ['Scotland', 'Rangers', 'RAN', '#1b458f'], ['Turkey', 'Fenerbahçe', 'FEN', '#163962'],
    ['Portugal', 'SC Braga', 'SCB', '#e30613'], ['Netherlands', 'AZ Alkmaar', 'AZ', '#db0021'],
    ['Netherlands', 'FC Utrecht', 'UTR', '#e2231a'], ['Belgium', 'KRC Genk', 'GNK', '#0b3d91'],
    ['Hungary', 'Ferencváros', 'FTC', '#1a7a3b'], ['Serbia', 'Crvena zvezda', 'CZV', '#d71920'],
    ['Greece', 'PAOK', 'PAOK', '#111827'], ['Denmark', 'FC Midtjylland', 'FCM', '#b91c1c'],
    ['Sweden', 'Malmö FF', 'MFF', '#38bdf8'], ['Bulgaria', 'Ludogorets', 'LUD', '#16803c'],
    ['Czechia', 'Viktoria Plzeň', 'PLZ', '#1e3a8a'], ['Austria', 'Sturm Graz', 'STU', '#111827'],
    ['Switzerland', 'FC Basel', 'BAS', '#d71920'], ['Norway', 'SK Brann', 'BRA', '#d71920'],
    ['Greece', 'Panathinaikos', 'PAO', '#007a3d'], ['Netherlands', 'Go Ahead Eagles', 'GAE', '#c8102e'],
    ['Israel', 'Maccabi Tel Aviv', 'MTA', '#eab308'], ['Romania', 'FCSB', 'FCSB', '#1d4ed8'],
    ['Ukraine', 'Dynamo Kyiv', 'DYN', '#1d4ed8'],
  ] as const
).map(([area, name, tla, color]) => ({ area, team: [name, name, tla, color] as TeamSeed }));

const EXTRA_ECL: { area: string; team: TeamSeed }[] = (
  [
    ['Ireland', 'Shamrock Rovers', 'SHA', '#009a44'], ['Poland', 'Legia Warsaw', 'LEG', '#117a3e'],
    ['Poland', 'Lech Poznań', 'LPO', '#1d4ed8'], ['Austria', 'Rapid Wien', 'RAP', '#00843d'],
    ['Cyprus', 'Omonia', 'OMO', '#00843d'], ['Greece', 'AEK Athens', 'AEK', '#eab308'],
    ['Cyprus', 'AEK Larnaca', 'AEL', '#ca8a04'], ['Czechia', 'Sparta Prague', 'SPA', '#7f1d1d'],
    ['Ukraine', 'Shakhtar Donetsk', 'SHK', '#f97316'], ['Slovakia', 'Slovan Bratislava', 'SLO', '#38bdf8'],
    ['Scotland', 'Aberdeen', 'ABE', '#c8102e'], ['Croatia', 'HNK Rijeka', 'RIJ', '#1d4ed8'],
    ['Slovenia', 'NK Celje', 'CEL', '#f59e0b'], ['Poland', 'Jagiellonia', 'JAG', '#eab308'],
    ['Switzerland', 'Lausanne-Sport', 'LAU', '#1e3a8a'], ['Turkey', 'Samsunspor', 'SAM', '#d71920'],
    ['Poland', 'Raków Częstochowa', 'RAK', '#b91c1c'], ['Finland', 'KuPS', 'KUP', '#eab308'],
    ['Ireland', 'Shelbourne', 'SHE', '#c8102e'], ['Kosovo', 'Drita', 'DRI', '#1d4ed8'],
    ['Armenia', 'FC Noah', 'NOA', '#111827'], ['Bosnia and Herzegovina', 'Zrinjski', 'ZRI', '#c8102e'],
    ['Iceland', 'Breiðablik', 'BRE', '#16a34a'], ['Czechia', 'Sigma Olomouc', 'SIG', '#1d4ed8'],
    ['Sweden', 'BK Häcken', 'HAC', '#eab308'], ['Romania', 'Universitatea Craiova', 'UCR', '#1d4ed8'],
  ] as const
).map(([area, name, tla, color]) => ({ area, team: [name, name, tla, color] as TeamSeed }));

type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC';

const NATIONS: { conf: Confederation; team: TeamSeed }[] = [
  // UEFA – the first 16 make up the Nations League groups, four at a time.
  ...([
    ['Spain', 'ESP', '#c60b1e'], ['Portugal', 'POR', '#006600'], ['Netherlands', 'NED', '#f36c21'], ['Scotland', 'SCO', '#1c2c5b'],
    ['France', 'FRA', '#002395'], ['Italy', 'ITA', '#0066cc'], ['Belgium', 'BEL', '#e30613'], ['Denmark', 'DEN', '#c8102e'],
    ['Germany', 'GER', '#1f2937'], ['Croatia', 'CRO', '#e1261c'], ['Switzerland', 'SUI', '#d52b1e'], ['Norway', 'NOR', '#ba0c2f'],
    ['England', 'ENG', '#1e3a8a'], ['Serbia', 'SRB', '#c6363c'], ['Wales', 'WAL', '#c8102e'], ['Austria', 'AUT', '#ed2939'],
  ] as const).map(([n, tla, c]) => ({ conf: 'UEFA' as const, team: [n, n, tla, c] as TeamSeed })),
  ...([
    ['Brazil', 'BRA', '#009c3b'], ['Argentina', 'ARG', '#75aadb'], ['Uruguay', 'URU', '#5ba3dc'], ['Colombia', 'COL', '#fcd116'],
    ['Ecuador', 'ECU', '#ffdd00'], ['Chile', 'CHI', '#d52b1e'], ['Paraguay', 'PAR', '#d52b1e'], ['Peru', 'PER', '#d91023'],
    ['Venezuela', 'VEN', '#7a1f2b'], ['Bolivia', 'BOL', '#007934'],
  ] as const).map(([n, tla, c]) => ({ conf: 'CONMEBOL' as const, team: [n, n, tla, c] as TeamSeed })),
  ...([
    ['United States', 'USA', '#1d3557'], ['Mexico', 'MEX', '#006847'], ['Canada', 'CAN', '#d52b1e'],
    ['Costa Rica', 'CRC', '#002b7f'], ['Panama', 'PAN', '#d21034'], ['Jamaica', 'JAM', '#fed100'],
  ] as const).map(([n, tla, c]) => ({ conf: 'CONCACAF' as const, team: [n, n === 'United States' ? 'USA' : n, tla, c] as TeamSeed })),
  ...([
    ['Morocco', 'MAR', '#c1272d'], ['Senegal', 'SEN', '#00853f'], ['Nigeria', 'NGA', '#008751'], ['Egypt', 'EGY', '#ce1126'],
    ['Ivory Coast', 'CIV', '#f77f00'], ['Ghana', 'GHA', '#006b3f'], ['Algeria', 'ALG', '#006233'], ['Cameroon', 'CMR', '#007a5e'],
    ['Tunisia', 'TUN', '#e70013'], ['Mali', 'MLI', '#14b53a'], ['South Africa', 'RSA', '#007749'], ['DR Congo', 'COD', '#007fff'],
    ['Burkina Faso', 'BFA', '#ef2b2d'], ['Guinea', 'GUI', '#ce1126'], ['Cape Verde', 'CPV', '#003893'], ['Zambia', 'ZAM', '#198a00'],
  ] as const).map(([n, tla, c]) => ({ conf: 'CAF' as const, team: [n, n, tla, c] as TeamSeed })),
  ...([
    ['Japan', 'JPN', '#000080'], ['South Korea', 'KOR', '#cd2e3a'], ['Australia', 'AUS', '#ffcd00'],
    ['Iran', 'IRN', '#239f40'], ['Saudi Arabia', 'KSA', '#006c35'], ['Qatar', 'QAT', '#8a1538'],
  ] as const).map(([n, tla, c]) => ({ conf: 'AFC' as const, team: [n, n, tla, c] as TeamSeed })),
];

const FIRST = [
  'Alex', 'Ben', 'Callum', 'Dani', 'Eli', 'Femi', 'Gabe', 'Hugo', 'Isaac', 'Jonah', 'Kai', 'Luca', 'Marco',
  'Nico', 'Omar', 'Pablo', 'Quinn', 'Rafa', 'Sami', 'Theo', 'Umar', 'Victor', 'Wes', 'Xavi', 'Yusuf', 'Zane',
  'Leo', 'Mateo', 'Jude', 'Ruben', 'Emil', 'Jonas', 'Lorenzo', 'Matteo', 'Oscar', 'Jules', 'Iker', 'Joao',
  'Adam', 'Bruno', 'Cesar', 'Diego', 'Erik', 'Felix', 'Goncalo', 'Hamza', 'Ilias', 'Kobe', 'Liam', 'Milan',
];
const LAST = [
  'Adeyemi', 'Barros', 'Carver', 'Duarte', 'Ekwueme', 'Fischer', 'Gallo', 'Hartley', 'Ivanov', 'Jansen',
  'Kovac', 'Lindqvist', 'Mensah', 'Novak', 'Okafor', 'Petit', 'Quaresma', 'Rinaldi', 'Silva', 'Toure', 'Ueda',
  'Vidal', 'Walsh', 'Yilmaz', 'Zielinski', 'Moreau', 'Osei', 'Brandt', 'Castro', 'Doherty', 'Lange', 'Bernard',
  'Esposito', 'Navarro', 'Hoffmann', 'Lefebvre', 'Romero', 'Keller', 'Marchetti', 'Aguirre', 'Dubois', 'Vogel',
  'Andersen', 'Berg', 'Costa', 'Delaney', 'Eriksen', 'Ferreira', 'Garcia', 'Hansen', 'Jovic', 'Kruger',
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SQUAD_SHAPE: Position[] = [
  'GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD',
];

/** Circle-method round robin: returns [home, away] pairs per round. */
export function roundRobin<T>(items: T[]): [T, T][][] {
  const ids = [...items];
  const rounds: [T, T][][] = [];
  for (let r = 0; r < ids.length - 1; r++) {
    const round: [T, T][] = [];
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

/** One table, or one per conference (each half of `list`), numbered from 1. */
function leagueStandings(list: Team[], played: Match[], conferences?: string[]): StandingGroup[] {
  const rows = computeStandings(list.map(ref), played);
  if (!conferences) return [{ rows }];
  const size = list.length / conferences.length;
  return conferences.map((name, k) => {
    const members = new Set(list.slice(k * size, (k + 1) * size).map((t) => t.id));
    return { name, rows: rows.filter((r) => members.has(r.team.id)).map((r, i) => ({ ...r, position: i + 1 })) };
  });
}

function seasonLabel(now: Date): string {
  const start = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

function ref(t: Team): TeamRef {
  return { id: t.id, name: t.name, shortName: t.shortName, tla: t.tla, crest: t.crest, color: t.color };
}

interface DemoWorld {
  season: string;
  competitions: Competition[];
  data: Map<string, CompetitionData>;
  teams: Map<number, Team>;
  /** Players by club; national teams pick from these by nationality. */
  clubPlayers: Map<number, Player[]>;
  nationSquads: Map<number, Player[]>;
  matches: Match[];
  transfers: Transfer[];
}

export function buildDemoWorld(now = new Date()): DemoWorld {
  const rand = mulberry32(2026);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const comp = (code: string) => COMPETITIONS.find((c) => c.code === code)!;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hour, minute);
    return d;
  };

  let matchId = 10_000;
  const scoreFor = () => {
    const r = rand();
    return r < 0.25 ? 0 : r < 0.6 ? 1 : r < 0.85 ? 2 : r < 0.96 ? 3 : 4;
  };
  /** Builds a match; kick-offs in the past are finished, and ones under way are live. */
  const makeMatch = (code: string, home: Team, away: Team, kickoff: Date, matchday: number | undefined, stage?: string): Match => {
    const elapsed = (now.getTime() - kickoff.getTime()) / 60_000;
    let status: Match['status'] = 'SCHEDULED';
    let minute: number | undefined;
    let statusText: string | undefined;
    if (elapsed >= 115) status = 'FINISHED';
    else if (elapsed >= 0) {
      status = 'LIVE';
      if (elapsed > 47 && elapsed < 62) statusText = 'HT';
      else minute = Math.min(90, Math.max(1, Math.round(elapsed >= 62 ? elapsed - 17 : elapsed)));
    }
    const played = status !== 'SCHEDULED';
    const share = status === 'LIVE' ? (minute ?? 45) / 90 : 1;
    const c = comp(code);
    return {
      id: matchId++,
      competition: { code: c.code, name: c.name },
      utcDate: kickoff.toISOString(),
      status,
      minute,
      statusText,
      matchday,
      stage,
      home: ref(home),
      away: ref(away),
      homeScore: played ? Math.round(scoreFor() * share) : null,
      awayScore: played ? Math.round(scoreFor() * share) : null,
    };
  };

  const teams = new Map<number, Team>();
  const leagueTeams = new Map<string, Team[]>();
  for (const [code, { idBase, nation, teams: seeds }] of Object.entries(LEAGUE_TEAMS)) {
    const c = comp(code);
    const list = seeds.map(([name, shortName, tla, color, area], i) => {
      const t: Team = { id: idBase + i, name, shortName, tla, color, area: area ?? nation, league: { code, name: c.name } };
      teams.set(t.id, t);
      return t;
    });
    leagueTeams.set(code, list);
  }
  const extras = (seeds: { area: string; team: TeamSeed }[], idBase: number) =>
    seeds.map(({ area, team: [name, shortName, tla, color] }, i) => {
      const t: Team = { id: idBase + i, name, shortName, tla, color, area };
      teams.set(t.id, t);
      return t;
    });
  const extraClubs = extras(EXTRA_CL, 501);
  const extraEl = extras(EXTRA_EL, 1601);
  const extraEcl = extras(EXTRA_ECL, 1701);
  const nations = NATIONS.map(({ team: [name, shortName, tla, color] }, i) => {
    const t: Team = { id: 901 + i, name, shortName, tla, color, area: name, national: true };
    teams.set(t.id, t);
    return t;
  });

  const matches: Match[] = [];

  // Domestic leagues: weekly rounds, five played, this weekend's round, then two more.
  const PLAYED = 5;
  const kickoffs: [number, number][] = [[11, 30], [14, 0], [14, 0], [14, 0], [16, 30], [19, 0], [13, 0], [15, 15], [17, 30], [19, 45]];
  for (const [code, list] of leagueTeams) {
    const slots = LEAGUE_TEAMS[code].kickoffs ?? kickoffs;
    const rounds = roundRobin(list).slice(0, PLAYED + 3);
    rounds.forEach((round, r) => {
      round.forEach(([home, away], i) => {
        const [h, m] = slots[i % slots.length];
        const dayOffset = (r - PLAYED) * 7 + (i >= 7 ? 1 : 0);
        matches.push(makeMatch(code, home, away, at(dayOffset, h, m), r + 1));
      });
    });
  }

  // Knockout ties: a draw goes to penalties, and the winner goes through.
  const knockout = (code: string, home: Team, away: Team, kickoff: Date, stage: string): Match => {
    const m = makeMatch(code, home, away, kickoff, undefined, stage);
    if (m.status === 'FINISHED' && m.homeScore === m.awayScore) {
      const homeWins = rand() < 0.5;
      m.note = `${(homeWins ? m.home : m.away).shortName} win ${homeWins ? '5-4' : '4-3'} on penalties`;
    }
    return m;
  };
  const winnerOf = (m: Match): Team => {
    if (m.homeScore !== m.awayScore) return teams.get(m.homeScore! > m.awayScore! ? m.home.id : m.away.id)!;
    return teams.get(m.note?.startsWith(`${m.home.shortName} win`) ? m.home.id : m.away.id)!;
  };
  const shuffled = <T,>(list: T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // EFL Cup: third round already played, fourth round drawn.
  const eflTeams = [...leagueTeams.get('PL')!, ...leagueTeams.get('ELC')!.slice(0, 12)];
  const drawOrder = shuffled(eflTeams);
  const third: Match[] = [];
  for (let i = 0; i < drawOrder.length; i += 2)
    third.push(knockout('EFL', drawOrder[i], drawOrder[i + 1], at(-4 + (i % 4 ? 1 : 0), i % 3 ? 18 : 19, 45), 'Third round'));
  const through = third.map(winnerOf);
  for (let i = 0; i < through.length; i += 2)
    third.push(knockout('EFL', through[i], through[i + 1], at(31 + (i % 4 ? 1 : 0), 19, 45), 'Fourth round'));
  matches.push(...third);

  // European league phases: 36 clubs, 8 matchdays, two played. The Champions
  // League plays Tuesday and Wednesday; the Europa and Conference Leagues on Thursday.
  const topFlights = ['PL', 'PD', 'BL1', 'SA', 'FL1'];
  const fromTopFlights = (from: number, to: number) => topFlights.flatMap((code) => leagueTeams.get(code)!.slice(from, to));
  const matchdays = [-19, -5, 9, 23, 37, 51, 65, 79];
  const leaguePhase = (code: string, clubs: Team[], dayShift: number, twoNights: boolean) =>
    roundRobin(clubs)
      .slice(0, 8)
      .forEach((round, r) =>
        round.forEach(([home, away], i) => {
          const second = twoNights && i >= round.length / 2;
          const early = i % 3 === 0;
          matches.push(
            makeMatch(code, home, away, at(matchdays[r] + dayShift + (second ? 1 : 0), early ? 16 : 19, early ? 45 : 0), r + 1, 'League phase'),
          );
        }),
      );
  const clTeams = [...fromTopFlights(0, 4), ...extraClubs];
  const elTeams = [...fromTopFlights(4, 7), ...extraEl];
  const eclTeams = [...fromTopFlights(7, 9), ...extraEcl];
  leaguePhase('CL', clTeams, 0, true);
  leaguePhase('EL', elTeams, 2, false);
  leaguePhase('ECL', eclTeams, 2, false);

  const byConf = (conf: Confederation) => nations.filter((_, i) => NATIONS[i].conf === conf);

  // Nations League: the first 16 UEFA nations in four groups of four, home and away.
  // International windows sit within the Scores page's date range so they're easy to find.
  const nlDays = [-6, -3, 4, 7, 40, 43];
  const nlGroups: StandingGroup[] = [];
  byConf('UEFA')
    .slice(0, 16)
    .forEach((_, i, uefa) => {
      if (i % 4) return;
      const group = `Group A${i / 4 + 1}`;
      const members = uefa.slice(i, i + 4);
      const firstLeg = roundRobin(members);
      const legs = [...firstLeg, ...firstLeg.map((round) => round.map(([a, b]) => [b, a] as [Team, Team]))];
      const groupMatches = legs.flatMap((round, r) =>
        round.map(([home, away], k) => makeMatch('UNL', home, away, at(nlDays[r], k ? 18 : 16, 45), r + 1, group)),
      );
      matches.push(...groupMatches);
      nlGroups.push({ name: group, rows: computeStandings(members.map(ref), groupMatches) });
    });

  /**
   * A tournament: groups of four (one round robin), then the top two go into
   * knockout rounds. Each knockout round is only drawn once the previous stage
   * has finished, so upcoming tournaments show just their group fixtures.
   */
  const tournament = (code: string, entrants: Team[], firstDay: number) => {
    const groups: StandingGroup[] = [];
    const out: Match[] = [];
    const qualified: Team[][] = [];
    const order = shuffled(entrants);
    for (let g = 0; g * 4 < order.length; g++) {
      const name = `Group ${String.fromCharCode(65 + g)}`;
      const members = order.slice(g * 4, g * 4 + 4);
      const gm = roundRobin(members).flatMap((round, r) =>
        round.map(([home, away], k) =>
          makeMatch(code, home, away, at(firstDay + r * 4 + (g % 4 >= 2 ? 1 : 0), [13, 16, 19][(g + k) % 3], 0), r + 1, name),
        ),
      );
      out.push(...gm);
      const rows = computeStandings(members.map(ref), gm);
      groups.push({ name, rows });
      qualified.push(rows.slice(0, 2).map((r) => teams.get(r.team.id)!));
    }
    const ROUND: Record<number, string> = { 16: 'Round of 16', 8: 'Quarter-finals', 4: 'Semi-finals', 2: 'Final' };
    if (out.every((m) => m.status === 'FINISHED')) {
      // Group winners play runners-up from the neighbouring group.
      let alive: Team[] = qualified.flatMap((_, g) => (g % 2 ? [] : [qualified[g][0], qualified[g + 1][1], qualified[g + 1][0], qualified[g][1]]));
      let day = firstDay + 13;
      while (alive.length >= 2) {
        const round: Match[] = [];
        for (let i = 0; i < alive.length; i += 2)
          round.push(knockout(code, alive[i], alive[i + 1], at(day + (i % 4 ? 1 : 0), i % 4 ? 19 : 16, 0), ROUND[alive.length]));
        out.push(...round);
        if (!round.every((m) => m.status === 'FINISHED')) break;
        alive = round.map(winnerOf);
        day += 4;
      }
    }
    matches.push(...out);
    return { matches: out, groups, entrants };
  };

  // Demo editions: a World Cup just finished; the Euros, Copa América and AFCON are coming up.
  const uefa = byConf('UEFA');
  const tournaments = {
    WC: tournament(
      'WC',
      [...uefa.slice(0, 13), ...byConf('CONMEBOL').slice(0, 6), ...byConf('CONCACAF').slice(0, 3), ...byConf('CAF').slice(0, 5), ...byConf('AFC').slice(0, 5)],
      -80,
    ),
    EC: tournament('EC', uefa, 250),
    CA: tournament('CA', [...byConf('CONMEBOL'), ...byConf('CONCACAF')], 270),
    AFCON: tournament('AFCON', byConf('CAF'), 95),
  };

  // Friendlies in the international windows, for nations not playing in the Nations League.
  const friendlyNations = nations.filter((n) => !nlGroups.some((g) => g.rows.some((r) => r.team.id === n.id)));
  const friendlies: Match[] = [];
  for (const day of [-5, -2, 5, 8]) {
    const pairs = shuffled(friendlyNations).slice(0, 24);
    const window = `${at(day, 12).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} window`;
    for (let i = 0; i < pairs.length; i += 2)
      friendlies.push(makeMatch('FRI', pairs[i], pairs[i + 1], at(day, [17, 19, 23, 1][i % 4], i % 3 ? 0 : 30), undefined, window));
  }
  matches.push(...friendlies);

  // Squads with stats consistent with the matches played in their competition.
  const clubPlayers = new Map<number, Player[]>();
  let playerId = 1;
  const usedNames = new Set<string>();
  const nationNames = NATIONS.map((n) => n.team[0]);
  const makeSquad = (team: Team, code: string, played: Match[]) => {
    const c = comp(code);
    const conceded = played.map((m) => (m.home.id === team.id ? m.awayScore! : m.homeScore!));
    const cleanSheets = conceded.filter((x) => x === 0).length;
    const squad = SQUAD_SHAPE.map((position, idx) => {
      let name = `${pick(FIRST)} ${pick(LAST)}`;
      // The name pool is finite, so fall back to a middle initial rather than looping forever.
      for (let tries = 0; usedNames.has(name); tries++)
        name = tries < 20 ? `${pick(FIRST)} ${pick(LAST)}` : `${pick(FIRST)} ${pick(FIRST)[0]}. ${pick(LAST)}`;
      usedNames.add(name);
      const starter = idx % 5 !== 1;
      const games = played.length;
      const appearances = starter ? Math.max(0, games - Math.floor(rand() * 2)) : Math.floor(rand() * Math.min(3, games + 1));
      const attack = { GK: 0, DEF: 0.08, MID: 0.25, FWD: 0.55 }[position];
      const goals = Array.from({ length: appearances }).filter(() => rand() < attack).length;
      const assists = Array.from({ length: appearances }).filter(() => rand() < attack * 0.7).length;
      const stats = {
        appearances,
        goals,
        assists,
        cleanSheets: position === 'GK' || position === 'DEF' ? Math.min(cleanSheets, appearances) : 0,
        yellowCards: Math.floor(rand() * 3),
        redCards: rand() < 0.03 ? 1 : 0,
        minutes: appearances * (70 + Math.floor(rand() * 21)),
      };
      // Roughly half the squad is from the club's own country.
      const nationality = rand() < 0.5 && team.area ? team.area : pick(nationNames);
      const player: Player = {
        id: playerId++,
        name,
        teamId: team.id,
        team: ref(team),
        competition: { code: c.code, name: c.name },
        position,
        nationality,
        age: 18 + Math.floor(rand() * 17),
        price: estimatePrice(position, stats, starter ? 1 : 0.6),
        stats,
      };
      return player;
    });
    clubPlayers.set(team.id, squad);
    return squad;
  };
  const finishedFor = (teamId: number, code: string) =>
    matches.filter(
      (m) => m.competition.code === code && m.status === 'FINISHED' && (m.home.id === teamId || m.away.id === teamId),
    );
  for (const [code, list] of leagueTeams) for (const t of list) makeSquad(t, code, finishedFor(t.id, code));
  for (const t of extraClubs) makeSquad(t, 'CL', finishedFor(t.id, 'CL'));
  for (const t of extraEl) makeSquad(t, 'EL', finishedFor(t.id, 'EL'));
  for (const t of extraEcl) makeSquad(t, 'ECL', finishedFor(t.id, 'ECL'));

  // National squads: best 23 players of each nationality across all clubs.
  const allClubPlayers = [...clubPlayers.values()].flat();
  const nationSquads = new Map<number, Player[]>();
  for (const n of nations) {
    const pool = allClubPlayers
      .filter((p) => p.nationality === n.name)
      .sort((a, b) => fantasyPoints(b.position, b.stats) - fantasyPoints(a.position, a.stats));
    const squad = (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
      pool.filter((p) => p.position === pos).slice(0, { GK: 3, DEF: 7, MID: 7, FWD: 6 }[pos]),
    );
    nationSquads.set(n.id, squad);
  }

  const season = seasonLabel(now);
  const data = new Map<string, CompetitionData>();
  for (const [code, list] of leagueTeams) {
    const compMatches = matches.filter((m) => m.competition.code === code);
    data.set(code, {
      competition: comp(code),
      season: LEAGUE_TEAMS[code].calendarYear ? String(now.getUTCFullYear()) : season,
      teams: list,
      players: list.flatMap((t) => clubPlayers.get(t.id)!),
      matches: compMatches,
      standings: leagueStandings(list, compMatches, LEAGUE_TEAMS[code].conferences),
    });
  }
  data.set('EFL', {
    competition: comp('EFL'),
    season,
    teams: eflTeams,
    players: eflTeams.flatMap((t) => clubPlayers.get(t.id)!),
    matches: third,
    standings: [],
  });
  for (const [code, clubs] of [['CL', clTeams], ['EL', elTeams], ['ECL', eclTeams]] as const) {
    const phase = matches.filter((m) => m.competition.code === code);
    data.set(code, {
      competition: comp(code),
      season,
      teams: clubs,
      // European stats for clubs from outside the leagues above; league stats for the rest.
      players: clubs.flatMap((t) => clubPlayers.get(t.id)!),
      matches: phase,
      standings: [{ name: 'League phase', rows: computeStandings(clubs.map(ref), phase) }],
    });
  }
  const nlTeams = nations.filter((n) => nlGroups.some((g) => g.rows.some((r) => r.team.id === n.id)));
  data.set('UNL', {
    competition: comp('UNL'),
    season,
    teams: nlTeams,
    players: nlTeams.flatMap((n) => nationSquads.get(n.id)!),
    matches: matches.filter((m) => m.competition.code === 'UNL'),
    standings: nlGroups,
  });
  for (const [code, t] of Object.entries(tournaments)) {
    data.set(code, {
      competition: comp(code),
      // Not a real edition's year: these results are invented.
      season: 'Demo edition',
      teams: t.entrants,
      players: t.entrants.flatMap((n) => nationSquads.get(n.id)!),
      matches: t.matches,
      standings: t.groups,
    });
  }
  data.set('FRI', {
    competition: comp('FRI'),
    season,
    teams: friendlyNations,
    players: [],
    matches: friendlies,
    standings: [],
  });

  // Transfer activity, including moves between leagues.
  const types: TransferType[] = ['permanent', 'permanent', 'loan', 'free', 'rumour'];
  const clubs = [...leagueTeams.values()].flat().concat(extraClubs, extraEl, extraEcl);
  const transfers: Transfer[] = [];
  for (let i = 0; i < 60; i++) {
    const player = pick(allClubPlayers);
    const from = teams.get(player.teamId)!;
    const to = pick(clubs.filter((t) => t.id !== from.id));
    const type = pick(types);
    const date = new Date(today);
    // Completed moves over the last three months; rumours are recent.
    date.setUTCDate(date.getUTCDate() - Math.floor(rand() * (type === 'rumour' ? 21 : 90)));
    transfers.push({
      id: `t${i}`,
      playerName: player.name,
      playerId: player.id,
      competitionCode: player.competition.code,
      from: ref(from),
      to: ref(to),
      fee:
        type === 'permanent' ? `£${5 + Math.floor(rand() * 70)}m`
        : type === 'loan' ? 'Loan'
        : type === 'free' ? 'Free'
        : `£${10 + Math.floor(rand() * 60)}m (reported)`,
      date: date.toISOString(),
      type,
    });
  }
  transfers.sort((a, b) => b.date.localeCompare(a.date));

  return { season, competitions: COMPETITIONS, data, teams, clubPlayers, nationSquads, matches, transfers };
}

/** Demo headlines written from the demo's own results, fixtures and transfers. */
export function buildDemoNews(w: DemoWorld, now = new Date()): NewsItem[] {
  const DAY = 86_400_000;
  const items: NewsItem[] = [];
  const recent = w.matches
    .filter((m) => m.status === 'FINISHED' && now.getTime() - Date.parse(m.utcDate) < 8 * DAY)
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  for (const m of recent) {
    const hs = m.homeScore!;
    const as = m.awayScore!;
    const homeThrough = m.note ? m.note.startsWith(`${m.home.shortName} win`) : hs >= as;
    const [win, lose, ws, ls] = homeThrough ? [m.home, m.away, hs, as] : [m.away, m.home, as, hs];
    const where = m.stage ? `${m.competition.name} ${m.stage.toLowerCase()}` : m.competition.name;
    const title = m.note
      ? `${win.shortName} knock out ${lose.shortName} on penalties after ${hs}-${as} draw`
      : hs === as
        ? `${m.home.shortName} and ${m.away.shortName} share the points in ${hs}-${as} draw`
        : ws - ls >= 3
          ? `${win.shortName} thrash ${lose.shortName} ${ws}-${ls}`
          : `${win.shortName} beat ${lose.shortName} ${ws}-${ls}`;
    items.push({
      id: `r${m.id}`,
      title,
      summary: `${where}: ${m.home.name} ${hs}-${as} ${m.away.name}.`,
      url: `#/team/${win.id}`,
      source: 'FootIQ Demo',
      publishedAt: new Date(Date.parse(m.utcDate) + 2 * 3_600_000).toISOString(),
      teamIds: [m.home.id, m.away.id],
    });
  }
  for (const t of w.transfers) {
    if (now.getTime() - Date.parse(t.date) > 30 * DAY || Date.parse(t.date) > now.getTime()) continue;
    const title =
      t.type === 'rumour'
        ? `${t.to.shortName} monitoring ${t.from.shortName}'s ${t.playerName}`
        : t.type === 'loan'
          ? `${t.playerName} joins ${t.to.shortName} on loan from ${t.from.shortName}`
          : `${t.to.shortName} sign ${t.playerName} from ${t.from.shortName}${t.type === 'free' ? ' on a free' : ` for ${t.fee}`}`;
    items.push({
      id: `t${t.id}`,
      title,
      summary: t.type === 'rumour' ? `Reports suggest a fee of ${t.fee?.replace(' (reported)', '')}.` : undefined,
      url: t.playerId && t.competitionCode ? `#/player/${t.competitionCode}/${t.playerId}` : `#/team/${t.to.id}`,
      source: 'FootIQ Demo',
      publishedAt: t.date,
      teamIds: [t.from.id, t.to.id],
    });
  }
  const upcoming = w.matches
    .filter((m) => m.status === 'SCHEDULED' && Date.parse(m.utcDate) - now.getTime() < 4 * DAY)
    .filter((m) => m.competition.code !== 'PL' || m.home.id < 7)
    .slice(0, 12);
  for (const m of upcoming) {
    items.push({
      id: `p${m.id}`,
      title: `Preview: ${m.home.shortName} v ${m.away.shortName}`,
      summary: `${m.competition.name}${m.stage ? ` · ${m.stage}` : ''}. Kick-off ${new Date(m.utcDate).toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' })}.`,
      url: `#/team/${m.home.id}`,
      source: 'FootIQ Demo',
      publishedAt: new Date(Math.min(now.getTime(), Date.parse(m.utcDate) - DAY)).toISOString(),
      teamIds: [m.home.id, m.away.id],
    });
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

let world: DemoWorld | null = null;
const getWorld = () => (world ??= buildDemoWorld());

export const demoProvider: DataProvider = {
  id: 'demo',

  async listCompetitions() {
    return COMPETITIONS;
  },

  async searchTeams(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return [...getWorld().teams.values()]
      .filter((t) => t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q))
      .slice(0, 30);
  },

  async loadCompetition(code) {
    const d = getWorld().data.get(code);
    if (!d) throw new Error(`Unknown competition ${code}`);
    return d;
  },

  async loadMatches(from, to) {
    return getWorld().matches.filter((m) => {
      const t = Date.parse(m.utcDate);
      return t >= from.getTime() && t <= to.getTime();
    });
  },

  async loadTeam(id): Promise<TeamData> {
    const w = getWorld();
    const team = w.teams.get(id);
    if (!team) throw new Error('Team not found');
    const matches = w.matches.filter((m) => m.home.id === id || m.away.id === id);
    const codes = [...new Set(matches.map((m) => m.competition.code))];
    return {
      team,
      competitions: w.competitions.filter((c) => codes.includes(c.code)).map((c) => ({ code: c.code, name: c.name })),
      squad: (team.national ? w.nationSquads.get(id) : w.clubPlayers.get(id)) ?? [],
      matches,
    };
  },

  async loadTransfers() {
    return getWorld().transfers;
  },
};

export const demoNews: NewsProvider = {
  id: 'demo',
  async load(teams, topic) {
    let all = buildDemoNews(getWorld());
    if (topic === 'transfers') all = all.filter((n) => n.id.startsWith('t'));
    if (!teams?.length) return all;
    const ids = new Set(teams.map((t) => t.id));
    return all.filter((n) => n.teamIds?.some((id) => ids.has(id)));
  },
};
