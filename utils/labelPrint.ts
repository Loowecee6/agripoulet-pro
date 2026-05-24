import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface LabelChicken {
  numero: string;
  poids: number;
  prix: number;
  batchNom: string;
}

/**
 * Generate and download a printable PDF sheet of QR labels for chickens.
 * Labels are arranged in a grid suitable for A4 sticker sheets.
 */
export async function printChickenLabels(chickens: LabelChicken[]): Promise<void> {
  if (chickens.length === 0) return;

  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Label dimensions (6 per page: 2 columns × 3 rows)
  const labelW = 90;
  const labelH = 60;
  const marginX = (pageWidth - labelW * 2) / 2;
  const marginY = 15;
  const gapX = 0;
  const gapY = 8;

  const CHUNK_SIZE = 6; // 6 labels per A4 page

  for (let chunkIdx = 0; chunkIdx < Math.ceil(chickens.length / CHUNK_SIZE); chunkIdx++) {
    if (chunkIdx > 0) doc.addPage();

    const chunk = chickens.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);

    for (let i = 0; i < chunk.length; i++) {
      const chicken = chunk[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = marginX + col * (labelW + gapX);
      const y = marginY + row * (labelH + gapY);

      // ── Label background ──
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, labelW, labelH, 2, 2, 'FD');

      // ── Header bar ──
      doc.setFillColor(234, 88, 12);
      doc.rect(x, y, labelW, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('AgriPoulet Pro', x + 3, y + 6);

      // ── QR Code ──
      const qrData = JSON.stringify({
        ref: chicken.numero,
        poids: chicken.poids,
        prix: chicken.prix,
      });
      try {
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 120,
          margin: 0,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        const qrSize = 22;
        doc.addImage(qrDataUrl, 'PNG', x + 3, y + 11, qrSize, qrSize);
      } catch {
        // QR failed — draw placeholder
        doc.setDrawColor(200, 200, 200);
        doc.rect(x + 3, y + 11, 22, 22);
        doc.setFontSize(5);
        doc.setTextColor(150, 150, 150);
        doc.text('QR Error', x + 14, y + 22, { align: 'center' });
      }

      // ── Chicken info ──
      const infoX = x + 28;
      const infoY = y + 14;

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(chicken.numero, infoX, infoY);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Poids: ${chicken.poids} kg`, infoX, infoY + 8);
      doc.text(`Prix: ${chicken.prix.toLocaleString('fr-FR')} Frs`, infoX, infoY + 15);

      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Lot: ${chicken.batchNom}`, infoX, infoY + 22);

      // ── Bottom border accent ──
      doc.setFillColor(59, 130, 246);
      doc.rect(x, y + labelH - 2, labelW / 2, 2, 'F');
      doc.setFillColor(234, 88, 12);
      doc.rect(x + labelW / 2, y + labelH - 2, labelW / 2, 2, 'F');

      // ── Cut marks ──
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      // Vertical cut between columns
      if (col === 0) {
        const cutX = x + labelW;
        doc.line(cutX, y + 2, cutX, y + labelH - 2);
      }
      // Horizontal cut between rows
      if (row < 2) {
        const cutY = y + labelH;
        doc.line(x + 2, cutY, x + labelW - 2, cutY);
      }
    }
  }

  doc.save('Etiquettes_AgriPoulet.pdf');
}
