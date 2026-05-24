import React, { useState, useMemo } from 'react';
import { KeyRound, TrendingUp, Download, FileSpreadsheet } from 'lucide-react';
import { AppData, User } from '../../types';
import { Modal } from '../common/Modal';
import { DataMigration } from '../common/DataMigration';
import { BackupManager } from '../common/BackupManager';
import { exportBatchExpenses, exportBatchSummary } from '../../utils/exportXLS';

interface RapportViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  user: User;
  permissions: string[];
}

export const RapportView = ({ data, setData, user, permissions }: RapportViewProps) => {
  const can = (perm: string) => permissions.includes(perm);
  const [previewBatch, setPreviewBatch] = useState<any>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  const batchSummaries = useMemo(() => {
    return data.stockBatches.map(sb => {
      const prod = data.productionBatches.find(p => p.id === sb.productionBatchId);
      const sales = data.sales.filter(s => s.pouletIds.some(pid => sb.poulets.some(sp => sp.id === pid)));
      const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
      
      const totalDepenses = prod ? prod.depenses.reduce((a, d) => a + d.montant, 0) : 0;
      const coutPoussins = prod ? (prod.nbPoussinsInitial * prod.prixAchatPoussin) : (sb.coutInitial || 0);
      const totalCost = totalDepenses + coutPoussins;

      const profit = totalRevenue - totalCost;
      const isFinished = sb.poulets.length > 0 && sb.poulets.every(p => p.vendu);
      
      const mortality = prod ? prod.suiviQuotidien.reduce((a, r) => a + r.mort, 0) : 0;
      const initialCount = prod ? prod.nbPoussinsInitial : sb.poulets.length;
      const soldCount = sb.poulets.filter(p => p.vendu).length;
      const avgWeight = prod && prod.suiviQuotidien.length > 0
        ? prod.suiviQuotidien[prod.suiviQuotidien.length - 1].poidsReel / 1000
        : 0;
      const costPerKg = soldCount > 0 ? Math.round(totalCost / (soldCount * avgWeight)) : 0;
      
      return { sb, prod, totalRevenue, totalCost, totalDepenses, coutPoussins, profit, isFinished, mortality, initialCount, sales, soldCount, avgWeight, costPerKg };
    });
  }, [data]);

  const handleFinalize = (batchId: string) => {
    if (confirm("Clôturer définitivement ce bilan ?")) {
        setData({
            ...data,
            stockBatches: data.stockBatches.map(b => b.id === batchId ? { ...b, isFinalized: true } : b)
        });
        setPreviewBatch(null);
    }
  };

  const handleUpdatePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newP = f.get('newPass') as string;
    if (newP.length < 4) return alert("Le code doit faire au moins 4 chiffres");
    setData({
      ...data,
      settings: { ...data.settings, adminPasswordHash: newP }
    });
    setIsChangingPass(false);
    alert("Code secret administrateur mis à jour !");
  };

  return (
    <div className="space-y-6 pb-20">
      <DataMigration />
      <BackupManager currentData={data} onDataRestored={setData} />

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Bilans Financiers</h2>
        {can('settings.edit') && (
          <button 
            onClick={() => setIsChangingPass(true)} 
            className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-orange-100 hover:text-orange-600 transition-colors"
            title="Changer code secret"
          >
            <KeyRound className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {batchSummaries.map((sum, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-black text-lg text-gray-800">{sum.sb.nom}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${sum.sb.typeOrigine === 'PR' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {sum.sb.typeOrigine === 'PR' ? 'PRODUCTION' : 'IMPORTATION'}
                      </span>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {sum.prod ? 'Interne' : 'Externe'}
                      </p>
                    </div>
                </div>
                <div className={`text-[10px] font-black px-3 py-1 rounded-full ${sum.sb.isFinalized ? 'bg-gray-100 text-gray-400' : 'bg-orange-100 text-orange-600'}`}>
                    {sum.sb.isFinalized ? 'CLÔTURÉ' : 'ACTIF'}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Investi</div>
                    <div className="text-lg font-black text-gray-700">{sum.totalCost} F</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100">
                    <div className="text-[10px] text-orange-400 font-bold uppercase mb-1">Recettes</div>
                    <div className="text-lg font-black text-orange-700">{sum.totalRevenue} F</div>
                </div>
            </div>
            
            <div className={`p-5 rounded-3xl flex justify-between items-center ${sum.profit >= 0 ? 'bg-green-600' : 'bg-red-600'} text-white shadow-lg`}>
                <div className="text-2xl font-black">{sum.profit} Frs</div>
                <TrendingUp className="opacity-30" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPreviewBatch(sum)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold text-[10px] uppercase">Détails</button>
              {sum.isFinished && !sum.sb.isFinalized && can('stock.finalize') && (
                <button onClick={() => handleFinalize(sum.sb.id)} className="flex-1 py-3 bg-gray-900 text-white rounded-2xl font-bold text-[10px] uppercase">Clôturer</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!previewBatch} onClose={() => setPreviewBatch(null)} title="Détails du Bilan">
        {previewBatch && (
          <div className="space-y-6">
            {/* Résumé production */}
            <div className="bg-gray-50 p-6 rounded-3xl space-y-3">
              <div className="flex justify-between text-xs"><span>Origine :</span><span className="font-bold">{previewBatch.sb.typeOrigine === 'PR' ? 'Production Interne' : 'Importation'}</span></div>
              <div className="flex justify-between text-xs"><span>Quantité initiale :</span><span className="font-bold">{previewBatch.initialCount} poulets</span></div>
              <div className="flex justify-between text-xs"><span>Pertes (Mortalité) :</span><span className="font-bold text-red-500">{previewBatch.mortality} poulets</span></div>
              <div className="flex justify-between text-xs"><span>Total vendus :</span><span className="font-bold text-green-600">{previewBatch.soldCount} poulets</span></div>
              {previewBatch.avgWeight > 0 && (
                <div className="flex justify-between text-xs"><span>Poids moyen :</span><span className="font-bold">{previewBatch.avgWeight.toFixed(2)} kg</span></div>
              )}
            </div>

            {/* Détail financier */}
            <div className="bg-white border rounded-3xl p-6 space-y-3">
              <h4 className="text-[10px] font-black uppercase text-gray-400">Compte de résultat</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Achat poussins ({previewBatch.initialCount})</span>
                  <span className="font-bold">{previewBatch.coutPoussins} Frs</span>
                </div>
                {previewBatch.prod?.depenses?.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dépenses ({previewBatch.prod.depenses.length})</span>
                      <span className="font-bold">{previewBatch.totalDepenses} Frs</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 px-2">
                      <span>Détail :</span>
                    </div>
                    {previewBatch.prod.depenses.map((d: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs text-gray-500 px-4">
                        <span>{d.libelle}</span>
                        <span>{d.montant} Frs</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="h-px bg-gray-200 my-2" />
                <div className="flex justify-between font-bold text-gray-700">
                  <span>TOTAL INVESTI</span>
                  <span>{previewBatch.totalCost} Frs</span>
                </div>
                <div className="flex justify-between font-bold text-orange-600">
                  <span>TOTAL RECETTES</span>
                  <span>{previewBatch.totalRevenue} Frs</span>
                </div>
                {previewBatch.costPerKg > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Coût par kg</span>
                    <span>{previewBatch.costPerKg} Frs/kg</span>
                  </div>
                )}
                <div className="h-px bg-gray-200 my-2" />
                <div className={`flex justify-between font-black text-lg ${previewBatch.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>RÉSULTAT</span>
                  <span>{previewBatch.profit >= 0 ? `+${previewBatch.profit} Frs` : `${previewBatch.profit} Frs`}</span>
                </div>
              </div>
            </div>

            {/* Export buttons */}
            {previewBatch.prod && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportBatchExpenses(
                    previewBatch.sb.nom,
                    previewBatch.prod.depenses,
                    previewBatch.prod.prixAchatPoussin,
                    previewBatch.prod.nbPoussinsInitial
                  )}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-2xl font-bold text-xs uppercase hover:bg-green-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Exporter Dépenses
                </button>
                <button
                  onClick={() => exportBatchSummary(previewBatch.sb.nom, {
                    totalInvested: previewBatch.totalCost,
                    totalRevenue: previewBatch.totalRevenue,
                    profit: previewBatch.profit,
                    initialCount: previewBatch.initialCount,
                    mortality: previewBatch.mortality,
                    soldCount: previewBatch.soldCount,
                    avgWeight: previewBatch.avgWeight,
                    costPerKg: previewBatch.costPerKg,
                  })}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-2xl font-bold text-xs uppercase hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Exporter Bilan
                </button>
              </div>
            )}

            {/* Notes de production */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-gray-400">Notes de production</h4>
              <div className="bg-white border rounded-2xl p-4 text-xs italic text-gray-600 space-y-2 max-h-40 overflow-y-auto">
                {previewBatch.prod?.suiviQuotidien.filter((r:any) => r.note).map((r:any, idx:number) => (
                  <div key={idx} className="border-b pb-2 last:border-0">• {r.note}</div>
                )) || <div className="text-gray-300">Aucune note pour cette bande</div>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isChangingPass} onClose={() => setIsChangingPass(false)} title="Sécurité Admin">
        <form onSubmit={handleUpdatePassword} className="space-y-4 p-2">
          <p className="text-xs text-gray-500">Ce code sera demandé à chaque connexion Administrateur sur tous les appareils.</p>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nouveau Code Secret</label>
            <input 
              name="newPass" 
              type="password" 
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Ex: 5678" 
              required 
              className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-center text-2xl font-black tracking-[1em]" 
            />
          </div>
          <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">Mettre à jour le code</button>
        </form>
      </Modal>
    </div>
  );
};
