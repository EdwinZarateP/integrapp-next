/**
 * Impresión oficial de requisición (FORM-CPR-011) y orden de compra
 * (FORM-CPR-004) con firmas y seguimiento a proveedor.
 * Puerto TS de reqPrint de views-requisiciones.js (módulo externo):
 * arma el HTML completo y lo abre en ventana nueva para imprimir/guardar PDF.
 */
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import type { Requisicion } from '@/Funciones/ApiPedidos/financiero';

const m = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v) || 0).toLocaleString('es-CO');

const f = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10).split('-').reverse().join('/') : '');

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CRITERIOS: { k: string; peso: number }[] = [
  { k: 'CE', peso: 0.10 }, { k: 'EC', peso: 0.10 }, { k: 'ES', peso: 0.10 },
  { k: 'SQR', peso: 0.05 }, { k: 'AC', peso: 0.05 }, { k: 'G', peso: 0.10 },
  { k: 'PFC', peso: 0.20 }, { k: 'MA', peso: 0.15 }, { k: 'SST', peso: 0.15 },
];

function firmaHtml(titulo: string, nombre?: string | null, at?: string | null): string {
  return `<div class="firma"><div class="lin">${nombre ? esc(nombre) : '&nbsp;'}</div><div class="cap">${titulo}${at ? ' · ' + f(at) : ''}</div></div>`;
}

function imprimirHtml(html: string, titulo: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana emergente. Permítelas para poder imprimir.');
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>${html}`);
  w.document.close();
}

/** Imprime la requisición (FORM-CPR-011) o la orden de compra (FORM-CPR-004). */
export function imprimirRequisicion(r: Requisicion, tipo: 'REQ' | 'OC'): void {
  const oc = tipo === 'OC';
  if (oc && !r.oc_numero) {
    alert('La orden de compra aún no existe: se genera con la aprobación final.');
    return;
  }
  const pd = (r.proveedor_datos ?? {}) as Record<string, unknown>;
  const ap = (n: number) => (r.historial_cambios || []).find((h) =>
    (n === 1 && h.accion === 'APROBAR' && h.estado_nuevo === 'PENDIENTE_COMPRAS') ||
    (n === 2 && h.accion === 'APROBAR' && h.estado_nuevo === 'PENDIENTE_FINANCIERA') ||
    (n === 3 && h.accion === 'APROBAR' && (h.estado_nuevo === 'EN_ORDEN_COMPRA' || h.estado_nuevo === 'APROBADA')));
  const jefe = ap(1), compras = ap(2), final = ap(3);
  const cal = r.calificacion_proveedor;
  const filas = (r.items || []).map((i) => `<tr><td>${esc(oc ? r.oc_numero : r.consecutivo)}</td><td>${esc(i.centro_costo ?? '')}</td><td class="c">${Number(i.cantidad).toLocaleString('es-CO')}</td><td>${esc(i.descripcion)}</td><td class="r">${m(i.precio_unitario)}</td><td class="r">${m(i.descuento ?? 0)}</td><td class="r">${m(i.total)}</td></tr>`).join('');

  const html = `<head><style>
    *{box-sizing:border-box} body{font:12px Arial,Helvetica,sans-serif;color:#111;margin:18px}
    table{border-collapse:collapse;width:100%} td,th{border:1px solid #444;padding:4px 6px;vertical-align:top}
    th{background:#e8eef5;font-size:11px;text-transform:uppercase} .c{text-align:center} .r{text-align:right}
    .head td{border:1px solid #444} .tit{font-size:15px;font-weight:700;text-align:center} .emp{font-weight:700;text-align:center;font-size:13px}
    .sec{background:#1f3b5c;color:#fff;font-weight:700;text-align:center}
    .firmas{display:flex;gap:18px;margin-top:26px} .firma{flex:1;text-align:center} .lin{border-bottom:1px solid #111;padding:6px 0 2px;min-height:40px;font-family:'Brush Script MT',cursive;font-size:27px;line-height:1.1;color:#0b2a6b} .cap{font-size:10.5px;margin-top:3px;text-transform:uppercase}
    .pie{margin-top:14px;font-size:10px;text-align:center;color:#444} .nb{border:none} .b{font-weight:700}
    @media print{body{margin:8mm} .noprint{display:none}}
  </style></head><body>
  <div class="noprint" style="margin-bottom:10px"><button onclick="window.print()" style="padding:7px 16px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button></div>
  <table class="head"><tr>
    <td rowspan="3" style="width:20%" class="c"><img src="${LOGO_INTEGRA}" style="max-width:130px;max-height:60px" alt=""></td>
    <td class="tit" rowspan="2">${oc ? 'FORMATO - ORDEN DE COMPRA' : 'FORMATO - REQUISICIÓN DE COMPRA'}</td>
    <td style="width:22%">Código: ${oc ? 'FORM-CPR-004' : 'FORM-CPR-011'}</td></tr>
    <tr><td>Versión: 4</td></tr>
    <tr><td class="emp">INTEGRA CADENA DE SERVICIOS S.A.S.${oc ? '<br><span style="font-weight:400;font-size:11px">NIT 900 164 363 - 7</span>' : ''}</td><td>Fecha: ${oc ? '30/09/2024' : '20/03/2026'}</td></tr>
  </table>
  <table style="margin-top:8px">
    <tr><td class="b" style="width:14%">PROVEEDOR:</td><td style="width:36%">${esc(r.proveedor_sugerido)}</td><td class="b" style="width:16%">FECHA DE SOLICITUD</td><td style="width:14%">${f(r.created_at)}</td><td class="b" style="width:20%">${oc ? 'NÚMERO ORDEN DE COMPRA' : 'Pedido No:'}</td></tr>
    <tr><td class="b">NIT:</td><td>${esc(r.proveedor_nit ?? '')}</td><td class="b">ÁREA</td><td>${esc(r.area)}</td><td rowspan="2" class="c b" style="font-size:16px">${esc(oc ? r.oc_numero : r.consecutivo)}</td></tr>
    <tr><td class="b">DIRECCIÓN:</td><td>${esc(pd.direccion ?? '')}</td><td class="b">Lugar de entrega</td><td>${esc(r.lugar_entrega)}</td></tr>
    <tr><td class="b">TELÉFONO:</td><td>${esc(pd.telefono ?? '')}</td><td class="b">CONTACTO:</td><td colspan="2">${esc(pd.contacto ?? '')}</td></tr>
  </table>
  <p style="margin:10px 0 6px">Con base en la cotización presentada por su empresa a INTEGRA CADENA DE SERVICIOS SAS, sírvase remitir los bienes o servicios que a continuación se detallan.</p>
  <table>
    <tr><th>Código</th><th>Centro de costo</th><th>Cantidad</th><th>Descripción del artículo</th><th>Precio unitario</th><th>Descuento</th><th>Precio total</th></tr>
    ${filas}
    <tr><td colspan="6" class="b">SUBTOTAL M.O Y TRABAJO TERCEROS</td><td class="r b">${m(r.subtotal)}</td></tr>
  </table>
  <table style="margin-top:8px"><tr>
    <td style="width:60%" class="nb">
      <table><tr><td class="b">NOMBRE DEL RECEPTOR</td><td class="b">FECHA DE INICIO</td><td class="b">FECHA DE FINALIZACIÓN</td></tr>
      <tr><td>${esc(pd.receptor ?? '')}&nbsp;</td><td>${f((pd.fecha_inicio as string) ?? null)}</td><td>${f((pd.fecha_fin as string) ?? null)}</td></tr></table>
    </td>
    <td class="nb" style="width:40%">
      <table><tr><td>SUMA PRODUCTOS SIN IVA</td><td class="r">${m(r.subtotal)}</td></tr>
      <tr><td>IVA</td><td class="r">&nbsp;</td></tr>
      <tr><td>RTE FUENTE 2,5%</td><td class="r">&nbsp;</td></tr>
      <tr><td>RTE ICA 11,04</td><td class="r">&nbsp;</td></tr>
      <tr><td class="b">TOTAL</td><td class="r b">${m(r.total)}</td></tr></table>
    </td></tr></table>
  <table style="margin-top:8px"><tr><td class="b">OBSERVACIONES</td></tr>
    <tr><td style="height:60px">${oc ? 'POR FAVOR GENERAR LA FACTURA ELECTRÓNICA Y EN EL CAMPO DE OBSERVACIONES ADJUNTAR EL NÚMERO DE ORDEN DE COMPRA ' + esc(r.oc_numero) + '.<br>' : ''}${esc(r.observaciones).replace(/\n/g, '<br>')}${pd.cotizacion_ref ? '<br>Cotización: ' + esc(pd.cotizacion_ref) : ''}</td></tr></table>
  <div class="firmas">
    ${firmaHtml('Solicitado por', r.solicitante_nombre, r.created_at)}
    ${firmaHtml('Jefe de área', jefe?.usuario, jefe?.fecha)}
    ${firmaHtml('Compras', compras?.usuario, compras?.fecha)}
    ${firmaHtml('Aprobado por', final?.usuario, final?.fecha)}
  </div>
  ${cal ? `<table style="margin-top:14px"><tr><td colspan="${CRITERIOS.length + 2}" class="sec">SEGUIMIENTO A PROVEEDOR O CONTRATISTA</td></tr>
    <tr>${CRITERIOS.map((c) => `<th>${c.k}<br>${Math.round(c.peso * 100)}%</th>`).join('')}<th>Calificación</th><th>Calificado por</th></tr>
    <tr>${CRITERIOS.map((c) => `<td class="c">${cal.notas?.[c.k] ?? ''}</td>`).join('')}<td class="c b">${Number(cal.puntaje).toFixed(2)} (${cal.letra})</td><td>${esc(cal.por)}</td></tr>
    <tr><td colspan="${CRITERIOS.length + 2}" style="font-size:10px">A: 15 a 13,8 proveedor confiable, primera opción · B: 13,7 a 7,5 segunda opción, controlar la prestación · C: 7,5 a 0 iniciar búsqueda de otro proveedor e inactivar. CE: Cumplimiento de entrega · EC: Especificaciones de calidad · ES: Especificaciones de seguridad · SQR: Solución queja y reclamo · AC: Atención al cliente · G: Garantía · PFC: Precio, financiación y crédito · MA: Medio ambiente · SST: Seguridad y salud en el trabajo</td></tr></table>` : ''}
  <div class="pie">Carrera 68ª No. 19 - 80 - Tel: 7006232 - Bogotá D.C., Colombia · E-mail: compras@integralogistica.com · www.integralogistica.com</div>
  </body></html>`;

  imprimirHtml(html, oc ? `Orden de compra ${r.oc_numero}` : `Requisición ${r.consecutivo}`);
}
