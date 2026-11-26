'use client';

/**
 * Traslados de presupuesto: bandeja con vistas (mías / por aprobar / todas),
 * búsqueda, efecto sobre el presupuesto, impresión del FORMATO - MOVIMIENTO
 * PRESUPUESTAL y eliminación admin. Puerto React de views-traslados.js
 * (772 líneas) sobre la API /fin/traslados.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaUndo, FaPrint, FaEllipsisV, FaTrash } from 'react-icons/fa';
import {
  Traslado, TrasladoLinea, UsuarioFin, eliminarTrasladoAdmin, listarTraslados,
  leerPresupuestoCatalogo, reenviarTraslado, transicionTraslado,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { BadgeEstadoFin, Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto, pedirTextoOpcional } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';
import ModalTrasladoForm from './traslados/ModalTrasladoForm';
import { imprimirTraslado } from '../utiles/imprimirTraslado';
import {
  PRESIDENCIA, PresupuestoData, EfectoLinea, efecto, lineasConEfecto, verReserva,
} from '../utiles/presupuestoTraslados';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_PRESIDENCIA = (u: UsuarioFin) => u.rol === 'presidencia' || ES_ADMIN(u);
const PUEDE_CREAR = (u: UsuarioFin) => u.rol === 'jefe_area' || ES_ADMIN(u);

const ESTADOS = ['', 'PENDIENTE_PRESIDENCIA', 'APROBADO', 'RECHAZADO', 'ANULADO'];
const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE_PRESIDENCIA: 'Pendiente Presidencia',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

type Vista = 'mias' | 'aprobar' | 'todas';

const et = (resp?: string | null | unknown, rubro?: string | null | unknown) =>
  (rubro ? `${String(resp ?? '')} › ${String(rubro)}` : String(resp ?? ''));
const sum = (lineas?: TrasladoLinea[]) => (lineas ?? []).reduce((s, l) => s + (Number(l.monto) || 0), 0);

/** Aprobar / rechazar / anular. Al aprobar se congela el efecto con el
 *  presupuesto vigente (el backend valida y reemplaza las líneas). */
async function decidir(
  t: Traslado, accion: 'APROBAR' | 'RECHAZAR' | 'ANULAR', recargarFn: () => void,
  ctx: { ppto: PresupuestoData | null; aprobados: Traslado[] },
) {
  let observacion = '';
  if (accion === 'RECHAZAR') {
    const motivo = await pedirTexto(`Rechazar ${t.consecutivo}`, 'Motivo del rechazo (obligatorio)');
    if (motivo === null) return;
    observacion = motivo;
  } else if (accion === 'ANULAR') {
    const motivo = await pedirTextoOpcional(`Anular ${t.consecutivo}`, 'Motivo de la anulación (opcional)');
    if (motivo === null) return;
    observacion = motivo;
  } else if (!(await confirmar(`¿Aprobar ${t.consecutivo}?`, `Traslado de ${t.area} por ${pesos(t.total)}.`))) {
    return;
  }
  try {
    let datosAdicionales: Record<string, unknown> | undefined;
    if (accion === 'APROBAR' && ctx.ppto) {
      const ef = efecto(ctx.ppto, ctx.aprobados.filter((a) => a.id !== t.id), t.lineas);
      datosAdicionales = { lineas: lineasConEfecto(t.lineas, ef) };
    }
    const r = await transicionTraslado(t.id, { accion, observacion, version: t.version, datos_adicionales: datosAdicionales });
    toastFin(`${t.consecutivo}: ${ETIQUETA_ESTADO[r.estado] ?? r.estado}`);
    recargarFn();
  } catch (e) {
    toastFin(e instanceof Error ? e.message : 'Error', 'mal');
  }
}

export default function TrasladosP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const [vista, setVista] = useState<Vista>(PUEDE_CREAR(usuario) ? 'mias' : 'todas');
  const [busqueda, setBusqueda] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<Traslado[]>(
    () => listarTraslados(estado || undefined), [estado],
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<Traslado | null>(null);
  const [detalle, setDetalle] = useState<Traslado | null>(null);
  const [menuFila, setMenuFila] = useState<string | null>(null);

  const aprobados = useMemo(() => (datos ?? []).filter((t) => t.estado === 'APROBADO'), [datos]);
  const [ppto, setPpto] = useState<PresupuestoData | null>(null);
  // El presupuesto solo hace falta para el efecto; se carga una vez por sesión de bandeja
  useEffect(() => {
    leerPresupuestoCatalogo(new Date().getFullYear()).then(setPpto).catch(() => setPpto(null));
  }, []);

  const porAprobar = (datos ?? []).filter((t) => t.estado === 'PENDIENTE_PRESIDENCIA' && ES_PRESIDENCIA(usuario));
  const mias = (datos ?? []).filter((t) => t.solicitante_id === usuario.id);

  const filtradas = useMemo(() => {
    let base = datos ?? [];
    if (vista === 'mias') base = mias;
    else if (vista === 'aprobar') base = porAprobar;
    const q = busqueda.trim().toLowerCase();
    if (q) {
      base = base.filter((t) => [t.consecutivo, t.solicitante_nombre, t.area,
        ...(t.lineas ?? []).map((l) => `${l.origen ?? ''} ${l.origenRubro ?? ''} ${l.destino ?? ''} ${l.destinoRubro} ${l.motivo}`)]
        .join(' ').toLowerCase().includes(q));
    }
    return base;
  }, [datos, vista, busqueda, usuario]);


  const eliminar = async (t: Traslado) => {
    if (!await confirmar(`Eliminar ${t.consecutivo}`, 'Acción irreversible de administrador. Queda con snapshot en la bitácora.')) return;
    const motivo = await pedirTexto(`Eliminar ${t.consecutivo}`, 'Motivo (mínimo 5 caracteres)');
    if (!motivo) return;
    try {
      await eliminarTrasladoAdmin(t.id, motivo);
      toastFin(`${t.consecutivo} eliminada`);
      recargar();
      setDetalle(null);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <div className="fin-pagina" onClick={() => setMenuFila(null)}>
      <div className="fin-barra">
        <h2 className="fin-titulo">Traslados de presupuesto</h2>
        <div className="fin-filtros">
          <input className="fin-input" placeholder="Buscar nº, área, solicitante, rubro…"
                 value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e ? (ETIQUETA_ESTADO[e] ?? e) : 'Todos los estados'}</option>
            ))}
          </select>
          {PUEDE_CREAR(usuario) && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
              <FaPlus /> Nueva solicitud
            </button>
          )}
        </div>
      </div>

      <div className="fin-tabs">
        {([
          ['mias', 'Mis solicitudes', mias.length],
          ['aprobar', 'Por aprobar', porAprobar.length],
          ['todas', 'Todas', (datos ?? []).length],
        ] as [Vista, string, number][])
          .filter(([v]) => v !== 'aprobar' || usuario.rol === 'presidencia' || ES_ADMIN(usuario))
          .map(([v, etiqueta, n]) => (
            <button key={v} className={`fin-tab ${vista === v ? 'fin-tabActivo' : ''}`} onClick={() => setVista(v)}>
              {etiqueta} <span className="fin-badge fin-badgeGris">{n}</span>
            </button>
          ))}
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando traslados…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && filtradas.length === 0 && !cargando && <div className="fin-vacio">No hay traslados en este filtro.</div>}

      {!!filtradas.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>Fecha</th><th>Solicitante</th><th>Origen → Destino</th>
                <th className="fin-num">Monto</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((t) => {
                const orig = [...new Set((t.lineas ?? []).map((l) => et(l.origen ?? PRESIDENCIA, l.origenRubro)))].join(', ');
                const dest = [...new Set((t.lineas ?? []).map((l) => et(l.destino, l.destinoRubro)))].join(', ');
                const puedeActuar = t.estado === 'PENDIENTE_PRESIDENCIA' && ES_PRESIDENCIA(usuario);
                return (
                  <tr key={t.id} className={`fin-fila fin-fila-${t.estado}`}>
                    <td><button className="fin-link" onClick={() => setDetalle(t)}>{t.consecutivo}</button></td>
                    <td>{fechaCorta(t.created_at)}</td>
                    <td>{t.solicitante_nombre}</td>
                    <td><b>{orig}</b> <span className="fin-suave">→</span> <b>{dest}</b></td>
                    <td className="fin-num">{pesos(sum(t.lineas))}</td>
                    <td><BadgeEstadoFin estado={t.estado} /></td>
                    <td className="fin-acciones">
                      {puedeActuar && (
                        <>
                          <button className="fin-btnIcono fin-icoOk" title="Aprobar"
                                  onClick={() => void decidir(t, 'APROBAR', recargar, { ppto, aprobados })}><FaCheck /></button>
                          <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                  onClick={() => void decidir(t, 'RECHAZAR', recargar, { ppto, aprobados })}><FaTimes /></button>
                        </>
                      )}
                      {t.estado === 'PENDIENTE_PRESIDENCIA' && (ES_ADMIN(usuario) || t.solicitante_id === usuario.id) && (
                        <button className="fin-btnIcono fin-icoGris" title="Anular"
                                onClick={() => void decidir(t, 'ANULAR', recargar, { ppto, aprobados })}><FaBan /></button>
                      )}
                      <button className="fin-btnIcono fin-icoAzul" title="Detalle"
                              onClick={() => setDetalle(t)}><FaEye /></button>
                      <span style={{ position: 'relative' }}>
                        <button className="fin-btnIcono fin-icoGris" title="Más opciones"
                                onClick={(e) => { e.stopPropagation(); setMenuFila(menuFila === t.id ? null : t.id); }}>
                          <FaEllipsisV />
                        </button>
                        {menuFila === t.id && (
                          <div className="fin-menuFila" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setMenuFila(null); setDetalle(t); }}><FaEye /> Ver detalle del traslado</button>
                            {t.estado === 'APROBADO' && (
                              <button onClick={() => { setMenuFila(null); imprimirTraslado(t); }}>
                                <FaPrint /> Imprimir formato movimiento presupuestal
                              </button>
                            )}
                            {ES_ADMIN(usuario) && (
                              <button className="fin-textoMal" onClick={() => { setMenuFila(null); void eliminar(t); }}>
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
        <ModalTrasladoForm usuario={usuario} editar={editar} aprobados={aprobados}
                           onCerrar={() => { setModalNuevo(false); setEditar(null); }}
                           onListo={() => { setModalNuevo(false); setEditar(null); recargar(); }} />
      )}
      {detalle && (
        <ModalTrasladoDetalle
          traslado={detalle} usuario={usuario} ppto={ppto} aprobados={aprobados}
          onCerrar={() => setDetalle(null)}
          onCorregir={(t) => { setDetalle(null); setEditar(t); }}
          onAnular={() => void decidir(detalle, 'ANULAR', recargar, { ppto, aprobados })}
          onEliminar={() => void eliminar(detalle)}
          onCambio={() => { recargar(); setDetalle(null); }}
        />
      )}
    </div>
  );
}

// ── Modal: detalle (+ corrección si rechazado, efecto, impresión) ──────────

function ModalTrasladoDetalle({ traslado, usuario, ppto, aprobados, onCerrar, onCambio, onCorregir, onAnular, onEliminar }: {
  traslado: Traslado; usuario: UsuarioFin; ppto: PresupuestoData | null; aprobados: Traslado[];
  onCerrar: () => void; onCambio: () => void; onCorregir: (t: Traslado) => void;
  onAnular: () => void; onEliminar: () => void;
}) {
  const t = traslado;
  const esCreador = t.solicitante_id === usuario.id;
  const puedeCorregir = esCreador && t.estado === 'RECHAZADO';
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [lineas, setLineas] = useState<TrasladoLinea[]>(t.lineas);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Mientras está pendiente se recalcula con el presupuesto de hoy; luego queda lo congelado al decidir
  const ef = useMemo<EfectoLinea[]>(
    () => (t.estado === 'PENDIENTE_PRESIDENCIA' && ppto
      ? efecto(ppto, aprobados.filter((a) => a.id !== t.id), t.lineas)
      : (t.lineas ?? []).map((l): EfectoLinea => {
          const congelado = l.efecto ?? {};
          return {
            monto: Number(l.monto) || 0,
            origen: l.origen ?? PRESIDENCIA, origenRubro: l.origenRubro,
            destino: l.destino, destinoRubro: l.destinoRubro, mes: l.mes as string,
            oAntes: (congelado.oAntes as number | null) ?? null,
            oDespues: (congelado.oDespues as number | null) ?? null,
            dAntes: (congelado.dAntes as number | null) ?? null,
            dDespues: (congelado.dDespues as number | null) ?? null,
          };
        })),
    [t, ppto, aprobados],
  );
  const verOrigen = verReserva(usuario);
  const m = (v: number | null | undefined) =>
    v === null || v === undefined ? <span className="fin-suave">sin presupuesto</span>
      : <span style={v < 0 ? { color: '#dc2626', fontWeight: 700 } : undefined}>{pesos(v)}</span>;
  const filasEfecto = ef.filter((e) => e.monto > 0);

  return (
    <ModalFin titulo={`Traslado ${t.consecutivo}`} onCerrar={onCerrar} ancho={900}>
      {error && <div className="fin-error">{error}</div>}
      {t.estado === 'APROBADO' && (
        <div className="fin-pasoCard" style={{ borderColor: '#16a34a', background: '#f0fdf4' }}>
          <b style={{ color: '#166534' }}>
            Aprobada por {t.aprobacion?.nombre ?? ''} ({t.aprobacion?.cargo ?? 'Presidencia'}) el {fechaCorta(t.aprobacion?.at ?? null)}
            {t.aprobacion?.comentario ? ` · ${t.aprobacion.comentario}` : ''}.
          </b>
          <div className="fin-suave" style={{ fontSize: 12 }}>
            Presidencia lo remite al Gerente financiero, con copia al Controller. Imprímelo o guárdalo como PDF.
          </div>
        </div>
      )}
      {t.estado === 'RECHAZADO' && t.motivo_rechazo && (
        <div className="fin-error"><b>Motivo del rechazo:</b> {t.motivo_rechazo}</div>
      )}
      {t.estado === 'ANULADO' && t.motivo_rechazo && (
        <div className="fin-vacio"><b>Anulada:</b> {t.motivo_rechazo}</div>
      )}

      <div className="fin-grid">
        <Campo etiqueta="Estado"><BadgeEstadoFin estado={t.estado} /></Campo>
        <Campo etiqueta="Área destino">{t.area}</Campo>
        <Campo etiqueta="Solicitó">{t.solicitante_nombre}</Campo>
        <Campo etiqueta="Creado">{fechaCorta(t.created_at)}</Campo>
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>Origen</th><th>Destino</th><th>Mes</th><th className="fin-num">Monto</th><th>Motivo / nota</th></tr></thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td>{corrigiendo ? (
                  <input className="fin-input" value={l.destinoRubro}
                         onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, destinoRubro: e.target.value } : x))} />
                ) : et(l.origen ?? PRESIDENCIA, l.origenRubro)}</td>
                <td>{et(l.destino, l.destinoRubro)}</td>
                <td>{l.mes as string}</td>
                <td className="fin-num">{corrigiendo ? (
                  <input className="fin-input fin-num" type="number" value={l.monto}
                         onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))} />
                ) : pesos(l.monto)}</td>
                <td>{corrigiendo ? (
                  <input className="fin-input" value={l.motivo}
                         onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, motivo: e.target.value } : x))} />
                ) : l.motivo}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td><b>TOTAL MONTO TRASLADADO</b></td><td></td><td></td>
            <td className="fin-num"><b>{pesos(sum(lineas))}</b></td><td></td></tr></tfoot>
        </table>
      </div>

      {/* Efecto sobre el presupuesto (congelado al aprobar; recalculado si sigue pendiente) */}
      {!!filasEfecto.length && (
        <div className="fin-pasoCard">
          <b style={{ fontSize: 12 }}>Efecto sobre el presupuesto</b>
          <div className="fin-tablaWrap" style={{ marginTop: 6 }}>
            <table className="fin-tabla fin-tablaCompacta">
              <thead><tr><th>Área › rubro</th><th>Mes</th><th className="fin-num">Disponible hoy</th><th className="fin-num">Traslado</th><th className="fin-num">Después</th></tr></thead>
              <tbody>
                {filasEfecto.map((e, i) => (
                  <Fragment key={i}>
                    {verOrigen && (
                      <tr>
                        <td>{e.origen} › {e.origenRubro} <span className="fin-badge fin-badgeMal">cede</span></td>
                        <td>{e.mes}</td><td className="fin-num">{m(e.oAntes)}</td>
                        <td className="fin-num">− {pesos(e.monto)}</td><td className="fin-num"><b>{m(e.oDespues)}</b></td>
                      </tr>
                    )}
                    <tr>
                      <td>{e.destino} › {e.destinoRubro} <span className="fin-badge fin-badgeOk">recibe</span></td>
                      <td>{e.mes}</td><td className="fin-num">{m(e.dAntes)}</td>
                      <td className="fin-num">+ {pesos(e.monto)}</td><td className="fin-num"><b>{m(e.dDespues)}</b></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {t.observaciones && <p className="fin-suave">Observaciones: {t.observaciones}</p>}

      {puedeCorregir && !corrigiendo && (
        <button className="fin-btn fin-btnSecundario" onClick={() => setCorrigiendo(true)}>
          <FaUndo /> Corregir y reenviar
        </button>
      )}
      {puedeCorregir && corrigiendo && (
        <div className="fin-filaAcciones">
          <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={async () => {
            setGuardando(true);
            try {
              const r = await reenviarTraslado(t.id, {
                lineas: lineas.map((l) => ({ ...l, monto: Number(l.monto) })), version: t.version,
              });
              toastFin(`${r.consecutivo} reenviada a Presidencia`);
              onCambio();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Error al reenviar');
            } finally { setGuardando(false); }
          }}>{guardando ? 'Enviando…' : 'Reenviar a Presidencia'}</button>
          <button className="fin-btn fin-btnSecundario" onClick={() => { setCorrigiendo(false); setLineas(t.lineas); }}>
            Cancelar edición
          </button>
        </div>
      )}

      <AdjuntosFin modulo="traslado" referencia={t.id} />

      <h4 className="fin-subtitulo">Historial ({t.historial_cambios.length})</h4>
      <div className="fin-historial">
        {t.historial_cambios.map((h, i) => (
          <div key={i} className="fin-evento">
            <span className="fin-eventoFecha">{fechaCorta(h.fecha)}</span>
            <span className={`fin-eventoAccion fin-acc-${h.accion}`}>{h.accion}</span>
            <span><b>{h.usuario}</b>{h.observacion ? ` — ${h.observacion}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="fin-modalPie">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {t.estado === 'APROBADO' && (
            <button className="fin-btn fin-btnSecundario" onClick={() => imprimirTraslado(t)}>
              <FaPrint /> Imprimir formato
            </button>
          )}
          {t.estado === 'PENDIENTE_PRESIDENCIA' && (ES_ADMIN(usuario) || esCreador) && (
            <button className="fin-btn fin-btnSecundario" onClick={onAnular}><FaBan /> Anular</button>
          )}
          {ES_ADMIN(usuario) && (
            <button className="fin-btn fin-btnSecundario fin-textoMal" onClick={onEliminar}>
              <FaTrash /> Eliminar (admin)
            </button>
          )}
        </div>
        {t.estado === 'PENDIENTE_PRESIDENCIA' && ES_PRESIDENCIA(usuario) && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fin-btn fin-btnMal" onClick={() => { onCerrar(); void decidir(t, 'RECHAZAR', onCambio, { ppto, aprobados }); }}><FaTimes /> Rechazar</button>
            <button className="fin-btn fin-btnPrimario" onClick={() => { onCerrar(); void decidir(t, 'APROBAR', onCambio, { ppto, aprobados }); }}><FaCheck /> Aprobar</button>
          </div>
        )}
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
