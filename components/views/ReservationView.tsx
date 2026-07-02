// components/views/ReservationView.tsx
// Vue de gestion des réservations clients — bloquer du stock pour une date future

import React, { useState, useMemo } from 'react';
import { useToast } from '../common/ToastContext';
import { Plus, CalendarDays, Clock, CheckCircle2, XCircle, ChevronRight, DollarSign, FileText, Trash2, MessageCircle, User as UserIcon, Filter } from 'lucide-react';
import { formatDateShort, formatDateLong } from '../../utils/dateFormat';
import { AppData, Reservation, ReservationStatut } from '../../types';
import { Modal } from '../common/Modal';

interface ReservationViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  darkMode?: boolean;
}

const STATUS_CONFIG: Record<ReservationStatut, { label: string; bg: string; darkBg: string; border: string; darkBorder: string; text: string; darkText: string; dot: string; darkDot: string }> = {
  pending: { label: 'En attente', bg: 'bg-yellow-50', darkBg: 'dark:bg-yellow-900/20', border: 'border-yellow-200', darkBorder: 'dark:border-yellow-800', text: 'text-gray-900', darkText: 'dark:text-yellow-300', dot: 'bg-yellow-500', darkDot: 'dark:bg-yellow-400' },
  confirmed: { label: 'Confirmée', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', border: 'border-blue-200', darkBorder: 'dark:border-blue-800', text: 'text-gray-900', darkText: 'dark:text-blue-300', dot: 'bg-blue-500', darkDot: 'dark:bg-blue-400' },
  cancelled: { label: 'Annulée', bg: 'bg-gray-50', darkBg: 'dark:bg-gray-800', border: 'border-gray-200', darkBorder: 'dark:border-gray-700', text: 'text-gray-900', darkText: 'dark:text-gray-400', dot: 'bg-gray-400', darkDot: 'dark:bg-gray-500' },
  completed: { label: 'Terminée', bg: 'bg-green-50', darkBg: 'dark:bg-green-900/20', border: 'border-green-200', darkBorder: 'dark:border-green-800', text: 'text-gray-900', darkText: 'dark:text-green-300', dot: 'bg-green-500', darkDot: 'dark:bg-green-400' },
};

export const ReservationView = ({ data, setData, darkMode }: ReservationViewProps) => {
  const { addToast } = useToast();
  const [filter, setFilter] = useState<ReservationStatut | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = [...data.reservations];
    if (filter !== 'all') list = list.filter(r => r.statut === filter);
    list.sort((a, b) => {
      const order = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
      const diff = order[a.statut] - order[b.statut];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [data.reservations, filter]);

  // ── Stats ──
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: data.reservations.length,
      pending: data.reservations.filter(r => r.statut === 'pending').length,
      confirmed: data.reservations.filter(r => r.statut === 'confirmed').length,
      today: data.reservations.filter(r =>
        r.dateReserve === now.toISOString().split('T')[0] &&
        (r.statut === 'pending' || r.statut === 'confirmed')
      ).length,
    };
  }, [data.reservations]);

  // ── Handle Create ──
  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const clientId = f.get('clientId') as string;
    const dateReserve = f.get('dateReserve') as string;
    const acompte = Number(f.get('acompte')) || 0;

    const client = data.clients.find(c => c.id === clientId);

    const newRes: Reservation = {
      id: crypto.randomUUID(),
      clientId: client?.id || '',
      clientNom: client?.nom || (f.get('clientNom') as string) || '',
      pouletIds: [],
      dateReserve,
      statut: 'pending',
      notes: (f.get('notes') as string) || undefined,
      createdAt: new Date().toISOString(),
      acompte: acompte > 0 ? acompte : undefined,
    };

    setData({ ...data, reservations: [newRes, ...data.reservations] });
    setIsAddModalOpen(false);
    addToast(`Réservation créée pour ${client.nom || 'client inconnu'}`, 'success');
  };

  // ── Handle Status Change ──
  const updateStatus = (id: string, statut: ReservationStatut) => {
    const res = data.reservations.find(r => r.id === id);
    if (!res) return;

    // Si annulée ou complétée, libérer les poulets
    const updatedReservations = data.reservations.map(r =>
      r.id === id ? { ...r, statut } : r
    );

    setData({ ...data, reservations: updatedReservations });

    if (statut === 'completed') {
      addToast('Réservation marquée comme terminée ✓', 'success');
    } else if (statut === 'cancelled') {
      addToast('Réservation annulée — stock libéré', 'info');
    } else if (statut === 'confirmed') {
      addToast('Réservation confirmée ✓', 'success');
    }
  };

  // ── Handle Delete ──
  const handleDelete = (id: string) => {
    if (!confirm('Supprimer définitivement cette réservation ?')) return;
    setData({
      ...data,
      reservations: data.reservations.filter(r => r.id !== id),
    });
    if (selectedRes?.id === id) setSelectedRes(null);
    addToast('Réservation supprimée', 'info');
  };

  // ── Helper — get chicken details ──
  const getChickens = (ids: string[]) => {
    const result: { numero: string; poids: number; prix: number }[] = [];
    for (const b of data.stockBatches) {
      for (const p of b.poulets) {
        if (ids.includes(p.id)) result.push({ numero: p.numero, poids: p.poids, prix: p.prix });
      }
    }
    return result;
  };

  const filterTabs: { key: ReservationStatut | 'all'; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'confirmed', label: 'Confirmées' },
    { key: 'completed', label: 'Terminées' },
    { key: 'cancelled', label: 'Annulées' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Réservations</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"
        >
          <Plus />
        </button>
      </div>

      {/* Stats cards */}
      {data.reservations.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-gray-700">
            <div className="text-lg font-black text-gray-800 dark:text-white">{stats.total}</div>
            <div className="text-[7px] text-gray-400 uppercase font-black tracking-wider">Total</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-2xl p-3 text-center border border-yellow-100 dark:border-yellow-800">
            <div className="text-lg font-black text-gray-900 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-[7px] text-gray-500 dark:text-yellow-500 uppercase font-black tracking-wider">En attente</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-2xl p-3 text-center border border-blue-100 dark:border-blue-800">
            <div className="text-lg font-black text-gray-900 dark:text-blue-400">{stats.confirmed}</div>
            <div className="text-[7px] text-gray-500 dark:text-blue-500 uppercase font-black tracking-wider">Confirmées</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/30 rounded-2xl p-3 text-center border border-orange-100 dark:border-orange-800">
            <div className="text-lg font-black text-gray-900 dark:text-orange-400">{stats.today}</div>
            <div className="text-[7px] text-gray-500 dark:text-orange-500 uppercase font-black tracking-wider">Aujourd'hui</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex gap-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                filter === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(r => {
          const cfg = STATUS_CONFIG[r.statut];
          const chickens = getChickens(r.pouletIds);
          const isToday = r.dateReserve === new Date().toISOString().split('T')[0];
          const isPast = new Date(r.dateReserve) < new Date(new Date().toISOString().split('T')[0]);
          return (
            <div
              key={r.id}
              onClick={() => setSelectedRes(r)}
              className={`bg-white dark:bg-gray-800 rounded-3xl border p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-transform ${cfg.bg} ${cfg.darkBg} ${cfg.border} ${cfg.darkBorder} ${
                isPast && (r.statut === 'pending') ? 'border-red-200 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-800' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${cfg.dot} ${cfg.darkDot}/20`}>
                  <CalendarDays className={`w-5 h-5 ${cfg.text} ${cfg.darkText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-white truncate">{r.clientNom}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${cfg.bg} ${cfg.darkBg} ${cfg.text} ${cfg.darkText}`}>
                      {cfg.label}
                    </span>
                    {isToday && r.statut !== 'completed' && r.statut !== 'cancelled' && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-orange-100 text-orange-600 animate-pulse">
                        Aujourd'hui
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {r.dateReserve ? formatDateShort(r.dateReserve) : '—'}</span>
                    <span>•</span>
                    <span>{chickens.length} poulet(s)</span>
                    {r.acompte && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 dark:text-green-400 font-bold">{r.acompte.toLocaleString()} F d'acompte</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
            {filter === 'all' ? 'Aucune réservation' : 'Aucune réservation dans ce statut'}
          </div>
        )}
      </div>

      {/* ── Create Reservation Modal ── */}
      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); }} title="Nouvelle Réservation">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Client (optionnel)</label>
            <select name="clientId" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none text-sm appearance-none dark:border-gray-600 dark:text-white">
              <option value="">Sélectionner un client</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <input
              name="clientNom"
              type="text"
              placeholder="Ou saisir un nom libre"
              className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none text-sm dark:border-gray-600 dark:text-white mt-2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Date de retrait (optionnel)</label>
            <input
              name="dateReserve"
              type="date"
              className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none dark:border-gray-600 dark:text-white"
            />
          </div>



          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Acompte (optionnel)</label>
            <input
              name="acompte"
              type="number"
              min="0"
              placeholder="Ex: 2000"
              className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none dark:border-gray-600 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Notes (optionnel)</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Ex: Pour une fête, retrait le matin..."
              className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none resize-none dark:border-gray-600 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-100 active:scale-95 transition-transform"
          >
            Créer la réservation
          </button>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal isOpen={!!selectedRes} onClose={() => setSelectedRes(null)} title="Détails Réservation">
        {selectedRes && (() => {
          const cfg = STATUS_CONFIG[selectedRes.statut];
          const chickens = getChickens(selectedRes.pouletIds);
          const totalPrix = chickens.reduce((s, c) => s + c.prix, 0);

          return (
            <div className="space-y-5">
              {/* Status header */}
              <div className={`rounded-3xl p-5 border ${cfg.bg} ${cfg.darkBg} ${cfg.border} ${cfg.darkBorder}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">{selectedRes.clientNom}</h3>
                    <div className="text-xs text-gray-500 mt-0.5">Créé le {formatDateShort(selectedRes.createdAt)}</div>
                  </div>
                  <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase ${cfg.bg} ${cfg.darkBg} ${cfg.text} ${cfg.darkText}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span className="font-bold uppercase">Retrait prévu</span>
                    </div>
                    <div className="text-sm font-black">{selectedRes.dateReserve ? formatDateLong(selectedRes.dateReserve) : 'Non définie'}</div>
                  </div>
                  <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="font-bold uppercase">Total estimé</span>
                    </div>
                    <div className="text-sm font-black">{totalPrix.toLocaleString()} F</div>
                    {selectedRes.acompte && (
                      <div className="text-[9px] text-green-600 dark:text-green-400 mt-0.5">Acompte : {selectedRes.acompte.toLocaleString()} F</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chickens list */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-orange-500" />
                  Poulets réservés ({chickens.length})
                </h4>
                <div className="space-y-1.5">
                  {chickens.map(c => (
                    <div key={c.numero} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-xs">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300">{c.numero}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500">{c.poids} kg</span>
                        <span className="font-bold text-orange-600">{c.prix} F</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedRes.notes && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-800 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-yellow-600" />
                    <span className="text-[9px] font-black text-gray-900 dark:text-yellow-700 uppercase">Notes</span>
                  </div>
                  <p className="text-xs text-gray-900 dark:text-gray-300 whitespace-pre-wrap">{selectedRes.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  {selectedRes.statut === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(selectedRes.id, 'confirmed')}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Confirmer
                      </button>
                      <button
                        onClick={() => updateStatus(selectedRes.id, 'cancelled')}
                        className="flex items-center justify-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
                      >
                        <XCircle className="w-4 h-4" /> Annuler
                      </button>
                    </>
                  )}
                  {selectedRes.statut === 'confirmed' && (
                    <>
                      <button
                        onClick={() => updateStatus(selectedRes.id, 'completed')}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform col-span-2"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Marquer comme terminée
                      </button>
                    </>
                  )}
                  {selectedRes.statut === 'completed' && (
                    <button
                      onClick={() => updateStatus(selectedRes.id, 'confirmed')}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform col-span-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Réactiver
                    </button>
                  )}
                </div>

                {/* WhatsApp link */}
                {(() => {
                  const client = data.clients.find(c => c.id === selectedRes.clientId);
                  if (!client?.tel) return null;
                  const digits = client.tel.replace(/\D/g, '');
                  const international = digits.startsWith('225') ? digits : `225${digits.replace(/^0+/, '')}`;
                  const dateLabel = selectedRes.dateReserve ? `pour le ${formatDateShort(selectedRes.dateReserve)}` : 'à venir';
                  const msg = `Bonjour ${selectedRes.clientNom} 👋\n\nJe vous rappelle que votre réservation de ${chickens.length} poulet(s) est prévue ${dateLabel}.\n\nMerci de confirmer votre venue. 🙏`;
                  return (
                    <a
                      href={`https://wa.me/${international}?text=${encodeURIComponent(msg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-green-500 text-white p-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                    >
                      <MessageCircle className="w-4 h-4" /> Rappel WhatsApp
                    </a>
                  );
                })()}

                <button
                  onClick={() => handleDelete(selectedRes.id)}
                  className="flex items-center justify-center gap-2 text-red-500 p-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer la réservation
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
