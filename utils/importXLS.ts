import type { Expense } from '../types';

const COLONNES_LIBELLE = /libellé|libelle|designation|désignation|description|nom|intitulé|intitule|article/i;
const COLONNES_MONTANT = /montant|prix|coût|cout|total|frais|f cfa|frs|somme|valeur/i;
const COLONNES_DATE = /date|jour|quand|échéance|echeance|dat/i;

function detecterColonnes(entetes: string[]): { libelle: number; montant: number; date: number } {
  let libelleIdx = -1;
  let montantIdx = -1;
  let dateIdx = -1;

  entetes.forEach((h, i) => {
    const hc = h.trim().toLowerCase();
    if (COLONNES_LIBELLE.test(hc)) libelleIdx = i;
    if (COLONNES_MONTANT.test(hc)) montantIdx = i;
    if (COLONNES_DATE.test(hc)) dateIdx = i;
  });

  if (libelleIdx === -1 && montantIdx === -1) {
    libelleIdx = 0;
    montantIdx = 1;
    dateIdx = entetes.length > 2 ? 2 : -1;
  }

  return { libelle: libelleIdx, montant: montantIdx, date: dateIdx };
}

function nettoyerMontant(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return 0;
  return parseFloat(val.replace(/[^\d,.\-]/g, '').replace(',', '.')) || 0;
}

function formaterDate(val: unknown): string {
  if (typeof val === 'string') {
    const match = val.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match) {
      const d = String(match[3]).padStart(2, '0');
      const m = String(match[2]).padStart(2, '0');
      return `${match[1]}-${m}-${d}`;
    }
    const match2 = val.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (match2) {
      const d = String(match2[1]).padStart(2, '0');
      const m = String(match2[2]).padStart(2, '0');
      return `${match2[3]}-${m}-${d}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

function detecterEntete(ligne: unknown[]): boolean {
  const cell0 = String(ligne[0] || '').trim().toLowerCase();
  return COLONNES_LIBELLE.test(cell0) || COLONNES_MONTANT.test(cell0) || COLONNES_DATE.test(cell0);
}

export async function parseXLSXFile(file: File): Promise<Expense[]> {
  const XLSX = await import('xlsx');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (json.length < 2) {
          reject(new Error('Le fichier doit contenir au moins 2 lignes (en-tête + données).'));
          return;
        }

        const premiereLigne = json[0] as unknown[];
        let startRow = 0;
        let colonnes: { libelle: number; montant: number; date: number };

        if (detecterEntete(premiereLigne)) {
          colonnes = detecterColonnes(premiereLigne as string[]);
          startRow = 1;
        } else {
          colonnes = { libelle: 0, montant: 1, date: json[0].length > 2 ? 2 : -1 };
        }

        const expenses: Expense[] = [];

        for (let i = startRow; i < json.length; i++) {
          const row = json[i] as unknown[];
          const libelle = String(row[colonnes.libelle] || '').trim();
          const montant = nettoyerMontant(row[colonnes.montant]);

          if (!libelle || montant <= 0) continue;

          expenses.push({
            id: crypto.randomUUID(),
            libelle,
            montant,
            date: colonnes.date >= 0 ? formaterDate(row[colonnes.date]) : new Date().toISOString().split('T')[0],
          });
        }

        resolve(expenses);
      } catch (err) {
        reject(new Error('Erreur lors de la lecture du fichier XLSX. Vérifiez le format.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.readAsArrayBuffer(file);
  });
}
