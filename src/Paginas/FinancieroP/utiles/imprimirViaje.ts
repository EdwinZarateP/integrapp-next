/**
 * Impresión de viajes: formato de SOLICITUD (firmas progresivas) y
 * PRESUPUESTO DE VIAJE (matriz día × concepto). Puerto TS de vjPrint /
 * vjPrintSolicitud / vjFirmasHTML de views-viajes.js.
 */
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import type { Viaje } from '@/Funciones/ApiPedidos/financiero';
import { CONCEPTOS, DiaPresupuesto, otrosDia, totalDia, totalGrupo, totalOtros, totalPresupuesto } from './viajes/presupuesto';
import { fmtDia } from './viajes/festivos';

const m = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v) || 0).toLocaleString('es-CO');

const f = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10).split('-').reverse().join('/') : '');

const fdt = (s: string | null | undefined) => {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface FirmaData { nombre?: string | null; fecha?: string | null }

function firmasHTML(veCategoria: boolean, bloques: [string, FirmaData | null, string][]): string {
  const bloque = (rol: string, d: FirmaData | null, pendiente: string) => `
    <div><div class="sg">${d?.nombre ? esc(d.nombre) : `<span class="pd">${esc(pendiente)}</span>`}</div>
    <div class="rl">${rol}</div><div class="nm">${d?.nombre ? esc(d.nombre) : ''}</div>
    <div class="fh">${d?.nombre && d.fecha ? 'Firmado electrónicamente · ' + fdt(d.fecha) : ''}</div></div>`;
  return `<div class="fr">${bloques.map(([rol, d, pend]) => bloque(rol, d, pend)).join('')}</div>`;
}

const FIRMA_CSS = `.fr{display:flex;gap:14px;margin-top:46px}.fr>div{flex:1;text-align:center}
.fr .sg{height:56px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #000;padding-bottom:3px;font-family:'Brush Script MT',cursive;font-size:27px;color:#0b2a6b}
.fr .rl{font-weight:bold;font-size:10.5px;margin-top:4px}.fr .nm{font-size:10px}.fr .fh{font-size:9px;color:#555}
.fr .pd{font-family:Arial,sans-serif;font-size:10px;color:#999;font-style:italic}`;

function abrir(titulo: string, cuerpo: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana emergente. Permítelas para poder imprimir.');
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}h1{font-size:16px;margin:0 0 2px}
  table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #999;padding:3px 5px}
  .n{text-align:right;white-space:nowrap}.b{font-weight:bold}.k td{border:none;padding:2px 8px 2px 0}
  .tot{font-size:13px;font-weight:bold;margin-top:10px;text-align:right}.ch{background:#fdecec}
  @media print{button{display:none}}${FIRMA_CSS}</style></head><body>
  <button onclick="print()" style="padding:7px 16px;font-weight:700;cursor:pointer">Imprimir / guardar PDF</button>
  ${cuerpo}</body></html>`);
  w.document.close();
}

/** Formato de solicitud (aún sin presupuesto) con las firmas que ya existen. */
export function imprimirSolicitudViaje(v: Viaje): void {
  const tq = (v.tiquetes_detalle ?? {}) as Record<string, unknown>;
  const an = (v.anticipo_detalle ?? {}) as Record<string, unknown>;
  const firmas = v.firmas ?? { solicito: null, autorizo: null, controller: null };
  abrir(`Solicitud de viaje ${v.consecutivo}`, `
  <h1>SOLICITUD DE VIAJE · ${esc(v.consecutivo)}</h1><div>${esc(v.estado)}</div>
  <table><tr><td><b>Viajero</b></td><td>${esc(v.viajero_nombre)}</td><td><b>Cargo</b></td><td>${esc(v.viajero_cargo ?? '')}</td></tr>
  <tr><td><b>Origen → Destino</b></td><td>${esc(v.origen)} → ${esc(v.destino)}</td><td><b>Salida / Regreso</b></td><td>${f(v.fecha_inicio)} → ${f(v.fecha_fin)}</td></tr>
  <tr><td><b>Objetivo</b></td><td colspan="3">${esc(v.objetivo)}</td></tr>
  ${v.observaciones ? `<tr><td><b>Observaciones</b></td><td colspan="3">${esc(v.observaciones)}</td></tr>` : ''}</table>
  <p style="margin-top:14px;color:#666">El presupuesto lo genera el Controller después de la autorización; este formato se actualiza con cada firma (Controller, Compras y Anticipo).</p>
  ${firmasHTML(false, [
    ['SOLICITÓ', firmas.solicito, 'Pendiente'],
    ['AUTORIZÓ', firmas.autorizo ?? null, v.estado === 'RECHAZADO' ? 'Rechazado' : 'Pendiente'],
    ['CONTROLLER', firmas.controller ?? null, 'Pendiente'],
    ['COMPRAS (TIQUETES)', tq.por ? { nombre: String(tq.por), fecha: (tq.at as string) ?? null } : null, 'Pendiente'],
    ['ANTICIPO', an.por ? { nombre: String(an.por), fecha: (an.at as string) ?? null } : null, 'Pendiente'],
  ])}`);
}

/** Presupuesto de viáticos completo (matriz día × concepto + otros gastos). */
export function imprimirPresupuestoViaje(v: Viaje, dias: DiaPresupuesto[], otros: { n?: string; v?: number[] }[]): void {
  const det = (v.presupuesto_detalle ?? {}) as Record<string, unknown>;
  const tq = (v.tiquetes_detalle ?? {}) as Record<string, unknown>;
  const firmas = v.firmas ?? { solicito: null, autorizo: null, controller: null };
  const veCategoria = v.categoria_tarifa != null;

  let g = '';
  const filas = CONCEPTOS.map((c) => {
    const sep = c.g !== g ? `<tr><th colspan="${dias.length + 2}" style="text-align:left;background:#eef1f7">${c.g}</th></tr>` : '';
    g = c.g;
    return `${sep}<tr><td>${esc(c.l)}</td>${dias.map((d) => `<td class="n">${d.v[c.k] ? m(d.v[c.k]) : '-'}</td>`).join('')}<td class="n b">${m(dias.reduce((s, d) => s + (Number(d.v[c.k]) || 0), 0))}</td></tr>`;
  }).join('');

  abrir(`Presupuesto ${v.consecutivo}`, `
  <h1>PRESUPUESTO DE VIAJE · ${esc(v.consecutivo)}</h1><div>Giro de viáticos</div>
  <table class="k"><tr><td><b>Viajero</b></td><td>${esc(v.viajero_nombre)}</td><td><b>Cargo</b></td><td>${esc(v.viajero_cargo ?? '')}</td>
  ${veCategoria ? `<td><b>Categoría</b></td><td>${esc(v.categoria_tarifa)}</td>` : '<td></td><td></td>'}</tr>
  <tr><td><b>Origen → Destino</b></td><td>${esc(v.origen)} → ${esc(v.destino)}</td><td><b>Salida</b></td><td>${f(v.fecha_inicio)}</td><td><b>Regreso</b></td><td>${f(v.fecha_fin)}</td></tr>
  <tr><td><b>Objetivo</b></td><td colspan="5">${esc(v.objetivo)}</td></tr>
  <tr><td><b>Autorizó</b></td><td>${esc(firmas.autorizo?.nombre ?? '')}</td><td><b>Presupuesto</b></td><td colspan="3">${esc(String(det.por ?? ''))} ${det.at ? '· ' + fdt(String(det.at)) : ''}</td></tr></table>
  <table><tr><th>CONCEPTO</th>${dias.map((d) => `<th class="${d.tipo !== 'habil' ? 'ch' : ''}">${fmtDia(d.f)}${d.tipo !== 'habil' ? `<br><small>${d.tipo === 'festivo' ? 'Festivo' : d.tipo === 'sabado' ? 'Sábado' : 'Domingo'}</small>` : ''}</th>`).join('')}<th>TOTAL</th></tr>${filas}
  ${otros.length ? `<tr><th colspan="${dias.length + 2}" style="text-align:left;background:#eef1f7">OTROS GASTOS</th></tr>${otros.map((o) => `<tr><td>${esc(o.n ?? '')}</td>${dias.map((_, i) => `<td class="n">${o.v?.[i] ? m(o.v[i]) : '-'}</td>`).join('')}<td class="n b">${m((o.v ?? []).reduce((a, x) => a + (Number(x) || 0), 0))}</td></tr>`).join('')}` : ''}
  <tr><th>Subtotal diario</th>${dias.map((_, i) => `<th class="n">${m(dias[i] ? totalDia(dias[i]) + otrosDia(otros, i) : 0)}</th>`).join('')}<th class="n">${m(totalPresupuesto(dias, otros))}</th></tr></table>
  <p class="tot">ALIMENTACIÓN ${m(totalGrupo(dias, 'ALIMENTACIÓN'))} · TRANSPORTE ${m(totalGrupo(dias, 'TRANSPORTE'))} · ALOJAMIENTO ${m(totalGrupo(dias, 'ALOJAMIENTO'))}${totalOtros(otros) ? ` · OTROS GASTOS ${m(totalOtros(otros))}` : ''}<br>TOTAL VIÁTICOS ${m(totalPresupuesto(dias, otros))}${tq.valor ? `<br>Tiquetes (Compras) ${m(Number(tq.valor))}` : ''}</p>
  ${det.nota ? `<p>Nota: ${esc(String(det.nota))}</p>` : ''}
  ${firmasHTML(veCategoria, [
    ['SOLICITÓ', firmas.solicito, 'Pendiente'],
    ['AUTORIZÓ', firmas.autorizo ?? null, 'Pendiente'],
    ['CONTROLLER', firmas.controller ?? null, 'Pendiente'],
    ['COMPRAS (TIQUETES)', tq.por ? { nombre: String(tq.por), fecha: (tq.at as string) ?? null } : null, 'Pendiente'],
    ['ANTICIPO', (v.anticipo_detalle as Record<string, unknown> | null)?.por
      ? { nombre: String((v.anticipo_detalle as Record<string, unknown>).por), fecha: (v.anticipo_detalle as Record<string, unknown>).at as string }
      : null, 'Pendiente'],
  ])}`);
}

/** Imprime el presupuesto si existe; si no, la solicitud. */
export function imprimirViaje(v: Viaje, dias: DiaPresupuesto[], otros: { n?: string; v?: number[] }[]): void {
  if (v.total_presupuesto || dias.length) imprimirPresupuestoViaje(v, dias, otros);
  else imprimirSolicitudViaje(v);
}
