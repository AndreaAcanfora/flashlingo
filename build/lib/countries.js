// Geography helpers for the world-capitals deck:
//  - continentOf(zone): maps a fine-grained Italian "zone" to a broad continent
//    bucket used as the card `group` (and the UI continent filter).
//  - ISO_BY_COUNTRY: Italian country name -> ISO 3166-1 alpha-2 (lowercase),
//    used to attach a `cc` to each card so the UI can render the flag SVG.

export function continentOf(zone) {
  const z = String(zone).toLowerCase();
  if (z.includes('europa')) return 'Europa';
  if (z.includes('asia') || z.includes('asiatico')) return 'Asia';
  if (z.includes('africa')) return 'Africa';
  if (z.includes('america') || z.includes('caraibi')) return 'America';
  if (z.includes('oceania')) return 'Oceania';
  return 'Altro';
}

export const ISO_BY_COUNTRY = {
  Italia: 'it', Spagna: 'es', Portogallo: 'pt', Grecia: 'gr', Croazia: 'hr',
  Slovenia: 'si', Serbia: 'rs', 'Bosnia ed Erzegovina': 'ba', Montenegro: 'me',
  'Macedonia del Nord': 'mk', Albania: 'al', Kosovo: 'xk', Malta: 'mt',
  Francia: 'fr', Germania: 'de', 'Paesi Bassi': 'nl', Belgio: 'be',
  Lussemburgo: 'lu', Austria: 'at', Svizzera: 'ch', 'Regno Unito': 'gb',
  Irlanda: 'ie', Danimarca: 'dk', Svezia: 'se', Norvegia: 'no', Finlandia: 'fi',
  Islanda: 'is', Estonia: 'ee', Lettonia: 'lv', Lituania: 'lt', Polonia: 'pl',
  'Repubblica Ceca': 'cz', Slovacchia: 'sk', Ungheria: 'hu', Romania: 'ro',
  Bulgaria: 'bg', Moldavia: 'md', Ucraina: 'ua', Bielorussia: 'by', Russia: 'ru',
  Turchia: 'tr', Cipro: 'cy', Georgia: 'ge', Armenia: 'am', Azerbaigian: 'az',
  Siria: 'sy', Libano: 'lb', Israele: 'il', Giordania: 'jo', Iraq: 'iq',
  'Arabia Saudita': 'sa', Yemen: 'ye', Oman: 'om', 'Emirati Arabi Uniti': 'ae',
  Qatar: 'qa', Kuwait: 'kw', Bahrein: 'bh', Kazakistan: 'kz', Uzbekistan: 'uz',
  Turkmenistan: 'tm', Kirghizistan: 'kg', Tagikistan: 'tj', Iran: 'ir',
  Afghanistan: 'af', Pakistan: 'pk', India: 'in', Nepal: 'np', Bhutan: 'bt',
  Bangladesh: 'bd', 'Sri Lanka': 'lk', Maldive: 'mv', Cina: 'cn', Mongolia: 'mn',
  'Corea del Nord': 'kp', 'Corea del Sud': 'kr', Giappone: 'jp', Myanmar: 'mm',
  Thailandia: 'th', Laos: 'la', Cambogia: 'kh', Vietnam: 'vn', Malesia: 'my',
  Singapore: 'sg', Brunei: 'bn', Indonesia: 'id', Filippine: 'ph', 'Timor Est': 'tl',
  Egitto: 'eg', Libia: 'ly', Tunisia: 'tn', Algeria: 'dz', Marocco: 'ma',
  Sudan: 'sd', 'Sud Sudan': 'ss', Mauritania: 'mr', Mali: 'ml', Niger: 'ne',
  Senegal: 'sn', Gambia: 'gm', 'Guinea-Bissau': 'gw', Guinea: 'gn',
  'Sierra Leone': 'sl', Liberia: 'lr', "Costa d'Avorio": 'ci', Ghana: 'gh',
  Togo: 'tg', Benin: 'bj', 'Burkina Faso': 'bf', Nigeria: 'ng', Ciad: 'td',
  Camerun: 'cm', 'Repubblica Centrafricana': 'cf', 'Guinea Equatoriale': 'gq',
  Gabon: 'ga', 'Repubblica del Congo': 'cg', 'Repubblica Democratica del Congo': 'cd',
  Angola: 'ao', Etiopia: 'et', Eritrea: 'er', Gibuti: 'dj', Somalia: 'so',
  Kenya: 'ke', Uganda: 'ug', Ruanda: 'rw', Burundi: 'bi', Tanzania: 'tz',
  Malawi: 'mw', Zambia: 'zm', Mozambico: 'mz', Zimbabwe: 'zw', Madagascar: 'mg',
  Mauritius: 'mu', Namibia: 'na', Botswana: 'bw', Sudafrica: 'za', Lesotho: 'ls',
  Eswatini: 'sz', Canada: 'ca', 'Stati Uniti': 'us', Messico: 'mx',
  Guatemala: 'gt', Belize: 'bz', Honduras: 'hn', 'El Salvador': 'sv',
  Nicaragua: 'ni', 'Costa Rica': 'cr', Panama: 'pa', Cuba: 'cu', Giamaica: 'jm',
  Haiti: 'ht', 'Repubblica Dominicana': 'do', Bahamas: 'bs',
  'Trinidad e Tobago': 'tt', Colombia: 'co', Venezuela: 've', Guyana: 'gy',
  Suriname: 'sr', Ecuador: 'ec', Peru: 'pe', Brasile: 'br', Bolivia: 'bo',
  Paraguay: 'py', Cile: 'cl', Argentina: 'ar', Uruguay: 'uy', Australia: 'au',
  'Nuova Zelanda': 'nz', 'Papua Nuova Guinea': 'pg', Figi: 'fj',
  'Isole Salomone': 'sb', Vanuatu: 'vu',
};

export function isoFor(country) {
  return ISO_BY_COUNTRY[String(country).trim()] || null;
}
