/**
 * Exportación Excel de pagos urgentes (16 columnas del original
 * exportPagosExcel en dian.js). Requiere xlsx (ya en package.json).
 */
import * as XLSX from 'xlsx';
import type { PagoUrgente } from '@/Funciones/ApiPedidos/financiero';

const CABECERAS = [
  'Fecha requerida', 'Fecha pago', 'Proveedor', 'NIT', 'NIT pago (giro)', 'Banco',
  'Cuenta', 'Tipo cuenta', 'Área', 'Contabilizada', 'Tipo doc', 'Nº documento',
  'Valor', 'Requerimiento', 'Asunto', 'Estado', 'Solicitó', 'Referencia',
];

export function exportarPagosExcel(pagos: PagoUrgente[]): void {
  const filas = pagos.map((p) => [
    (p.fecha_requerida ?? '').slice(0, 10),
    (p.fecha_pago ?? '').slice(0, 10),
    p.proveedor ?? '',
    p.nit ?? '',
    p.nit_pago ?? '',
    p.banco ?? '',
    p.no_cuenta ?? '',
    p.tipo_cuenta ?? '',
    p.area ?? '',
    p.contabilizada ? 'SÍ' : 'NO',
    p.tipo_doc ?? '',
    p.numero_doc ?? '',
    p.valor,
    p.requerimiento ?? '',
    p.asunto ?? '',
    p.estado,
    p.solicitante_nombre,
    p.referencia ?? '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([CABECERAS, ...filas]);
  ws['!cols'] = [12, 12, 32, 12, 12, 14, 16, 10, 14, 11, 14, 14, 14, 40, 32, 10, 20, 18].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos urgentes');
  XLSX.writeFile(wb, `Pagos_Urgentes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
