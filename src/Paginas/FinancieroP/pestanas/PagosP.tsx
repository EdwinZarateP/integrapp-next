'use client';

/**
 * Pagos urgentes: bandeja de Tesorería con vista día/semana/todos y navegación
 * de fecha, búsqueda, banner de vencidos, chip Contabilizada clicable,
 * reversiones (reabrir/reconsiderar), edición/eliminación, motivos frecuentes
 * de rechazo, Excel 16 columnas y pestaña interna de Cotizaciones/Anticipos.
 * Puerto React de views-pagos.js (2.921 líneas).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  FaMoneyBillWave, FaUndo, FaPlus, FaCheck, FaTimes, FaEllipsisV, FaTrash, FaEdit,
  FaFileExcel, FaBan, FaEnvelope,
} from 'react-icons/fa';
import {
  PagoUrgente, PayloadPagoManual, ResumenPagos, UsuarioFin, crearPagoManual,
  editarPagoUrgente, eliminarPagoUrgente, listarPagos, motivosRechazoPago, pagarPagoUrgente,
  reabrirPagoUrgente, reconsiderarPagoUrgente, rechazarPagoUrgente, toggleContabilizadaPago,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto, pedirTextoOpcional } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';
import QuotesTab from './pagos/QuotesTab';
import { exportarPagosExcel } from './pagos/excelPagos';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_CONTA = (u: UsuarioFin) => u.rol === 'contabilidad' || ES_ADMIN(u);
const PUEDE_PAGAR = (u: UsuarioFin) => u.rol === 'tesoreria' || u.es_aprobador_pagos || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', RECHAZADO: 'Devuelto' };
const BADGE: Record<string, string> = { PENDIENTE: 'fin-badgeAmb', PAGADO: 'fin-badgeOk', RECHAZADO: 'fin-badgeMal' };
const TIPOS_DOC = ['', 'Factura', 'Cotización', 'Cuenta de cobro', 'Anticipo'];

type VistaFecha = 'dia' | 'semana' | 'todos';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function PagosP({ usuario }: { usuario: UsuarioFin }) {
  const [tab, setTab] = useState<'bandeja' | 'quotes'>('bandeja');
  const [vistaFecha, setVistaFecha] = useState<VistaFecha>('todos');
  const [ancla, setAncla] = useState(() => iso(new Date()));
  const [estado, setEstado] = useState('PENDIENTE');
  const [busqueda, setBusqueda] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<PagoUrgente | null>(null);
  const [rechazando, setRechazando] = useState<PagoUrgente | null>(null);
  const [detalle, setDetalle] = useState<PagoUrgente | null>(null);
  const [menuFila, setMenuFila] = useState<string | null>(null);

  const { desde, hasta } = useMemo(() => {
    if (vistaFecha === 'dia') return { desde: ancla, hasta: ancla };
    if (vistaFecha === 'semana') {
      const d = new Date(ancla + 'T12:00:00');
      const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
      return { desde: iso(lunes), hasta: iso(domingo) };
    }
    return { desde: undefined, hasta: undefined };
  }, [vistaFecha, ancla]);

  const { datos, cargando, error, recargar } = useFinDatos<{ pagos: PagoUrgente[]; resumen: ResumenPagos }>(
    () => listarPagos({
      estado: estado || undefined, q: busqueda.trim() || undefined, tipo_doc: tipoDoc || undefined,
      desde, hasta, solo_vencidos: soloVencidos || undefined,
    }), [estado, busqueda, tipoDoc, desde, hasta, soloVencidos],
  );

  const pagos = datos?.pagos ?? [];
  const resumen = datos?.resumen;

  const mover = (dias: number) => {
    const d = new Date(ancla + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    setAncla(iso(d));
  };

  const pagar = async (p: PagoUrgente) => {
    const referencia = await pedirTextoOpcional(
      `Pagar ${p.consecutivo_req ?? p.proveedor}`,
      `Referencia de la transferencia (opcional) · ${p.proveedor ?? ''} · ${pesos(p.valor)}`);
    if (referencia === null) return;
    try {
      await pagarPagoUrgente(p.id, { referencia: referencia || undefined, version: p.version });
      toastFin(`${p.consecutivo_req ?? p.proveedor} pagado`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  const eliminar = async (p: PagoUrgente) => {
    if (!await confirmar('Eliminar pago', 'Acción irreversible de administrador.')) return;
    try {
      await eliminarPagoUrgente(p.id);
      toastFin('Pago eliminado');
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    try { await fn(); toastFin(mensaje); recargar(); }
    catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  if (tab === 'quotes') {
    return (
      <div className="fin-pagina">
        <div className="fin-barra">
          <h2 className="fin-titulo">Pagos urgentes · Cotizaciones y anticipos</h2>
        </div>
        <div className="fin-tabs" style={{ marginBottom: 12 }}>
          <button className="fin-tab" onClick={() => setTab('bandeja')}>← Bandeja de pagos</button>
        </div>
        <QuotesTab usuario={usuario} onPagoCreado={recargar} />
      </div>
    );
  }

  return (
    <div className="fin-pagina" onClick={() => setMenuFila(null)}>
      <div className="fin-barra">
        <h2 className="fin-titulo">Pagos urgentes</h2>
        <div className="fin-filtros">
          {PUEDE_PAGAR(usuario) && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
              <FaPlus /> Pago manual
            </button>
          )}
          <button className="fin-btn fin-btnSecundario" onClick={() => setTab('quotes')}>
            🧾 Cotizaciones y anticipos
          </button>
        </div>
      </div>

      {/* Banner de vencidos */}
      {!!resumen?.vencidos && (
        <div className="fin-pasoCard" style={{ borderColor: '#dc2626', background: '#fef2f2', cursor: 'pointer' }}
             onClick={() => setSoloVencidos(!soloVencidos)}>
          <b style={{ color: '#b91c1c' }}>
            ⚠️ {resumen.vencidos} pago(s) vencido(s) por {pesos(resumen.total_vencido)}
          </b>
          <span className="fin-suave" style={{ marginLeft: 8, fontSize: 12 }}>
            — clic para {soloVencidos ? 'volver a la bandeja completa' : 'ver solo los vencidos'}
          </span>
        </div>
      )}

      {/* KPI de cabecera + vista de fecha */}
      <div className="fin-filtros">
        <div className="fin-tabs" style={{ border: 'none' }}>
          {(['dia', 'semana', 'todos'] as VistaFecha[]).map((v) => (
            <button key={v} className={`fin-tab ${vistaFecha === v ? 'fin-tabActivo' : ''}`}
                    onClick={() => setVistaFecha(v)}>
              {{ dia: 'Día', semana: 'Semana', todos: 'Todos' }[v]}
            </button>
          ))}
        </div>
        {vistaFecha !== 'todos' && (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="fin-btn fin-btnSecundario" onClick={() => mover(vistaFecha === 'dia' ? -1 : -7)}>‹</button>
            <span className="fin-suave" style={{ fontSize: 12 }}>
              {vistaFecha === 'dia' ? ancla : `${desde} → ${hasta}`}
            </span>
            <button className="fin-btn fin-btnSecundario" onClick={() => mover(vistaFecha === 'dia' ? 1 : 7)}>›</button>
            <button className="fin-btn fin-btnSecundario" onClick={() => setAncla(iso(new Date()))}>Hoy</button>
          </span>
        )}
        <input className="fin-input" placeholder="Buscar proveedor, NIT, nº, requerimiento…"
               value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="fin-input" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
          {TIPOS_DOC.map((t) => <option key={t} value={t}>{t || 'Todo tipo doc'}</option>)}
        </select>
        <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          {Object.keys(ETIQUETA).map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
        </select>
        {(busqueda || tipoDoc || soloVencidos || estado) && (
          <button className="fin-btn fin-btnSecundario" onClick={() => {
            setBusqueda(''); setTipoDoc(''); setSoloVencidos(false); setEstado('PENDIENTE');
          }}>Limpiar filtros</button>
        )}
        <button className="fin-btn fin-btnSecundario" onClick={() => exportarPagosExcel(pagos)}>
          <FaFileExcel /> Excel
        </button>
      </div>

      {resumen && (
        <p className="fin-suave" style={{ fontSize: 12 }}>
          {resumen.cantidad} pago(s) en la vista · <b>{resumen.pendientes} pendientes por {pesos(resumen.total_pendiente)}</b>
        </p>
      )}
      {cargando && !datos && <div className="fin-vacio">Cargando pagos…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && pagos.length === 0 && !cargando && (
        <div className="fin-vacio">Sin pagos en este filtro. Los pagos urgentes nacen de requisiciones aprobadas,
          de anticipos internos o se crean manuales.</div>
      )}

      {!!pagos.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Requerido</th><th>Proveedor</th><th>NIT / giro</th><th>Banco / cuenta</th>
                <th>Tipo doc</th><th className="fin-num">Valor</th><th>Contab.</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} style={p.estado === 'PENDIENTE' && p.fecha_requerida && p.fecha_requerida.slice(0, 10) < iso(new Date()) ? { background: '#fef2f2' } : undefined}>
                  <td>
                    {p.consecutivo_req
                      ? <><button className="fin-link" onClick={() => setDetalle(p)}>{p.consecutivo_req}</button><div className="fin-suave" style={{ fontSize: 10 }}>OC {p.oc_numero ?? '—'}</div></>
                      : <button className="fin-link" onClick={() => setDetalle(p)}>{p.origen === 'anticipo' ? 'Anticipo interno' : 'Manual'}</button>}
                    <div className="fin-suave" style={{ fontSize: 10 }}>{(p.fecha_requerida ?? '').slice(0, 10)}</div>
                  </td>
                  <td title={p.asunto ?? ''}>
                    {p.proveedor ?? '—'}
                    {p.area && <div className="fin-suave" style={{ fontSize: 10 }}>{p.area}</div>}
                  </td>
                  <td className="fin-suave">{p.nit ?? '—'}{p.nit_pago && p.nit_pago !== p.nit ? <div style={{ fontSize: 10 }}>giro: {p.nit_pago}</div> : null}</td>
                  <td className="fin-suave">{p.banco ?? '—'}{p.no_cuenta ? ` · ${p.no_cuenta}` : ''}{p.tipo_cuenta ? ` (${p.tipo_cuenta})` : ''}</td>
                  <td className="fin-suave">{p.tipo_doc ?? '—'}{p.numero_doc ? ` ${p.numero_doc}` : ''}</td>
                  <td className="fin-num">{pesos(p.valor)}</td>
                  <td>
                    {ES_CONTA(usuario) && p.estado === 'PENDIENTE' ? (
                      <button className={`fin-badge ${p.contabilizada ? 'fin-badgeOk' : 'fin-badgeMal'}`}
                              style={{ border: 0, cursor: 'pointer' }}
                              title={p.contabilizada ? 'Clic para bloquear el pago' : 'Clic para habilitar el pago'}
                              onClick={() => void accion(() => toggleContabilizadaPago(p.id, p.version), 'Contabilizada conmutada')}>
                        {p.contabilizada ? '✓ Contab.' : '✗ Sin contab.'}
                      </button>
                    ) : <span className={`fin-badge ${p.contabilizada ? 'fin-badgeOk' : 'fin-badgeMal'}`}>{p.contabilizada ? '✓' : '✗'}</span>}
                  </td>
                  <td>
                    <span className={`fin-badge ${BADGE[p.estado]}`}>{ETIQUETA[p.estado]}</span>
                    {p.referencia && <div className="fin-suave" style={{ fontSize: 10 }}>{p.referencia}</div>}
                    {p.motivo_rechazo && <div className="fin-textoMal" style={{ fontSize: 10 }}>↩ {p.motivo_rechazo.slice(0, 30)}</div>}
                  </td>
                  <td className="fin-acciones">
                    {p.estado === 'PENDIENTE' && PUEDE_PAGAR(usuario) && p.contabilizada && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Marcar pagado" onClick={() => void pagar(p)}><FaMoneyBillWave /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Devolver" onClick={() => setRechazando(p)}><FaUndo /></button>
                      </>
                    )}
                    <span style={{ position: 'relative' }}>
                      <button className="fin-btnIcono fin-icoGris" title="Más opciones"
                              onClick={(e) => { e.stopPropagation(); setMenuFila(menuFila === p.id ? null : p.id); }}><FaEllipsisV /></button>
                      {menuFila === p.id && (
                        <div className="fin-menuFila" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setMenuFila(null); setDetalle(p); }}>🔍 Ver detalle</button>
                          {p.requerimiento && (
                            <button onClick={() => { setMenuFila(null); void navigator.clipboard?.writeText(p.requerimiento!); toastFin('Requerimiento copiado'); }}>
                              📋 Copiar requerimiento
                            </button>
                          )}
                          {p.asunto && (
                            <button onClick={() => { setMenuFila(null); void navigator.clipboard?.writeText(p.asunto!); toastFin('Asunto copiado'); }}>
                              📋 Copiar asunto
                            </button>
                          )}
                          {PUEDE_PAGAR(usuario) && (
                            <button onClick={() => { setMenuFila(null); setEditar(p); }}><FaEdit /> Editar</button>
                          )}
                          {p.estado === 'PAGADO' && PUEDE_PAGAR(usuario) && (
                            <button onClick={() => { setMenuFila(null); void accion(() => reabrirPagoUrgente(p.id, p.version), 'Pago reabierto'); }}>
                              <FaUndo /> Reabrir
                            </button>
                          )}
                          {p.estado === 'RECHAZADO' && PUEDE_PAGAR(usuario) && (
                            <button onClick={() => { setMenuFila(null); void accion(() => reconsiderarPagoUrgente(p.id, p.version), 'Pago reconsiderado'); }}>
                              <FaCheck /> Reconsiderar
                            </button>
                          )}
                          {ES_ADMIN(usuario) && (
                            <button className="fin-textoMal" onClick={() => { setMenuFila(null); void eliminar(p); }}>
                              <FaTrash /> Eliminar (admin)
                            </button>
                          )}
                        </div>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modalNuevo || editar) && (
        <ModalPagoForm pago={editar} onCerrar={() => { setModalNuevo(false); setEditar(null); }}
                       onListo={() => { setModalNuevo(false); setEditar(null); recargar(); }} />
      )}
      {rechazando && (
        <ModalRechazo pago={rechazando} onCerrar={() => setRechazando(null)}
                      onListo={() => { setRechazando(null); recargar(); }} />
      )}
      {detalle && (
        <ModalPagoDetalle pago={detalle} onCerrar={() => setDetalle(null)} />
      )}
    </div>
  );
}

// ── Modal: pago manual / edición ───────────────────────────────────────────

function ModalPagoForm({ pago, onCerrar, onListo }: {
  pago: PagoUrgente | null; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState<PayloadPagoManual>({
    proveedor: pago?.proveedor ?? '', nit: pago?.nit ?? '', nit_pago: pago?.nit_pago ?? '',
    banco: pago?.banco ?? '', no_cuenta: pago?.no_cuenta ?? '', tipo_cuenta: pago?.tipo_cuenta ?? '',
    area: pago?.area ?? '', tipo_doc: pago?.tipo_doc ?? 'Cuenta de cobro',
    numero_doc: pago?.numero_doc ?? '',
    valor: pago?.valor ?? 0,
    fecha_requerida: (pago?.fecha_requerida ?? new Date().toISOString()).slice(0, 10),
    requerimiento: pago?.requerimiento ?? '', asunto: pago?.asunto ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  return (
    <ModalFin titulo={pago ? 'Editar pago' : 'Pago manual'} onCerrar={onCerrar} ancho={720}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Proveedor *">
          <input className="fin-input" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
        </Campo>
        <Campo etiqueta="NIT (autocompleta banco/cuenta del catálogo)">
          <input className="fin-input" value={form.nit ?? ''} onChange={(e) => setForm({ ...form, nit: e.target.value, nit_pago: e.target.value })} />
        </Campo>
        <Campo etiqueta="NIT de pago (giro) si difiere">
          <input className="fin-input" value={form.nit_pago ?? ''} onChange={(e) => setForm({ ...form, nit_pago: e.target.value })} />
        </Campo>
        <Campo etiqueta="Banco">
          <input className="fin-input" value={form.banco ?? ''} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
        </Campo>
        <Campo etiqueta="Nº cuenta">
          <input className="fin-input" value={form.no_cuenta ?? ''} onChange={(e) => setForm({ ...form, no_cuenta: e.target.value })} />
        </Campo>
        <Campo etiqueta="Tipo de cuenta">
          <input className="fin-input" value={form.tipo_cuenta ?? ''} onChange={(e) => setForm({ ...form, tipo_cuenta: e.target.value })} />
        </Campo>
        <Campo etiqueta="Área">
          <input className="fin-input" value={form.area ?? ''} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </Campo>
        <Campo etiqueta="Tipo de documento">
          <select className="fin-input" value={form.tipo_doc}
                  onChange={(e) => setForm({ ...form, tipo_doc: e.target.value })}>
            {TIPOS_DOC.slice(1).map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Nº documento">
          <input className="fin-input" value={form.numero_doc ?? ''} onChange={(e) => setForm({ ...form, numero_doc: e.target.value })} />
        </Campo>
        <Campo etiqueta="Valor *">
          <input className="fin-input fin-num" type="number" min={0} value={form.valor || ''}
                 onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
        </Campo>
        <Campo etiqueta="Requerido para *">
          <input type="date" className="fin-input" value={form.fecha_requerida}
                 onChange={(e) => setForm({ ...form, fecha_requerida: e.target.value })} />
        </Campo>
      </div>
      <Campo etiqueta="Requerimiento (texto copiable)">
        <input className="fin-input" value={form.requerimiento ?? ''} onChange={(e) => setForm({ ...form, requerimiento: e.target.value })} />
      </Campo>
      <Campo etiqueta="Asunto (texto copiable)">
        <input className="fin-input" value={form.asunto ?? ''} onChange={(e) => setForm({ ...form, asunto: e.target.value })} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          if (!form.proveedor.trim() || !(form.valor > 0) || !form.fecha_requerida) {
            setError('Proveedor, valor y fecha son obligatorios.');
            return;
          }
          setGuardando(true);
          const payload = { ...form, fecha_requerida: `${form.fecha_requerida}T12:00:00` };
          (pago ? editarPagoUrgente(pago.id, payload) : crearPagoManual(payload))
            .then(() => { toastFin(pago ? 'Pago editado' : 'Pago creado'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>{guardando ? 'Guardando…' : pago ? 'Guardar' : 'Crear pago'}</button>
      </div>
    </ModalFin>
  );
}

// ── Modal: rechazo con motivos frecuentes ──────────────────────────────────

function ModalRechazo({ pago, onCerrar, onListo }: {
  pago: PagoUrgente; onCerrar: () => void; onListo: () => void;
}) {
  const [motivos, setMotivos] = useState<string[] | null>(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { motivosRechazoPago().then((r) => setMotivos(r.motivos)).catch(() => setMotivos([])); }, []);
  return (
    <ModalFin titulo={`Devolver pago · ${pago.consecutivo_req ?? pago.proveedor}`} onCerrar={onCerrar} ancho={620}>
      <div className="fin-pasoCard">
        <b>{pago.proveedor}</b> · {pesos(pago.valor)} · NIT {pago.nit ?? '—'} · {pago.banco ?? '—'} {pago.no_cuenta ?? ''}
      </div>
      <Campo etiqueta="Motivo del rechazo *">
        <select className="fin-input" value={motivos?.includes(motivo) ? motivo : (motivo ? 'otro' : '')}
                onChange={(e) => setMotivo(e.target.value === 'otro' ? '' : e.target.value)}>
          <option value="">— Selecciona o escribe —</option>
          {(motivos ?? []).map((m) => <option key={m}>{m}</option>)}
          <option value="otro">Otro (escribir)…</option>
        </select>
        <input className="fin-input" style={{ marginTop: 6 }} value={motivo}
               placeholder="Motivo de la devolución" onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnMal" disabled={guardando || !motivo.trim()} onClick={() => {
          setGuardando(true);
          rechazarPagoUrgente(pago.id, { motivo, version: pago.version })
            .then(() => { toastFin('Pago devuelto'); onListo(); })
            .catch((e) => toastFin(e instanceof Error ? e.message : 'Error', 'mal'))
            .finally(() => setGuardando(false));
        }}>Devolver</button>
      </div>
    </ModalFin>
  );
}

// ── Modal: detalle ─────────────────────────────────────────────────────────

function ModalPagoDetalle({ pago, onCerrar }: { pago: PagoUrgente; onCerrar: () => void }) {
  const p = pago;
  return (
    <ModalFin titulo={`Pago · ${p.consecutivo_req ?? p.proveedor}`} onCerrar={onCerrar} ancho={760}>
      <div className="fin-grid">
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[p.estado]}`}>{ETIQUETA[p.estado]}</span></Campo>
        <Campo etiqueta="Proveedor">{p.proveedor}</Campo>
        <Campo etiqueta="NIT / giro">{p.nit ?? '—'}{p.nit_pago && p.nit_pago !== p.nit ? ` → ${p.nit_pago}` : ''}</Campo>
        <Campo etiqueta="Banco / cuenta">{p.banco ?? '—'} {p.no_cuenta ?? ''} {p.tipo_cuenta ? `(${p.tipo_cuenta})` : ''}</Campo>
        <Campo etiqueta="Valor">{pesos(p.valor)}</Campo>
        <Campo etiqueta="Requerido para">{(p.fecha_requerida ?? '').slice(0, 10)}</Campo>
        {p.fecha_pago && <Campo etiqueta="Pagado">{fechaCorta(p.fecha_pago)} · ref {p.referencia ?? '—'}</Campo>}
        {p.motivo_rechazo && <Campo etiqueta="Motivo de devolución"><span className="fin-textoMal">{p.motivo_rechazo}</span></Campo>}
        <Campo etiqueta="Requerimiento">{p.requerimiento ?? '—'}</Campo>
        <Campo etiqueta="Asunto">{p.asunto ?? '—'}</Campo>
      </div>
      <AdjuntosFin modulo="pago" referencia={p.id} />
      <h4 className="fin-subtitulo">Historial ({p.historial_cambios.length})</h4>
      <div className="fin-historial">
        {p.historial_cambios.map((h, i) => (
          <div key={i} className="fin-evento">
            <span className="fin-eventoFecha">{fechaCorta(h.fecha)}</span>
            <span className="fin-eventoAccion">{h.accion}</span>
            <span><b>{h.usuario}</b>{h.observacion ? ` — ${h.observacion}` : ''}</span>
          </div>
        ))}
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
