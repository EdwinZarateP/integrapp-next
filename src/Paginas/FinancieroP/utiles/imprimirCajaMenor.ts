/**
 * Impresión oficial FORM-FIN-007 «Formato Reembolso de Caja Menor».
 * Puerto TS de imprimirCajaMenorPDF de views-cajas-menores.js: letter
 * landscape, tabla de 8 columnas con mínimo 18 filas, bloque del responsable
 * y 4 firmas (Responsable / Jefe-Controller / Contabilidad FC / Tesorería).
 */
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import type { CajaMenorFin, MovimientoCajaFin } from '@/Funciones/ApiPedidos/financiero';

const m = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v) || 0).toLocaleString('es-CO');

const f = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10).split('-').reverse().join('/') : '');

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TIPO_DOC: Record<string, string> = {
  recibo_caja: 'RCM', cuenta_cobro: 'CxC', factura_electronica: 'FE',
};

export function imprimirCajaMenor(c: CajaMenorFin): void {
  const items = c.movimientos || [];
  const maxFilas = Math.max(items.length, 18);
  const filas: string[] = [];
  for (let i = 0; i < maxFilas; i++) {
    const it: MovimientoCajaFin | undefined = items[i];
    filas.push(`<tr>
      <td class="c">${it?.folio ?? i + 1}</td>
      <td class="c">${f(it?.fecha ?? null)}</td>
      <td>${esc(it?.nit ?? '')}</td>
      <td>${esc(it?.proveedor ?? '')}</td>
      <td>${esc(it?.concepto ?? '')}${it?.tipo_documento ? ` <span style="color:#64748b;font-size:9px">[${TIPO_DOC[it.tipo_documento] ?? ''}]</span>` : ''}</td>
      <td class="c">${esc(it?.centro_costo ?? '')}</td>
      <td class="c">${esc(it?.no_factura ?? '')}</td>
      <td class="r">${it ? m(it.valor) : ''}</td>
    </tr>`);
  }

  const aprobador = String(c.datos?.aprobado_controller_por ?? c.datos?.aprobado_jefe_por ?? '');
  const firma = (nombre: string | null | undefined, rol: string) => `
    <div class="firma">
      <div class="linea">${nombre ? esc(nombre) : '&nbsp;'}</div>
      <div class="rol">${rol}</div>
    </div>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(c.consecutivo ?? 'Caja menor')} · FORM-FIN-007</title>
  <style>
    @page { size: letter landscape; margin: 8mm 8mm; }
    * { box-sizing: border-box; }
    body { font: 11px 'Segoe UI', Calibri, Arial, sans-serif; color: #111; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #444; padding: 3px 5px; vertical-align: top; }
    th { background: #e8eef5; font-size: 10px; text-transform: uppercase; }
    .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
    .b { font-weight: 700; }
    .firmas { display: flex; gap: 26px; margin-top: 46px; }
    .firma { flex: 1; text-align: center; }
    .linea { border-bottom: 1px solid #000; min-height: 40px; display: flex; align-items: flex-end; justify-content: center;
             font-family: 'Brush Script MT', cursive; font-size: 26px; color: #0b2a6b; padding-bottom: 2px; }
    .rol { font-weight: 700; font-size: 10px; margin-top: 4px; }
    @media print { .noprint { display: none; } }
  </style></head><body>
  <div class="noprint" style="margin-bottom:10px"><button onclick="window.print()" style="padding:7px 16px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button></div>
  <table>
    <tr>
      <td rowspan="3" style="width:20%" class="c"><img src="${LOGO_INTEGRA}" style="max-width:130px;max-height:60px" alt=""></td>
      <td class="b c" style="font-size:14px">FORMATO REEMBOLSO DE CAJA MENOR<br>
        <span style="font-weight:400;font-size:11px">INTEGRA CADENA DE SERVICIOS S.A.S.</span></td>
      <td style="width:24%">Código: FORM-FIN-007 · Versión: 1<br>Fecha: 09/04/2024 · Página: 1 de 1</td>
    </tr>
  </table>
  <table style="margin-top:8px">
    <tr>
      <th>No Folio</th><th>Fecha del documento</th><th>Nit/CC</th><th>Proveedor</th>
      <th>Concepto</th><th>Centro de costo</th><th>No factura</th><th>Total cancelado</th>
    </tr>
    ${filas.join('')}
    <tr>
      <td colspan="7" class="b r">TOTAL A REEMBOLSAR:</td>
      <td class="r b">${m(c.total_reembolso)}</td>
    </tr>
  </table>
  <table style="margin-top:12px">
    <tr><td class="b" style="width:22%">Nombre Responsable:</td><td>${esc(c.responsable)}</td>
        <td class="b" style="width:18%">C.C:</td><td>${esc(c.responsable_cc ?? '')}</td></tr>
    <tr><td class="b">Ciudad origen de la caja:</td><td>${esc(c.sede)}</td>
        <td class="b">Fecha de envío:</td><td>${f(c.politica?.fechaEnvio as string ?? c.created_at)}${c.politica?.aTiempoParaViernes ? ' 🟢' : ' 🟡'}</td></tr>
    <tr><td class="b">Aprobado por:</td><td colspan="3">${esc(aprobador)}</td></tr>
  </table>
  <div class="firmas">
    ${firma(c.responsable, 'Firma Responsable Caja Menor')}
    ${firma(aprobador || null, 'Aprobación Jefe Inmediato / Controller')}
    ${firma(String(c.datos?.contabilizado_por ?? ''), `Contabilidad / Causación FC${c.datos?.no_comprobante_fc ? `: ${c.datos.no_comprobante_fc}` : ' · Pendiente FC'}`)}
    ${firma(String(c.datos?.reembolsado_por ?? ''), `Tesorería / Devolución Egreso${c.datos?.no_egreso_banco ? ` #${c.datos.no_egreso_banco}` : ' · Pendiente Egreso'}`)}
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana emergente. Permítelas para poder imprimir.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Copia la tabla de legalización al portapapeles (TSV con la columna estado FC). */
export function copiarTablaCaja(c: CajaMenorFin): void {
  const cab = ['No Folio', 'Fecha del documento', 'Nit/CC', 'Proveedor', 'Concepto', 'Centro de costo', 'No factura', 'Total cancelado', 'estadoFc'];
  const filas = (c.movimientos || []).map((it) => [
    it.folio, f(it.fecha), it.nit ?? '', it.proveedor ?? '', it.concepto, it.centro_costo ?? '',
    it.no_factura ?? '', m(it.valor),
    it.contabilizado === false ? 'NO CAUSADO (EXCLUIDO)'
      : c.datos?.no_comprobante_fc ? `Causado - FC ${c.datos.no_comprobante_fc}` : 'Causado',
  ].join('\t'));
  filas.push(`TOTAL A REEMBOLSAR:\t\t\t\t\t\t\t$ ${Math.round(c.total_reembolso).toLocaleString('es-CO')}`);
  const tsv = [cab.join('\t'), ...filas].join('\n');
  void navigator.clipboard?.writeText(tsv);
}
