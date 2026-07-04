import React, { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Calendar, BarChart3, Target, Droplets, AlertCircle, CheckCircle, Bell } from 'lucide-react';
import { ProductionBatch } from '../../types';
import { POIDS_THEORIQUE_REFERENCE } from '../../constants';

interface BatchAnalyticsProps {
  batches: ProductionBatch[];
}

export function BatchAnalytics({ batches }: BatchAnalyticsProps) {
  const activeBatches = batches.filter(b => b.statut === 'active');
  const closedBatches = batches.filter(b => b.statut === 'cloturee');

  const activeBatchAnalysis = useMemo(() => {
    return activeBatches.map(batch => {
      const currentDay = batch.suiviQuotidien.length > 0
        ? Math.max(...batch.suiviQuotidien.map(r => r.jourDeBande))
        : 0;
      const lastRecord = batch.suiviQuotidien.length > 0
        ? batch.suiviQuotidien[batch.suiviQuotidien.length - 1]
        : null;

      // IC (Indice de Consommation)
      const totalConsoKg = batch.suiviQuotidien.reduce((a, r) => a + r.conso, 0) / 1000;
      const totalAlimKg = batch.suiviQuotidien.reduce((a, r) => a + r.quantite, 0);
      const poidsTotalGagne = lastRecord ? lastRecord.poidsReel : 0;
      const survivingBirds = batch.nbPoussinsInitial - batch.suiviQuotidien.reduce((a, r) => a + r.mort, 0);
      const poidsTotalKg = (poidsTotalGagne * survivingBirds) / 1000;
      const ic = poidsTotalKg > 0 ? totalAlimKg / poidsTotalKg : 0;

      // Alerte mortalité anormale (>2% sur un jour ou >5% cumulé)
      const dailyMortality = batch.suiviQuotidien.filter(r => r.mort > 0);
      const totalMortality = batch.suiviQuotidien.reduce((a, r) => a + r.mort, 0);
      const mortalityRate = batch.nbPoussinsInitial > 0 ? (totalMortality / batch.nbPoussinsInitial) * 100 : 0;
      const highDailyMortality = dailyMortality.some(r => (r.mort / batch.nbPoussinsInitial) * 100 > 2);
      const mortalityAlert = highDailyMortality || mortalityRate > 5;

      // Alerte vaccin en retard
      const today = batch.dateMisePlace ? Math.floor((Date.now() - new Date(batch.dateMisePlace).getTime()) / 86400000) + 1 : 0;
      const overdueVaccines = batch.vaccinations.filter(v => {
        if (v.effectuee) return false;
        const maxDay = Math.max(...v.jours);
        return maxDay <= today;
      });

      // Prévision date de vente (poids cible 2.0kg vidé ≈ 2740g vif)
      const targetWeight = 2740;
      let predictedDay: number | null = null;
      if (lastRecord && lastRecord.poidsReel > 0) {
        // Linear extrapolation based on current growth rate
        const firstRecord = batch.suiviQuotidien[0];
        if (firstRecord.poidsReel > 0 && lastRecord.jourDeBande > firstRecord.jourDeBande) {
          const dailyGain = (lastRecord.poidsReel - firstRecord.poidsReel) / (lastRecord.jourDeBande - firstRecord.jourDeBande);
          if (dailyGain > 0) {
            predictedDay = Math.ceil(lastRecord.jourDeBande + (targetWeight - lastRecord.poidsReel) / dailyGain);
          }
        }
      }

      // Comparaison avec théorique
      const theoreticalWeight = POIDS_THEORIQUE_REFERENCE[currentDay] || 0;
      const weightDiff = lastRecord && theoreticalWeight > 0
        ? lastRecord.poidsReel - theoreticalWeight
        : 0;
      const weightDiffPercent = theoreticalWeight > 0 ? (weightDiff / theoreticalWeight) * 100 : 0;

      return {
        batch,
        currentDay,
        ic,
        totalAlimKg,
        survivingBirds,
        poidsTotalKg,
        mortalityRate,
        mortalityAlert,
        overdueVaccines,
        predictedDay,
        theoreticalWeight,
        weightDiff,
        weightDiffPercent,
        lastRecord,
      };
    });
  }, [activeBatches]);

  const batchComparison = useMemo(() => {
    return closedBatches.map(batch => {
      const totalDepenses = batch.depenses.reduce((a, d) => a + d.montant, 0);
      const totalCost = totalDepenses + (batch.nbPoussinsInitial * batch.prixAchatPoussin);
      const totalMortality = batch.suiviQuotidien.reduce((a, r) => a + r.mort, 0);
      const lastWeight = batch.suiviQuotidien.length > 0
        ? batch.suiviQuotidien[batch.suiviQuotidien.length - 1].poidsReel
        : 0;
      const totalConsoKg = batch.suiviQuotidien.reduce((a, r) => a + r.quantite, 0);
      const survivingBirds = batch.nbPoussinsInitial - totalMortality - (batch.nbAbattus || 0);
      const poidsTotalKg = (lastWeight * survivingBirds) / 1000;
      const ic = poidsTotalKg > 0 ? totalConsoKg / poidsTotalKg : 0;
      const duration = batch.suiviQuotidien.length > 0
        ? Math.max(...batch.suiviQuotidien.map(r => r.jourDeBande))
        : 0;

      return {
        batch,
        totalCost,
        totalMortality,
        mortalityRate: batch.nbPoussinsInitial > 0 ? (totalMortality / batch.nbPoussinsInitial) * 100 : 0,
        lastWeight,
        ic,
        duration,
        survivingBirds,
      };
    });
  }, [closedBatches]);

  if (activeBatches.length === 0 && closedBatches.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Alertes actives */}
      {activeBatchAnalysis.some(a => a.mortalityAlert || a.overdueVaccines.length > 0) && (
        <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-red-800">Alertes</h3>
          </div>
          {activeBatchAnalysis.map(a => (
            <React.Fragment key={a.batch.id}>
              {a.mortalityAlert && (
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>{a.batch.nom}</strong> : Mortalité élevée ({a.mortalityRate.toFixed(1)}%)</span>
                </div>
              )}
              {a.overdueVaccines.map((v, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>{a.batch.nom}</strong> : Vaccin "{v.traitement}" en retard (J{v.jours.join('-')})</span>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Analyse par bande active */}
      {activeBatchAnalysis.map(a => (
        <div key={a.batch.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800">{a.batch.nom}</h3>
            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full">J{a.currentDay}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* IC */}
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 mb-1">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-400 uppercase">IC</span>
              </div>
              <div className={`text-lg font-black ${a.ic > 2.2 ? 'text-red-600' : a.ic > 1.8 ? 'text-orange-600' : 'text-green-600'}`}>
                {a.ic > 0 ? a.ic.toFixed(2) : '—'}
              </div>
              <div className="text-[9px] text-gray-400">{a.totalAlimKg.toFixed(1)} kg aliment / {a.poidsTotalKg.toFixed(1)} kg viande</div>
            </div>

            {/* Poids vs théorique */}
            <div className={`p-3 rounded-xl border ${a.weightDiff >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[10px] font-black text-orange-400 uppercase">Poids</span>
              </div>
              <div className={`text-lg font-black ${a.weightDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {a.lastRecord ? `${a.lastRecord.poidsReel}g` : '—'}
              </div>
              <div className="text-[9px] text-gray-400">
                {a.weightDiff >= 0 ? '+' : ''}{a.weightDiffPercent.toFixed(1)}% vs théorique ({a.theoreticalWeight}g)
              </div>
            </div>
          </div>

          {/* Prévision date de vente */}
          {a.predictedDay && (
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-purple-500 shrink-0" />
              <div>
                  <div className="text-[10px] font-black text-purple-400 uppercase">Prévision poids cible (2.0 kg vidé)</div>
                <div className="text-sm font-bold text-purple-800">
                  Vers J{a.predictedDay} ({a.predictedDay - a.currentDay > 0 ? `dans ${a.predictedDay - a.currentDay} jours` : 'atteint !'})
                </div>
              </div>
            </div>
          )}

          {/* Survivants */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Survivants</span>
            <span className="font-bold">{a.survivingBirds} / {a.batch.nbPoussinsInitial}</span>
          </div>

          {/* Conseil période critique J28+ */}
          {a.currentDay >= 28 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-amber-800 uppercase">Période critique J28+</span>
              </div>
              <ul className="text-[11px] text-amber-900 space-y-1 list-disc list-inside">
                <li>Le poulet double son poids en 2 semaines — l'alimentation est capitale</li>
                <li>Vérifie que les <strong>mangeoires</strong> ne sont jamais vides</li>
                <li>L'<strong>eau</strong> doit être fraîche et abondante (stress thermique élevé)</li>
                <li>Surveille la <strong>consommation</strong> : elle doit augmenter chaque jour</li>
                <li>Nettoie les <strong>abreuvoirs</strong> quotidiennement</li>
              </ul>
            </div>
          )}
          {a.currentDay >= 21 && a.currentDay < 28 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black text-blue-700 uppercase">Prépare la période critique J28+</span>
              </div>
              <p className="text-[10px] text-blue-800">
                Dans {28 - a.currentDay} jour(s), les poulets entrent en phase de croissance explosive.
                Anticipe le stock d'aliment et vérifie le système d'abreuvement.
              </p>
            </div>
          )}
        </div>
      ))}

      {/* Comparaison entre bandes */}
      {batchComparison.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-gray-800">Comparaison des bandes</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-1 text-gray-400 font-black uppercase text-[9px]">Bande</th>
                  <th className="text-center py-2 px-1 text-gray-400 font-black uppercase text-[9px]">Durée</th>
                  <th className="text-center py-2 px-1 text-gray-400 font-black uppercase text-[9px]">IC</th>
                  <th className="text-center py-2 px-1 text-gray-400 font-black uppercase text-[9px]">Mortalité</th>
                  <th className="text-center py-2 px-1 text-gray-400 font-black uppercase text-[9px]">Poids final</th>
                  <th className="text-center py-2 px-1 text-gray-400 font-black uppercase text-[9px]">Coût total</th>
                </tr>
              </thead>
              <tbody>
                {batchComparison.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-1 font-bold text-gray-700">{c.batch.nom}</td>
                    <td className="py-2 px-1 text-center text-gray-500">J{c.duration}</td>
                    <td className={`py-2 px-1 text-center font-bold ${c.ic > 2.2 ? 'text-red-600' : 'text-green-600'}`}>{c.ic.toFixed(2)}</td>
                    <td className={`py-2 px-1 text-center font-bold ${c.mortalityRate > 5 ? 'text-red-600' : 'text-gray-500'}`}>{c.mortalityRate.toFixed(1)}%</td>
                    <td className="py-2 px-1 text-center font-bold text-gray-700">{c.lastWeight}g</td>
                    <td className="py-2 px-1 text-center font-bold text-gray-700">{c.totalCost} Frs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
