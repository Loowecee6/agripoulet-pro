/**
 * hooks/useCurrentSeason.ts
 * Hook React qui utilise le service météo pour détecter la saison actuelle
 * et retourne les infos à afficher dans l'interface.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentSeasonData,
  getSeasonFromMonth,
  clearWeatherCache,
  SeasonData,
} from '../services/weatherService';

export interface CurrentSeason {
  /** Infos complètes de la saison (calendaire + météo) */
  data: SeasonData | null;
  /** Icône + nom affichable */
  displayLabel: string;
  /** Saison active finale (calendaire ou ajustée par météo) */
  active: {
    icon: string;
    label: string;
    temperature: string;
    monthsLabel: string;
  } | null;
  /** Chargement en cours */
  loading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Recharger les données météo */
  refresh: () => void;
}

/**
 * Hook qui retourne la saison sénégalaise actuelle
 * @param offset Décalage manuel en jours (0 par défaut)
 * @param autoRefresh Recharger automatiquement toutes les heures
 */
export const useCurrentSeason = (
  offset: number = 0,
  autoRefresh: boolean = true,
): CurrentSeason => {
  const [data, setData] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getCurrentSeasonData(offset);
      setData(result);
    } catch (e) {
      console.warn('[useCurrentSeason] Error loading season:', e);
      setError('Impossible de charger les données saisonnières');
      // Fallback: saison calendaire sans météo
      const month = new Date().getMonth();
      const fallback = getSeasonFromMonth(month, offset);
      setData({
        calendarSeason: {
          key: fallback.key,
          icon: fallback.icon,
          label: fallback.label,
          monthsLabel: fallback.monthsLabel,
          temperature: fallback.temperature,
          characteristics: fallback.characteristics,
        },
        weatherAdjustedSeason: null,
        isWeatherAdjusted: false,
        warning: 'Données météo indisponibles — saison basée sur le calendrier',
        weather: null,
      });
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    load();

    // Rechargement automatique toutes les heures
    if (autoRefresh) {
      const interval = setInterval(load, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [load, autoRefresh]);

  // Déterminer l'affichage
  const activeSeason = data?.isWeatherAdjusted && data?.weatherAdjustedSeason
    ? data.weatherAdjustedSeason
    : data?.calendarSeason ?? null;

  const displayLabel = activeSeason
    ? `${activeSeason.icon} ${activeSeason.label}`
    : '🌍 Saison...';

  return {
    data,
    displayLabel,
    active: activeSeason
      ? {
          icon: activeSeason.icon,
          label: activeSeason.label,
          temperature: activeSeason.temperature,
          monthsLabel: activeSeason.monthsLabel,
        }
      : null,
    loading,
    error,
    refresh: () => {
      clearWeatherCache();
      load();
    },
  };
};

/**
 * Helper synchrone pour avoir la saison approximative sans API
 * (utile pour le rendu initial ou hors-ligne)
 */
export const getFallbackSeason = () => {
  const month = new Date().getMonth();
  if (month >= 10 || month <= 1) return { icon: '🌤️', label: 'Sèche (fraîche)', monthsLabel: 'Nov–Fév' };
  if (month >= 2 && month <= 5) return { icon: '☀️', label: 'Sèche (chaude)', monthsLabel: 'Mar–Juin' };
  return { icon: '🌧️', label: 'Pluies (hivernage)', monthsLabel: 'Juil–Oct' };
};
