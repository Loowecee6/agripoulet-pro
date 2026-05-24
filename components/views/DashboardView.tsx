import React, { useMemo, useState } from 'react';
import { Users, TrendingUp, AlertTriangle, Egg, ShoppingCart,
  CreditCard, BarChart3, PieChart, Target, Droplets, Clock,
  MessageCircle, Phone
} from 'lucide-react';
import { SeasonalStats } from '../common/SeasonalStats';
import { formatWhatsAppUrl } from '../../utils/whatsapp';
import { getRemainingBalance } from '../../utils/creditHelpers';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RePieChart,
  Pie, Cell, AreaChart, Area
} from 'recharts';
import { AppData } from '../../types';
import { POIDS_THEORIQUE_REFERENCE } from '../../constants';

interface DashboardViewProps {
  data: AppData;
}

const COLORS = {
  orange: '#ea580c',
  blue: '#3b82f6',
  green: '#16a34a',
  red: '#dc2626',
  purple: '#7c3aed',
  teal: '#0d9488',
  yellow: '#eab308',
  gray: '#94a3b8',
};

const PIE_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#eab308'];

export const DashboardView = ({ data }: DashboardViewProps) => {
  const today = new Date().toISOString().split('T')[0];

  // === KPI Calculations ===

  const stats = useMemo(() => {
    // Poulets vivants (production - toutes bandes actives)
    const liveChickens = data.productionBatches
      .filter(b => b.statut === 'active')
      .reduce((acc, batch) => {
        const totalMorts = batch.suiviQuotidien.reduce((s, r) => s + r.mort, 0);
        return acc + (batch.nbPoussinsInitial - totalMorts);
      }, 0);

    // Poulets en stock non vendus
    const stockAvailable = data.stockBatches
      .filter(sb => sb.isFinalized)
      .reduce((acc, sb) => acc + sb.poulets.filter(p => !p.vendu).length, 0);

    // Crédits en cours (solde restant après paiements partiels)
    const creditsEnCours = data.sales
      .filter(s => s.isCredit)
      .reduce((sum, s) => {
        const totalPayments = (s.payments || []).reduce((pSum, p) => pSum + p.montant, 0);
        const remaining = Math.max(0, s.total - totalPayments);
        return sum + remaining;
      }, 0);

    const creditsCount = data.sales
      .filter(s => s.isCredit)
      .filter(s => {
        const totalPayments = (s.payments || []).reduce((pSum, p) => pSum + p.montant, 0);
        return totalPayments < s.total;
      }).length;

    // Ventes du jour
    const ventesDuJour = data.sales
      .filter(s => s.dateVente === today)
      .reduce((sum, s) => sum + s.total, 0);

    const ventesDuJourCount = data.sales.filter(s => s.dateVente === today).length;

    // Ventes du mois
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const ventesDuMois = data.sales
      .filter(s => s.dateVente >= monthStartStr)
      .reduce((sum, s) => sum + s.total, 0);

    // Total clients
    const totalClients = data.clients.length;

    // Bande active la plus avancée
    const activeBatches = data.productionBatches.filter(b => b.statut === 'active');
    const mostAdvancedBatch = activeBatches.length > 0
      ? activeBatches.reduce((best, b) => {
          const bestDays = best.suiviQuotidien.length > 0
            ? Math.max(...best.suiviQuotidien.map(r => r.jourDeBande))
            : 0;
          const bDays = b.suiviQuotidien.length > 0
            ? Math.max(...b.suiviQuotidien.map(r => r.jourDeBande))
            : 0;
          return bDays > bestDays ? b : best;
        })
      : null;

    const lastRecord = mostAdvancedBatch?.suiviQuotidien[mostAdvancedBatch.suiviQuotidien.length - 1] ?? null;

    return {
      liveChickens,
      stockAvailable,
      creditsEnCours,
      creditsCount,
      ventesDuJour,
      ventesDuJourCount,
      ventesDuMois,
      totalClients,
      mostAdvancedBatch,
      lastRecord,
    };
  }, [data, today]);

  // === Alertes ===

  const alerts = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'info'; icon: React.ReactNode; message: string }[] = [];

    // Crédit échéance proche
    const todayDate = new Date();
    const soonDate = new Date(todayDate.getTime() + 3 * 86400000);
    data.sales
      .filter(s => s.isCredit && s.dueDate)
      .forEach(s => {
        const totalPayments = (s.payments || []).reduce((pSum, p) => pSum + p.montant, 0);
        const isFullyPaid = totalPayments >= s.total;
        if (isFullyPaid) return;
        const remaining = s.total - totalPayments;
        const due = new Date(s.dueDate!);
        if (due <= todayDate) {
          const daysLate = Math.floor((todayDate.getTime() - due.getTime()) / 86400000);
          list.push({
            type: 'danger',
            icon: <AlertTriangle className="w-4 h-4" />,
            message: `${daysLate}j de retard : ${s.clientNom} — ${remaining.toLocaleString()} Frs restants`,
          });
        } else if (due <= soonDate) {
          const daysLeft = Math.floor((due.getTime() - todayDate.getTime()) / 86400000);
          list.push({
            type: 'warning',
            icon: <Clock className="w-4 h-4" />,
            message: `Échéance J-${daysLeft} : ${s.clientNom} — ${remaining.toLocaleString()} Frs restants`,
          });
        }
      });

    // Mortalité anormale
    data.productionBatches.filter(b => b.statut === 'active').forEach(b => {
      const totalMorts = b.suiviQuotidien.reduce((s, r) => s + r.mort, 0);
      const mortalityRate = b.nbPoussinsInitial > 0 ? (totalMorts / b.nbPoussinsInitial) * 100 : 0;
      if (mortalityRate > 5) {
        list.push({
          type: 'danger',
          icon: <AlertTriangle className="w-4 h-4" />,
          message: `Mortalité élevée : ${b.nom} (${mortalityRate.toFixed(1)}%)`,
        });
      }
    });

    // Vaccins en retard
    data.productionBatches.filter(b => b.statut === 'active').forEach(b => {
      const todayDay = b.dateMisePlace
        ? Math.floor((Date.now() - new Date(b.dateMisePlace).getTime()) / 86400000) + 1
        : 0;
      b.vaccinations.filter(v => !v.effectuee).forEach(v => {
        const maxDay = Math.max(...v.jours);
        if (maxDay <= todayDay) {
          list.push({
            type: 'warning',
            icon: <Droplets className="w-4 h-4" />,
            message: `Vaccin en retard : ${b.nom} — ${v.traitement}`,
          });
        }
      });
    });

    // Stock faible
    const stockAvailable = data.stockBatches
      .filter(sb => sb.isFinalized)
      .reduce((acc, sb) => acc + sb.poulets.filter(p => !p.vendu).length, 0);
    if (stockAvailable === 0 && data.productionBatches.some(b => b.statut === 'active')) {
      list.push({
        type: 'info',
        icon: <ShoppingCart className="w-4 h-4" />,
        message: 'Aucun poulet en stock — pensez à étiqueter après l\'abattage',
      });
    }

    return list.slice(0, 10);
  }, [data]);

  // === Graphique : Ventes sur 30 jours ===

  const salesChartData = useMemo(() => {
    const days: { date: string; total: number; credit: number; cash: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = data.sales.filter(s => s.dateVente === dateStr);
      days.push({
        date: dateStr,
        total: daySales.reduce((sum, s) => sum + s.total, 0),
        credit: daySales.filter(s => s.isCredit).reduce((sum, s) => sum + s.total, 0),
        cash: daySales.filter(s => !s.isCredit).reduce((sum, s) => sum + s.total, 0),
      });
    }
    return days;
  }, [data]);

  // === Graphique : Répartition des ventes ===

  const salesPieData = useMemo(() => {
    const totalCash = data.sales.filter(s => !s.isCredit).reduce((sum, s) => sum + s.total, 0);
    const totalCredit = data.sales
      .filter(s => s.isCredit)
      .reduce((sum, s) => {
        const paid = (s.payments || []).reduce((pSum, p) => pSum + p.montant, 0);
        return sum + Math.max(0, s.total - paid);
      }, 0);
    const totalPaidCredit = data.sales
      .filter(s => s.isCredit)
      .reduce((sum, s) => sum + (s.payments || []).reduce((pSum, p) => pSum + p.montant, 0), 0);
    return [
      { name: 'Comptant', value: totalCash, color: PIE_COLORS[0] },
      { name: 'Crédit impayé', value: totalCredit, color: PIE_COLORS[1] },
      { name: 'Crédit payé', value: totalPaidCredit, color: PIE_COLORS[2] },
    ].filter(d => d.value > 0);
  }, [data]);

  // === Graphique : Poids des bandes actives ===

  const weightChartData = useMemo(() => {
    const activeBatches = data.productionBatches.filter(b => b.statut === 'active');
    const maxDays = Math.max(
      ...activeBatches.map(b =>
        b.suiviQuotidien.length > 0 ? Math.max(...b.suiviQuotidien.map(r => r.jourDeBande)) : 0
      ),
      7
    );

    const chartData: { jour: string; [key: string]: number | string | null }[] = [];
    for (let j = 1; j <= maxDays; j++) {
      const point: { jour: string; [key: string]: number | string | null } = { jour: `J${j}` };
      // Theoretical weight
      point['Théorique'] = POIDS_THEORIQUE_REFERENCE[j] || null;

      // Each active batch
      activeBatches.forEach(b => {
        const record = b.suiviQuotidien.find(r => r.jourDeBande === j);
        if (record) {
          point[b.nom] = record.poidsReel;
        }
      });
      chartData.push(point);
    }
    return chartData;
  }, [data]);

  // === Graphique : Ventes par client (top 5) ===

  const topClients = useMemo(() => {
    const clientTotals: Record<string, number> = {};
    data.sales.forEach(s => {
      clientTotals[s.clientNom] = (clientTotals[s.clientNom] || 0) + s.total;
    });
    return Object.entries(clientTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [data]);

  // === Crédits : Répartition par mode de paiement ===

  const creditBreakdown = useMemo(() => {
    let totalRecuEspeces = 0;
    let totalRecuOrange = 0;
    let totalRecuWave = 0;
    let totalRestant = 0;

    data.sales.filter(s => s.isCredit).forEach(s => {
      const totalPayments = (s.payments || []).reduce((sum, p) => sum + p.montant, 0);
      totalRestant += Math.max(0, s.total - totalPayments);

      (s.payments || []).forEach(p => {
        if (p.methode === 'especes') totalRecuEspeces += p.montant;
        else if (p.methode === 'orange_money') totalRecuOrange += p.montant;
        else if (p.methode === 'wave') totalRecuWave += p.montant;
        else totalRecuEspeces += p.montant; // fallback: paiements sans méthode
      });
    });

    const totalPaymentsAll = totalRecuEspeces + totalRecuOrange + totalRecuWave;
    const totalCredits = totalPaymentsAll + totalRestant;

    return {
      totalCredits,
      totalRestant,
      totalPaymentsAll,
      especes: totalRecuEspeces,
      orangeMoney: totalRecuOrange,
      wave: totalRecuWave,
      hasData: totalCredits > 0,
    };
  }, [data]);

  // === Relance WhatsApp groupée ===

  const overdueForRelance = useMemo(() => {
    const now = new Date();
    return data.sales
      .filter(s => s.isCredit && s.dueDate && new Date(s.dueDate) < now)
      .map(s => ({
        ...s,
        remaining: getRemainingBalance(s),
        daysLate: Math.floor((now.getTime() - new Date(s.dueDate!).getTime()) / 86400000),
        client: data.clients.find(c => c.id === s.clientId),
      }))
      .filter(s => s.remaining > 0)
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [data]);

  // === Statistiques hebdomadaires ===

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const weekSales = data.sales.filter(s => s.dateVente >= weekAgo);
    const weekTotal = weekSales.reduce((sum, s) => sum + s.total, 0);
    const weekCount = weekSales.length;
    const avgPerDay = weekCount > 0 ? weekTotal / 7 : 0;
    return { weekTotal, weekCount, avgPerDay };
  }, [data]);

  return (
    <div className="space-y-5 pb-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tableau de bord</h2>
          <p className="text-xs text-gray-500 mt-1">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* === KPIs === */}
      <div className="grid grid-cols-2 gap-3">
        {/* Poulets vivants */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 p-2 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-medium">
              +{stats.stockAvailable} en stock
            </span>
          </div>
          <div className="text-2xl font-black">{stats.liveChickens}</div>
          <div className="text-xs text-orange-100 mt-1">Poulets vivants</div>
        </div>

        {/* Crédits en cours */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 text-white shadow-lg shadow-red-200">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 p-2 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-medium">
              {stats.creditsCount} clients
            </span>
          </div>
          <div className="text-2xl font-black">{stats.creditsEnCours.toLocaleString()}</div>
          <div className="text-xs text-red-100 mt-1">Frs crédits en cours</div>
        </div>

        {/* Ventes du jour */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white shadow-lg shadow-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 p-2 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-medium">
              {stats.ventesDuJourCount} ventes
            </span>
          </div>
          <div className="text-2xl font-black">{stats.ventesDuJour.toLocaleString()}</div>
          <div className="text-xs text-green-100 mt-1">Frs ventes aujourd'hui</div>
        </div>

        {/* Ventes du mois */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 p-2 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-medium">
              {stats.totalClients} clients
            </span>
          </div>
          <div className="text-2xl font-black">{stats.ventesDuMois.toLocaleString()}</div>
          <div className="text-xs text-blue-100 mt-1">Frs ventes du mois</div>
        </div>
      </div>

      {/* === Relance WhatsApp groupée === */}
      {overdueForRelance.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-bold text-gray-800">À relancer ({overdueForRelance.length})</h3>
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              {overdueForRelance.reduce((s, v) => s + v.remaining, 0).toLocaleString()} Frs
            </span>
          </div>
          <div className="px-4 pb-4 space-y-1.5">
            {overdueForRelance.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-red-50 rounded-xl p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-3 h-3 text-red-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-700 truncate">{s.clientNom}</span>
                  <span className="text-[9px] text-red-500 font-bold whitespace-nowrap">{s.daysLate}j</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-red-600">{s.remaining.toLocaleString()} F</span>
                  {s.client?.tel && (() => {
                    const waMsg = `Bonjour ${s.clientNom} 👋\n\nJe me permets de vous relancer concernant le solde restant de ${s.remaining.toLocaleString()} Frs sur vos achats.\n\nMerci de bien vouloir régulariser votre situation. 🙏`;
                    const url = formatWhatsAppUrl(s.client.tel, waMsg);
                    if (!url) return null;
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title={`Relancer ${s.clientNom}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    );
                  })()}
                </div>
              </div>
            ))}
            {overdueForRelance.length > 5 && (
              <button
                onClick={() => {
                  const nav = document.querySelector('[data-tab="echeances"]') as HTMLButtonElement;
                  nav?.click();
                }}
                className="w-full text-center text-[10px] font-bold text-gray-400 py-2 hover:text-gray-600 transition-colors"
              >
                +{overdueForRelance.length - 5} autres → Voir toutes les échéances
              </button>
            )}
          </div>
        </div>
      )}

      {/* === Alertes === */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-4 pb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-gray-800">Alertes ({alerts.length})</h3>
          </div>
          <div className="space-y-1 px-4 pb-4">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs ${
                  alert.type === 'danger'
                    ? 'bg-red-50 text-red-700'
                    : alert.type === 'warning'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                <span className="shrink-0 mt-0.5">{alert.icon}</span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Crédits : Répartition par mode de paiement === */}
      {creditBreakdown.hasData && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-gray-800">Crédits reçus par mode</h3>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-green-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-gray-700">💵 Espèces</span>
              </div>
              <span className="text-sm font-black text-gray-800">{creditBreakdown.especes.toLocaleString()} Frs</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-xs font-medium text-gray-700">📱 Orange Money</span>
              </div>
              <span className="text-sm font-black text-gray-800">{creditBreakdown.orangeMoney.toLocaleString()} Frs</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-gray-700">📱 Wave</span>
              </div>
              <span className="text-sm font-black text-gray-800">{creditBreakdown.wave.toLocaleString()} Frs</span>
            </div>
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex items-center justify-between p-2.5 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs font-medium text-gray-700">⏳ Restant à recouvrer</span>
              </div>
              <span className="text-sm font-black text-red-600">{creditBreakdown.totalRestant.toLocaleString()} Frs</span>
            </div>
            <div className="flex items-center justify-between pt-1 px-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Total crédits</span>
              <span className="text-xs font-black text-gray-800">{creditBreakdown.totalCredits.toLocaleString()} Frs</span>
            </div>
          </div>
        </div>
      )}

      {/* === Statistiques hebdomadaires === */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center shadow-sm">
          <div className="text-lg font-black text-gray-800">{weeklyStats.weekCount}</div>
          <div className="text-[10px] text-gray-500 mt-1">Ventes (7j)</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center shadow-sm">
          <div className="text-lg font-black text-gray-800">{weeklyStats.weekTotal.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 mt-1">Frs (7j)</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center shadow-sm">
          <div className="text-lg font-black text-gray-800">{Math.round(weeklyStats.avgPerDay).toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 mt-1">Frs / jour</div>
        </div>
      </div>

      {/* === Graphique : Ventes sur 30 jours === */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-gray-800">Évolution des ventes (30 jours)</h3>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesChartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`${value.toLocaleString()} Frs`]}
                labelFormatter={(label: string) => new Date(label).toLocaleDateString('fr-FR')}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={COLORS.orange}
                strokeWidth={2}
                fill="url(#colorTotal)"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.orange }}
              />
              <Line
                type="monotone"
                dataKey="cash"
                stroke={COLORS.green}
                strokeWidth={1.5}
                dot={false}
                name="Comptant"
              />
              <Line
                type="monotone"
                dataKey="credit"
                stroke={COLORS.purple}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                name="Crédit"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.orange }} />
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
            <span>Comptant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.purple }} />
            <span>Crédit</span>
          </div>
        </div>
      </div>

      {/* === Graphiques en ligne : Répartition + Top clients === */}
      <div className="grid grid-cols-2 gap-3">
        {/* Répartition des ventes */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold text-gray-800">Répartition</h3>
          </div>
          {salesPieData.length > 0 ? (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {salesPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => `${value.toLocaleString()} Frs`}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-[10px] text-gray-400">
              Aucune donnée
            </div>
          )}
          <div className="space-y-1 mt-2">
            {salesPieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-500">{d.name}</span>
                </div>
                <span className="font-medium text-gray-700">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top clients */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-gray-800">Top clients</h3>
          </div>
          {topClients.length > 0 ? (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ left: 5, right: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 8 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => `${value.toLocaleString()} Frs`}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill={COLORS.blue} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-[10px] text-gray-400">
              Aucune vente
            </div>
          )}
        </div>
      </div>

      {/* === Graphique : Poids des bandes actives === */}
      {weightChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-gray-800">Évolution poids des bandes</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="jour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`${value}g`]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                />
                <Line
                  name="Théorique"
                  type="monotone"
                  dataKey="Théorique"
                  stroke={COLORS.gray}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                {data.productionBatches.filter(b => b.statut === 'active').map((batch, idx) => {
                  const colors = [COLORS.orange, COLORS.blue, COLORS.green, COLORS.purple, COLORS.yellow];
                  return (
                    <Line
                      key={batch.id}
                      name={batch.nom}
                      type="monotone"
                      dataKey={batch.nom}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* === Bande active la plus avancée === */}
      {stats.mostAdvancedBatch && (
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 border border-orange-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Egg className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-bold text-orange-900">Bande la plus avancée</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-orange-900">{stats.mostAdvancedBatch.nom}</div>
              <div className="text-xs text-orange-700 mt-1">
                {stats.mostAdvancedBatch.suiviQuotidien.length} suivis ·{' '}
                {stats.mostAdvancedBatch.suiviQuotidien.reduce((s, r) => s + r.mort, 0)} morts
              </div>
            </div>
            <div className="text-right">
              {stats.lastRecord && (
                <>
                  <div className="text-lg font-black text-orange-900">{stats.lastRecord.poidsReel}g</div>
                  <div className="text-xs text-orange-700">J{stats.lastRecord.jourDeBande}</div>
                </>
              )}
            </div>
          </div>
          {stats.mostAdvancedBatch.suiviQuotidien.length >= 2 && (
            <div className="mt-3 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={stats.mostAdvancedBatch.suiviQuotidien.slice(-14).map(r => ({
                    jour: `J${r.jourDeBande}`,
                    poids: r.poidsReel,
                  }))}
                >
                  <Line
                    type="monotone"
                    dataKey="poids"
                    stroke={COLORS.orange}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* === Statistiques saisonnières === */}
      <SeasonalStats data={data} />

      {/* === Raccourcis rapides === */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink
          icon={<ShoppingCart className="w-5 h-5" />}
          label="Nouvelle vente"
          color="bg-green-500"
          onClick={() => {
            const nav = document.querySelector('[data-tab="ventes"]') as HTMLButtonElement;
            nav?.click();
          }}
        />
        <QuickLink
          icon={<Users className="w-5 h-5" />}
          label="Ajouter un client"
          color="bg-blue-500"
          onClick={() => {
            const nav = document.querySelector('[data-tab="clients"]') as HTMLButtonElement;
            nav?.click();
          }}
        />
        <QuickLink
          icon={<Egg className="w-5 h-5" />}
          label="Suivi production"
          color="bg-orange-500"
          onClick={() => {
            const nav = document.querySelector('[data-tab="production"]') as HTMLButtonElement;
            nav?.click();
          }}
        />
        <QuickLink
          icon={<BarChart3 className="w-5 h-5" />}
          label="Rapport financier"
          color="bg-purple-500"
          onClick={() => {
            const nav = document.querySelector('[data-tab="rapport"]') as HTMLButtonElement;
            nav?.click();
          }}
        />
      </div>
    </div>
  );
};

// === Quick Link Sub-component ===

const QuickLink = ({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform hover:border-gray-200 text-left"
  >
    <div className={`${color.replace('500', '100')} p-2.5 rounded-xl`}>
      <div className={`${color.replace('bg-', 'text-')}`}>
        {icon}
      </div>
    </div>
    <span className="text-sm font-bold text-gray-700">{label}</span>
  </button>
);
