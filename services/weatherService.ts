/**
 * services/weatherService.ts
 * Service météo utilisant l'API Open-Meteo (gratuite, sans clé)
 * pour détecter les saisons sénégalaises en temps réel.
 *
 * Open-Meteo fournit des données de précipitations et températures
 * pour n'importe quelle coordonnée GPS sans nécessiter de clé API.
 */

// Coordonnées par défaut — centre du Sénégal (Dakar)
const DEFAULT_LAT = 14.7;
const DEFAULT_LON = -17.4;

// Cache en mémoire pour éviter les appels API répétés
interface CacheEntry {
  data: SeasonData;
  timestamp: number;
  /** Clé de cache : date du jour + offset */
  key: string;
}
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure
let cache: CacheEntry | null = null;

/** Génère la clé de cache pour le jour + offset */
const getCacheKey = (offset: number) => `${new Date().toISOString().split('T')[0]}_${offset}`;

// Types
export interface SeasonInfo {
  key: string;
  icon: string;
  label: string;
  monthsLabel: string;
  temperature: string;
  characteristics: string;
}

export interface SeasonData {
  /** Saison calculée à partir des dates fixes + offset */
  calendarSeason: SeasonInfo;
  /** Saison ajustée par les données météo (si API disponible) */
  weatherAdjustedSeason: SeasonInfo | null;
  /** Si l'API a modifié la saison par rapport au calendrier */
  isWeatherAdjusted: boolean;
  /** Avertissement si décalage climatique détecté */
  warning: string | null;
  /** Données météo brutes (pour affichage) */
  weather: {
    tempMin: number;
    tempMax: number;
    precipitation: number;
    lastRainDays: number; // jours depuis la dernière pluie
  } | null;
}

// Informations des 3 saisons sénégalaises
export const SEASONS: Record<string, SeasonInfo> = {
  'Sèche (fraîche)': {
    key: 'Sèche (fraîche)',
    icon: '\u{1F324}\u{FE0F}',
    label: 'S\u00e8che (fra\u00eeche)',
    monthsLabel: 'Nov \u2013 F\u00e9v',
    temperature: '20\u201330 \u00b0C',
    characteristics: 'Harmattan, nuits fra\u00eeches, climat agr\u00e9able',
  },
  'S\u00e8che (chaude)': {
    key: 'S\u00e8che (chaude)',
    icon: '\u2600\uFE0F',
    label: 'S\u00e8che (chaude)',
    monthsLabel: 'Mar \u2013 Juin',
    temperature: '30\u201345 \u00b0C',
    characteristics: 'Forte chaleur int\u00e9rieure, brise marine sur la c\u00f4te',
  },
  'Pluies (hivernage)': {
    key: 'Pluies (hivernage)',
    icon: '\uD83C\uDF27\uFE0F',
    label: 'Pluies (hivernage)',
    monthsLabel: 'Juil \u2013 Oct',
    temperature: '30\u201335 \u00b0C',
    characteristics: 'Pluies abondantes, v\u00e9g\u00e9tation luxuriante, humidit\u00e9 \u00e9lev\u00e9e',
  },
};

/**
 * D\u00e9termine la saison \u00e0 partir du mois + offset manuel
 * @param month Mois (0=Jan, 11=Dec)
 * @param offset D\u00e9calage en jours (positif = saisons plus tardives)
 */
export const getSeasonFromMonth = (month: number, offset: number = 0): SeasonInfo => {
  // L'offset est en jours — on le convertit approximativement en mois
  // 15 jours d'offset ≈ 0.5 mois
  const offsetMonths = Math.round(offset / 30);
  const adjustedMonth = ((month - offsetMonths) % 12 + 12) % 12;

  if (adjustedMonth >= 10 || adjustedMonth <= 1) return SEASONS['S\u00e8che (fra\u00eeche)'];
  if (adjustedMonth >= 2 && adjustedMonth <= 5) return SEASONS['S\u00e8che (chaude)'];
  return SEASONS['Pluies (hivernage)'];
};

/**
 * Récupère les données météo des 14 derniers jours via Open-Meteo
 */
export const fetchWeatherData = async (
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON
): Promise<{ precipitation: number[]; temps: number[]; dates: string[] } | null> => {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 14);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const url = `https://api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=precipitation_sum,temperature_2m_max&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.daily) return null;

    return {
      precipitation: data.daily.precipitation_sum || [],
      temps: data.daily.temperature_2m_max || [],
      dates: data.daily.time || [],
    };
  } catch (e) {
    console.warn('[weatherService] Failed to fetch weather data:', e);
    return null;
  }
};

/**
 * Détecte la saison réelle à partir des données météo
 * Utilise les précipitations pour déterminer si l'hivernage a commencé
 * Retourne également le nombre de jours depuis la dernière pluie
 */
export const detectSeasonFromWeather = (
  weather: { precipitation: number[]; temps: number[] }
): { season: SeasonInfo | null; warning: string | null; daysSinceRain: number } => {
  if (!weather.precipitation.length) return { season: null, warning: null, daysSinceRain: 0 };

  // Calculs
  const avgPrecip = weather.precipitation.reduce((a, b) => a + b, 0) / weather.precipitation.length;
  const avgTemp = weather.temps.length > 0
    ? weather.temps.reduce((a, b) => a + b, 0) / weather.temps.length
    : 30;
  const rainyDays = weather.precipitation.filter(p => p > 2).length;
  const daysSinceRain = (() => {
    for (let i = weather.precipitation.length - 1; i >= 0; i--) {
      if (weather.precipitation[i] > 1) return weather.precipitation.length - 1 - i;
    }
    return weather.precipitation.length;
  })();

  // Logique de détection :
  // - Pluies fréquentes (≥5 jours avec >2mm en 14j) → Hivernage
  // - Pluies rares + forte chaleur → Sèche chaude
  // - Pluies rares + températures modérées → Sèche fraîche
  if (rainyDays >= 5 && avgPrecip > 3) {
    return {
      season: SEASONS['Pluies (hivernage)'],
      warning: rainyDays >= 10
        ? 'Hivernage bien installé — pluies abondantes cette période'
        : "Début d'hivernage détecté — suivi des précipitations recommandé",
      daysSinceRain,
    };
  }

  if (avgTemp > 33 && rainyDays <= 1) {
    return {
      season: SEASONS['S\u00e8che (chaude)'],
      warning: daysSinceRain > 10
        ? 'Chaleur intense prolongée — risque de stress thermique pour les volailles'
        : null,
      daysSinceRain,
    };
  }

  if (avgTemp < 30 && rainyDays <= 1) {
    return { season: SEASONS['S\u00e8che (fra\u00eeche)'], warning: null, daysSinceRain };
  }

  // Cas ambigus — on laisse le calendrier faire foi
  return { season: null, warning: null, daysSinceRain };
};

/**
 * Fonction principale : calcule la saison actuelle avec détection météo
 *
 * @param offset Décalage manuel en jours (positif = saisons décalées plus tard)
 * @returns Données complètes de la saison actuelle
 */
export const getCurrentSeasonData = async (offset: number = 0): Promise<SeasonData> => {
  // Vérifier le cache avec la bonne clé (date du jour + offset)
  const expectedKey = getCacheKey(offset);
  if (cache && cache.key === expectedKey && cache.timestamp > Date.now() - CACHE_TTL_MS) {
    return cache.data;
  }

  const now = new Date();
  const month = now.getMonth();

  // 1. Saison calendaire (dates fixes + offset)
  const calendarSeason = getSeasonFromMonth(month, offset);
  let weatherAdjustedSeason: SeasonInfo | null = null;
  let isWeatherAdjusted = false;
  let warning: string | null = null;
  let weatherData: SeasonData['weather'] = null;

  // 2. Tentative de données météo
  const weatherResult = await fetchWeatherData();
  if (weatherResult) {
    const detection = detectSeasonFromWeather(weatherResult);
    const daysSinceRain = detection.daysSinceRain;

    weatherData = {
      tempMin: Math.min(...weatherResult.temps.filter(t => t !== undefined)),
      tempMax: Math.max(...weatherResult.temps.filter(t => t !== undefined)),
      precipitation: weatherResult.precipitation.reduce((a, b) => a + b, 0),
      lastRainDays: daysSinceRain,
    };

    // Si la détection météo donne un résultat différent du calendrier
    if (detection.season && detection.season.key !== calendarSeason.key) {
      weatherAdjustedSeason = detection.season;
      isWeatherAdjusted = true;
      warning = detection.warning
        || `Saison détectée : ${detection.season.label} (décalage par rapport au calendrier traditionnel)`;
    } else if (detection.warning) {
      warning = detection.warning;
    }

    // Vérifier décalage climatique : si on est dans la période de l'hivernage
    // mais qu'il n'a pas plu depuis longtemps
    if (calendarSeason.key === 'Pluies (hivernage)' && daysSinceRain > 7) {
      warning = `⚠️ Sécheresse inhabituelle en période d'hivernage — ${daysSinceRain} jours sans pluie significative`;
    }

    // Vérifier hivernage précoce/tardif
    if (month >= 8 && month <= 9 && calendarSeason.key !== 'Pluies (hivernage)') {
      // Septembre-Octobre : devrait être hivernage mais ne l'est pas
      warning = '🔶 Hivernage tardif ou réduit cette année — lié au changement climatique';
    }
  }

  const result: SeasonData = {
    calendarSeason,
    weatherAdjustedSeason,
    isWeatherAdjusted,
    warning,
    weather: weatherData,
  };

  // Mettre en cache avec la clé appropriée
  cache = { data: result, timestamp: Date.now(), key: expectedKey };

  return result;
};

/**
 * Vide le cache pour forcer un rechargement
 */
export const clearWeatherCache = () => {
  cache = null;
};

