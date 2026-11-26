/**
 * Impresión oficial del traslado de presupuesto:
 * FORMATO - MOVIMIENTO PRESUPUESTAL (Formato_Aprobacion_Traslados.xlsx del
 * original). Puerto TS de trPrint de views-traslados.js: window.open +
 * document.write con firmas.
 */
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import type { Traslado } from '@/Funciones/ApiPedidos/financiero';

const m = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v) || 0).toLocaleString('es-CO');

const f = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10).split('-').reverse().join('/') : '');

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const et = (resp?: string | null, rubro?: string | null) => (rubro ? `${resp} › ${rubro}` : (resp ?? ''));

export function imprimirTraslado(t: Traslado): void {
  const ap = t.aprobacion;
  const filas = (t.lineas || []).map((l) =>
    `<tr><td>${f(t.fecha)}</td><td>${esc(et(l.origen, l.origenRubro))}</td><td>${esc(et(l.destino, l.destinoRubro))}</td><td>${esc(l.mes ?? '')}</td><td class="r">${m(l.monto)}</td><td>${esc(l.motivo)}</td></tr>`).join('');
  const total = (t.lineas || []).reduce((s, l) => s + (Number(l.monto) || 0), 0);

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Traslado ${esc(t.consecutivo)}</title>
  <style>*{box-sizing:border-box} body{font:12px Arial,Helvetica,sans-serif;color:#111;margin:18px}
  table{border-collapse:collapse;width:100%} td,th{border:1px solid #444;padding:5px 7px;vertical-align:top}
  th{background:#e8eef5;font-size:11px;text-transform:uppercase} .r{text-align:right} .c{text-align:center} .b{font-weight:700}
  .tit{font-size:15px;font-weight:700;text-align:center} .sec{background:#1f3b5c;color:#fff;font-weight:700;text-align:center}
  @media print{body{margin:8mm} .noprint{display:none}}</style></head><body>
  <div class="noprint" style="margin-bottom:10px"><button onclick="window.print()" style="padding:7px 16px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button></div>
  <table><tr><td rowspan="3" style="width:20%" class="c"><img src="${LOGO_INTEGRA}" style="max-width:130px;max-height:60px" alt=""></td>
    <td class="tit" rowspan="2">FORMATO - MOVIMIENTO PRESUPUESTAL</td><td style="width:22%">Código: </td></tr>
    <tr><td>Versión: </td></tr>
    <tr><td class="b c">INTEGRA CADENA DE SERVICIOS S.A.S.</td><td>Fecha: </td></tr></table>
  <table style="margin-top:8px"><tr><td class="sec">SOLICITADO POR</td></tr><tr><td class="b">${esc(t.solicitante_nombre)} <span style="font-weight:400">· ${esc(t.consecutivo)}</span></td></tr></table>
  <p style="margin:10px 0 6px">Solicito a Presidencia autorizar el(los) siguiente(s) traslado(s) de presupuesto entre los rubros y áreas que se detallan a continuación.</p>
  <table><tr><th>Fecha</th><th>Área › rubro origen</th><th>Área › rubro destino</th><th>Mes afectado</th><th>Monto trasladado</th><th>Motivo / nota</th></tr>${filas}
    <tr><td colspan="4" class="b">TOTAL MONTO TRASLADADO</td><td class="r b">${m(total)}</td><td></td></tr></table>
  <table style="margin-top:12px"><tr><td class="sec" colspan="3">APROBADO POR</td></tr>
    <tr><th>Nombre</th><th>Cargo</th><th>Fecha aprobación</th></tr>
    <tr><td style="height:50px;font-family:'Brush Script MT',cursive;font-size:27px;color:#0b2a6b">${esc(ap?.nombre ?? '')}</td><td>${esc(ap?.cargo ?? '')}</td><td>${ap?.at ? f(ap.at) : ''}</td></tr></table>
  <table style="margin-top:12px"><tr><td class="sec">OBSERVACIONES</td></tr><tr><td style="height:60px">${esc([t.observaciones, ap?.comentario].filter(Boolean).join(' · ')).replace(/\\n/g, '<br>')}</td></tr></table>
  <p style="margin-top:12px;font-size:10.5px">Nota: este formato debe ser diligenciado y remitido a Presidencia. Presidencia es quien debe enviarlo al Gerente Financiero, con copia al Controller.</p>
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
