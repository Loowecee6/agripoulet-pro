// components/common/ProductionGoals.tsx
// Objectifs de production — Poids cible, FCR, mortalité, progression temps réel

import React, { useMemo } from 'react';
import { Target, TrendingUp, Droplets, Skull, Award, BarChart3 } from 'lucide-react';
import { AppData } from '../../types';
import { POIDS_THEORIQUE_REFERENCE } from '../../constants';

interface ProductionGoalsProps {
  data: AppData;
}

// Objectifs par défaut configurables
const DEFAULT_TARGETS = {
  targetWeightDay42: 2740,    // poids cible à J42 — vif (g) (≈2000g vidé)
  maxMortalityRate: 5,        // taux de mortalité max (%)
  targetFCR: 1.8,             // Feed Conversion Ratio cible
  targetAvgPricePerKg: 2645,  // prix moyen cible par kg (Frs)
  targetSurvivalRate: 95,     // taux de survie cible (%)
};

export const ProductionGoals = ({ data }: ProductionGoalsProps) => {
  const activeBatches = data.productionBatches.filter(b => b.statut === 'active');
  const closedBatches = data.productionBatches.filter(b => b.statut === 'cloturee');

  const goals = useMemo(() => {
    const targets = DEFAULT_TARGETS;
    // computed inside useMemo to avoid stale reference issues
    const activeBatches = data.productionBatches.filter(b => b.statut === 'active');
    const closedBatches = data.productionBatches.filter(b => b.statut === 'cloturee');

    // ── Progression bande la plus avancée ──
    let bestBatchWeight = 0;
    let bestBatchDay = 0;
    let bestBatchName = '—';

    if (activeBatches.length > 0) {
      const best = activeBatches.reduce((a, b) => {
        const aDays = a.suiviQuotidien.length;
        const bDays = b.suiviQuotidien.length;
        return bDays > aDays ? b : a;
      });
      const lastRecord = best.suiviQuotidien[best.suiviQuotidien.length - 1];
      if (lastRecord) {
        bestBatchWeight = lastRecord.poidsReel;
        bestBatchDay = lastRecord.jourDeBande;
        bestBatchName = best.nom;
      }
    }

    // Poids théorique au même jour
    const theoreticalWeight = POIDS_THEORIQUE_REFERENCE[bestBatchDay] || 0;
    const weightProgress = targets.targetWeightDay42 > 0
      ? Math.min(100, Math.round((bestBatchWeight / targets.targetWeightDay42) * 100))
      : 0;
    const weightVsTheory = theoreticalWeight > 0
      ? Math.round((bestBatchWeight / theoreticalWeight) * 100)
      : 0;

    // ── Taux de mortalité moyen (bandes actives) ──
    let totalMortality = 0;
    let totalInitial = 0;
    activeBatches.forEach(b => {
      const morts = b.suiviQuotidien.reduce((s, r) => s + r.mort, 0);
      totalMortality += morts;
      totalInitial += b.nbPoussinsInitial;
    });
    const mortalityRate = totalInitial > 0 ? (totalMortality / totalInitial) * 100 : 0;
    const mortalityStatus = mortalityRate <= targets.maxMortalityRate ? 'good' : mortalityRate <= targets.maxMortalityRate * 1.5 ? 'warning' : 'bad';

    // ── FCR (Feed Conversion Ratio) moyen ──
    let totalConso = 0; // en g
    let totalGain = 0;  // en g de poids vif
    activeBatches.forEach(b => {
      b.suiviQuotidien.forEach(r => {
        totalConso += r.conso;
        // Gain de poids estimé : poidsReel * nb poulets vivants à ce jour
        const nbVivants = b.nbPoussinsInitial - b.suiviQuotidien
          .filter(x => x.jourDeBande <= r.jourDeBande)
          .reduce((s, x) => s + x.mort, 0);
        totalGain += (r.poidsReel - 40) * nbVivants; // 40g = poids naissance estimé
      });
    });
    const fcr = totalGain > 0 ? Math.round((totalConso / totalGain) * 100) / 100 : 0;
    const fcrStatus = fcr > 0 && fcr <= targets.targetFCR ? 'good' : fcr > targets.targetFCR && fcr <= targets.targetFCR * 1.2 ? 'warning' : fcr > 0 ? 'bad' : 'neutral';

    // ── Taux de survie (toutes bandes) ──
    let totalMortsAll = 0;
    let totalInitAll = 0;
    data.productionBatches.forEach(b => {
      const morts = b.suiviQuotidien.reduce((s, r) => s + r.mort, 0);
      totalMortsAll += morts;
      totalInitAll += b.nbPoussinsInitial;
    });
    const survivalRate = totalInitAll > 0 ? ((totalInitAll - totalMortsAll) / totalInitAll) * 100 : 0;
    const survivalStatus = survivalRate >= targets.targetSurvivalRate ? 'good' : survivalRate >= targets.targetSurvivalRate - 10 ? 'warning' : 'bad';

    // ── Prix de vente moyen (dernières ventes) ──
    const recentSales = data.sales.slice(-20);
    const soldChickens = data.stockBatches
      .flatMap(sb => sb.poulets)
      .filter(p => p.vendu);
    const avgPricePerKg = soldChickens.length > 0
      ? Math.round(soldChickens.reduce((sum, p) => sum + (p.poids > 0 ? p.prix / p.poids : 0), 0) / soldChickens.length)
      : 0;
    const priceStatus = avgPricePerKg >= targets.targetAvgPricePerKg ? 'good' : avgPricePerKg >= targets.targetAvgPricePerKg * 0.8 ? 'warning' : avgPricePerKg > 0 ? 'bad' : 'neutral';

    // ── Nombre de bandes clôturées avec profit ──
    const profitableBatches = closedBatches.filter(b => {
      const sb = data.stockBatches.find(s => s.productionBatchId === b.id);
      if (!sb) return false;
      const sales = data.sales.filter(s => s.pouletIds.some(pid => sb.poulets.some(sp => sp.id === pid)));
      const revenue = sales.reduce((a, s) => a + s.total, 0);
      const cost = sb.coutInitial;
      return revenue > cost;
    }).length;

    return {
      bestBatchName,
      bestBatchWeight,
      bestBatchDay,
      theoreticalWeight,
      weightProgress,
      weightVsTheory,
      mortalityRate: Math.round(mortalityRate * 10) / 10,
      mortalityStatus,
      fcr,
      fcrStatus,
      survivalRate: Math.round(survivalRate * 10) / 10,
      survivalStatus,
      avgPricePerKg,
      priceStatus,
      targets,
      profitableBatches,
      closedBatchesCount: closedBatches.length,
    };
  }, [data]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'good': return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500', icon: '✅' };
      case 'warning': return { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500', icon: '⚠️' };
      case 'bad': return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', icon: '🔴' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-500', bar: 'bg-gray-300', icon: '—' };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Objectifs de production</h3>
        </div>
        <span className="text-[9px] text-gray-400 font-medium">
          {activeBatches.length} bande{activeBatches.length > 1 ? 's' : ''} active{activeBatches.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Poids cible — progression */}
      {goals.bestBatchDay > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase">{goals.bestBatchName}</span>
              </div>
              <span className="text-[9px] opacity-70">J{goals.bestBatchDay}</span>
            </div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-lg font-black">{goals.bestBatchWeight}g</div>
                <div className="text-[9px] opacity-70">Objectif J42: {goals.targets.targetWeightDay42}g vif (≈{Math.round(goals.targets.targetWeightDay42 * 0.73)}g vidé)</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black">{goals.weightProgress}%</div>
                <div className="text-[9px] opacity-70">progression</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, goals.weightProgress)}%` }}
              />
            </div>
            {goals.theoreticalWeight > 0 && (
              <div className="mt-1.5 flex justify-between text-[8px] opacity-60">
                <span>Théorique J{goals.bestBatchDay}: {goals.theoreticalWeight}g</span>
                <span>{goals.weightVsTheory}% du théorique</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grille de métriques */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-1.5">
        {/* Mortalité */}
        <div className={`p-2.5 rounded-xl ${statusColor(goals.mortalityStatus).bg}`}>
          <div className="flex items-center justify-between mb-0.5">
            <Skull className={`w-3 h-3 ${statusColor(goals.mortalityStatus).text}`} />
            <span className="text-[8px] font-bold">{statusColor(goals.mortalityStatus).icon}</span>
          </div>
          <div className={`text-sm font-black ${statusColor(goals.mortalityStatus).text}`}>
            {goals.mortalityRate}%
          </div>
          <div className={`text-[8px] ${statusColor(goals.mortalityStatus).text} opacity-70`}>
            Mortalité (max {goals.targets.maxMortalityRate}%)
          </div>
        </div>

        {/* FCR */}
        <div className={`p-2.5 rounded-xl ${statusColor(goals.fcrStatus).bg}`}>
          <div className="flex items-center justify-between mb-0.5">
            <Droplets className={`w-3 h-3 ${statusColor(goals.fcrStatus).text}`} />
            <span className="text-[8px] font-bold">{statusColor(goals.fcrStatus).icon}</span>
          </div>
          <div className={`text-sm font-black ${statusColor(goals.fcrStatus).text}`}>
            {goals.fcr > 0 ? goals.fcr : '—'}
          </div>
          <div className={`text-[8px] ${statusColor(goals.fcrStatus).text} opacity-70`}>
            FCR (cible {goals.targets.targetFCR})
          </div>
        </div>

        {/* Taux de survie */}
        <div className={`p-2.5 rounded-xl ${statusColor(goals.survivalStatus).bg}`}>
          <div className="flex items-center justify-between mb-0.5">
            <Award className={`w-3 h-3 ${statusColor(goals.survivalStatus).text}`} />
            <span className="text-[8px] font-bold">{statusColor(goals.survivalStatus).icon}</span>
          </div>
          <div className={`text-sm font-black ${statusColor(goals.survivalStatus).text}`}>
            {goals.survivalRate}%
          </div>
          <div className={`text-[8px] ${statusColor(goals.survivalStatus).text} opacity-70`}>
            Survie (cible {goals.targets.targetSurvivalRate}%)
          </div>
        </div>

        {/* Prix moyen */}
        <div className={`p-2.5 rounded-xl ${statusColor(goals.priceStatus).bg}`}>
          <div className="flex items-center justify-between mb-0.5">
            <BarChart3 className={`w-3 h-3 ${statusColor(goals.priceStatus).text}`} />
            <span className="text-[8px] font-bold">{statusColor(goals.priceStatus).icon}</span>
          </div>
          <div className={`text-sm font-black ${statusColor(goals.priceStatus).text}`}>
            {goals.avgPricePerKg > 0 ? `${goals.avgPricePerKg} F/kg` : '—'}
          </div>
          <div className={`text-[8px] ${statusColor(goals.priceStatus).text} opacity-70`}>
            Prix vente moyen (cible {goals.targets.targetAvgPricePerKg} F/kg)
          </div>
        </div>
      </div>

      {/* Résumé bandes clôturées */}
      {goals.closedBatchesCount > 0 && (
        <div className="mx-4 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              Bandes clôturées : <strong>{goals.closedBatchesCount}</strong>
            </span>
            <span className="text-xs text-gray-600">
              Rentables : <strong className="text-green-600">{goals.profitableBatches}</strong>
              {goals.closedBatchesCount > 0 && (
                <span className="text-gray-400 ml-1">
                  ({Math.round((goals.profitableBatches / goals.closedBatchesCount) * 100)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Message vide si aucune bande */}
      {goals.bestBatchDay === 0 && activeBatches.length === 0 && (
        <div className="px-4 pb-4 text-center text-gray-400 text-[10px]">
          <Target className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
          Aucune bande active pour suivre les objectifs
        </div>
      )}
    </div>
  );
};
