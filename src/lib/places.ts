/**
 * Every town someone might search from, not only the ones that already have a
 * salon.
 *
 * "Where" used to offer the two cities with a listed business; a visitor from
 * Burgas found nothing to pick and left. Now any town can be chosen, and the
 * search sorts by distance from it - so a town with no salon yet still shows
 * the nearest ones, with how far away they are.
 *
 * Coordinates are town centres to two decimals (about a kilometre), which is
 * all "12 km away" needs. Client-safe: no server imports.
 */

export type PlaceName = { bg: string; en: string; ro: string };

export type Place = {
  id: string;
  country: "BG" | "RO";
  lat: number;
  lng: number;
  name: PlaceName;
};

/** [id, bg, latin, lat, lng] - Bulgarian towns; the latin form serves en and ro. */
const BG: Array<[string, string, string, number, number]> = [
  ["sofia", "София", "Sofia", 42.7, 23.32],
  ["plovdiv", "Пловдив", "Plovdiv", 42.14, 24.75],
  ["varna", "Варна", "Varna", 43.21, 27.91],
  ["burgas", "Бургас", "Burgas", 42.5, 27.46],
  ["ruse", "Русе", "Ruse", 43.84, 25.97],
  ["stara-zagora", "Стара Загора", "Stara Zagora", 42.43, 25.63],
  ["pleven", "Плевен", "Pleven", 43.42, 24.61],
  ["sliven", "Сливен", "Sliven", 42.68, 26.32],
  ["dobrich", "Добрич", "Dobrich", 43.57, 27.83],
  ["shumen", "Шумен", "Shumen", 43.27, 26.94],
  ["pernik", "Перник", "Pernik", 42.61, 23.04],
  ["haskovo", "Хасково", "Haskovo", 41.93, 25.56],
  ["yambol", "Ямбол", "Yambol", 42.48, 26.5],
  ["pazardzhik", "Пазарджик", "Pazardzhik", 42.19, 24.33],
  ["blagoevgrad", "Благоевград", "Blagoevgrad", 42.02, 23.09],
  ["veliko-tarnovo", "Велико Търново", "Veliko Tarnovo", 43.08, 25.62],
  ["vratsa", "Враца", "Vratsa", 43.21, 23.55],
  ["gabrovo", "Габрово", "Gabrovo", 42.87, 25.32],
  ["asenovgrad", "Асеновград", "Asenovgrad", 42.02, 24.87],
  ["vidin", "Видин", "Vidin", 44.0, 22.87],
  ["kazanlak", "Казанлък", "Kazanlak", 42.62, 25.39],
  ["kyustendil", "Кюстендил", "Kyustendil", 42.28, 22.69],
  ["kardzhali", "Кърджали", "Kardzhali", 41.65, 25.37],
  ["montana", "Монтана", "Montana", 43.41, 23.23],
  ["dimitrovgrad", "Димитровград", "Dimitrovgrad", 42.05, 25.6],
  ["targovishte", "Търговище", "Targovishte", 43.25, 26.57],
  ["lovech", "Ловеч", "Lovech", 43.13, 24.72],
  ["silistra", "Силистра", "Silistra", 44.12, 27.27],
  ["dupnitsa", "Дупница", "Dupnitsa", 42.27, 23.12],
  ["razgrad", "Разград", "Razgrad", 43.53, 26.52],
  ["gorna-oryahovitsa", "Горна Оряховица", "Gorna Oryahovitsa", 43.13, 25.7],
  ["smolyan", "Смолян", "Smolyan", 41.58, 24.7],
  ["petrich", "Петрич", "Petrich", 41.39, 23.21],
  ["sandanski", "Сандански", "Sandanski", 41.57, 23.28],
  ["samokov", "Самоков", "Samokov", 42.34, 23.55],
  ["sevlievo", "Севлиево", "Sevlievo", 43.03, 25.11],
  ["lom", "Лом", "Lom", 43.82, 23.24],
  ["karlovo", "Карлово", "Karlovo", 42.63, 24.8],
  ["velingrad", "Велинград", "Velingrad", 42.03, 23.99],
  ["nova-zagora", "Нова Загора", "Nova Zagora", 42.48, 26.02],
  ["troyan", "Троян", "Troyan", 42.88, 24.72],
  ["aytos", "Айтос", "Aytos", 42.7, 27.25],
  ["botevgrad", "Ботевград", "Botevgrad", 42.9, 23.78],
  ["gotse-delchev", "Гоце Делчев", "Gotse Delchev", 41.57, 23.73],
  ["peshtera", "Пещера", "Peshtera", 42.03, 24.3],
  ["harmanli", "Харманли", "Harmanli", 41.93, 25.9],
  ["karnobat", "Карнобат", "Karnobat", 42.65, 26.98],
  ["svishtov", "Свищов", "Svishtov", 43.62, 25.35],
  ["panagyurishte", "Панагюрище", "Panagyurishte", 42.5, 24.18],
  ["chirpan", "Чирпан", "Chirpan", 42.2, 25.33],
  ["popovo", "Попово", "Popovo", 43.35, 26.23],
  ["rakovski", "Раковски", "Rakovski", 42.3, 24.97],
  ["radomir", "Радомир", "Radomir", 42.55, 22.97],
  ["kozloduy", "Козлодуй", "Kozloduy", 43.78, 23.72],
  ["parvomay", "Първомай", "Parvomay", 42.1, 25.22],
  ["berkovitsa", "Берковица", "Berkovitsa", 43.23, 23.12],
  ["nesebar", "Несебър", "Nesebar", 42.66, 27.72],
  ["sunny-beach", "Слънчев бряг", "Sunny Beach", 42.69, 27.71],
  ["sozopol", "Созопол", "Sozopol", 42.42, 27.7],
  ["pomorie", "Поморие", "Pomorie", 42.55, 27.65],
  ["balchik", "Балчик", "Balchik", 43.42, 28.17],
  ["kavarna", "Каварна", "Kavarna", 43.43, 28.33],
  ["primorsko", "Приморско", "Primorsko", 42.27, 27.75],
  ["tsarevo", "Царево", "Tsarevo", 42.17, 27.85],
  ["bansko", "Банско", "Bansko", 41.84, 23.49],
  ["razlog", "Разлог", "Razlog", 41.88, 23.47],
  ["pravets", "Правец", "Pravets", 42.88, 23.92],
  ["ihtiman", "Ихтиман", "Ihtiman", 42.43, 23.82],
  ["elin-pelin", "Елин Пелин", "Elin Pelin", 42.67, 23.6],
  ["bankya", "Банкя", "Bankya", 42.71, 23.14],
  ["kostinbrod", "Костинброд", "Kostinbrod", 42.82, 23.22],
  ["slivnitsa", "Сливница", "Slivnitsa", 42.85, 23.03],
  ["byala-slatina", "Бяла Слатина", "Byala Slatina", 43.47, 23.93],
  ["knezha", "Кнежа", "Knezha", 43.5, 24.08],
  ["omurtag", "Омуртаг", "Omurtag", 43.1, 26.42],
  ["devnya", "Девня", "Devnya", 43.22, 27.57],
  ["provadiya", "Провадия", "Provadiya", 43.18, 27.43],
  ["novi-pazar", "Нови пазар", "Novi Pazar", 43.35, 27.2],
  ["isperih", "Исперих", "Isperih", 43.72, 26.83],
  ["svilengrad", "Свиленград", "Svilengrad", 41.77, 26.2],
  ["momchilgrad", "Момчилград", "Momchilgrad", 41.53, 25.42],
  ["zlatograd", "Златоград", "Zlatograd", 41.38, 25.1],
  ["chepelare", "Чепеларе", "Chepelare", 41.73, 24.68],
  ["etropole", "Етрополе", "Etropole", 42.83, 24.0],
  ["stamboliyski", "Стамболийски", "Stamboliyski", 42.13, 24.53],
  ["sopot", "Сопот", "Sopot", 42.65, 24.75],
  ["hisarya", "Хисаря", "Hisarya", 42.5, 24.7],
  ["pavlikeni", "Павликени", "Pavlikeni", 43.23, 25.3],
  ["lyaskovets", "Лясковец", "Lyaskovets", 43.1, 25.72],
  ["elena", "Елена", "Elena", 42.93, 25.88],
  ["dryanovo", "Дряново", "Dryanovo", 42.97, 25.47],
  ["tryavna", "Трявна", "Tryavna", 42.87, 25.5],
  ["belene", "Белене", "Belene", 43.65, 25.12],
  ["levski", "Левски", "Levski", 43.37, 25.13],
  ["teteven", "Тетевен", "Teteven", 42.92, 24.27],
  ["lukovit", "Луковит", "Lukovit", 43.2, 24.17],
  ["oryahovo", "Оряхово", "Oryahovo", 43.73, 23.97],
  ["belogradchik", "Белоградчик", "Belogradchik", 43.62, 22.68],
  ["breznik", "Брезник", "Breznik", 42.75, 22.9],
  ["bobov-dol", "Бобов дол", "Bobov Dol", 42.37, 23.0],
  ["simitli", "Симитли", "Simitli", 41.88, 23.1],
  ["batak", "Батак", "Batak", 41.93, 24.22],
  ["septemvri", "Септември", "Septemvri", 42.22, 24.12],
  ["pirdop", "Пирдоп", "Pirdop", 42.7, 24.18],
  ["zlatitsa", "Златица", "Zlatitsa", 42.72, 24.13],
  ["koprivshtitsa", "Копривщица", "Koprivshtitsa", 42.63, 24.35],
  ["kuklen", "Куклен", "Kuklen", 42.03, 24.78],
  ["tervel", "Тервел", "Tervel", 43.75, 27.4],
];

/** [id, bg, ro, lat, lng] - Romanian cities; the Romanian form serves en and ro. */
const RO: Array<[string, string, string, number, number]> = [
  ["bucuresti", "Букурещ", "București", 44.43, 26.1],
  ["cluj-napoca", "Клуж-Напока", "Cluj-Napoca", 46.77, 23.62],
  ["timisoara", "Тимишоара", "Timișoara", 45.75, 21.21],
  ["iasi", "Яш", "Iași", 47.16, 27.6],
  ["constanta", "Констанца", "Constanța", 44.16, 28.63],
  ["craiova", "Крайова", "Craiova", 44.33, 23.79],
  ["brasov", "Брашов", "Brașov", 45.64, 25.59],
  ["galati", "Галац", "Galați", 45.44, 28.01],
  ["ploiesti", "Плоещ", "Ploiești", 44.94, 26.01],
  ["oradea", "Орадя", "Oradea", 47.05, 21.92],
  ["braila", "Браила", "Brăila", 45.27, 27.96],
  ["arad", "Арад", "Arad", 46.19, 21.31],
  ["pitesti", "Питещ", "Pitești", 44.86, 24.87],
  ["sibiu", "Сибиу", "Sibiu", 45.8, 24.13],
  ["bacau", "Бакъу", "Bacău", 46.57, 26.91],
  ["targu-mures", "Търгу Муреш", "Târgu Mureș", 46.54, 24.56],
  ["baia-mare", "Бая Маре", "Baia Mare", 47.66, 23.59],
  ["buzau", "Бузъу", "Buzău", 45.15, 26.83],
  ["botosani", "Ботошани", "Botoșani", 47.75, 26.67],
  ["satu-mare", "Сату Маре", "Satu Mare", 47.79, 22.89],
  ["ramnicu-valcea", "Рымнику Вълча", "Râmnicu Vâlcea", 45.1, 24.38],
  ["drobeta", "Дробета-Турну Северин", "Drobeta-Turnu Severin", 44.64, 22.66],
  ["suceava", "Сучава", "Suceava", 47.65, 26.26],
  ["piatra-neamt", "Пятра Нямц", "Piatra Neamț", 46.93, 26.37],
  ["targu-jiu", "Търгу Жиу", "Târgu Jiu", 45.04, 23.27],
  ["targoviste", "Търговище (Румъния)", "Târgoviște", 44.93, 25.46],
  ["focsani", "Фокшани", "Focșani", 45.7, 27.19],
  ["tulcea", "Тулча", "Tulcea", 45.18, 28.81],
  ["giurgiu", "Гюргево", "Giurgiu", 43.9, 25.97],
  ["calarasi", "Кълъраш", "Călărași", 44.2, 27.33],
  ["alba-iulia", "Алба Юлия", "Alba Iulia", 46.07, 23.58],
  ["slatina", "Слатина", "Slatina", 44.43, 24.37],
  ["deva", "Дева", "Deva", 45.88, 22.9],
  ["hunedoara", "Хунедоара", "Hunedoara", 45.75, 22.9],
  ["zalau", "Залъу", "Zalău", 47.19, 23.06],
  ["bistrita", "Бистрица", "Bistrița", 47.13, 24.5],
  ["resita", "Решица", "Reșița", 45.3, 21.88],
  ["vaslui", "Васлуй", "Vaslui", 46.63, 27.73],
  ["alexandria", "Александрия", "Alexandria", 43.98, 25.33],
  ["turda", "Турда", "Turda", 46.57, 23.78],
  ["medgidia", "Меджидия", "Medgidia", 44.25, 28.28],
  ["slobozia", "Слобозия", "Slobozia", 44.57, 27.37],
  ["mangalia", "Мангалия", "Mangalia", 43.8, 28.58],
  ["mamaia", "Мамая", "Mamaia", 44.25, 28.62],
  ["sighisoara", "Сигишоара", "Sighișoara", 46.22, 24.79],
];

export const PLACES: Place[] = [
  ...BG.map(([id, bg, latin, lat, lng]) => ({
    id,
    country: "BG" as const,
    lat,
    lng,
    name: { bg, en: latin, ro: latin },
  })),
  ...RO.map(([id, bg, ro, lat, lng]) => ({
    id,
    country: "RO" as const,
    lat,
    lng,
    name: { bg, en: ro, ro },
  })),
];

const BY_ID = new Map(PLACES.map((place) => [place.id, place]));

export function findPlace(id: string | null | undefined) {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** Lower-case, no diacritics - so "iasi" finds Iași and "brasov" Brașov. */
export function normalizePlace(text: string) {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * The town a free-text city field names, when it names one exactly - in any
 * of the three spellings, ignoring case and diacritics. "София", "sofia" and
 * "Sofia " all give Sofia; "Sofia centre" gives nothing rather than a guess.
 */
export function matchPlace(text: string | null | undefined) {
  if (!text) return null;
  const needle = normalizePlace(text);
  if (!needle) return null;
  return (
    PLACES.find((place) =>
      [place.name.bg, place.name.en, place.name.ro].some(
        (name) => normalizePlace(name) === needle,
      ),
    ) ?? null
  );
}

/**
 * Places matching what was typed, in any of the three spellings. Prefix
 * matches first, then anywhere-in-the-name, each in the list's own order
 * (largest towns first); the visitor's own country leads when nothing is
 * typed.
 */
export function searchPlaces(query: string, country: "BG" | "RO", limit = 8) {
  const q = normalizePlace(query);
  const ordered = [
    ...PLACES.filter((place) => place.country === country),
    ...PLACES.filter((place) => place.country !== country),
  ];
  if (!q) return ordered.slice(0, limit);

  const names = (place: Place) =>
    [place.name.bg, place.name.en, place.name.ro].map(normalizePlace);
  const prefix = ordered.filter((place) => names(place).some((name) => name.startsWith(q)));
  const inside = ordered.filter(
    (place) =>
      !prefix.includes(place) && names(place).some((name) => name.includes(q)),
  );
  return [...prefix, ...inside].slice(0, limit);
}

/**
 * A browser position, coarsened before it goes anywhere. Two decimals is
 * about a kilometre: enough to sort salons by distance, too coarse to put a
 * front door in a URL someone might share.
 */
export function coarsen(value: number) {
  return Math.round(value * 100) / 100;
}

/** "42.70,23.32" -> a point, or null for anything malformed or off the globe. */
export function parseNear(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: coarsen(lat), lng: coarsen(lng) };
}

/**
 * Distance for a card, in the visitor's own unit spelling ("12 км", "12 km").
 * Anything under a kilometre reads as "< 1": metres would be false precision
 * from a town-centre point.
 */
export function formatDistance(km: number | null | undefined, locale: string) {
  if (km == null) return null;
  const format = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: km < 10 ? 1 : 0,
  });
  return km < 1 ? `< ${format.format(1)}` : format.format(km);
}
