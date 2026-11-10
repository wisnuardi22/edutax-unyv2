import QRCode from 'qrcode';

export interface BillingPdfParams {
  kodeBilling: string;
  kapKjs: string;
  masaPajak: string;
  nominal: number;
  createdAt: string;
  expiresAt: string;
  taxpayerTin?: string;
  taxpayerName?: string;
  taxpayerAddress?: string;
  uraian?: string;
}

const UNY_LOGO_BASE64 = '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';

export function terbilang(n: number): string {
  const words = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  if (n < 12) return words[n];
  if (n < 20) return (terbilang(n - 10) + ' Belas').trim();
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10)).trim();
  if (n < 200) return ('Seratus ' + terbilang(n - 100)).trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100)).trim();
  if (n < 2000) return ('Seribu ' + terbilang(n - 1000)).trim();
  if (n < 1000000) return (terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000)).trim();
  if (n < 1000000000) return (terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000)).trim();
  if (n < 1000000000000) return (terbilang(Math.floor(n / 1000000000)) + ' Miliar ' + terbilang(n % 1000000000)).trim();
  return (terbilang(Math.floor(n / 1000000000000)) + ' Triliun ' + terbilang(n % 1000000000000)).trim();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Buffer.from(base64, 'base64');
}

function buildPdf(objects: (string | Uint8Array)[]): Uint8Array {
  const enc = new TextEncoder();
  const header = enc.encode('%PDF-1.4\n');
  const chunks: Uint8Array[] = [header];
  const offsets: number[] = [];
  let curOffset = header.length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(curOffset);
    const startObj = enc.encode((i + 1) + ' 0 obj\n');
    const endObj = enc.encode('\nendobj\n');
    const content = typeof objects[i] === 'string' ? enc.encode(objects[i] as string) : (objects[i] as Uint8Array);

    chunks.push(startObj, content, endObj);
    curOffset += startObj.length + content.length + endObj.length;
  }

  const startxref = curOffset;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (const off of offsets) {
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + startxref + '\n%%EOF';
  chunks.push(enc.encode(xref + trailer));

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  return merged;
}

export function generateBillingPdf(params: BillingPdfParams): Uint8Array {
  const {
    kodeBilling = '1234567890123456',
    kapKjs = '411121-100',
    masaPajak = '09092024',
    nominal = 0,
    expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    taxpayerTin = '0012345678910000',
    taxpayerName = 'PT KARYA MANDIRI SEJAHTERA',
    taxpayerAddress = 'Jl. Sudirman Kav. 25, Jakarta Pusat',
    uraian,
  } = params;

  const nominalFormatted = nominal.toLocaleString('id-ID') + ',00';
  const terbilangText = terbilang(nominal) + ' Rupiah';
  const expiresFormatted = formatDate(expiresAt);
  const uraianText = uraian || ('Pembayaran PPh Pasal 21 Masa ' + masaPajak);

  let s = '';
  const strokeColor = (r: number, g: number, b: number) => r + ' ' + g + ' ' + b + ' RG\n';
  const fillColor = (r: number, g: number, b: number) => r + ' ' + g + ' ' + b + ' rg\n';
  const rect = (x: number, y: number, w: number, h: number, op = 'S') => x + ' ' + y + ' ' + w + ' ' + h + ' re ' + op + '\n';
  const line = (x1: number, y1: number, x2: number, y2: number) => x1 + ' ' + y1 + ' m ' + x2 + ' ' + y2 + ' l S\n';
  const text = (f: string, size: number, x: number, y: number, str: string) =>
    'BT /' + f + ' ' + size + ' Tf ' + x + ' ' + y + ' Td (' + String(str).replace(/[\\()]/g, '\\$&') + ') Tj ET\n';

  // Draw Logo UNY using Image XObject /Im1
  s += 'q\n38 0 0 38 50 712 cm\n/Im1 Do\nQ\n';

  // Set text color to solid black
  s += fillColor(0, 0, 0);

  // Header Texts Left
  s += text('F2', 12, 96, 742, 'EDUTAX UNY 2026');
  s += text('F2', 9.5, 96, 728, 'UNIVERSITAS NEGERI YOGYAKARTA');
  s += text('F1', 8, 96, 716, 'SISTEM INTI ADMINISTRASI PERPAJAKAN');

  // Header Box Right (Bordered box)
  s += strokeColor(0, 0, 0);
  s += '0.75 w\n';
  s += rect(390, 714, 172, 38, 'S');
  s += text('F3', 8.5, 442, 737, 'KODE BILLING');
  s += text('F2', 11, 412, 722, kodeBilling);

  // Divider
  s += '0.5 w\n';
  s += strokeColor(0.8, 0.8, 0.8);
  s += line(50, 700, 562, 700);

  // Wajib Pajak Data
  const leftX = 50;
  const colonX = 140;
  const valX = 150;
  let y = 675;

  s += text('F1', 9, leftX, y, 'NPWP');
  s += text('F1', 9, colonX, y, ':');
  s += text('F1', 9, valX, y, taxpayerTin);

  y -= 15;
  s += text('F1', 9, leftX, y, 'NAMA');
  s += text('F1', 9, colonX, y, ':');
  s += text('F1', 9, valX, y, taxpayerName);

  y -= 15;
  s += text('F1', 9, leftX, y, 'ALAMAT');
  s += text('F1', 9, colonX, y, ':');
  s += text('F1', 9, valX, y, taxpayerAddress);

  y -= 22;
  s += text('F1', 9, leftX, y, 'MATA UANG');
  s += text('F1', 9, colonX, y, ':');
  s += text('F1', 9, valX, y, 'IDR');

  y -= 15;
  s += text('F1', 9, leftX, y, 'NOMINAL');
  s += text('F1', 9, colonX, y, ':');
  s += text('F1', 9, valX, y, nominalFormatted);

  y -= 15;
  s += text('F1', 9, leftX, y, 'JUMLAH DETAIL');
  s += text('F1', 9, colonX, y, ':');
  s += text('F1', 9, valX, y, '1');

  // DETAIL BILLING TABLE
  y -= 25;
  s += text('F2', 9, leftX, y, 'DETAIL BILLING:');

  y -= 10;
  const tblX = 50;
  const tblW = 512;
  const tblHeaderH = 18;
  const tblRowH = 20;
  const tblTotalH = 18;
  const tblTerbilangH = 20;

  // Header background (Mustard Yellow #F4BA24)
  s += fillColor(0.957, 0.729, 0.141);
  s += rect(tblX, y - tblHeaderH, tblW, tblHeaderH, 'f');

  // Header Texts in solid black
  s += fillColor(0, 0, 0);
  s += text('F2', 8.5, 75, y - 13, 'KAP-KJS');
  s += text('F2', 8.5, 160, y - 13, 'MASA PAJAK');
  s += text('F2', 8.5, 255, y - 13, 'REF TAGIHAN');
  s += text('F2', 8.5, 365, y - 13, 'NOP');
  s += text('F2', 8.5, 475, y - 13, 'NOMINAL');

  // Row 1
  y -= tblHeaderH;
  s += text('F1', 9, 72, y - 14, kapKjs);
  s += text('F1', 9, 162, y - 14, masaPajak);
  s += text('F1', 9, 275, y - 14, '-');
  s += text('F1', 9, 370, y - 14, '-');
  s += text('F1', 9, 475, y - 14, 'Rp' + nominalFormatted);

  // Total Row Background
  y -= tblRowH;
  s += fillColor(0.957, 0.729, 0.141);
  s += rect(tblX, y - tblTotalH, tblW, tblTotalH, 'f');
  // Total Row Text in solid black
  s += fillColor(0, 0, 0);
  s += text('F2', 9, 72, y - 13, 'TOTAL');
  s += text('F2', 9, 475, y - 13, 'Rp' + nominalFormatted);

  // Terbilang Row
  y -= tblTotalH;
  s += text('F3', 8.5, 56, y - 14, 'Terbilang: ' + terbilangText);

  // Table Grid Lines
  y -= tblTerbilangH;
  const fullTblH = tblHeaderH + tblRowH + tblTotalH + tblTerbilangH;
  s += strokeColor(0, 0, 0);
  s += '0.5 w\n';
  s += rect(tblX, y, tblW, fullTblH, 'S');
  s += line(tblX, y + tblTerbilangH, tblX + tblW, y + tblTerbilangH);
  s += line(tblX, y + tblTerbilangH + tblTotalH, tblX + tblW, y + tblTerbilangH + tblTotalH);
  s += line(tblX, y + tblTerbilangH + tblTotalH + tblRowH, tblX + tblW, y + tblTerbilangH + tblTotalH + tblRowH);

  // Vertical column dividers
  const c1 = 140, c2 = 230, c3 = 330, c4 = 420;
  const topY = y + fullTblH;
  const midY = y + tblTerbilangH + tblTotalH;
  s += line(c1, midY, c1, topY);
  s += line(c2, midY, c2, topY);
  s += line(c3, midY, c3, topY);
  s += line(c4, y + tblTerbilangH, c4, topY);

  // Bottom section
  y -= 25;
  s += text('F2', 8.5, leftX, y, 'URAIAN:');
  s += text('F1', 8.5, leftX + 50, y, uraianText);

  y -= 25;
  s += text('F2', 8.5, leftX, y, 'GUNAKAN KODE BILLING DI BAWAH INI');
  y -= 12;
  s += text('F2', 8.5, leftX, y, 'UNTUK MELAKUKAN PEMBAYARAN');

  y -= 20;
  s += text('F2', 9, leftX, y, 'KODE BILLING');
  s += text('F2', 10, leftX + 85, y, ':  ' + kodeBilling);

  y -= 16;
  s += text('F2', 9, leftX, y, 'MASA AKTIF');
  s += text('F1', 9, leftX + 85, y, ':  ' + expiresFormatted);

  // Real Scannable QR Code on right side
  const qrX = 460;
  const qrY = y - 10;
  const qrSize = 75;
  try {
    const qr = QRCode.create(kodeBilling, { errorCorrectionLevel: 'M' });
    const numModules = qr.modules.size;
    const moduleSize = qrSize / numModules;

    // White background for QR code
    s += fillColor(1, 1, 1);
    s += rect(qrX, qrY, qrSize, qrSize, 'f');
    s += strokeColor(0, 0, 0);
    s += '0.5 w\n';
    s += rect(qrX, qrY, qrSize, qrSize, 'S');

    // Draw dark modules
    s += fillColor(0, 0, 0);
    for (let r = 0; r < numModules; r++) {
      for (let c = 0; c < numModules; c++) {
        if (qr.modules.get(r, c)) {
          const modX = qrX + c * moduleSize;
          const modY = qrY + (numModules - 1 - r) * moduleSize;
          s += rect(modX, modY, moduleSize + 0.1, moduleSize + 0.1, 'f');
        }
      }
    }
  } catch {
    // Fallback simple frame
    s += strokeColor(0, 0, 0);
    s += '1 w\n';
    s += rect(qrX, qrY, qrSize, qrSize, 'S');
  }

  // Footer Disclaimers
  s += fillColor(0.3, 0.3, 0.3);
  s += text('F1', 7, leftX, 70, 'Cetakan ini diterbitkan secara otomatis oleh sistem EduTax UNY 2026 dan sah tanpa tanda tangan basah.');
  s += text('F1', 7, leftX, 60, 'Saluran pembayaran: Teller Bank Persepsi/Kantor Pos, ATM, Internet Banking, Mobile Banking, atau Agen Laku Pandai.');

  const enc = new TextEncoder();
  const streamBuf = enc.encode(s);
  const jpgBytes = base64ToUint8Array(UNY_LOGO_BASE64);

  // Image Object 8
  const imgHeader = enc.encode('<< /Type /XObject /Subtype /Image /Width 100 /Height 100 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpgBytes.length + ' >>\nstream\n');
  const imgFooter = enc.encode('\nendstream');
  const imgObj = new Uint8Array(imgHeader.length + jpgBytes.length + imgFooter.length);
  imgObj.set(imgHeader, 0);
  imgObj.set(jpgBytes, imgHeader.length);
  imgObj.set(imgFooter, imgHeader.length + jpgBytes.length);

  const streamHeader = enc.encode('<< /Length ' + streamBuf.length + ' >>\nstream\n');
  const streamEnd = enc.encode('\nendstream');
  const contentObj = new Uint8Array(streamHeader.length + streamBuf.length + streamEnd.length);
  contentObj.set(streamHeader, 0);
  contentObj.set(streamBuf, streamHeader.length);
  contentObj.set(streamEnd, streamHeader.length + streamBuf.length);

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', // 1
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', // 2
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /XObject << /Im1 8 0 R >> >> >>', // 3
    contentObj, // 4
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', // 5
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>', // 6
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>', // 7
    imgObj, // 8
  ];

  return buildPdf(objects);
}

export function downloadBillingPdf(params: BillingPdfParams) {
  const bytes = generateBillingPdf(params);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'billing-' + params.kodeBilling + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
