/**
 * Parser PDF client-side para los documentos del proveedor nuevo.
 * Puerto TS de views-requisiciones.js (reqExtraerTextoPDFNativo,
 * reqAnalizarRUT, reqAnalizarCertBancaria) del módulo externo — parser
 * nativo autocontenido (streams + DecompressionStream), sin dependencias:
 * el mismo fallback que usaba el original cuando pdf.js no estaba.
 *
 * De él sale la autodetección de razón social/NIT (RUT DIAN) y
 * banco/tipo de cuenta/número de cuenta/NIT de pago (certificación bancaria).
 */

export interface ItemTexto {
  str: string;
  x: number;
  y: number;
  page?: number;
}

export interface LineaTexto {
  y: number;
  items: ItemTexto[];
  text: string;
}

export interface TextoPdf {
  items: ItemTexto[];
  lines: LineaTexto[];
  text: string;
  isImage: boolean;
}

export interface DatosRut {
  nombre: string;
  nit: string;
}

export interface DatosCertBancaria {
  banco: string;
  tipoCuenta: string;
  noCuenta: string;
  nitPago: string;
  nombre: string;
}

// ── Helpers de texto ───────────────────────────────────────────────────────

const limpiarTexto = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim();

const normUpper = (s: unknown): string =>
  limpiarTexto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const digitos = (s: unknown): string => String(s ?? '').replace(/\D/g, '');

/** NIT sin DV ni separadores (puerto de reqCleanNitSinDV). */
export const nitSinDV = (raw: unknown): string =>
  String(raw ?? '').trim().replace(/\s*[-–]\s*\d\s*$/, '').replace(/\D/g, '');

// ── Parser PDF nativo ──────────────────────────────────────────────────────

function itemsALineas(items: ItemTexto[]): LineaTexto[] {
  const buckets = new Map<number, ItemTexto[]>();
  items.forEach((it) => {
    const txt = limpiarTexto(it.str);
    if (!txt) return;
    const yKey = Math.round(Number(it.y || 0) / 3.5) * 3.5;
    if (!buckets.has(yKey)) buckets.set(yKey, []);
    buckets.get(yKey)!.push({ ...it, str: txt });
  });
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, row]) => {
      const sorted = row.sort((a, b) => a.x - b.x);
      return { y, items: sorted, text: limpiarTexto(sorted.map((x) => x.str).join(' ')) };
    });
}

function decodificarLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const nx = raw[++i];
      if (nx === 'n') out += '\n';
      else if (nx === 'r' || nx === 't') out += ' ';
      else if (nx === '(' || nx === ')' || nx === '\\') out += nx;
      else if (/[0-7]/.test(nx)) {
        let oct = nx;
        for (let k = 0; k < 2 && i + 1 < raw.length && /[0-7]/.test(raw[i + 1]); k++) oct += raw[++i];
        out += String.fromCharCode(parseInt(oct, 8));
      } else out += nx;
    } else {
      out += ch;
    }
  }
  return out;
}

function decodificarHex(hex: string): string {
  const clean = String(hex || '').replace(/\s+/g, '');
  if (!clean) return '';
  if (clean.length >= 4 && clean.length % 4 === 0 && (clean.startsWith('00') || clean.toUpperCase().startsWith('FEFF'))) {
    let out = '';
    for (let i = (clean.toUpperCase().startsWith('FEFF') ? 4 : 0); i < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (code >= 32 && code !== 127) out += String.fromCharCode(code);
    }
    if (out.trim()) return out;
  }
  let out = '';
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code !== 127) out += String.fromCharCode(code);
  }
  return out;
}

function parsearContentStream(contentStr: string, items: ItemTexto[]): void {
  const btRe = /BT\b([\s\S]*?)\bET\b/g;
  let m: RegExpExecArray | null;
  while ((m = btRe.exec(contentStr)) !== null) {
    const blk = m[1];
    let curX = 0, curY = 0;
    const tokRe = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm|(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+T[dD]|\[([\s\S]*?)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*(?:Tj|'|")/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokRe.exec(blk)) !== null) {
      if (tm[5] !== undefined) {
        curX = parseFloat(tm[5]) || 0;
        curY = parseFloat(tm[6]) || 0;
      } else if (tm[7] !== undefined) {
        curX += parseFloat(tm[7]) || 0;
        curY += parseFloat(tm[8]) || 0;
      } else if (tm[9] !== undefined) {
        const arrStr = tm[9];
        const innerRe = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g;
        let partTxt = '', im: RegExpExecArray | null;
        while ((im = innerRe.exec(arrStr)) !== null) {
          partTxt += im[1] !== undefined ? decodificarLiteral(im[1]) : decodificarHex(im[2]);
        }
        const cleaned = limpiarTexto(partTxt);
        if (cleaned) items.push({ str: cleaned, x: curX, y: curY });
      } else if (tm[10] !== undefined) {
        const cleaned = limpiarTexto(decodificarLiteral(tm[10]));
        if (cleaned) items.push({ str: cleaned, x: curX, y: curY });
      } else if (tm[11] !== undefined) {
        const cleaned = limpiarTexto(decodificarHex(tm[11]));
        if (cleaned) items.push({ str: cleaned, x: curX, y: curY });
      }
    }
  }
}

async function extraerTextoPdfNativo(buf: ArrayBuffer): Promise<TextoPdf> {
  const bytes = new Uint8Array(buf);
  let latin = '';
  const CHUNK = 32768;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    latin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  const items: ItemTexto[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(latin)) !== null) {
    const startIdx = m.index + m[0].indexOf(m[1]);
    const endIdx = startIdx + m[1].length;
    const rawSlice = bytes.slice(startIdx, endIdx);
    let content = '';
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        void writer.write(rawSlice);
        void writer.close();
        const decBuf = await new Response(ds.readable).arrayBuffer();
        content = new TextDecoder('latin1').decode(decBuf);
      } catch {
        content = m[1];
      }
    } else {
      content = m[1];
    }
    if (content && (content.includes('BT') || content.includes('Tj') || content.includes('TJ'))) {
      parsearContentStream(content, items);
    }
  }
  const lines = itemsALineas(items);
  return { items, lines, text: lines.map((l) => l.text).join('\n'), isImage: false };
}

/** Extrae el texto de un PDF en el navegador; imágenes → isImage. */
export async function extraerTextoPdf(file: File): Promise<TextoPdf> {
  const vacio: TextoPdf = { items: [], lines: [], text: '', isImage: false };
  if (!file) return vacio;
  const esPdf = (file.type || '').toLowerCase().includes('pdf') || /\.pdf$/i.test(file.name || '');
  if (!esPdf) return { items: [], lines: [], text: '', isImage: true };
  const buf = await file.arrayBuffer();
  try {
    return await extraerTextoPdfNativo(buf);
  } catch {
    return vacio;
  }
}

// ── RUT (Formulario 001 DIAN) ──────────────────────────────────────────────

/** Puerto de reqAnalizarRUT: NIT (Casilla 5) y razón social (Casilla 35 / 31-34). */
export function analizarRut(info: TextoPdf, fileName = ''): DatosRut {
  const res: DatosRut = { nombre: '', nit: '' };
  if (!info || info.isImage || (!info.text && !(info.items && info.items.length))) return res;

  const p1Items = (info.items || []).filter((it) => !it.page || it.page === 1);
  const text = info.text || '';
  const lines = (info.lines || []).map((l) => l.text);

  // 1. NIT por coordenadas (Casilla 5, excluye Casilla 6 DV y nº de formulario)
  const label5 = p1Items.find((it) => /5\.\s*N[uú]mero\s+de\s+Identificaci[oó]n|Identificaci[oó]n\s+Tributaria\s*\(NIT\)/i.test(it.str));
  const label6 = p1Items.find((it) => /\b6\.\s*DV\b/i.test(it.str));
  if (label5) {
    const dvX = label6 ? label6.x - 3 : (label5.x + 175);
    const nitCandidates = p1Items
      .filter((it) =>
        it.y < label5.y - 2 &&
        it.y > label5.y - 34 &&
        it.x >= label5.x - 14 &&
        it.x < dvX &&
        /^\d[\d\s.\-]*$/.test(it.str),
      )
      .sort((a, b) => a.x - b.x);
    let nitDigits = nitCandidates.map((it) => it.str.replace(/\D/g, '')).join('');
    if (!label6 && nitDigits.length === 10 && /^[89]/.test(nitDigits)) {
      nitDigits = nitDigits.slice(0, 9);
    }
    if (nitDigits.length >= 6 && nitDigits.length <= 11 && !/^14\d{9,}$/.test(nitDigits)) {
      res.nit = nitDigits;
    }
  }

  if (!res.nit) {
    const mSpaced = text.match(/5\.\s*N[uú]mero\s+de\s+Identificaci[oó]n[^\n]*\n([^\n]+)/i);
    if (mSpaced) {
      const cand = limpiarTexto(mSpaced[1]).replace(/\s+6\.\s*DV.*/i, '');
      const mFirst = cand.match(/^([\d\s]{5,24})/);
      if (mFirst) {
        let d = mFirst[1].replace(/\D/g, '');
        if (d.length === 10 && /^[89]/.test(d)) d = d.slice(0, 9);
        if (d.length >= 6 && d.length <= 11 && !/^14\d{9,}$/.test(d)) res.nit = d;
      }
    }
  }
  if (!res.nit) {
    const mReg = text.match(/(?:Identificaci[oó]n\s+Tributaria\s*\(NIT\)|5\.\s*NIT)[^0-9]{0,30}((?:\d\s*){6,11})/i);
    if (mReg) {
      let d = mReg[1].replace(/\D/g, '');
      if (d.length === 10 && /^[89]/.test(d)) d = d.slice(0, 9);
      if (d.length >= 6 && d.length <= 11 && !/^14\d{9,}$/.test(d)) res.nit = d;
    }
  }

  // 2. Razón social (Casilla 35) o persona natural (Casillas 31-34)
  const label35 = p1Items.find((it) => /35\.\s*Raz[oó]n\s+social/i.test(it.str));
  const label36 = p1Items.find((it) => /36\.\s*Nombre\s+comercial/i.test(it.str));
  if (label35) {
    const minY = label36 && label36.y < label35.y ? label36.y + 2 : label35.y - 34;
    const razonItems = p1Items
      .filter((it) =>
        it.y < label35.y - 2 &&
        it.y > minY &&
        !/^(35|36|37)\.|Raz[oó]n\s+social|Nombre\s+comercial|IDENTIFICACI[OÓ]N/i.test(it.str),
      )
      .sort((a, b) => (Math.abs(a.y - b.y) > 4 ? b.y - a.y : a.x - b.x));
    const razonTxt = limpiarTexto(razonItems.map((it) => it.str).join(' '));
    if (razonTxt && razonTxt.length >= 3) {
      res.nombre = razonTxt.toUpperCase();
    }
  }

  if (!res.nombre) {
    const l31 = p1Items.find((it) => /31\.\s*Primer\s+apellido/i.test(it.str));
    const l32 = p1Items.find((it) => /32\.\s*Segundo\s+apellido/i.test(it.str));
    const l33 = p1Items.find((it) => /33\.\s*Primer\s+nombre/i.test(it.str));
    const l34 = p1Items.find((it) => /34\.\s*Otros\s+nombres/i.test(it.str));
    const baseLabel = l31 || l33 || l32 || l34;
    if (baseLabel) {
      const bottomY = label35 && label35.y < baseLabel.y ? label35.y + 2 : baseLabel.y - 32;
      const rowItems = p1Items
        .filter((it) =>
          it.y < baseLabel.y - 2 &&
          it.y > bottomY &&
          !/^(31|32|33|34|35)\.|Primer\s+apellido|Segundo\s+apellido|Primer\s+nombre|Otros\s+nombres/i.test(it.str),
        )
        .sort((a, b) => a.x - b.x);
      if (rowItems.length) {
        if (l31 && l33) {
          const cols = [
            { k: 31, x: l31.x },
            { k: 32, x: l32 ? l32.x : (l31.x + (l33.x - l31.x) / 2) },
            { k: 33, x: l33.x },
            { k: 34, x: l34 ? l34.x : (l33.x + 120) },
          ].sort((a, b) => a.x - b.x);
          const buckets: Record<number, string[]> = { 31: [], 32: [], 33: [], 34: [] };
          rowItems.forEach((it) => {
            let best = cols[0];
            cols.forEach((c) => { if (it.x >= c.x - 12) best = c; });
            buckets[best.k].push(it.str);
          });
          const fullName = limpiarTexto([...buckets[33], ...buckets[34], ...buckets[31], ...buckets[32]].join(' '));
          if (fullName.length >= 3) res.nombre = fullName.toUpperCase();
        }
        if (!res.nombre) {
          const fallbackName = limpiarTexto(rowItems.map((it) => it.str).join(' '));
          if (fallbackName.length >= 3) res.nombre = fallbackName.toUpperCase();
        }
      }
    }
  }

  if (!res.nombre) {
    const idx35 = lines.findIndex((l) => /35\.\s*Raz[oó]n\s+social/i.test(l));
    if (idx35 >= 0 && idx35 + 1 < lines.length) {
      const nextLine = limpiarTexto(lines[idx35 + 1]);
      if (nextLine && !/^(36\.|Nombre\s+comercial)/i.test(nextLine)) {
        res.nombre = nextLine.toUpperCase();
      }
    }
  }
  if (!res.nombre) {
    const socLine = lines.find((l) =>
      !/DIAN|REGISTRO\s+UNICO\s+TRIBUTARIO|DIRECCION\s+DE\s+IMPUESTOS/i.test(l) &&
      /\b(S\.?A\.?S\.?|LTDA\.?|S\.?A\.?|E\.?U\.?|S\.?C\.?A\.?|CORPORACION|FUNDACION)\b/i.test(l) &&
      l.length >= 6 && l.length <= 120,
    );
    if (socLine) res.nombre = socLine.replace(/^35\.\s*Raz[oó]n\s+social\s*/i, '').trim().toUpperCase();
  }
  if (!res.nombre && fileName && !res.nit) {
    const mFn = fileName.match(/\b(\d{6,11})\b/);
    if (mFn) res.nit = mFn[1];
  }

  return res;
}

// ── Certificación bancaria ─────────────────────────────────────────────────

/** NITs propios de bancos colombianos (para excluirlos al buscar el del titular). */
const BANK_NITS = new Set([
  '890903938', '860034313', '860002964', '860003020', '860007335',
  '890300279', '860007738', '860035827', '860034594', '890903937',
  '800037800', '860050750', '900474518', '890903790', '900204953',
  '900047981', '860043186', '901279884', '901383474', '890203088',
  '860049689', '890900841', '900215071',
]);

const REGLAS_BANCO: [RegExp, string][] = [
  [/\bNEQUI\b/, 'Nequi'],
  [/\bDAVIPLATA\b/, 'Daviplata'],
  [/\bBANCOLOMBIA\b/, 'Bancolombia'],
  [/\bDAVIVIENDA\b/, 'Davivienda'],
  [/\bCAJA\s+SOCIAL\b|\bBCSC\b/, 'Banco Caja Social'],
  [/\bBANCO\s+DE\s+BOGOTA\b|\bBOGOTA\s+S\.?\s*A\.?\b/, 'Banco de Bogotá'],
  [/\bBBVA\b/, 'BBVA'],
  [/\bBANCO\s+DE\s+OCCIDENTE\b|\bOCCIDENTE\s+S\.?\s*A\.?\b/, 'Banco de Occidente'],
  [/\bBANCO\s+POPULAR\b/, 'Banco Popular'],
  [/\bAV\s*VILLAS\b/, 'Banco AV Villas'],
  [/\bCOLPATRIA\b|\bSCOTIABANK\b/, 'Scotiabank Colpatria'],
  [/\bITAU\b|\bCORPBANCA\b/, 'Itaú'],
  [/\bBANCO\s+AGRARIO\b/, 'Banco Agrario'],
  [/\bGNB\s+SUDAMERIS\b|\bSUDAMERIS\b/, 'Banco GNB Sudameris'],
  [/\bPICHINCHA\b/, 'Banco Pichincha'],
  [/\bFALABELLA\b/, 'Banco Falabella'],
  [/\bLULO\s*BANK\b/, 'Lulo Bank'],
  [/\bNU\s+COLOMBIA\b|\bBANCO\s+NU\b|\bNU\.COM\.CO\b/, 'Nu Colombia'],
  [/\bBANCOOMEVA\b/, 'Bancoomeva'],
  [/\bFINANDINA\b/, 'Banco Finandina'],
  [/\bSERFINANZA\b/, 'Banco Serfinanza'],
  [/\bCITIBANK\b/, 'Citibank'],
  [/\bCOOPCENTRAL\b/, 'Coopcentral'],
  [/\bCONFIAR\b/, 'Confiar'],
  [/\bBANCAMIA\b/, 'Bancamía'],
  [/\bMUNDO\s+MUJER\b/, 'Banco Mundo Mujer'],
  [/\bBANCO\s+W\b/, 'Banco W'],
];

/** Puerto de reqAnalizarCertBancaria. */
export function analizarCertBancaria(info: TextoPdf, fileName = '', nitActual = ''): DatosCertBancaria {
  const res: DatosCertBancaria = { banco: '', tipoCuenta: '', noCuenta: '', nitPago: '', nombre: '' };
  if (!info || info.isImage || (!info.text && !(info.lines && info.lines.length))) return res;

  const text = info.text || '';
  const textNorm = normUpper(text);
  const fnNorm = normUpper(fileName);
  const lines = (info.lines || []).map((l) => l.text);

  // 1. Banco emisor
  for (const [re, name] of REGLAS_BANCO) {
    if (re.test(textNorm)) { res.banco = name; break; }
  }
  if (!res.banco) {
    for (const [re, name] of REGLAS_BANCO) {
      if (re.test(fnNorm)) { res.banco = name; break; }
    }
  }

  // 2. Tipo de cuenta
  const tipoExplicit = text.match(/Tipo\s+de\s+(?:cuenta|producto)\s*[:\-]?\s*(Cuenta\s+de\s+)?(Ahorros|Corriente)/i);
  if (tipoExplicit) {
    res.tipoCuenta = /corriente/i.test(tipoExplicit[2]) ? 'Corriente' : 'Ahorros';
  } else if (/CUENTA\s+CORRIENTE|CTA\.?\s+CORRIENTE|\bCORRIENTE\b/i.test(textNorm) && !/CUENTA\s+DE\s+AHORROS/i.test(textNorm)) {
    res.tipoCuenta = 'Corriente';
  } else if (/CUENTA\s+DE\s+AHORROS|CUENTA\s+AHORROS|CTA\.?\s+AHORROS|\bAHORROS\b|DEPOSITO\s+DE\s+BAJO\s+MONTO|\bNEQUI\b|\bDAVIPLATA\b/i.test(textNorm)) {
    res.tipoCuenta = 'Ahorros';
  } else if (/CUENTA\s+CORRIENTE/i.test(textNorm)) {
    res.tipoCuenta = 'Corriente';
  }

  // 3. Titular y NIT de pago
  const holderMatch = text.match(/(?:certifica\s+que|informa\s+que|hace\s+constar\s+que)\s+([A-ZÁÉÍÓÚÑ0-9\s.,&\-]{3,95}?)\s+(?:identificad[oa]|con\s+(?:NIT|C\.?C\.?|c[eé]dula|documento))/i);
  if (holderMatch) {
    const cleanH = limpiarTexto(holderMatch[1])
      .replace(/^(?:el|la)\s+(?:se[ñn]or(?:a)?|sociedad|empresa)\s+/i, '')
      .replace(/[,.\s]+$/, '');
    if (cleanH.length >= 3 && !/BANCO|DAVIVIENDA|BANCOLOMBIA/i.test(cleanH)) {
      res.nombre = cleanH.toUpperCase();
    }
  }

  const nitCandRe = /(?:identificad[oa]\s+con(?:\s+(?:el|la))?\s*(?:NIT|C\.?C\.?|c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|documento)?|NIT\s*(?:No\.?|N[úu]mero|N[°º]|:)?|C\.?C\.?\s*(?:No\.?|N[úu]mero|:)?|C[eé]dula(?:\s+de\s+ciudadan[ií]a)?\s*(?:No\.?|:)?)\s*[:.#-]?\s*(\d[\d.\s]{4,14}\d(?:\s*-\s*\d)?)/gi;
  let nm: RegExpExecArray | null;
  const nitCands: string[] = [];
  while ((nm = nitCandRe.exec(text)) !== null) {
    const d = nitSinDV(nm[1]);
    if (d.length >= 6 && d.length <= 11 && !BANK_NITS.has(d) && !BANK_NITS.has(d.slice(0, 9))) {
      nitCands.push(d);
    }
  }
  const nitActualClean = digitos(nitActual || '');
  if (nitActualClean && nitCands.some((c) => digitos(c) === nitActualClean)) {
    res.nitPago = nitActualClean;
  } else if (nitCands.length) {
    res.nitPago = nitCands[0];
  } else if (nitActualClean && new RegExp(nitActualClean).test(text.replace(/[\s.,-]/g, ''))) {
    res.nitPago = nitActualClean;
  }

  // 4. Número de cuenta
  const nitSet = new Set(BANK_NITS);
  if (nitActualClean) nitSet.add(nitActualClean);
  if (res.nitPago) nitSet.add(digitos(res.nitPago));

  const esNumeroCuentaValido = (rawCand: unknown): boolean => {
    const d = String(rawCand || '').replace(/\D/g, '');
    if (d.length < 7 || d.length > 18) return false;
    if (nitSet.has(d) || nitSet.has(d.slice(0, 9))) return false;
    if (/^018000/.test(d)) return false; // línea 018000 del banco
    if (/^(19|20)\d{6}$/.test(d)) return false; // fechas AAAAMMDD
    return true;
  };

  const ctaRegexes = [
    /(?:n[uú]mero\s+de\s+(?:la\s+)?cuenta|no\.?\s*(?:de\s+)?cuenta|nro\.?\s*(?:de\s+)?cuenta|n[úu]mero\s+(?:de\s+)?producto|no\.?\s*producto)\s*[:#.\-]?\s*(\d[\d\-\s]{5,22}\d)/gi,
    /(?:cuenta\s+(?:de\s+)?ahorros?\s*(?:no\.?|nro\.?|n[úu]mero|n[°º]|#)?|cuenta\s+corriente\s*(?:no\.?|nro\.?|n[úu]mero|n[°º]|#)?|cta\.?\s*(ahorros|corriente)\s*(?:no\.?|#|:)?)\s*[:#.\-]?\s*(\d[\d\-\s]{5,22}\d)/gi,
  ];
  for (const re of ctaRegexes) {
    let cm: RegExpExecArray | null;
    while ((cm = re.exec(text)) !== null) {
      const cand = limpiarTexto(cm[1] ?? cm[2]).replace(/\s+/g, '');
      if (esNumeroCuentaValido(cand)) {
        res.noCuenta = cand;
        break;
      }
    }
    if (res.noCuenta) break;
  }

  if (!res.noCuenta) {
    for (let i = 0; i < lines.length; i++) {
      if (/\b(AHORROS|CORRIENTE|CUENTA|PRODUCTO)\b/i.test(lines[i])) {
        const windowTxt = [lines[i], lines[i + 1] || ''].join(' ');
        const nums = windowTxt.match(/\b\d[\d\-]{6,20}\d\b/g) || [];
        const hit = nums.map((x) => x.replace(/\s+/g, '')).find(esNumeroCuentaValido);
        if (hit) { res.noCuenta = hit; break; }
      }
    }
  }

  return res;
}
