import React, { useState, useMemo } from 'react';
import { CreditCard, AlertTriangle, Clock, CheckCircle2, Phone, MessageCircle, Filter, ChevronRight, DollarSign } from 'lucide-react';
import { AppData, Sale } from '../../types';
import { formatWhatsAppUrl } from '../../utils/whatsapp';
import { getRemainingBalance, isSalePaid } from '../../utils/creditHelpers';
import { formatCurrency, formatNumber } from '../../utils/currency';
import { formatDateShort } from '../../utils/dateFormat';

interface EcheancesViewProps {
  data: AppData;
}

type FilterEcheance = 'all' | 'overdue' | 'upcoming' | 'paid';

export const EcheancesView = ({ data }: EcheancesViewProps) => {
  const [filter, setFilter] = useState<FilterEcheance>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const creditSales = useMemo(() => {
    const now = new Date();
    const activeSales = data.sales.filter(s => !('deletedAt' in s));
    return activeSales
      .filter(s => s.isCredit)
      .map(s => {
        const remaining = getRemainingBalance(s);
        const paid = isSalePaid(s);
        const dueDate = s.dueDate ? new Date(s.dueDate) : null;
        const isOverdue = dueDate && dueDate < now && !paid;
        const daysRemaining = dueDate
          ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000)
          : null;
        const client = data.clients.find(c => c.id === s.clientId);
        return { ...s, remaining, paid, isOverdue, daysRemaining, client };
      })
      .filter(s => {
        if (filter === 'overdue') return s.isOverdue;
        if (filter === 'upcoming') return !s.paid && s.dueDate && !s.isOverdue;
        if (filter === 'paid') return s.paid;
        return true;
      })
      .sort((a, b) => {
        // Overdue first, then by dueDate ascending
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      });
  }, [data, filter]);

  const overdueCount = creditSales.filter(s => s.isOverdue).length;
  const upcomingCount = creditSales.filter(s => !s.paid && !s.isOverdue).length;
  const paidCount = creditSales.filter(s => s.paid).length;

  const getDaysColor = (days: number | null, isOverdue: boolean) => {
    if (!days) return 'text-gray-400';
    if (isOverdue) {
      if (Math.abs(days) >= 15) return 'text-red-600';
      if (Math.abs(days) >= 7) return 'text-red-500';
      return 'text-red-400';
    }
    if (days <= 3) return 'text-orange-600';
    if (days <= 7) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filterTabs: { key: FilterEcheance; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: creditSales.length },
    { key: 'overdue', label: '🔴 En retard', count: overdueCount },
    { key: 'upcoming', label: '🟡 À venir', count: upcomingCount },
    { key: 'paid', label: '✅ Soldées', count: paidCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Calendrier des échéances</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 text-white shadow-lg shadow-red-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black">{overdueCount}</div>
          <div className="text-xs text-red-100">En retard</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black">{upcomingCount}</div>
          <div className="text-xs text-orange-100">À venir</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white shadow-lg shadow-green-200">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black">{paidCount}</div>
          <div className="text-xs text-green-100">Soldées</div>
        </div>
      </div>

      {/* Total impayé */}
      {(() => {
        const totalImpaye = creditSales
          .filter(s => !s.paid)
          .reduce((sum, s) => sum + s.remaining, 0);
        if (totalImpaye <= 0) return null;
        return (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-center">
            <div className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase tracking-wider">Total impayé</div>
            <div className="text-2xl font-black text-red-600 mt-1">{formatCurrency(totalImpaye)}</div>
          </div>
        );
      })()}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              filter === tab.key
                ? 'bg-gray-900 dark:bg-gray-700 text-white'
                : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Credit list */}
      <div className="space-y-2">
        {creditSales.length === 0 && (
          <div className="text-center py-10">
            <CreditCard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Aucune échéance trouvée</p>
          </div>
        )}

        {creditSales.map(s => (
          <div
            key={s.id}
            onClick={() => setSelectedSale(s === selectedSale ? null : s)}
            className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all ${
              s.isOverdue
                ? 'border-red-200 dark:border-red-800'
                : s.paid
                ? 'border-green-200 dark:border-green-800'
                : 'border-orange-200 dark:border-orange-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                s.isOverdue
                  ? 'bg-red-100 text-red-600'
                  : s.paid
                  ? 'bg-green-100 text-green-600'
                  : 'bg-orange-100 text-orange-600'
              }`}>
                {s.isOverdue ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : s.paid ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Clock className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800 dark:text-white truncate">{s.clientNom}</span>
                  {s.isOverdue && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase shrink-0">
                      Retard
                    </span>
                  )}
                  {s.paid && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 uppercase shrink-0">
                      Soldé
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs font-black ${getDaysColor(s.daysRemaining, s.isOverdue)}`}>
                    {s.isOverdue
                      ? `🔴 ${Math.abs(s.daysRemaining || 0)}j de retard`
                      : s.paid
                      ? '✓ Payé'
                      : s.daysRemaining !== null
                      ? `🟡 Échéance J-${s.daysRemaining}`
                      : 'Pas d\'échéance'
                    }
                  </span>
                  {s.dueDate && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {formatDateShort(s.dueDate)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-black ${s.paid ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(s.remaining)}
                </div>
                <div className="text-[9px] text-gray-400">sur {formatCurrency(s.total)}</div>
              </div>
            </div>

            {/* Expanded detail with WhatsApp relance */}
            {selectedSale?.id === s.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3 animate-in slide-in-from-top duration-200">
                {/* Payment info */}
                {s.payments && s.payments.length > 0 && (
                  <div className="space-y-1">                        <div className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Versements</div>
                    {s.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-3 h-3 text-green-500" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {formatDateShort(p.date)}
                          </span>
                          {p.methode && (
                            <span className="text-[9px] text-gray-400 dark:text-gray-500">
                              ({p.methode === 'especes' ? 'Espèces' : p.methode === 'orange_money' ? 'Orange Money' : 'Wave'})
                            </span>
                          )}
                        </div>                          <span className="font-bold text-gray-800 dark:text-white">{formatCurrency(p.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* WhatsApp relance button */}
                {!s.paid && s.client?.tel && (() => {
                  const waMsg = `Bonjour ${s.clientNom} 👋\n\nJe me permets de vous relancer concernant le solde restant de ${formatCurrency(s.remaining)} sur vos achats (${formatDateShort(s.dateVente)}).\n\nMerci de bien vouloir régulariser votre situation. 🙏\n\nCordialement.`;
                  const waUrl = formatWhatsAppUrl(s.client.tel, waMsg);
                  if (!waUrl) return null;
                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-green-600 text-white p-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform hover:bg-green-700"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Relancer sur WhatsApp
                    </a>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
