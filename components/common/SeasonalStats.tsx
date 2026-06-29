import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Thermometer, DollarSign, BarChart3, Egg } from 'lucide-react';
import { AppData, ProductionBatch } from '../../types';

interface SeasonalStatsProps {
  data: AppData;
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const COLORS = ['#ea580c', '#3b82f6', '#16a34a', '#dc2626', '#7c3aed', '#0d9488', '#eab308', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

// Helper: extract month number (1-12) from date string
const getMonth = (dateStr: string) => new Date(dateStr).getMonth();

// Helper: mortality rate for a batch
const getMortalityRate = (batch: ProductionBatch) => {
  if (batch.nbPoussinsInitial <= 0) return 0;
  const totalMorts = batch.suiviQuotidien.reduce((s, r) => s + r.mort, 0);
  return (totalMorts / batch.nbPoussinsInitial) * 100;
};

// Get season from month (0=Jan, 11=Dec) — Sénégal
const getSeason = (month: number): string => {
  if (month >= 10 || month <= 1) return 'Sèche (fraîche)'; // Nov–Fév
  if (month >= 2 && month <= 5) return 'Sèche (chaude)';   // Mar–Juin
  return 'Pluies (hivernage)';                               // Juil–Oct
};

// Icons for seasons
const SEASON_ICONS: Record<string, string> = {
  'Sèche (fraîche)': '🌤️',
  'Sèche (chaude)': '☀️',
  'Pluies (hivernage)': '🌧️',
};

// Température et caractéristiques des saisons sénégalaises
const SEASON_INFO: Record<string, { temperature: string; characteristics: string }> = {
  'Sèche (fraîche)': { temperature: '20–30 °C', characteristics: 'Harmattan, nuits fraîches, climat agréable' },
  'Sèche (chaude)': { temperature: '30–45 °C', characteristics: 'Forte chaleur intérieure, brise marine sur la côte' },
  'Pluies (hivernage)': { temperature: '30–35 °C', characteristics: 'Pluies abondantes, végétation luxuriante, humidité élevée' },
};

export const SeasonalStats = ({ data }: SeasonalStatsProps) => {
  const activeSales = useMemo(() => data.sales.filter(s => !('deletedAt' in s)), [data.sales]);

  // ── Sales by month ──
  const monthlySales = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      label: MONTHS_FR[i],
      total: 0,
      count: 0,
      credit: 0,
      cash: 0,
    }));

    activeSales.forEach(s => {
      const month = getMonth(s.dateVente);
      months[month].total += s.total;
      months[month].count += 1;
      if (s.isCredit) months[month].credit += s.total;
      else months[month].cash += s.total;
    });

    return months;
  }, [activeSales]);

  // ── Sales by season ──
  const seasonalSales = useMemo(() => {
    const seasons: Record<string, { total: number; count: number }> = {
      'Sèche (fraîche)': { total: 0, count: 0 },
      'Sèche (chaude)': { total: 0, count: 0 },
      'Pluies (hivernage)': { total: 0, count: 0 },
    };

    activeSales.forEach(s => {
      const season = getSeason(getMonth(s.dateVente));
      seasons[season].total += s.total;
      seasons[season].count += 1;
    });

    return Object.entries(seasons).map(([name, stats]) => ({
      name: `${SEASON_ICONS[name]} ${name}`,
      total: stats.total,
      count: stats.count,
    }));
  }, [data]);

  // ── Mortality by month ──
  const monthlyMortality = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      label: MONTHS_FR[i],
      rate: 0,
      batchCount: 0,
    }));

    data.productionBatches.forEach(batch => {
      const month = getMonth(batch.dateMisePlace);
      months[month].rate += getMortalityRate(batch);
      months[month].batchCount += 1;
    });

    // Average rate
    months.forEach(m => {
      if (m.batchCount > 0) m.rate = Math.round((m.rate / m.batchCount) * 10) / 10;
    });

    return months;
  }, [data]);

  // ── Best month ──
  const bestMonth = useMemo(() => {
    let best = monthlySales[0];
    monthlySales.forEach(m => {
      if (m.total > best.total) best = m;
    });
    return best.total > 0 ? best : null;
  }, [monthlySales]);

  // ── Worst mortality month ──
  const worstMortality = useMemo(() => {
    let worst = monthlyMortality[0];
    monthlyMortality.forEach(m => {
      if (m.rate > worst.rate && m.batchCount > 0) worst = m;
    });
    return worst.rate > 0 ? worst : null;
  }, [monthlyMortality]);

  // ── Season with best revenue ──
  const bestSeason = useMemo(() => {
    let best = seasonalSales[0];
    seasonalSales.forEach(s => {
      if (s.total > best.total) best = s;
    });
    return best.total > 0 ? best : null;
  }, [seasonalSales]);

  // ── Average monthly revenue ──
  const avgMonthlyRevenue = useMemo(() => {
    const monthsWithSales = monthlySales.filter(m => m.total > 0).length;
    if (monthsWithSales === 0) return 0;
    return Math.round(monthlySales.reduce((s, m) => s + m.total, 0) / monthsWithSales);
  }, [monthlySales]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-teal-500" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-white">Statistiques saisonnières</h3>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {bestMonth && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 text-white shadow-sm">
            <div className="text-[9px] text-orange-100 uppercase font-black tracking-wider">Mois le + rentable</div>
            <div className="text-lg font-black mt-1">{bestMonth.label}</div>
            <div className="text-xs text-orange-100">{bestMonth.total.toLocaleString()} Frs</div>
          </div>
        )}
        {bestSeason && (
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 text-white shadow-sm">
            <div className="text-[9px] text-blue-100 uppercase font-black tracking-wider">Saison la + rentable</div>
            <div className="text-lg font-black mt-1">{bestSeason.name}</div>
            <div className="text-xs text-blue-100">{bestSeason.total.toLocaleString()} Frs</div>
          </div>
        )}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 text-white shadow-sm">
          <div className="text-[9px] text-purple-100 uppercase font-black tracking-wider">Moy. mensuelle</div>
          <div className="text-lg font-black mt-1">{avgMonthlyRevenue.toLocaleString()}</div>
          <div className="text-xs text-purple-100">Frs / mois</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 text-white shadow-sm">
          <div className="text-[9px] text-green-100 uppercase font-black tracking-wider">Total ventes</div>
          <div className="text-lg font-black mt-1">{activeSales.reduce((s, v) => s + v.total, 0).toLocaleString()}</div>
          <div className="text-xs text-green-100">Frs toutes ventes</div>
        </div>
      </div>

      {/* Monthly revenue bar chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-orange-500" />
          <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">Revenus par mois</h4>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`${value.toLocaleString()} Frs`]}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {monthlySales.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2 text-[9px] text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Crédit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Comptant</span>
          </div>
        </div>
      </div>

      {/* Seasonal comparison pie + Mortality by month */}
      <div className="grid grid-cols-2 gap-3">
        {/* Seasonal sales */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-3.5 h-3.5 text-blue-500" />
            <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Par saison</h4>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={seasonalSales}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={38}
                  paddingAngle={3}
                  dataKey="total"
                >
                  {seasonalSales.map((_, i) => (
                    <Cell key={i} fill={[COLORS[0], COLORS[1], COLORS[2]][i % 3]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => `${value.toLocaleString()} Frs`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-0.5 mt-1">
            {seasonalSales.map((s, i) => {
              const info = SEASON_INFO[s.name.replace(/^[^\s]+\s+/, '')] || null;
              return (
                <div key={s.name} className="text-[8px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: [COLORS[0], COLORS[1], COLORS[2]][i % 3] }} />
                      <span className="text-gray-500">{s.name}</span>
                    </div>
                    <span className="font-medium text-gray-700">{s.total.toLocaleString()} F</span>
                  </div>
                  {info && (
                    <div className="text-[6px] text-gray-400 ml-2.5 mt-0.5">
                      {info.temperature} · {info.characteristics}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mortality by month */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Egg className="w-3.5 h-3.5 text-red-500" />
            <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Mortalité / mois</h4>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyMortality}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`${value}%`]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Mortalité"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {worstMortality && (
            <div className="text-[8px] text-red-500 mt-1 text-center">
              ⚠️ Pic mortalité en {worstMortality.label} ({worstMortality.rate}%)
            </div>
          )}
        </div>
      </div>

      {/* Detailed monthly table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-3 pb-1">
          <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Détail mensuel</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left p-2 text-gray-400 font-medium">Mois</th>
                <th className="text-right p-2 text-gray-400 font-medium">Ventes</th>
                <th className="text-right p-2 text-gray-400 font-medium">Montant</th>
                <th className="text-right p-2 text-gray-400 font-medium">Moy./vente</th>
                <th className="text-right p-2 text-gray-400 font-medium">Mortalité</th>
              </tr>
            </thead>
            <tbody>
              {monthlySales.filter(m => m.total > 0 || monthlyMortality[m.month].rate > 0).map(m => {
                const mort = monthlyMortality[m.month];
                return (
                  <tr key={m.month} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="p-2 font-bold text-gray-700 dark:text-gray-300">{m.label}</td>
                    <td className="p-2 text-right text-gray-600 dark:text-gray-400">{m.count}</td>
                    <td className="p-2 text-right font-bold text-gray-800 dark:text-white">{m.total.toLocaleString()} F</td>
                    <td className="p-2 text-right text-gray-500">
                      {m.count > 0 ? Math.round(m.total / m.count).toLocaleString() : '—'}
                    </td>
                    <td className="p-2 text-right">
                      <span className={mort.rate > 5 ? 'text-red-500 font-bold' : mort.rate > 0 ? 'text-yellow-500' : 'text-gray-400'}>
                        {mort.rate > 0 ? `${mort.rate}%` : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {monthlySales.every(m => m.total === 0) && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    Aucune donnée de vente disponible
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      {bestMonth && bestSeason && (
        <div className="bg-gradient-to-br from-teal-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 rounded-2xl p-4 border border-teal-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-teal-600" />
            <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300">Insights</h4>
          </div>
          <ul className="space-y-1.5 text-[10px] text-teal-700 dark:text-teal-400">
            <li>📈 Le mois le plus rentable est <strong>{bestMonth.label}</strong> avec <strong>{bestMonth.total.toLocaleString()} Frs</strong> de ventes</li>
            <li>🌤️ La saison la plus productive est <strong>{bestSeason.name}</strong></li>
            <li>💰 Revenu mensuel moyen : <strong>{avgMonthlyRevenue.toLocaleString()} Frs</strong></li>
            {worstMortality && (
              <li>⚠️ Attention : la mortalité est plus élevée en <strong>{worstMortality.label}</strong> ({worstMortality.rate}%)</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
