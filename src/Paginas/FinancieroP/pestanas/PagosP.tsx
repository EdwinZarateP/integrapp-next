'use client';

/** Pagos urgentes: bandeja de Tesorería (nacen de requisiciones aprobadas
 *  con pago urgente) — pagar con referencia o devolver con motivo. */
import { useState } from 'react';
import { FaMoneyBillWave, FaUndo } from 'react-icons/fa';
import {
  PagoUrgente, UsuarioFin, listarPagos, pagarPagoUrgente, rechazarPagoUrgente,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { pedirNumero, pedirTexto, pedirTextoOpcional } from '../nucleo/dialogos';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const PUEDE_PAGAR = (u: UsuarioFin) => u.rol === 'tesoreria' || u.es_aprobador_pagos || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', RECHAZADO: 'Devuelto' };
const BADGE: Record<string, string> = { PENDIENTE: 'fin-badgeAmb', PAGADO: 'fin-badgeOk', RECHAZADO: 'fin-badgeMal' };
const ESTADOS = ['', 'PENDIENTE', 'PAGADO', 'RECHAZADO'];

export default function PagosP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('PENDIENTE');
  const { datos, cargando, error, recargar } = useFinDatos<PagoUrgente[]>(
    () => listarPagos(estado || undefined), [estado],
  );

  const pagar = async (p: PagoUrgente) => {
    const referencia = await pedirTextoOpcional(
      `Pagar ${p.consecutivo_req}`,
      `Referencia de la transferencia (opcional) · ${p.proveedor ?? ''} · ${pesos(p.valor)}`);
    if (referencia === null) return;
    try {
      await pagarPagoUrgente(p.id, { referencia: referencia || undefined, version: p.version });
      toastFin(`${p.consecutivo_req} pagado`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  const devolver = async (p: PagoUrgente) => {
    const motivo = await pedirTexto(`Devolver ${p.consecutivo_req}`, 'Motivo de la devolución (obligatorio)');
    if (motivo === null) return;
    try {
      await rechazarPagoUrgente(p.id, { motivo, version: p.version });
      toastFin(`${p.consecutivo_req} devuelto`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Pagos urgentes</h2>
        <div className="fin-filtros">
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e ? ETIQUETA[e] : 'Todos'}</option>)}
          </select>
        </div>
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando pagos…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && (
        <div className="fin-vacio">Sin pagos en este estado. Los pagos urgentes nacen cuando una
        requisición con pago urgente es aprobada por la financiera.</div>
      )}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Requisición</th><th>OC</th><th>Solicitó</th><th>Proveedor</th>
                <th className="fin-num">Valor</th><th>Requerido para</th><th>Estado</th><th>Referencia</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((p) => (
                <tr key={p.id}>
                  <td>{p.consecutivo_req}</td>
                  <td>{p.oc_numero ?? '—'}</td>
                  <td>{p.solicitante_nombre}</td>
                  <td className="fin-suave">{p.proveedor ?? '—'}</td>
                  <td className="fin-num">{pesos(p.valor)}</td>
                  <td>{(p.fecha_requerida || '').slice(0, 10)}</td>
                  <td><span className={`fin-badge ${BADGE[p.estado]}`}>{ETIQUETA[p.estado]}</span></td>
                  <td className="fin-suave">
                    {p.referencia ?? (p.motivo_rechazo ? `↩ ${p.motivo_rechazo.slice(0, 40)}` : '—')}
                  </td>
                  <td className="fin-acciones">
                    {p.estado === 'PENDIENTE' && PUEDE_PAGAR(usuario) && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Marcar pagado"
                                onClick={() => pagar(p)}><FaMoneyBillWave /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Devolver"
                                onClick={() => devolver(p)}><FaUndo /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datos && datos.length > 0 && (
        <p className="fin-suave">
          Última actualización: {fechaCorta(new Date().toISOString())} · La bandeja se refresca cada 25 s.
        </p>
      )}
    </div>
  );
}
