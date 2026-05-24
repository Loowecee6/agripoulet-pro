import React, { useState, useMemo } from 'react';
import { useToast } from '../common/ToastContext';
import { Plus, Edit2, Trash2, Phone, MessageCircle, ShoppingCart, CalendarDays, DollarSign, Clock, ChevronRight, FileDown, Filter, FileText, AlertTriangle, CreditCard, CheckCircle2 } from 'lucide-react';
import { AppData, Client, Sale } from '../../types';
import { generateInvoice } from '../../utils/invoicePDF';
import { exportClients } from '../../utils/exportXLS';
import { formatWhatsAppUrl } from '../../utils/whatsapp';
import { getRemainingBalance, isSalePaid, getTotalPayments, getCreditRisk } from '../../utils/creditHelpers';
import { Modal } from '../common/Modal';
import { SearchBar } from '../common/SearchBar';type FilterStatus = 'all' | 'actif' | 'inactif_30' | 'inactif_60';
type RiskFilter = 'all' | 'urgent' | 'en_cours' | 'aucun';

type SortBy = 'nom' | 'recent' | 'depense';

interface ClientsViewProps {
  data: AppData;
  setData: (d: AppData) => void;
}

// ── Helpers ─────────────────────────────────────────────
const getClientSales = (sales: Sale[], clientId: string) =>
  sales.filter(s => s.clientId === clientId).sort((a, b) => new Date(b.dateVente).getTime() - new Date(a.dateVente).getTime());

// Get the worst credit risk across all sales for a client
const getWorstRisk = (sales: Sale[]): { level: 'none' | 'ok' | 'warning' | 'danger'; label: string } => {
  let worst: 'none' | 'ok' | 'warning' | 'danger' = 'none';
  let worstLabel = '';
  for (const s of sales) {
    const risk = getCreditRisk(s);
    const order = { none: 0, ok: 1, warning: 2, danger: 3 };
    if (order[risk.level] > order[worst]) {
      worst = risk.level;
      worstLabel = risk.label;
    }
  }
  return { level: worst, label: worstLabel };
};

const getDaysSince = (date: Date): number =>
  Math.floor((Date.now() - date.getTime()) / 86400000);

const getActivityStatus = (days: number | null): { label: string; color: string; badge: string } => {
  if (days === null) return { label: 'Nouveau', color: 'text-blue-600', badge: 'bg-blue-100 text-blue-600' };
  if (days <= 30) return { label: 'Actif', color: 'text-green-600', badge: 'bg-green-100 text-green-600' };
  if (days <= 60) return { label: '30j+ inactif', color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-600' };
  return { label: '60j+ inactif', color: 'text-red-600', badge: 'bg-red-100 text-red-600' };
};

// ── Component ────────────────────────────────────────────
export const ClientsView = ({ data, setData }: ClientsViewProps) => {
  const { addToast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('nom');

  // ── Computed per-client stats ──
  const clientStats = useMemo(() => {
    const map = new Map<string, {
      totalSpent: number;
      purchaseCount: number;
      lastPurchase: Date | null;
      daysSince: number | null;
      sales: Sale[];
      creditTotal: number;
      creditRemaining: number;
      risk: ReturnType<typeof getWorstRisk>;
    }>();
    data.clients.forEach(c => {
      const sales = getClientSales(data.sales, c.id);
      const lastPurchase = sales.length > 0 ? new Date(sales[0].dateVente) : null;
      const creditSales = sales.filter(s => s.isCredit && !isSalePaid(s));
      const creditRemaining = creditSales.reduce((sum, s) => sum + getRemainingBalance(s), 0);
      map.set(c.id, {
        totalSpent: sales.reduce((sum, s) => sum + s.total, 0),
        purchaseCount: sales.length,
        lastPurchase,
        daysSince: lastPurchase ? getDaysSince(lastPurchase) : null,
        sales,
        creditTotal: creditSales.reduce((sum, s) => sum + s.total, 0),
        creditRemaining,
        risk: getWorstRisk(sales),
      });
    });
    return map;
  }, [data.clients, data.sales]);

  // ── Filtered & sorted list ──
  const filtered = useMemo(() => {
    let list = data.clients.filter(c =>
      c.nom.toLowerCase().includes(search.toLowerCase()) || c.tel.includes(search)
    );

    // Filter by activity
    if (filterStatus === 'actif') {
      list = list.filter(c => {
        const stat = clientStats.get(c.id);
        return stat && stat.daysSince !== null && stat.daysSince <= 30;
      });
    } else if (filterStatus === 'inactif_30') {
      list = list.filter(c => {
        const stat = clientStats.get(c.id);
        return stat && stat.daysSince !== null && stat.daysSince > 30;
      });
    } else if (filterStatus === 'inactif_60') {
      list = list.filter(c => {
        const stat = clientStats.get(c.id);
        return stat && stat.daysSince !== null && stat.daysSince > 60;
      });
    }

    // Filter by credit risk
    if (riskFilter === 'urgent') {
      list = list.filter(c => {
        const stat = clientStats.get(c.id);
        return stat && stat.risk.level === 'danger';
      });
    } else if (riskFilter === 'en_cours') {
      list = list.filter(c => {
        const stat = clientStats.get(c.id);
        return stat && (stat.risk.level === 'warning' || stat.risk.level === 'ok');
      });
    } else if (riskFilter === 'aucun') {
      list = list.filter(c => {
        const stat = clientStats.get(c.id);
        return !stat || stat.risk.level === 'none';
      });
    }

    // Sort
    list.sort((a, b) => {
      const sa = clientStats.get(a.id);
      const sb = clientStats.get(b.id);
      if (sortBy === 'recent') {
        const da = sa?.lastPurchase?.getTime() || 0;
        const db = sb?.lastPurchase?.getTime() || 0;
        return db - da;
      }
      if (sortBy === 'depense') {
        return (sb?.totalSpent || 0) - (sa?.totalSpent || 0);
      }
      return a.nom.localeCompare(b.nom);
    });

    return list;
  }, [data.clients, search, filterStatus, riskFilter, sortBy, clientStats]);

  // ── Handlers ──
  const handleAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newClient: Client = {
      id: crypto.randomUUID(),
      nom: f.get('nom') as string,
      adresse: f.get('adresse') as string || '',
      tel: f.get('tel') as string || '',
      notes: (f.get('notes') as string) || undefined,
    };
    setData({ ...data, clients: [...data.clients, newClient] });
    setIsAddModalOpen(false);
  };

  const handleUpdateClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingClient) return;
    const f = new FormData(e.currentTarget);
    const updatedClient: Client = {
      ...editingClient,
      nom: f.get('nom') as string,
      adresse: f.get('adresse') as string || '',
      tel: f.get('tel') as string || '',
      notes: (f.get('notes') as string) || undefined,
    };
    setData({ 
      ...data, 
      clients: data.clients.map(c => c.id === editingClient.id ? updatedClient : c),
      sales: data.sales.map(s => s.clientId === editingClient.id ? { ...s, clientNom: updatedClient.nom } : s)
    });
    // Update selected client if viewing
    if (selectedClient?.id === editingClient.id) setSelectedClient(updatedClient);
    setEditingClient(null);
  };

  const handleDeleteClient = (clientId: string) => {
    const clientSales = data.sales.filter(s => s.clientId === clientId);
    const msg = clientSales.length > 0
      ? `Supprimer "${data.clients.find(c => c.id === clientId)?.nom}" ?\n${clientSales.length} vente(s) liée(s) seront également supprimées.`
      : `Supprimer le client ?`;
    if (!confirm(msg)) return;
    // Remove client & their sales, restore chickens
    const clientSaleIds = data.sales.filter(s => s.clientId === clientId).map(s => s.id);
    const updatedStock = data.stockBatches.map(b => ({
      ...b,
      poulets: b.poulets.map(p =>
        data.sales.some(s => s.clientId === clientId && s.pouletIds.includes(p.id))
          ? { ...p, vendu: false }
          : p
      )
    }));
    setData({
      ...data,
      clients: data.clients.filter(c => c.id !== clientId),
      sales: data.sales.filter(s => s.clientId !== clientId),
      stockBatches: updatedStock,
    });
    if (selectedClient?.id === clientId) setSelectedClient(null);
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'actif', label: 'Actifs' },
    { key: 'inactif_30', label: '30j+' },
    { key: 'inactif_60', label: '60j+' },
  ];

  const riskTabs: { key: RiskFilter; label: string; icon: string }[] = [
    { key: 'all', label: 'Tous', icon: '' },
    { key: 'urgent', label: '🔴 Urgent', icon: '' },
    { key: 'en_cours', label: '🟡 En cours', icon: '' },
    { key: 'aucun', label: '✅ OK', icon: '' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Base Clients</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportClients(data.clients, data.sales)}
            className="bg-green-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"
            title="Exporter la liste clients"
          >
            <FileDown />
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher par nom ou mobile..." />

      {/* ── Filter & Sort ── */}
      {/* ── Filtre activité ── */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                filterStatus === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtre crédit ── */}
      <div className="flex items-center gap-2">
        <CreditCard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {riskTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setRiskFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider whitespace-nowrap transition-all ${
                riskFilter === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          className="text-[10px] font-black bg-gray-100 border-0 rounded-lg px-2 py-1.5 outline-none text-gray-500 appearance-none cursor-pointer"
        >
          <option value="nom">Nom</option>
          <option value="recent">Récent</option>
          <option value="depense">Dépense</option>
        </select>
      </div>

      {/* ── Client List ── */}
      <div className="grid gap-3">
        {filtered.map(c => {
          const stat = clientStats.get(c.id);
          const status = getActivityStatus(stat?.daysSince ?? null);
          return (
            <div
              key={c.id}
              onClick={() => setSelectedClient(c)}
              className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer active:scale-[0.98] transition-transform"
            >                <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-white truncate">{c.nom}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${status.badge}`}>
                      {status.label}
                    </span>
                    {stat && stat.risk.level !== 'none' && stat.risk.level !== 'ok' && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                        stat.risk.level === 'danger' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {stat.risk.level === 'danger' ? '🔴' : '🟡'} {stat.risk.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    {c.tel && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.tel}</span>}
                    {stat && stat.purchaseCount > 0 && (
                      <>
                        <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{stat.purchaseCount} achat(s)</span>
                        <span className="font-bold text-orange-600">{stat.totalSpent.toLocaleString()} F</span>
                      </>
                    )}
                    {stat && stat.purchaseCount === 0 && (
                      <span className="italic text-gray-300">Aucun achat</span>
                    )}
                  </div>
                  {stat && stat.lastPurchase && (
                    <div className="text-[9px] text-gray-400 mt-1">
                      Dernier achat : {stat.lastPurchase.toLocaleDateString('fr-FR')}
                      {stat.daysSince !== null && stat.daysSince > 0 && (
                        <span className="ml-1">(il y a {stat.daysSince}j)</span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">
            {search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
          </p>
        )}
      </div>

      {/* ── Add Client Modal ── */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouveau Client">
        <form onSubmit={handleAddClient} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nom Complet *</label>                  <input name="nom" required placeholder="Ex: Jean Dupont" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">N° Téléphone</label>
            <input name="tel" placeholder="Ex: 06 00 00 00 00" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Adresse de livraison</label>
            <input name="adresse" placeholder="Quartier, Ville..." className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Notes</label>
            <textarea name="notes" rows={3} placeholder="Ex: Préfère le samedi, client fidèle..." className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:text-white resize-none" />
          </div>
          <button type="submit" className="w-full bg-orange-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-100 mt-4 active:scale-95 transition-transform">Enregistrer le client</button>
        </form>
      </Modal>

      {/* ── Edit Client Modal ── */}
      <Modal isOpen={!!editingClient} onClose={() => setEditingClient(null)} title="Modifier Client">
        {editingClient && (
          <form onSubmit={handleUpdateClient} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nom Complet *</label>
              <input name="nom" required defaultValue={editingClient.nom} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">N° Téléphone</label>
              <input name="tel" defaultValue={editingClient.tel} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Adresse de livraison</label>
            <input name="adresse" defaultValue={editingClient.adresse} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Notes</label>
            <textarea name="notes" rows={3} defaultValue={editingClient.notes || ''} placeholder="Ex: Préfère le samedi, client fidèle..." className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
          </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl mt-4 active:scale-95 transition-transform">Mettre à jour la fiche</button>
          </form>
        )}
      </Modal>

      {/* ── Client Detail Modal ── */}
      <Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title="Fiche Client">
        {selectedClient && (() => {
          const stat = clientStats.get(selectedClient.id);
          const status = getActivityStatus(stat?.daysSince ?? null);
          const sales = stat?.sales || [];
          const waUrl = formatWhatsAppUrl(selectedClient.tel);

          return (
            <div className="space-y-5">
              {/* Header */}
              <div className="bg-gradient-to-br from-orange-50 dark:from-gray-800 to-white dark:to-gray-800 rounded-3xl p-5 border border-orange-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">{selectedClient.nom}</h3>
                      {selectedClient.tel && (
                        <a
                          href={`tel:${selectedClient.tel}`}
                          className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> {selectedClient.tel}
                        </a>
                      )}
                      {selectedClient.adresse && (
                        <div className="text-xs text-gray-400 mt-0.5">{selectedClient.adresse}</div>
                      )}
                      {selectedClient.notes && (
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                          <FileText className="w-3 h-3" />
                          Note
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${status.badge}`}>
                    {status.label}
                  </span>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700">
                    <ShoppingCart className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                    <div className="text-sm font-black text-gray-800 dark:text-white">{stat?.purchaseCount || 0}</div>
                    <div className="text-[7px] text-gray-400 uppercase font-black tracking-wider">Achats</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700">
                    <DollarSign className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <div className="text-sm font-black text-gray-800 dark:text-white">{(stat?.totalSpent || 0).toLocaleString()}</div>
                    <div className="text-[7px] text-gray-400 uppercase font-black tracking-wider">Dépensé</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700">
                    <CalendarDays className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <div className="text-sm font-black text-gray-800 dark:text-white">
                      {stat?.lastPurchase ? stat.lastPurchase.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
                    </div>
                    <div className="text-[7px] text-gray-400 uppercase font-black tracking-wider">Dernier</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700">
                    <Clock className="w-4 h-4 text-red-500 mx-auto mb-1" />
                    <div className="text-sm font-black text-gray-800 dark:text-white">
                      {stat?.daysSince !== null && stat?.daysSince !== undefined ? `${stat.daysSince}j` : '—'}
                    </div>
                    <div className="text-[7px] text-gray-400 uppercase font-black tracking-wider">Inactif</div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {waUrl && (() => {
                  // Build relance message if client has active credit
                  const activeCredits = sales.filter(s => s.isCredit && !isSalePaid(s) && getRemainingBalance(s) > 0);
                  let waMsg: string | undefined;
                  if (activeCredits.length > 0) {
                    const totalRemaining = activeCredits.reduce((sum, s) => sum + getRemainingBalance(s), 0);
                    waMsg = `Bonjour ${selectedClient.nom} 👋\n\nJe me permets de vous relancer concernant le solde restant de ${totalRemaining.toLocaleString()} Frs sur vos achats chez AgriPoulet Pro.\n\nMerci de bien vouloir régulariser votre situation. 🙏\n\nCordialement.`;
                  }
                  return (
                    <a
                      href={formatWhatsAppUrl(selectedClient.tel, waMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${
                        activeCredits.length > 0
                          ? 'bg-green-600 text-white shadow-green-100 hover:bg-green-700'
                          : 'bg-green-500 text-white shadow-green-100 hover:bg-green-600'
                      }`}
                    >
                      <MessageCircle className="w-5 h-5" />
                      {activeCredits.length > 0 ? 'Relancer 💬' : 'WhatsApp'}
                    </a>
                  );
                })()}
                <button
                  onClick={() => { setEditingClient(selectedClient); setSelectedClient(null); }}
                  className="flex-1 bg-gray-900 text-white p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-gray-800"
                >
                  <Edit2 className="w-5 h-5" /> Modifier
                </button>
                <button
                  onClick={() => handleDeleteClient(selectedClient.id)}
                  className="bg-red-50 text-red-500 p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-red-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Active Credit Info */}
              {stat && stat.creditRemaining > 0 && (() => {
                const activeCredits = sales.filter(s => s.isCredit && !isSalePaid(s) && getRemainingBalance(s) > 0);
                return (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-red-600" />
                        <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">Crédits en cours</span>
                      </div>
                      <span className="text-lg font-black text-red-600">{stat.creditRemaining.toLocaleString()} F</span>
                    </div>
                    <div className="space-y-1.5">
                      {activeCredits.map(s => {
                        const risk = getCreditRisk(s);
                        const remaining = getRemainingBalance(s);
                        return (
                          <div key={s.id} className="flex items-center justify-between bg-white/80 rounded-xl p-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                risk.level === 'danger' ? 'bg-red-500' :
                                risk.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                              }`} />
                              <span className="font-medium text-gray-700">
                                {new Date(s.dateVente).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500">{remaining.toLocaleString()} F</span>
                              {s.dueDate && (
                                <span className={`text-[9px] font-bold ${
                                  risk.level === 'danger' ? 'text-red-600' :
                                  risk.level === 'warning' ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {risk.label}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Paid / No credit indicator */}
              {stat && stat.creditRemaining <= 0 && sales.some(s => s.isCredit) && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl p-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-xs font-medium text-green-700">Tous les crédits sont soldés ✓</span>
                </div>
              )}

              {/* ── Reservations section ── */}
              {data.reservations.filter(r => r.clientId === selectedClient.id && r.statut !== 'cancelled').length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Réservations en cours</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.reservations
                      .filter(r => r.clientId === selectedClient.id && r.statut !== 'cancelled')
                      .sort((a, b) => new Date(a.dateReserve).getTime() - new Date(b.dateReserve).getTime())
                      .map(r => {
                        const isToday = r.dateReserve === new Date().toISOString().split('T')[0];
                        const isPast = new Date(r.dateReserve) < new Date(new Date().toISOString().split('T')[0]);
                        const chickenCount = r.pouletIds.length;
                        return (
                          <div key={r.id} className="flex items-center justify-between bg-white/80 rounded-xl p-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${r.statut === 'confirmed' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                              <div>
                                <div className="font-medium text-gray-700">
                                  {new Date(r.dateReserve).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  {isToday && <span className="ml-1 text-orange-600 font-bold">(Aujourd'hui)</span>}
                                </div>
                                <div className="text-[9px] text-gray-400">
                                  {chickenCount} poulet(s) · {r.statut === 'confirmed' ? 'Confirmée' : 'En attente'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.acompte && (
                                <span className="text-[9px] font-bold text-green-600">{r.acompte.toLocaleString()} F</span>
                              )}
                              {isPast && r.statut === 'pending' && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">En retard</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedClient.notes && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="w-4 h-4 text-yellow-600" />
                    <span className="text-[10px] font-black text-yellow-700 uppercase tracking-wider">Notes</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedClient.notes}</p>
                </div>
              )}

              {/* Purchase History */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-orange-500" />
                  Historique des achats ({sales.length})
                </h4>

                {sales.length === 0 && (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center">
                    <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Aucun achat pour ce client</p>
                  </div>
                )}

                <div className="space-y-2">
                  {sales.map((s, idx) => (
                    <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-xs font-black">
                            #{sales.length - idx}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-800">
                              {new Date(s.dateVente).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </div>
                            <div className="text-[9px] text-gray-400">{s.pouletIds.length} poulet(s)</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-orange-600">{s.total.toLocaleString()} F</div>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                            !s.isCredit ? 'bg-green-100 text-green-600' :
                            isSalePaid(s) ? 'bg-blue-100 text-blue-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {!s.isCredit ? 'Comptant' : isSalePaid(s) ? 'Payé' : `Solde ${getRemainingBalance(s).toLocaleString()}F`}
                          </span>
                        </div>
                      </div>

                      {/* Payment progress for credit sales */}
                      {s.isCredit && s.payments && s.payments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (getTotalPayments(s) / s.total) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-gray-500 font-medium whitespace-nowrap">
                              {getTotalPayments(s).toLocaleString()} / {s.total.toLocaleString()} F
                            </span>
                          </div>
                          {s.payments.slice(-1).map(p => (
                            <div key={p.id} className="text-[8px] text-gray-400 flex items-center gap-1">
                              <DollarSign className="w-2.5 h-2.5 text-green-500" />
                              Dernier versement : {p.montant.toLocaleString()} F
                              {p.methode && ` (${p.methode === 'especes' ? 'Espèces' : p.methode === 'orange_money' ? 'Orange Money' : 'Wave'})`}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Mini invoice button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const chickens = s.pouletIds.map(id => {
                              for (const batch of data.stockBatches) {
                                const ch = batch.poulets.find(p => p.id === id);
                                if (ch) return { numero: ch.numero, poids: ch.poids, prix: ch.prix };
                              }
                              return null;
                            }).filter(Boolean) as { numero: string; poids: number; prix: number }[];
                            await generateInvoice(s, s.clientNom, chickens);
                            addToast('Facture téléchargée !', 'success');
                          } catch (err) {
                            addToast('Erreur lors de la génération de la facture', 'error');
                            console.error(err);
                          }
                        }}
                        className="mt-2 text-[9px] text-orange-500 font-black uppercase tracking-wider flex items-center gap-1 hover:text-orange-700 transition-colors"
                      >
                        <FileDown className="w-3 h-3" /> Télécharger la facture
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedClient(null)}
                className="w-full bg-gray-100 text-gray-500 p-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
              >
                Fermer
              </button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
