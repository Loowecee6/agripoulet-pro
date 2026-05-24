// Export data to XLS (CSV format compatible with Excel)
import { formatCurrency } from './currency';

export function exportToXLS(filename: string, headers: string[], rows: (string | number)[][]) {
  // BOM for Excel UTF-8
  const BOM = '\uFEFF';
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBatchExpenses(batchName: string, expenses: { libelle: string; montant: number; date: string }[], poussinCost: number, poussinCount: number) {
  const headers = ['Date', 'Libellé', 'Montant (Frs)'];
  const rows = expenses.map(e => [e.date, e.libelle, e.montant]);

  // Add summary
  const totalDepenses = expenses.reduce((a, e) => a + e.montant, 0);
  const totalPoussins = poussinCount * poussinCost;
  const totalGeneral = totalDepenses + totalPoussins;

  rows.push([]);
  rows.push(['', 'Investissement Poussins', totalPoussins]);
  rows.push([]);
  rows.push(['', 'TOTAL DÉPENSES', totalDepenses]);
  rows.push(['', 'TOTAL GÉNÉRAL', totalGeneral]);

  exportToXLS(`Depenses_${batchName}`, headers, rows);
}

export function exportClients(clients: { id: string; nom: string; tel: string; adresse: string }[], sales: { clientId: string; total: number; isCredit: boolean; isPaid: boolean; dueDate?: string }[]) {
  const headers = ['Nom', 'Téléphone', 'Adresse', 'Total achats', 'Crédit en cours', 'Solde restant', 'Statut crédit'];
  const rows = clients.map(c => {
    const clientSales = sales.filter(s => s.clientId === c.id);
    const totalAchats = clientSales.reduce((s, v) => s + v.total, 0);
    const creditSales = clientSales.filter(s => s.isCredit);
    const creditTotal = creditSales.reduce((s, v) => s + v.total, 0);
    const remaining = creditSales.reduce((s, v) => s + (v.total - (v.isPaid ? v.total : 0)), 0);
    const status = creditSales.length === 0 ? 'Comptant' : remaining <= 0 ? 'Soldé' : 'Impayé';
    return [c.nom, c.tel || '', c.adresse || '', totalAchats, creditTotal, remaining, status];
  });

  exportToXLS('Clients', headers, rows);
}

export function exportBatchSummary(batchName: string, summary: {
  totalInvested: number;
  totalRevenue: number;
  profit: number;
  initialCount: number;
  mortality: number;
  soldCount: number;
  avgWeight: number;
  costPerKg: number;
}) {
  const headers = ['Indicateur', 'Valeur'];
  const rows = [
    ['Bande', batchName],
    ['Poussins initiaux', summary.initialCount],
    ['Mortalité', summary.mortality],
    ['Poulets vendus', summary.soldCount],
    ['Poids moyen (kg)', summary.avgWeight.toFixed(2)],
    ['', ''],
    ['Total investi (Frs)', summary.totalInvested],
    ['Total recettes (Frs)', summary.totalRevenue],
    ['Coût par kg (Frs)', formatCurrency(summary.costPerKg)],
    ['', ''],
    ['RÉSULTAT', summary.profit >= 0 ? `BÉNÉFICE: ${formatCurrency(summary.profit)}` : `PERTE: ${formatCurrency(Math.abs(summary.profit))}`],
  ];

  exportToXLS(`Bilan_${batchName}`, headers, rows);
}
