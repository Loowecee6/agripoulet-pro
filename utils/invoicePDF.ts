import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Sale } from '../types';
import { formatDateInvoice, formatDateInvoiceShort } from './dateFormat';
import { formatCurrency, formatNumber } from './currency';

// Compagny info
const COMPANY = {
  name: 'Agripoulet Pro',
  tagline: 'Élevage de poulets de qualité',
  tel: '+225 XX XX XX XX',
  email: 'contact@agripoulet-pro.com',
  adresse: 'Abidjan, Côte d\'Ivoire',
};

// Inline SVG logo as data URL (converted to PNG via canvas)
function getLogoDataURL(): Promise<string> {
  return new Promise((resolve) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="24" fill="#ea580c"/>
      <g transform="translate(12, 10)">
        <ellipse cx="48" cy="62" rx="26" ry="22" fill="white"/>
        <circle cx="72" cy="40" r="14" fill="white"/>
        <circle cx="76" cy="38" r="2.5" fill="#ea580c"/>
        <polygon points="85,40 96,37 85,34" fill="#f59e0b"/>
        <path d="M72 26 Q68 18 62 22 Q66 16 72 14 Q78 16 82 22 Q76 18 72 26Z" fill="#dc2626"/>
        <path d="M72 54 Q74 60 70 62 Q66 60 68 54Z" fill="#dc2626"/>
        <path d="M40 52 Q52 44 60 56 Q56 66 40 62Z" fill="#fed7aa"/>
        <path d="M22 52 Q14 38 18 30 Q22 36 26 44Z" fill="white" opacity="0.8"/>
        <path d="M18 56 Q6 46 8 34 Q14 42 22 50Z" fill="white" opacity="0.6"/>
        <line x1="42" y1="82" x2="40" y2="98" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="54" y1="82" x2="56" y2="98" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>`;
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 120, 120);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(''); // fallback empty
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });
}

// Format currency
const fmt = (n: number) => formatCurrency(n);

// Format date
const fmtDate = (d: string) =>
  formatDateInvoice(d);

// Format short date
const fmtDateShort = (d: string) =>
  formatDateInvoiceShort(d);

// Get payment method label
const methodLabel = (m?: string) => {
  switch (m) {
    case 'especes': return '💵 Espèces';
    case 'orange_money': return '📱 Orange Money';
    case 'wave': return '📱 Wave';
    default: return '—';
  }
};

// Generate invoice number
function invoiceNumber(sale: Sale, index: number): string {
  const date = new Date(sale.dateVente);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `FACT-${year}${month}-${String(index + 1).padStart(4, '0')}`;
}

export interface InvoiceOptions {
  /** Index used for invoice numbering; defaults to 0 */
  index?: number;
  /** Callback for progress (if needed) */
  onProgress?: (msg: string) => void;
}

/**
 * Generate a professional PDF invoice for a given sale and download it.
 */
export async function generateInvoice(
  sale: Sale,
  clientName: string,
  chickens: { numero: string; poids: number; prix: number }[],
  options: InvoiceOptions = {}
): Promise<void> {
  const { index = 0 } = options;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const orange = '#ea580c';
  const gray = '#64748b';
  const dark = '#1e293b';

  // -- Helper: page header with orange bar --
  let currentY = margin;

  // Draw a colored header background
  doc.setFillColor(234, 88, 12); // orange-600
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Logo (white) + company name in header
  const logo = await getLogoDataURL();
  if (logo) {
    doc.addImage(logo, 'PNG', margin + 2, 4, 32, 32);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, margin + 42, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.tagline, margin + 42, 26);

  doc.setFontSize(8);
  doc.text(COMPANY.adresse, margin + 42, 33);

  currentY = 50;

  // -- Invoice title & number --
  const invNum = invoiceNumber(sale, index);

  doc.setTextColor(dark);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', margin, currentY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(gray);
  doc.text(`N° ${invNum}`, margin, currentY + 8);

  // Date on the right
  doc.setFontSize(9);
  doc.text(`Date: ${fmtDate(sale.dateVente)}`, pageWidth - margin, currentY + 4, { align: 'right' });

  currentY += 20;

  // -- Client section --
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240); // border
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, 'S');

  doc.setTextColor(orange);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT', margin + 5, currentY + 7);

  doc.setTextColor(dark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(clientName, margin + 5, currentY + 17);

  currentY += 32;

  // -- Articles table (chickens) --
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(gray);
  doc.text('ARTICLES', margin, currentY);

  currentY += 5;

  const tableHead = [['N° / Réf.', 'Poids', 'Prix']];
  const tableBody = chickens.map((c) => [
    c.numero,
    `${c.poids} kg`,
    `${c.prix} Frs`,
  ]);

  // Total row
  tableBody.push(['', '', '']); // spacer
  tableBody.push([
    { content: 'TOTAL', colSpan: 1, styles: { fontStyle: 'bold', fontSize: 10, textColor: dark } } as any,
    '',      { content: `${formatCurrency(sale.total)}`,
          styles: { fontStyle: 'bold', fontSize: 11, textColor: orange, halign: 'right' } } as any,
  ]);

  autoTable(doc, {
    head: tableHead,
    body: tableBody as any,
    startY: currentY,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [234, 88, 12],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: dark,
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 50, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.5,
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // -- Payment status box --
  const isPaid = sale.isPaid;
  const totalPayments = (sale.payments || []).reduce((s, p) => s + p.montant, 0);
  const remaining = Math.max(0, sale.total - totalPayments);

  doc.setDrawColor(isPaid ? 22 : 239, isPaid ? 163 : 68, isPaid ? 74 : 68); // green or red border
  doc.setFillColor(isPaid ? 240 : 254, isPaid ? 253 : 242, isPaid ? 244 : 242); // light bg
  doc.roundedRect(margin, currentY, contentWidth, isPaid ? 18 : 22, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isPaid ? 22 : 220, isPaid ? 163 : 38, isPaid ? 74 : 38);
  doc.text(isPaid
    ? `✓ PAYÉ${sale.isCredit ? ' — Intégralement remboursé' : ' COMPTANT'}`
    : `✗ ${sale.isCredit ? 'À CRÉDIT — Solde restant: ' + formatCurrency(remaining) : 'NON PAYÉ'}`,
    margin + 5, currentY + (isPaid ? 12 : 8));

  if (!isPaid && sale.isCredit && sale.dueDate) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Échéance: ${fmtDate(sale.dueDate)}`, margin + 5, currentY + 17);
  }

  currentY += (isPaid ? 28 : 32);

  // -- Payment history (if credit) --
  const payments = sale.payments || [];
  if (sale.isCredit && payments.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(gray);
    doc.text('HISTORIQUE DES PAIEMENTS', margin, currentY);
    currentY += 5;

    const payHead = [['Date', 'Montant', 'Mode', 'Note']];
    const payBody = payments.map((p) => [
      fmtDateShort(p.date),
      `${formatCurrency(p.montant)}`,
      methodLabel(p.methode),
      p.note || '—',
    ]);

    // Total paid row
    payBody.push(['', '', '', '']);
    payBody.push([
      { content: 'Total versé', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9 } } as any,
      '',
      { content: `${formatCurrency(totalPayments)}`,
        styles: { fontStyle: 'bold', fontSize: 10, halign: 'right', textColor: [22, 163, 74] } } as any,
    ]);

    autoTable(doc, {
      head: payHead,
      body: payBody as any,
      startY: currentY,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [59, 130, 246], // blue-500
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 8, textColor: dark },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35, halign: 'right' },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 50 },
      },
      theme: 'plain',
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.5,
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // -- QR Code --
  const qrData = [
    `FACTURE: ${invoiceNumber(sale, index)}`,
    `Client: ${clientName}`,
    `Date: ${fmtDate(sale.dateVente)}`,
    `Montant: ${formatCurrency(sale.total)}`,
    `Statut: ${isPaid ? 'Payé' : sale.isCredit ? `Solde: ${formatCurrency(remaining)}` : 'Non payé'}`,
  ].join(' | ');

  try {
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    const qrSize = 24;
    const qrX = pageWidth - margin - qrSize;
    const qrY = currentY;

    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // QR label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(gray);
    doc.text('Scanner pour vérifier', qrX, qrY - 1, { align: 'center' });

    currentY = Math.max(currentY + qrSize + 5, currentY + 20);
  } catch {
    // QR code generation failed — skip silently
    currentY += 5;
  }

  // -- Footer --
  const footerY = 275; // near page bottom
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(gray);
  doc.text('Merci de votre confiance !', pageWidth / 2, footerY + 6, { align: 'center' });

  doc.setFontSize(7);
  doc.text(`${COMPANY.name} · ${COMPANY.tel} · ${COMPANY.email} · ${COMPANY.adresse}`, pageWidth / 2, footerY + 13, { align: 'center' });

  // -- Save --
  doc.save(`Facture_${clientName.replace(/\s+/g, '_')}_${invoiceNumber(sale, index)}.pdf`);
}
