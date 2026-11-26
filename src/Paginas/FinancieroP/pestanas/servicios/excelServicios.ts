/**
 * Exportación Excel de servicios públicos con secciones por categoría y
 * subtotales (puerto de exportarServiciosExcel del original).
 */
import * as XLSX from 'xlsx';
import type { ServicioPublicoFin } from '@/Funciones/ApiPedidos/financiero';
import { CATEGORIAS_INFO, ESTADOS_CAUSADO } from './utilidades';

const CABECERAS = [
  'Servicio', 'Inmueble', 'Categoría', 'Contrato', 'NIT tercero', 'Tercero',
  'Día corte', 'Valor', 'Fecha límite', 'Estado', 'Fecha pago', 'URL pago',
];

export function exportarServiciosExcel(servicios: ServicioPublicoFin[]): void {
  const aoa: (string | number)[][] = [CABECERAS];
  let granTotal = 0;
  for (const cat of CATEGORIAS_INFO) {
    const delGrupo = servicios.filter((s) => (s.categoria ?? 'publicos') === cat.clave);
    if (!delGrupo.length) continue;
    aoa.push([`── ${cat.etiqueta.toUpperCase()} ──`]);
    for (const s of delGrupo) {
      aoa.push([
        s.servicio, s.inmueble, cat.etiqueta, s.contrato ?? '', s.nit_tercero ?? '',
        s.tercero ?? '', s.fecha_exp ?? '', Number(s.valor) || 0, s.fecha_limite ?? '',
        ESTADOS_CAUSADO.find((e) => e.clave === s.estado)?.etiqueta ?? s.estado,
        s.fecha_pago ?? '', s.url_pago ?? '',
      ]);
      granTotal += Number(s.valor) || 0;
    }
    const subtotal = delGrupo.reduce((t, s) => t + (Number(s.valor) || 0), 0);
    aoa.push(['', '', '', '', '', '', '', 'Subtotal', subtotal]);
    aoa.push([]);
  }
  aoa.push(['', '', '', '', '', '', '', 'TOTAL', granTotal]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [22, 24, 14, 16, 12, 28, 14, 14, 12, 22, 12, 30].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
  XLSX.writeFile(wb, `Servicios_Publicos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
