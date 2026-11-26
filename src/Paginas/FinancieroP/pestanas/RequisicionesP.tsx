'use client';

/**
 * Requisiciones de compra: bandeja con vistas (mías / por aprobar / por
 * entregar / todas), búsqueda, banner de entrega pendiente de confirmar,
 * anulación, impresión FORM-CPR-011/004 y detalle con bandejas por rol.
 * Puerto React de views-requisiciones.js del módulo externo.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaUndo, FaTruck, FaBoxOpen, FaBolt,
  FaPrint, FaEllipsisV, FaTrash,
} from 'react-icons/fa';
import {
  CRITERIOS_CALIFICACION, Requisicion, UsuarioFin, eliminarRequisicionAdmin,
  leerConfiguracion, listarRequisiciones, transicionRequisicion,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';
import ModalReqForm from './requisiciones/ModalReqForm';
import { imprimirRequisicion } from '../utiles/imprimirRequisicion';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_JEFE = (u: UsuarioFin) => u.rol === 'jefe_area' || ES_ADMIN(u);
const ES_COMPRAS = (u: UsuarioFin) => u.rol === 'compras' || ES_ADMIN(u);
const ES_CONTROLLER = (u: UsuarioFin) => u.rol === 'controller' || ES_ADMIN(u);
const ES_GERENTE = (u: UsuarioFin) => u.rol === 'gerente_financiero' || ES_ADMIN(u);
const PUEDE_CREAR = (u: UsuarioFin) => ['requisicion', 'jefe_area', 'compras', 'admin'].includes(u.rol) || ES_ADMIN(u);
const TOPE_CONTROLLER_DEFAULT = 100_000_000;

const ETIQUETA: Record<string, string> = {
  BORRADOR: 'Borrador', PENDIENTE_JEFE: 'Pendiente jefe', RECHAZADA_JEFE: 'Rechazada (jefe)',
  PENDIENTE_COMPRAS: 'Pendiente compras', PENDIENTE_FINANCIERA: 'Pendiente financiera',
  RECHAZADA_FINANCIERA: 'Rechazada (financiera)', APROBADA: 'Aprobada',
  EN_ORDEN_COMPRA: 'En orden de compra', RECIBIDO_PARCIAL: 'Recibido parcial',
  RECIBIDO_TOTAL: 'Recibido total', ANULADA: 'Anulada',
};
const ESTADOS = ['', ...Object.keys(ETIQUETA)];

const BADGE: Record<string, string> = {
  PENDIENTE_JEFE: 'fin-badgeAmb', PENDIENTE_COMPRAS: 'fin-badgeInfo',
  PENDIENTE_FINANCIERA: 'fin-badgeAmb', RECHAZADA_JEFE: 'fin-badgeMal',
  RECHAZADA_FINANCIERA: 'fin-badgeMal', APROBADA: 'fin-badgeOk',
  EN_ORDEN_COMPRA: 'fin-badgeOk', RECIBIDO_TOTAL: 'fin-badgeGris',
  RECIBIDO_PARCIAL: 'fin-badgeGris', ANULADA: 'fin-badgeMal',
};

type Vista = 'mias' | 'aprobar' | 'entregar' | 'todas';

/** ¿Puede el usuario actuar (aprobar) sobre la req en su estado actual? */
function puedeAprobar(r: Requisicion, u: UsuarioFin): boolean {
  if (r.estado === 'PENDIENTE_JEFE') return ES_JEFE(u) && (u.area === r.area || ES_ADMIN(u));
  if (r.estado === 'PENDIENTE_COMPRAS') return ES_COMPRAS(u);
  if (r.estado === 'PENDIENTE_FINANCIERA') return ES_CONTROLLER(u) || ES_GERENTE(u);
  return false;
}

export default function RequisicionesP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const { datos, cargando, error, recargar } = useFinDatos<Requisicion[]>(
    () => listarRequisiciones({ estado: estado || undefined, solo_urgentes: soloUrgentes || undefined }),
    [estado, soloUrgentes],
  );
  const [vista, setVista] = useState<Vista>(PUEDE_CREAR(usuario) ? 'mias' : 'todas');
  const [busqueda, setBusqueda] = useState('');
  const [tope, setTope] = useState<number>(TOPE_CONTROLLER_DEFAULT);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<Requisicion | null>(null);
  const [detalle, setDetalle] = useState<Requisicion | null>(null);
  const [menuFila, setMenuFila] = useState<string | null>(null);

  useEffect(() => {
    leerConfiguracion()
      .then((cfg) => setTope(Number(cfg.limite_controller) || TOPE_CONTROLLER_DEFAULT))
      .catch(() => { /* tope por defecto */ });
  }, []);

  /** El tope real decide el aprobador financiero (el backend manda). */
  const apruebaGerente = (r: Requisicion) => Number(r.total) > tope;

  const filtradas = useMemo(() => {
    let base = datos ?? [];
    if (vista === 'mias') base = base.filter((r) => r.solicitante_id === usuario.id);
    else if (vista === 'aprobar') base = base.filter((r) => puedeAprobar(r, usuario));
    else if (vista === 'entregar') base = base.filter((r) => r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      base = base.filter((r) => [r.consecutivo, r.oc_numero, r.proveedor_sugerido, r.solicitante_nombre, r.area]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    return base;
  }, [datos, vista, busqueda, usuario]);

  /** Requisiciones donde Compras ya entregó y falta que el solicitante confirme. */
  const entregasPendientes = useMemo(
    () => (datos ?? []).filter((r) => r.estado === 'EN_ORDEN_COMPRA' && r.entregado_en && r.solicitante_id === usuario.id),
    [datos, usuario],
  );

  const contar = (v: Vista) => {
    const base = datos ?? [];
    if (v === 'mias') return base.filter((r) => r.solicitante_id === usuario.id).length;
    if (v === 'aprobar') return base.filter((r) => puedeAprobar(r, usuario)).length;
    if (v === 'entregar') return base.filter((r) => r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en).length;
    return base.length;
  };

  const anular = async (r: Requisicion) => {
    const motivo = await pedirTexto(`Anular ${r.consecutivo}`, 'Motivo de la anulación (obligatorio)');
    if (!motivo) return;
    try {
      await transicionRequisicion(r.id, { accion: 'ANULAR', observacion: motivo, version: r.version });
      toastFin(`${r.consecutivo} anulada`);
      recargar();
      setDetalle(null);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  const eliminar = async (r: Requisicion) => {
    if (!await confirmar(`Eliminar ${r.consecutivo}`, 'Acción irreversible de administrador. Queda con snapshot en la bitácora.')) return;
    const motivo = await pedirTexto(`Eliminar ${r.consecutivo}`, 'Motivo (mínimo 5 caracteres)');
    if (!motivo) return;
    try {
      await eliminarRequisicionAdmin(r.id, motivo);
      toastFin(`${r.consecutivo} eliminada`);
      recargar();
      setDetalle(null);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <div className="fin-pagina" onClick={() => setMenuFila(null)}>
      <div className="fin-barra">
        <h2 className="fin-titulo">Requisiciones de compra</h2>
        <div className="fin-filtros">
          <input className="fin-input" placeholder="Buscar nº, proveedor, solicitante…"
                 value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e ? ETIQUETA[e] : 'Todos los estados'}</option>)}
          </select>
          <label className="fin-check">
            <input type="checkbox" checked={soloUrgentes} onChange={(e) => setSoloUrgentes(e.target.checked)} />
            Solo urgentes
          </label>
          {PUEDE_CREAR(usuario) && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
              <FaPlus /> Nueva requisición
            </button>
          )}
        </div>
      </div>

      {/* Banner: entregas por confirmar (puerto del original) */}
      {entregasPendientes.map((r) => (
        <div key={r.id} className="fin-pasoCard" style={{ borderColor: '#16a34a', background: '#f0fdf4', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
            📦 Compras marcó como entregada {r.consecutivo} · OC {r.oc_numero} · {r.proveedor_sugerido} ({fechaCorta(r.entregado_en)}). Confirma que la recibiste.
          </span>
          <button className="fin-btn fin-btnPrimario" style={{ marginLeft: 12 }} onClick={() => setDetalle(r)}>
            ✅ Confirmar recepción
          </button>
        </div>
      ))}

      <div className="fin-tabs">
        {([
          ['mias', 'Mis requisiciones'],
          ['aprobar', 'Por aprobar'],
          ['entregar', 'Por entregar'],
          ['todas', ES_JEFE(usuario) || usuario.rol === 'requisicion' ? `Mi área${usuario.area ? ' · ' + usuario.area : ''}` : 'Todas'],
        ] as [Vista, string][])
          .filter(([v]) => v !== 'entregar' || ES_COMPRAS(usuario))
          .map(([v, etiqueta]) => (
            <button key={v} className={`fin-tab ${vista === v ? 'fin-tabActivo' : ''}`} onClick={() => setVista(v)}>
              {etiqueta} <span className="fin-badge fin-badgeGris">{contar(v)}</span>
            </button>
          ))}
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando requisiciones…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && filtradas.length === 0 && !cargando && <div className="fin-vacio">No hay requisiciones en este filtro.</div>}

      {!!filtradas.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>OC</th><th>Área</th><th>Solicitó</th><th>Proveedor</th>
                <th className="fin-num">Total</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="fin-link" onClick={() => setDetalle(r)}>{r.consecutivo}</button>
                    {r.es_urgente && <span title="Urgente" style={{ color: '#d97706', marginLeft: 4 }}><FaBolt /></span>}
                  </td>
                  <td>{r.oc_numero ?? '—'}</td>
                  <td>{r.area}</td>
                  <td>{r.solicitante_nombre}</td>
                  <td className="fin-suave">
                    {r.proveedor_sugerido ?? '—'}
                    {Boolean((r.datos_front as Record<string, unknown> | null)?.proveedor_nuevo) && (
                      <span className="fin-badge fin-badgeInfo" style={{ marginLeft: 6 }}>🏢 Prov. nuevo</span>
                    )}
                  </td>
                  <td className="fin-num">{pesos(r.total)}</td>
                  <td>
                    <span className={`fin-badge ${BADGE[r.estado] ?? 'fin-badgeGris'}`}>{ETIQUETA[r.estado] ?? r.estado}</span>
                    {r.entregado_en && r.estado === 'EN_ORDEN_COMPRA' && r.solicitante_id === usuario.id && (
                      <div className="fin-suave" style={{ fontSize: 11 }}>Por confirmar recepción</div>
                    )}
                  </td>
                  <td className="fin-acciones">
                    {puedeAprobar(r, usuario) && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Aprobar"
                                onClick={() => setDetalle(r)}><FaCheck /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                onClick={() => void simple(r, 'RECHAZAR', recargar)}><FaTimes /></button>
                      </>
                    )}
                    {r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en && ES_COMPRAS(usuario) && (
                      <button className="fin-btnIcono fin-icoAzul" title="Marcar entrega"
                              onClick={() => void simple(r, 'ENTREGAR', recargar)}><FaTruck /></button>
                    )}
                    {(r.estado.startsWith('RECHAZADA')) && r.solicitante_id === usuario.id && (
                      <button className="fin-btnIcono fin-icoAzul" title="Corregir y reenviar"
                              onClick={() => setEditar(r)}><FaUndo /></button>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => setDetalle(r)}><FaEye /></button>
                    <span style={{ position: 'relative' }}>
                      <button className="fin-btnIcono fin-icoGris" title="Más opciones"
                              onClick={(e) => { e.stopPropagation(); setMenuFila(menuFila === r.id ? null : r.id); }}>
                        <FaEllipsisV />
                      </button>
                      {menuFila === r.id && (
                        <div className="fin-menuFila" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setMenuFila(null); setDetalle(r); }}><FaEye /> Ver detalle completo</button>
                          <button onClick={() => { setMenuFila(null); imprimirRequisicion(r, 'REQ'); }}><FaPrint /> Imprimir requisición</button>
                          {r.oc_numero && (
                            <button onClick={() => { setMenuFila(null); imprimirRequisicion(r, 'OC'); }}>
                              <FaPrint /> Imprimir orden de compra {r.oc_numero}
                            </button>
                          )}
                          {['PENDIENTE_JEFE', 'PENDIENTE_COMPRAS', 'PENDIENTE_FINANCIERA'].includes(r.estado)
                            && (ES_ADMIN(usuario) || r.solicitante_id === usuario.id) && (
                            <button onClick={() => { setMenuFila(null); void anular(r); }}><FaBan /> Anular</button>
                          )}
                          {ES_ADMIN(usuario) && (
                            <button className="fin-textoMal" onClick={() => { setMenuFila(null); void eliminar(r); }}>
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
        <ModalReqForm usuario={usuario} editar={editar}
                      onCerrar={() => { setModalNuevo(false); setEditar(null); }}
                      onListo={() => { setModalNuevo(false); setEditar(null); recargar(); }} />
      )}
      {detalle && (
        <ModalReqDetalle req={detalle} usuario={usuario} tope={tope}
                         onCerrar={() => setDetalle(null)}
                         onCorregir={(r) => { setDetalle(null); setEditar(r); }}
                         onAnular={() => void anular(detalle)}
                         onEliminar={() => void eliminar(detalle)}
                         onCambio={() => { recargar(); setDetalle(null); }} />
      )}
    </div>
  );
}

async function simple(r: Requisicion, accion: string, recargar: () => void, datosAdicionales?: Record<string, unknown>) {
  let observacion = '';
  if (accion === 'RECHAZAR') {
    const motivo = await pedirTexto(`Rechazar ${r.consecutivo}`, 'Motivo del rechazo (obligatorio)');
    if (motivo === null) return;
    observacion = motivo;
  } else if (!(await confirmar(accion === 'APROBAR' ? `¿Aprobar ${r.consecutivo}?` : `¿Registrar entrega de ${r.consecutivo}?`))) {
    return;
  }
  try {
    const res = await transicionRequisicion(r.id, { accion, observacion, version: r.version, datos_adicionales: datosAdicionales });
    toastFin(`${r.consecutivo}: ${ETIQUETA[res.estado] ?? res.estado}${res.oc_numero ? ` · OC ${res.oc_numero}` : ''}`);
    recargar();
  } catch (e) {
    toastFin(e instanceof Error ? e.message : 'Error', 'mal');
  }
}

// ── Modal: detalle con bandejas por rol ────────────────────────────────────

function ModalReqDetalle({ req, usuario, tope, onCerrar, onCambio, onCorregir, onAnular, onEliminar }: {
  req: Requisicion; usuario: UsuarioFin; tope: number;
  onCerrar: () => void; onCambio: () => void; onCorregir: (r: Requisicion) => void;
  onAnular: () => void; onEliminar: () => void;
}) {
  const r = req;
  const [error, setError] = useState('');
  const [pagoUrgenteFecha, setPagoUrgenteFecha] = useState('');
  const [notas, setNotas] = useState<Record<string, number>>({});

  const esSolicitante = r.solicitante_id === usuario.id;
  const pasoJefe = r.estado === 'PENDIENTE_JEFE' && ES_JEFE(usuario) && (usuario.area === r.area || ES_ADMIN(usuario));
  const pasoCompras = r.estado === 'PENDIENTE_COMPRAS' && ES_COMPRAS(usuario);
  const sobreTope = Number(r.total) > tope;
  const pasoFinanciera = r.estado === 'PENDIENTE_FINANCIERA'
    && ((!sobreTope && (ES_CONTROLLER(usuario) || ES_GERENTE(usuario))) || (sobreTope && ES_GERENTE(usuario)));
  const pasoEntrega = r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en && ES_COMPRAS(usuario);
  const pasoRecepcion = r.estado === 'EN_ORDEN_COMPRA' && r.entregado_en && (esSolicitante || ES_ADMIN(usuario));
  const puedeCorregir = esSolicitante && (r.estado === 'RECHAZADA_JEFE' || r.estado === 'RECHAZADA_FINANCIERA');
  const puedeAnular = ['PENDIENTE_JEFE', 'PENDIENTE_COMPRAS', 'PENDIENTE_FINANCIERA'].includes(r.estado)
    && (ES_ADMIN(usuario) || (esSolicitante && r.estado !== 'PENDIENTE_FINANCIERA'));

  const pd = (r.proveedor_datos ?? {}) as Record<string, unknown>;

  const aprobarFinanciera = async () => {
    let datos: Record<string, unknown> | undefined;
    if (r.pago_urgente) {
      const decision = await confirmar(
        `Aprobar ${r.consecutivo} con pago urgente`,
        'Aceptar aprueba la compra CON el pago urgente para Tesorería.',
      );
      if (decision === null) return;
      datos = { pago_urgente_aprobado: decision };
    }
    try {
      const res = await transicionRequisicion(r.id, { accion: 'APROBAR', version: r.version, datos_adicionales: datos });
      toastFin(`${r.consecutivo} aprobada · OC ${res.oc_numero}`);
      onCambio();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };

  const recibirTotal = async () => {
    const faltan = CRITERIOS_CALIFICACION.filter((c) => !(c.clave in notas) || notas[c.clave] < 0 || notas[c.clave] > 15);
    if (faltan.length) { setError(`Califica los 9 criterios (0 a 15). Faltan: ${faltan.map((f) => f.clave).join(', ')}`); return; }
    try {
      await transicionRequisicion(r.id, { accion: 'RECIBIR_TOTAL', version: r.version, datos_adicionales: { notas } });
      toastFin(`${r.consecutivo} recibida totalmente`);
      onCambio();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };

  return (
    <ModalFin titulo={`Requisición ${r.consecutivo}`} onCerrar={onCerrar} ancho={960}>
      {error && <div className="fin-error">{error}</div>}
      {pasoRecepcion && (
        <div className="fin-pasoCard" style={{ borderColor: '#16a34a', background: '#f0fdf4' }}>
          <b style={{ color: '#166534' }}>📦 Entregada por Compras el {fechaCorta(r.entregado_en)} — confirma la recepción y califica al proveedor.</b>
        </div>
      )}
      <div className="fin-grid">
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[r.estado]}`}>{ETIQUETA[r.estado]}</span></Campo>
        <Campo etiqueta="Orden de compra">{r.oc_numero ?? '—'}</Campo>
        <Campo etiqueta="Área">{r.area}</Campo>
        <Campo etiqueta="Solicitó">{r.solicitante_nombre}</Campo>
        <Campo etiqueta="Radicada">{fechaCorta(r.created_at)}</Campo>
        <Campo etiqueta="Total">{pesos(r.total)}{sobreTope ? ' (supera tope Controller)' : ''}</Campo>
      </div>

      <div className="fin-grid">
        <Campo etiqueta="Proveedor">{r.proveedor_sugerido ?? '—'} {r.proveedor_nit ? `· NIT ${r.proveedor_nit}` : ''}</Campo>
        <Campo etiqueta="Contacto">{String(pd.contacto ?? '—')} {pd.telefono ? `· ${pd.telefono}` : ''}</Campo>
        <Campo etiqueta="Entrega">
          {r.lugar_entrega}
          {pd.receptor ? ` · Recibe: ${pd.receptor}` : ''}
          {pd.fecha_inicio ? ` · ${String(pd.fecha_inicio).slice(0, 10)}` : ''}
          {pd.fecha_fin ? ` → ${String(pd.fecha_fin).slice(0, 10)}` : ''}
        </Campo>
        {pd.direccion ? <Campo etiqueta="Dirección">{String(pd.direccion)}</Campo> : null}
        {pd.cotizacion_ref ? <Campo etiqueta="Cotización ref">{String(pd.cotizacion_ref)}</Campo> : null}
        {r.es_urgente && <Campo etiqueta="Urgente"><span className="fin-textoMal">{r.motivo_urgencia}</span></Campo>}
        {r.pago_urgente && (
          <Campo etiqueta="Pago urgente">
            {r.pago_aprobado === null
              ? `propuesto para ${(r.pago_fecha || '').slice(0, 10)} (pendiente de decisión financiera)`
              : `${r.pago_aprobado ? 'APROBADO' : 'no aprobado'} por ${r.pago_decidido_por}`}
          </Campo>
        )}
        {r.entregado_en && <Campo etiqueta="Entregada por Compras">{fechaCorta(r.entregado_en)}</Campo>}
        {r.observacion_jefe && <Campo etiqueta="Observación del jefe">{r.observacion_jefe}</Campo>}
        {r.observacion_financiera && <Campo etiqueta="Observación financiera">{r.observacion_financiera}</Campo>}
        {r.observaciones && <Campo etiqueta="Observaciones">{r.observaciones}</Campo>}
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>Centro costo</th><th>Descripción</th><th className="fin-num">Cant.</th><th className="fin-num">Vr. unit.</th><th className="fin-num">Dcto</th><th className="fin-num">Total</th></tr></thead>
          <tbody>
            {r.items.map((it, i) => (
              <tr key={i}>
                <td>{it.centro_costo ?? '—'}</td><td>{it.descripcion}</td>
                <td className="fin-num">{it.cantidad} {it.unidad}</td>
                <td className="fin-num">{pesos(it.precio_unitario)}</td>
                <td className="fin-num">{pesos(it.descuento ?? 0)}</td>
                <td className="fin-num">{pesos(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bandeja: jefe de área */}
      {pasoJefe && (
        <div className="fin-pasoCard fin-filaAcciones">
          <b>Visto bueno del jefe de área</b>
          <button className="fin-btn fin-btnPrimario" onClick={() => simple(r, 'APROBAR', onCambio)}><FaCheck /> Aprobar y enviar a Compras</button>
          <button className="fin-btn fin-btnMal" onClick={() => simple(r, 'RECHAZAR', onCambio)}><FaTimes /> Rechazar</button>
        </div>
      )}

      {/* Bandeja: compras */}
      {pasoCompras && (
        <div className="fin-pasoCard">
          <b>Cotización de Compras</b>
          <div className="fin-filaAcciones" style={{ marginTop: 8 }}>
            <label className="fin-check">
              <input type="checkbox" checked={!!pagoUrgenteFecha} disabled={!!pagoUrgenteFecha}
                     onChange={(e) => setPagoUrgenteFecha(e.target.checked ? new Date().toISOString().slice(0, 10) : '')} />
              Proponer pago urgente
            </label>
            {pagoUrgenteFecha && (
              <input type="date" className="fin-input" value={pagoUrgenteFecha}
                     onChange={(e) => setPagoUrgenteFecha(e.target.value)} />
            )}
            <button className="fin-btn fin-btnPrimario" onClick={async () => {
              try {
                const datos = pagoUrgenteFecha ? { pago_urgente: true, pago_fecha: `${pagoUrgenteFecha}T12:00:00` } : undefined;
                await transicionRequisicion(r.id, { accion: 'APROBAR', version: r.version, datos_adicionales: datos });
                toastFin('Enviada a aprobación financiera'); onCambio();
              } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
            }}><FaCheck /> Enviar a aprobación financiera</button>
          </div>
        </div>
      )}

      {/* Bandeja: financiera */}
      {pasoFinanciera && (
        <div className="fin-pasoCard fin-filaAcciones">
          <b>Aprobación financiera {sobreTope ? '(Gerente financiero: supera tope)' : '(Controller)'}</b>
          <button className="fin-btn fin-btnPrimario" onClick={aprobarFinanciera}><FaCheck /> Aprobar y generar OC</button>
          <button className="fin-btn fin-btnMal" onClick={() => simple(r, 'RECHAZAR', onCambio)}><FaTimes /> Rechazar</button>
        </div>
      )}

      {/* Bandeja: entrega */}
      {pasoEntrega && (
        <div className="fin-pasoCard fin-filaAcciones">
          <b>Entrega</b>
          <button className="fin-btn fin-btnPrimario" onClick={() => simple(r, 'ENTREGAR', onCambio)}><FaTruck /> Marcar entregada al solicitante</button>
        </div>
      )}

      {/* Bandeja: recepción + calificación */}
      {pasoRecepcion && (
        <div className="fin-pasoCard">
          <b>Recepción y seguimiento al proveedor (9 criterios, 0 a 15)</b>
          <table className="fin-tabla fin-tablaCompacta" style={{ marginTop: 8 }}>
            <tbody>
              {CRITERIOS_CALIFICACION.map((c) => (
                <tr key={c.clave}>
                  <td style={{ width: 46 }}><b>{c.clave}</b></td>
                  <td>{c.nombre}</td>
                  <td style={{ width: 110 }}>
                    <input className="fin-input fin-num" type="number" min={0} max={15}
                           value={notas[c.clave] ?? ''}
                           onChange={(e) => setNotas({ ...notas, [c.clave]: parseFloat(e.target.value) || 0 })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fin-filaAcciones" style={{ marginTop: 8 }}>
            <button className="fin-btn fin-btnPrimario" onClick={recibirTotal}><FaBoxOpen /> Confirmar recepción total</button>
          </div>
        </div>
      )}

      {r.calificacion_proveedor && (
        <div className="fin-pasoCard">
          <b>Calificación del proveedor</b>{' '}
          <span className={`fin-badge ${r.calificacion_proveedor.letra === 'A' ? 'fin-badgeOk' : r.calificacion_proveedor.letra === 'B' ? 'fin-badgeAmb' : 'fin-badgeMal'}`}>
            {r.calificacion_proveedor.letra} · {r.calificacion_proveedor.puntaje}/15
          </span>
          <span className="fin-suave"> por {r.calificacion_proveedor.por} · {fechaCorta(r.calificacion_proveedor.at)}</span>
        </div>
      )}

      {Boolean((r.datos_front as Record<string, unknown> | null)?.tercero_id) && (
        <div className="fin-pasoCard fin-suave" style={{ fontSize: 12 }}>
          🏢 Proveedor nuevo: su aprobación y carga en software se gestionan en la pestaña <b>Prov. nuevos</b>.
        </div>
      )}

      {puedeCorregir && (
        <button className="fin-btn fin-btnSecundario" onClick={() => onCorregir(r)}>
          <FaUndo /> Corregir y reenviar
        </button>
      )}

      <AdjuntosFin modulo="requisicion" referencia={r.id} />

      <h4 className="fin-subtitulo">Historial ({r.historial_cambios.length})</h4>
      <div className="fin-historial">
        {r.historial_cambios.map((h, i) => (
          <div key={i} className="fin-evento">
            <span className="fin-eventoFecha">{fechaCorta(h.fecha)}</span>
            <span className="fin-eventoAccion">{h.accion}</span>
            <span><b>{h.usuario}</b>{h.observacion ? ` — ${h.observacion}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="fin-modalPie">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="fin-btn fin-btnSecundario" onClick={() => imprimirRequisicion(r, 'REQ')}>
            <FaPrint /> Imprimir requisición
          </button>
          {r.oc_numero && (
            <button className="fin-btn fin-btnSecundario" onClick={() => imprimirRequisicion(r, 'OC')}>
              <FaPrint /> Orden de compra {r.oc_numero}
            </button>
          )}
          {puedeAnular && (
            <button className="fin-btn fin-btnSecundario" onClick={onAnular}><FaBan /> Anular</button>
          )}
          {ES_ADMIN(usuario) && (
            <button className="fin-btn fin-btnSecundario fin-textoMal" onClick={onEliminar}>
              <FaTrash /> Eliminar (admin)
            </button>
          )}
        </div>
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
