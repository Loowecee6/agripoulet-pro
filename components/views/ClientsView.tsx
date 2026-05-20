import React, { useState } from 'react';
import { Plus, User as UserIcon, Edit2, Trash2 } from 'lucide-react';
import { AppData, Client } from '../../types';
import { Modal } from '../common/Modal';
import { SearchBar } from '../common/SearchBar';

interface ClientsViewProps {
  data: AppData;
  setData: (d: AppData) => void;
}

export const ClientsView = ({ data, setData }: ClientsViewProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');

  const filtered = data.clients.filter(c => c.nom.toLowerCase().includes(search.toLowerCase()) || c.tel.includes(search));

  const handleAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newClient: Client = {
      id: crypto.randomUUID(),
      nom: f.get('nom') as string,
      adresse: f.get('adresse') as string || '',
      tel: f.get('tel') as string || ''
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
      tel: f.get('tel') as string || ''
    };
    setData({ 
      ...data, 
      clients: data.clients.map(c => c.id === editingClient.id ? updatedClient : c),
      sales: data.sales.map(s => s.clientId === editingClient.id ? { ...s, clientNom: updatedClient.nom } : s)
    });
    setEditingClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Base Clients</h2>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher par nom ou mobile..." />

      <div className="grid gap-4">
        {filtered.map(c => (
          <div key={c.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center shadow-inner"><UserIcon className="w-6 h-6" /></div>
               <div>
                 <div className="font-bold text-gray-800">{c.nom}</div>
                 <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{c.tel || 'Aucun tel.'}</div>
                 <div className="text-[10px] text-gray-400 italic mt-0.5">{c.adresse || 'Sans adresse'}</div>
               </div>
             </div>
             <div className="flex items-center gap-1">
               <button onClick={() => setEditingClient(c)} className="p-3 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-5 h-5" /></button>
               <button onClick={() => {
                 if(confirm(`Supprimer le client "${c.nom}" ?`)) setData({ ...data, clients: data.clients.filter(cl => cl.id !== c.id) });
               }} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
             </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Aucun client trouvé</p>}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouveau Client">
        <form onSubmit={handleAddClient} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nom Complet *</label>
            <input name="nom" required placeholder="Ex: Jean Dupont" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">N° Téléphone</label>
            <input name="tel" placeholder="Ex: 06 00 00 00 00" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Adresse de livraison</label>
            <input name="adresse" placeholder="Quartier, Ville..." className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <button type="submit" className="w-full bg-orange-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-100 mt-4 active:scale-95 transition-transform">Enregistrer le client</button>
        </form>
      </Modal>

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
            <button type="submit" className="w-full bg-gray-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl mt-4 active:scale-95 transition-transform">Mettre à jour la fiche</button>
          </form>
        )}
      </Modal>
    </div>
  );
};
