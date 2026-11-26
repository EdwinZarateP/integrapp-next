'use client';

/**
 * Viajes y anticipos: bandeja con vistas (mías / por gestionar / todos),
 * búsqueda, columna «pendiente de» derivada de la máquina serializada
 * (Autoriza → Controller: presupuesto → Compras: tiquetes → Anticipo),
 * menú ⋮ con impresiones y detalle con timeline de 4 pasos. Puerto React de
 * views-viajes.js (1.135 líneas) sobre la API /fin/viajes.
 */
import { useMemo, useState } from 'react';
import {
  FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaUndo, FaPrint, FaEllipsisV, FaTrash, FaPlane, FaMoneyBillWave, FaCog,
} from 'react-icons/fa';
import {
  UsuarioFin, Viaje, eliminarViajeAdmin, listarViajes, transicionViaje,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';
import ModalViajeForm from './viajes/ModalViajeForm';
import ModalTiquetes from './viajes/ModalTiquetes';
import ModalAnticipo from './viajes/ModalAnticipo';
import ModalPresupuesto from './viajes/ModalPresupuesto';
import ModalTarifas from './viajes/ModalTarifas';
import { imprimirViaje } from '../utiles/imprimirViaje';
import { DiaPresupuesto, totalGrupo, totalOtros, totalPresupuesto } from '../utiles/viajes/presupuesto';
import { listaDias, tipoDia } from '../utiles/viajes/festivos';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_CONTROLLER = (u: UsuarioFin) => ['controller', 'gerente_financiero'].includes(u.rol) || ES_ADMIN(u);
const ES_COMPRAS = (u: UsuarioFin) => u.rol === 'compras' || ES_ADMIN(u);
const ES_TESORERIA = (u: UsuarioFin) => u.rol === 'tesoreria' || u.es_aprobador_pagos || ES_ADMIN(u);
const ES_CONTA = (u: UsuarioFin) => ['contabilidad', 'controller', 'tesoreria'].includes(u.rol) || ES_ADMIN(u);
const ES_AUTORIZADOR = (u: UsuarioFin) =>
  ['controller', 'gerente_financiero', 'presidencia', 'autorizador_viajes', 'admin'].includes(u.rol)
  || u.es_autorizador_viajes || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = {
  SOLICITADO: 'Solicitado', AUTORIZADO: 'Autorizado', RECHAZADO: 'Rechazado',
  PRESUPUESTO_ASIGNADO: 'Presupuesto', TIQUETES_GESTIONADOS: 'Tiquetes',
  ANTICIPO_PAGADO: 'Anticipo pagado', LEGALIZADO: 'Legalizado',
  CERRADO: 'Cerrado', ANULADO: 'Anulado', BORRADOR: 'Borrador',
};
const ESTADOS = ['', ...Object.keys(ETIQUETA)];
const BADGE: Record<string, string> = {
  SOLICITADO: 'fin-badgeAmb', AUTORIZADO: 'fin-badgeInfo', PRESUPUESTO_ASIGNADO: 'fin-badgeInfo',
  TIQUETES_GESTIONADOS: 'fin-badgeAmb', ANTICIPO_PAGADO: 'fin-badgeOk',
  LEGALIZADO: 'fin-badgeOk', CERRADO: 'fin-badgeGris', RECHAZADO: 'fin-badgeMal', ANULADO: 'fin-badgeMal',
};

type Vista = 'mias' | 'turno' | 'todas';

function BadgeEstadoViaje({ estado }: { estado: string }) {
  return <span className={`fin-badge ${BADGE[estado] ?? 'fin-badgeGris'}`}>{ETIQUETA[estado] ?? estado}</span>;
}

/** Turno del usuario sobre el viaje, derivado del estado serializado + rol. */
function turnoDe(v: Viaje, u: UsuarioFin): string {
  if (v.estado === 'SOLICITADO' && (ES_AUTORIZADOR(u) || v.autorizador_id === u.id)) return 'Autorizar';
  if (v.estado === 'AUTORIZADO' && ES_CONTROLLER(u)) return 'Generar presupuesto';
  if (v.estado === 'PRESUPUESTO_ASIGNADO' && ES_COMPRAS(u) && v.requiere_tiquetes) return 'Comprar tiquetes';
  if (v.estado === 'TIQUETES_GESTIONADOS' && ES_TESORERIA(u)) return 'Gestionar anticipo';
  return '';
}

/** «Pendiente de» que se muestra bajo el estado en la fila. */
function pendienteDe(v: Viaje): string {
  switch (v.estado) {
    case 'SOLICITADO': return 'Pendiente de autorización';
    case 'AUTORIZADO': return 'Controller: presupuesto';
    case 'PRESUPUESTO_ASIGNADO': return 'Compras: tiquetes';
    case 'TIQUETES_GESTIONADOS': return 'Anticipo: Tesorería';
    default: return '';
  }
}

export default function ViajesP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const [vista, setVista] = useState<Vista>('mias');
  const [busqueda, setBusqueda] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<Viaje[]>(
    () => listarViajes(estado || undefined), [estado],
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<Viaje | null>(null);
  const [detalle, setDetalle] = useState<Viaje | null>(null);
  const [tarifas, setTarifas] = useState(false);
  const [menuFila, setMenuFila] = useState<string | null>(null);

  const mias = (datos ?? []).filter((v) => v.solicitante_id === usuario.id);
  const enTurno = (datos ?? []).filter((v) => turnoDe(v, usuario));

  const filtradas = useMemo(() => {
    let base = datos ?? [];
    if (vista === 'mias') base = mias;
    else if (vista === 'turno') base = enTurno;
    const q = busqueda.trim().toLowerCase();
    if (q) {
      base = base.filter((v) => [v.consecutivo, v.viajero_nombre, v.origen, v.destino, v.objetivo, v.solicitante_nombre]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    return base;
  }, [datos, vista, busqueda, usuario]);

  const accion = async (v: Viaje, acc: string, recargarFn: () => void, datosAdicionales?: Record<string, unknown>) => {
    let observacion = '';
    if (acc === 'RECHAZAR') {
      const motivo = await pedirTexto(`Rechazar ${v.consecutivo}`, 'Motivo del rechazo (obligatorio)');
      if (motivo === null) return;
      observacion = motivo;
    } else if (acc !== 'AUTORIZAR' && !(await confirmar(`${acc.replace('_', ' ')} · ${v.consecutivo}`))) {
      return;
    }
    try {
      const r = await transicionViaje(v.id, { accion: acc, observacion, version: v.version, datos_adicionales: datosAdicionales });
      toastFin(`${v.consecutivo}: ${ETIQUETA[r.estado] ?? r.estado}`);
      recargarFn();
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  const eliminar = async (v: Viaje) => {
    if (!await confirmar(`Eliminar ${v.consecutivo}`, 'Acción irreversible de administrador. Queda con snapshot en la bitácora.')) return;
    const motivo = await pedirTexto(`Eliminar ${v.consecutivo}`, 'Motivo (mínimo 5 caracteres)');
    if (!motivo) return;
    try {
      await eliminarViajeAdmin(v.id, motivo);
      toastFin(`${v.consecutivo} eliminado`);
      recargar();
      setDetalle(null);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <div className="fin-pagina" onClick={() => setMenuFila(null)}>
      <div className="fin-barra">
        <h2 className="fin-titulo">Viajes y anticipos</h2>
        <div className="fin-filtros">
          <input className="fin-input" placeholder="Buscar nº, viajero, destino…"
                 value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e ? ETIQUETA[e] : 'Todos los estados'}</option>)}
          </select>
          {ES_ADMIN(usuario) && (
            <button className="fin-btn fin-btnSecundario" onClick={() => setTarifas(true)}>
              <FaCog /> Tarifas y autorizadores
            </button>
          )}
          <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
            <FaPlus /> Solicitar viaje
          </button>
        </div>
      </div>

      <div className="fin-tabs">
        {([
          ['mias', 'Mis viajes', mias.length],
          ['turno', 'Por gestionar', enTurno.length],
          ['todas', 'Todos', (datos ?? []).length],
        ] as [Vista, string, number][]).map(([v, etiqueta, n]) => (
          <button key={v} className={`fin-tab ${vista === v ? 'fin-tabActivo' : ''}`} onClick={() => setVista(v)}>
            {etiqueta} <span className="fin-badge fin-badgeGris">{n}</span>
          </button>
        ))}
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando viajes…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && filtradas.length === 0 && !cargando && <div className="fin-vacio">No hay viajes en este filtro.</div>}

      {!!filtradas.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>Viajero</th><th>Ruta</th><th>Fechas</th>
                <th className="fin-num">Presupuesto</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((v) => {
                const turno = turnoDe(v, usuario);
                return (
                  <tr key={v.id} className={`fin-fila fin-filaV-${v.estado}`}>
                    <td><button className="fin-link" onClick={() => setDetalle(v)}>{v.consecutivo}</button></td>
                    <td><b>{v.viajero_nombre}</b>
                      {v.categoria_tarifa && <div className="fin-suave" style={{ fontSize: 11 }}>Cat. {v.categoria_tarifa}</div>}
                    </td>
                    <td>{v.origen} → {v.destino}</td>
                    <td>{(v.fecha_inicio || '').slice(0, 10)}<div className="fin-suave" style={{ fontSize: 11 }}>→ {(v.fecha_fin || '').slice(0, 10)}</div></td>
                    <td className="fin-num">{v.total_presupuesto ? pesos(v.total_presupuesto) : '—'}</td>
                    <td>
                      <BadgeEstadoViaje estado={v.estado} />
                      {pendienteDe(v) && <div className="fin-suave" style={{ fontSize: 11 }}>{pendienteDe(v)}</div>}
                    </td>
                    <td className="fin-acciones">
                      {turno && <span className="fin-badge fin-badgeAmb">{turno}</span>}
                      {v.estado === 'SOLICITADO' && ES_AUTORIZADOR(usuario) && (
                        <>
                          <button className="fin-btnIcono fin-icoOk" title="Autorizar"
                                  onClick={() => void accion(v, 'AUTORIZAR', recargar)}><FaCheck /></button>
                          <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                  onClick={() => void accion(v, 'RECHAZAR', recargar)}><FaTimes /></button>
                        </>
                      )}
                      {(v.estado === 'SOLICITADO' || v.estado === 'RECHAZADO') && v.solicitante_id === usuario.id && (
                        v.estado === 'RECHAZADO'
                          ? <button className="fin-btnIcono fin-icoAzul" title="Corregir y reenviar"
                                    onClick={() => setEditar(v)}><FaUndo /></button>
                          : <button className="fin-btnIcono fin-icoGris" title="Anular"
                                    onClick={() => void accion(v, 'ANULAR', recargar)}><FaBan /></button>
                      )}
                      <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => setDetalle(v)}><FaEye /></button>
                      <span style={{ position: 'relative' }}>
                        <button className="fin-btnIcono fin-icoGris" title="Más opciones"
                                onClick={(e) => { e.stopPropagation(); setMenuFila(menuFila === v.id ? null : v.id); }}>
                          <FaEllipsisV />
                        </button>
                        {menuFila === v.id && (
                          <div className="fin-menuFila" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setMenuFila(null); setDetalle(v); }}><FaEye /> Ver detalle del viaje</button>
                            <button onClick={() => { setMenuFila(null); imprimirViaje(v, diasDe(v), otrosDe(v)); }}>
                              <FaPrint /> {v.total_presupuesto ? 'Imprimir presupuesto' : 'Imprimir formato'}
                            </button>
                            {ES_ADMIN(usuario) && (
                              <button className="fin-textoMal" onClick={() => { setMenuFila(null); void eliminar(v); }}>
                                <FaTrash /> Eliminar (admin)
                              </button>
                            )}
                          </div>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(modalNuevo || editar) && (
        <ModalViajeForm usuario={usuario} editar={editar}
                        onCerrar={() => { setModalNuevo(false); setEditar(null); }}
                        onListo={() => { setModalNuevo(false); setEditar(null); recargar(); }} />
      )}
      {tarifas && <ModalTarifas onCerrar={() => setTarifas(false)} />}
      {detalle && (
        <ModalViajeDetalle viaje={detalle} usuario={usuario}
                           onCerrar={() => setDetalle(null)}
                           onCorregir={(v) => { setDetalle(null); setEditar(v); }}
                           onCambio={() => { recargar(); setDetalle(null); }}
                           onEliminar={() => void eliminar(detalle)} />
      )}
    </div>
  );
}

/** items del presupuesto → DiasPresupuesto (para resumen e impresión). */
function diasDe(v: Viaje): DiaPresupuesto[] {
  return (v.presupuesto_items ?? []) as unknown as DiaPresupuesto[];
}

/** otros gastos del detalle → array para resumen e impresión. */
function otrosDe(v: Viaje): { n?: string; v?: number[] }[] {
  const det = (v.presupuesto_detalle ?? {}) as Record<string, unknown>;
  return (det.otros as { n?: string; v?: number[] }[]) ?? [];
}

// ── Modal: detalle con timeline de 4 pasos ─────────────────────────────────

function ModalViajeDetalle({ viaje, usuario, onCerrar, onCambio, onCorregir, onEliminar }: {
  viaje: Viaje; usuario: UsuarioFin; onCerrar: () => void; onCambio: () => void;
  onCorregir: (v: Viaje) => void; onEliminar: () => void;
}) {
  const v = viaje;
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'tiquetes' | 'anticipo' | 'presupuesto' | null>(null);

  const esSolicitante = v.solicitante_id === usuario.id;
  const veCategoria = ES_CONTROLLER(usuario) || ES_AUTORIZADOR(usuario) || v.autorizador_id === usuario.id;
  const dias = listaDias((v.fecha_inicio || '').slice(0, 10), (v.fecha_fin || '').slice(0, 10));
  const especiales = dias.filter((d) => tipoDia(d).tipo !== 'habil').length;
  const diasPpto = diasDe(v);
  const otros = otrosDe(v);
  const det = (v.presupuesto_detalle ?? {}) as Record<string, unknown>;
  const tq = (v.tiquetes_detalle ?? {}) as Record<string, unknown>;
  const an = (v.anticipo_detalle ?? {}) as Record<string, unknown>;
  const anticipoCambio = Boolean(an.valorPpto && Number(an.valorPpto) !== Number(v.total_presupuesto));

  const pasos = [
    { t: '1. Autorización', ok: v.estado !== 'SOLICITADO' && v.fecha_autorizacion != null,
      s: v.estado === 'RECHAZADO' ? 'Rechazado' : (v.fecha_autorizacion ? fechaCorta(v.fecha_autorizacion) : 'Pendiente') },
    { t: '2. Presupuesto (Controller)', ok: diasPpto.length > 0 || v.total_presupuesto > 0,
      s: v.total_presupuesto ? `${pesos(v.total_presupuesto)}${det.por ? ` · ${det.por}` : ''}` : 'Pendiente' },
    { t: '3. Tiquetes (Compras)', ok: Boolean(tq.hecho),
      s: tq.hecho ? (tq.no_aplica || tq.noAplica ? 'No requiere tiquetes' : `${pesos(Number(tq.valor) || 0)}`) : (v.requiere_tiquetes ? 'Por comprar' : 'No requiere') },
    { t: '4. Anticipo (Tesorería)', ok: v.estado === 'ANTICIPO_PAGADO' || v.estado === 'LEGALIZADO' || v.estado === 'CERRADO' || Boolean(an.hecho),
      s: an.hecho ? `${pesos(Number(an.valor) || 0)}${an.por ? ` · ${an.por}` : ''}` : (tq.hecho ? 'Por gestionar el pago' : 'Espera los tiquetes') },
  ];

  const puedeAnular = !['CERRADO', 'ANULADO', 'RECHAZADO'].includes(v.estado) && (ES_ADMIN(usuario) || (esSolicitante && v.estado === 'SOLICITADO'));
  const puedeCorregir = esSolicitante && v.estado === 'RECHAZADO';
  const puedeTiquetes = ES_COMPRAS(usuario) && (v.estado === 'PRESUPUESTO_ASIGNADO' || (v.requiere_tiquetes && ['TIQUETES_GESTIONADOS', 'ANTICIPO_PAGADO'].includes(v.estado)));
  const puedeAnticipo = ES_TESORERIA(usuario) && (v.estado === 'TIQUETES_GESTIONADOS' || ['ANTICIPO_PAGADO', 'LEGALIZADO'].includes(v.estado));
  const puedePpto = ES_CONTROLLER(usuario) && (v.estado === 'AUTORIZADO' || ['PRESUPUESTO_ASIGNADO', 'TIQUETES_GESTIONADOS', 'ANTICIPO_PAGADO'].includes(v.estado));
  const puedeLegalizar = v.estado === 'ANTICIPO_PAGADO'
    && (esSolicitante || ['contabilidad', 'tesoreria'].includes(usuario.rol) || ES_ADMIN(usuario));
  const puedeCerrar = v.estado === 'LEGALIZADO' && ES_CONTA(usuario);

  const accionSimple = async (acc: string, datos?: Record<string, unknown>) => {
    try {
      const r = await transicionViaje(v.id, { accion: acc, version: v.version, datos_adicionales: datos });
      toastFin(`${v.consecutivo}: ${ETIQUETA[r.estado] ?? r.estado}`);
      onCambio();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };

  return (
    <ModalFin titulo={`Viaje ${v.consecutivo}`} onCerrar={onCerrar} ancho={900}>
      {error && <div className="fin-error">{error}</div>}

      {/* Timeline de pasos */}
      {v.estado !== 'RECHAZADO' && v.estado !== 'ANULADO' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {pasos.map((p) => (
            <div key={p.t} className="fin-pasoCard" style={{
              flex: '1 1 180px',
              borderColor: p.ok ? '#16a34a' : undefined,
              background: p.ok ? '#f0fdf4' : undefined,
            }}>
              <b style={{ fontSize: 12 }}>{p.ok ? '✅' : '⏳'} {p.t}</b>
              <div className="fin-suave" style={{ fontSize: 11 }}>{p.s}</div>
            </div>
          ))}
        </div>
      )}
      {v.estado === 'RECHAZADO' && Boolean(v.observacion_autorizacion) && (
        <div className="fin-error"><b>Motivo del rechazo:</b> {v.observacion_autorizacion}</div>
      )}

      <div className="fin-grid">
        <Campo etiqueta="Estado"><BadgeEstadoViaje estado={v.estado} /></Campo>
        <Campo etiqueta="Ruta">{v.origen} → {v.destino}</Campo>
        <Campo etiqueta="Viajero">{v.viajero_nombre}{v.viajero_cargo ? ` (${v.viajero_cargo})` : ''}</Campo>
        <Campo etiqueta="Fechas">{(v.fecha_inicio || '').slice(0, 10)} → {(v.fecha_fin || '').slice(0, 10)}
          <div className="fin-suave" style={{ fontSize: 11 }}>{dias.length} día(s) · {Math.max(0, dias.length - 1)} noche(s){especiales ? ` · ${especiales} sáb/dom/festivo` : ''}</div>
        </Campo>
        <Campo etiqueta="Objetivo">{v.objetivo}</Campo>
        <Campo etiqueta="Categoría de tarifa">
          {v.categoria_tarifa ?? <span className="fin-suave">confidencial</span>}
        </Campo>
        {Boolean(v.observaciones) && <Campo etiqueta="Observaciones">{v.observaciones}</Campo>}
        {Boolean(v.observacion_autorizacion) && v.estado !== 'RECHAZADO' && (
          <Campo etiqueta="Observación de autorización">{v.observacion_autorizacion}</Campo>
        )}
      </div>

      {/* Tiquetes */}
      {Boolean(tq.hecho) && !Boolean(tq.no_aplica || tq.noAplica) && (
        <div className="fin-pasoCard">
          <b>✈ Tiquetes:</b> {pesos(Number(tq.valor) || 0)} · {String(tq.detalle ?? '')}
          {tq.fecha ? ` · comprados el ${String(tq.fecha).slice(0, 10)}` : ''}{tq.por ? ` por ${tq.por}` : ''}
          {tq.nota ? <div className="fin-suave" style={{ fontSize: 11 }}>{String(tq.nota)}</div> : null}
        </div>
      )}
      {Boolean(tq.hecho && (tq.no_aplica || tq.noAplica)) && (
        <div className="fin-pasoCard">✈ Este viaje no requiere tiquetes.</div>
      )}

      {/* Resumen del presupuesto */}
      {(diasPpto.length > 0 || v.total_presupuesto > 0) && (
        <div className="fin-pasoCard">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <b>Presupuesto del viaje</b>
            <span className="fin-suave" style={{ fontSize: 11 }}>
              {veCategoria && v.categoria_tarifa ? `Categoría ${v.categoria_tarifa} · ` : ''}
              {String(det.por ?? '')}{det.at ? ` · ${fechaCorta(String(det.at))}` : ''}
              {((det.agregados as string[])?.length || 0) + ((det.quitados as string[])?.length || 0)
                ? ` · ${(det.agregados as string[])?.length || 0} agregado(s), ${(det.quitados as string[])?.length || 0} quitado(s)` : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 8, textAlign: 'center' }}>
            {['ALIMENTACIÓN', 'TRANSPORTE', 'ALOJAMIENTO'].map((g) => (
              <div key={g}><div className="fin-suave" style={{ fontSize: 10 }}>{g}</div><b>{pesos(totalGrupo(diasPpto, g))}</b></div>
            ))}
            <div><div className="fin-suave" style={{ fontSize: 10 }}>OTROS GASTOS</div><b>{pesos(totalOtros(otros))}</b></div>
            <div><div className="fin-suave" style={{ fontSize: 10 }}>TOTAL VIÁTICOS</div><b>{pesos(totalPresupuesto(diasPpto, otros))}</b></div>
          </div>
          {det.nota ? <p className="fin-suave" style={{ fontSize: 11, margin: '6px 0 0' }}>Nota: {String(det.nota)}</p> : null}
        </div>
      )}

      {/* Anticipo */}
      {Boolean(an.hecho) ? (
        <div className="fin-pasoCard" style={{ borderColor: '#16a34a', background: '#f0fdf4' }}>
          <b>💵 Anticipo gestionado:</b> {pesos(Number(an.valor) || 0)}{an.fecha ? ` · ${String(an.fecha).slice(0, 10)}` : ''}{an.por ? ` · por ${an.por}` : ''}
          {an.ref ? <div>Referencia / comprobante: <b>{String(an.ref)}</b></div> : null}
          {an.nota ? <div className="fin-suave" style={{ fontSize: 11 }}>{String(an.nota)}</div> : null}
          {anticipoCambio && (
            <p className="fin-textoMal" style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700 }}>
              ⚠ El presupuesto cambió después del anticipo (antes {pesos(Number(an.valorPpto) || 0)}, ahora {pesos(v.total_presupuesto)}): revisar el ajuste.
            </p>
          )}
        </div>
      ) : (v.total_presupuesto > 0 && v.estado === 'TIQUETES_GESTIONADOS') ? (
        <div className="fin-pasoCard" style={{ borderColor: '#d97706', background: '#fff7e0' }}>
          <b>💵 Pendiente el anticipo:</b> el presupuesto ya está generado; Tesorería / aprobadores de pagos deben iniciar
          el proceso de pago del anticipo por <b>{pesos(v.total_presupuesto)}</b>.
        </div>
      ) : null}

      {puedeCorregir && (
        <button className="fin-btn fin-btnSecundario" onClick={() => onCorregir(v)}>
          <FaUndo /> Corregir y reenviar
        </button>
      )}

      <AdjuntosFin modulo="viaje" referencia={v.id} />

      <h4 className="fin-subtitulo">Historial ({v.historial_cambios.length})</h4>
      <div className="fin-historial">
        {v.historial_cambios.map((h, i) => (
          <div key={i} className="fin-evento">
            <span className="fin-eventoFecha">{fechaCorta(h.fecha)}</span>
            <span className="fin-eventoAccion">{h.accion}</span>
            <span><b>{h.usuario}</b>{h.observacion ? ` — ${h.observacion}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="fin-modalPie">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="fin-btn fin-btnSecundario" onClick={() => imprimirViaje(v, diasPpto, otros)}>
            <FaPrint /> {v.total_presupuesto ? 'Imprimir presupuesto' : 'Imprimir formato'}
          </button>
          {puedeAnular && (
            <button className="fin-btn fin-btnSecundario" onClick={() => void accionSimple('ANULAR')}><FaBan /> Anular</button>
          )}
          {ES_ADMIN(usuario) && (
            <button className="fin-btn fin-btnSecundario fin-textoMal" onClick={onEliminar}>
              <FaTrash /> Eliminar (admin)
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {puedeTiquetes && (
            <button className="fin-btn fin-btnSecundario" onClick={() => setModal('tiquetes')}>
              <FaPlane /> {tq.hecho ? 'Editar tiquetes' : 'Registrar compra de tiquetes'}
            </button>
          )}
          {puedeAnticipo && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModal('anticipo')}>
              <FaMoneyBillWave /> {an.hecho ? 'Editar anticipo' : 'Registrar anticipo'}
            </button>
          )}
          {puedePpto && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModal('presupuesto')}>
              🧾 {v.total_presupuesto ? 'Editar presupuesto' : 'Generar presupuesto'}
            </button>
          )}
          {puedeLegalizar && (
            <button className="fin-btn fin-btnPrimario" onClick={() => void accionSimple('LEGALIZAR', { legalizado_por: usuario.nombre })}>
              Legalizar viaje
            </button>
          )}
          {puedeCerrar && (
            <button className="fin-btn fin-btnPrimario" onClick={() => void accionSimple('CERRAR')}>Cerrar viaje</button>
          )}
          {v.estado === 'SOLICITADO' && (ES_AUTORIZADOR(usuario) || v.autorizador_id === usuario.id) && (
            <>
              <button className="fin-btn fin-btnMal" onClick={() => void accionSimple('RECHAZAR')}><FaTimes /> Rechazar</button>
              <button className="fin-btn fin-btnPrimario" onClick={() => void accionSimple('AUTORIZAR')}><FaCheck /> Autorizar</button>
            </>
          )}
        </div>
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>

      {modal === 'tiquetes' && (
        <ModalTiquetes viaje={v} yaRegistrado={Boolean(tq.hecho)}
                       onCerrar={() => setModal(null)}
                       onListo={() => { setModal(null); onCambio(); }} />
      )}
      {modal === 'anticipo' && (
        <ModalAnticipo viaje={v} yaRegistrado={Boolean(an.hecho)}
                       onCerrar={() => setModal(null)}
                       onListo={() => { setModal(null); onCambio(); }} />
      )}
      {modal === 'presupuesto' && (
        <ModalPresupuesto viaje={v} yaAsignado={v.total_presupuesto > 0} veCategoria={veCategoria}
                          onCerrar={() => setModal(null)}
                          onListo={() => { setModal(null); onCambio(); }} />
      )}
    </ModalFin>
  );
}
