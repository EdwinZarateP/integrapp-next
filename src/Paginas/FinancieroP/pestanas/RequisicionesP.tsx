'use client';

/**
 * Requisiciones de compra: radicación → jefe de área → compras (cotiza,
 * propone pago urgente) → aprobación financiera (tope Controller/Gerente) →
 * orden de compra automática (AAAA-386+) → entrega → recepción con
 * calificación de proveedor (9 criterios FORM-CPR-011).
 * Puerto React de views-requisiciones.js del módulo externo (4.019 líneas).
 */
import { useMemo, useState } from 'react';
import {
  FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaFileExcel, FaUndo, FaTruck, FaBoxOpen, FaBolt,
} from 'react-icons/fa';
import {
  CRITERIOS_CALIFICACION, ItemRequisicion, PayloadRequisicion, Requisicion,
  UsuarioFin, buscarCentrosCosto, crearRequisicion, importarLineasRequisicion,
  listarRequisiciones, reenviarRequisicion, transicionRequisicion,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, elegirSiNo, pedirTexto } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_JEFE = (u: UsuarioFin) => u.rol === 'jefe_area' || ES_ADMIN(u);
const ES_COMPRAS = (u: UsuarioFin) => u.rol === 'compras' || ES_ADMIN(u);
const ES_CONTROLLER = (u: UsuarioFin) => u.rol === 'controller' || ES_ADMIN(u);
const ES_GERENTE = (u: UsuarioFin) => u.rol === 'gerente_financiero' || ES_ADMIN(u);
const PUEDE_CREAR = (u: UsuarioFin) => ['requisicion', 'compras', 'admin'].includes(u.rol) || ES_ADMIN(u);
/** El tope viaja en la configuración; el front lo usa solo para UX (el backend manda). */
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

export default function RequisicionesP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const { datos, cargando, error, recargar } = useFinDatos<Requisicion[]>(
    () => listarRequisiciones({ estado: estado || undefined, solo_urgentes: soloUrgentes || undefined }),
    [estado, soloUrgentes],
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<Requisicion | null>(null);
  const [detalle, setDetalle] = useState<Requisicion | null>(null);

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Requisiciones de compra</h2>
        <div className="fin-filtros">
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

      {cargando && !datos && <div className="fin-vacio">Cargando requisiciones…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && <div className="fin-vacio">No hay requisiciones en este filtro.</div>}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>OC</th><th>Área</th><th>Solicitó</th><th>Proveedor</th>
                <th className="fin-num">Total</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="fin-link" onClick={() => setDetalle(r)}>{r.consecutivo}</button>
                    {r.es_urgente && <span title="Urgente" style={{ color: '#d97706', marginLeft: 4 }}><FaBolt /></span>}
                  </td>
                  <td>{r.oc_numero ?? '—'}</td>
                  <td>{r.area}</td>
                  <td>{r.solicitante_nombre}</td>
                  <td className="fin-suave">{r.proveedor_sugerido ?? '—'}</td>
                  <td className="fin-num">{pesos(r.total)}</td>
                  <td><span className={`fin-badge ${BADGE[r.estado] ?? 'fin-badgeGris'}`}>{ETIQUETA[r.estado] ?? r.estado}</span></td>
                  <td className="fin-acciones">
                    {r.estado === 'PENDIENTE_JEFE' && ES_JEFE(usuario) && usuario.area === r.area && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Aprobar (a compras)"
                                onClick={() => simple(r, 'APROBAR', recargar)}><FaCheck /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                onClick={() => simple(r, 'RECHAZAR', recargar)}><FaTimes /></button>
                      </>
                    )}
                    {r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en && ES_COMPRAS(usuario) && (
                      <button className="fin-btnIcono fin-icoAzul" title="Marcar entrega"
                              onClick={() => simple(r, 'ENTREGAR', recargar)}><FaTruck /></button>
                    )}
                    {(r.estado.startsWith('RECHAZADA')) && r.solicitante_id === usuario.id && (
                      <button className="fin-btnIcono fin-icoAzul" title="Corregir y reenviar"
                              onClick={() => setEditar(r)}><FaUndo /></button>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => setDetalle(r)}><FaEye /></button>
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
        <ModalReqDetalle req={detalle} usuario={usuario} tope={TOPE_CONTROLLER_DEFAULT}
                         onCerrar={() => setDetalle(null)}
                         onCorregir={(r) => { setDetalle(null); setEditar(r); }}
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

// ── Modal: nueva / corrección ──────────────────────────────────────────────

function ModalReqForm({ usuario, editar, onCerrar, onListo }: {
  usuario: UsuarioFin; editar: Requisicion | null; onCerrar: () => void; onListo: () => void;
}) {
  const [items, setItems] = useState<ItemRequisicion[]>(
    editar?.items?.length
      ? editar.items.map((i) => ({ ...i }))
      : [{ descripcion: '', cantidad: 1, unidad: 'UND', precio_unitario: 0, total: 0, centro_costo: '' }],
  );
  const [form, setForm] = useState({
    lugar_entrega: editar?.lugar_entrega ?? '',
    es_urgente: editar?.es_urgente ?? false,
    motivo_urgencia: editar?.motivo_urgencia ?? '',
    proveedor_sugerido: editar?.proveedor_sugerido ?? '',
    proveedor_nit: editar?.proveedor_nit ?? '',
    observaciones: editar?.observaciones ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.total) || 0), 0), [items]);
  const total = subtotal; // IVA por línea iría en el precio; edición posterior si el negocio lo pide

  const fijarItem = (i: number, cambios: Partial<ItemRequisicion>) => {
    setItems(items.map((it, j) => {
      if (j !== i) return it;
      const nuevo = { ...it, ...cambios };
      nuevo.total = Math.max(0, (Number(nuevo.cantidad) || 0) * (Number(nuevo.precio_unitario) || 0) - (Number(nuevo.descuento) || 0));
      return nuevo;
    }));
  };

  const validar = () => {
    if (form.lugar_entrega.trim().length < 2) return 'Indica el lugar de entrega.';
    for (const [i, it] of items.entries()) {
      if (!it.descripcion.trim()) return `Línea ${i + 1}: falta la descripción.`;
      if (!(Number(it.cantidad) > 0)) return `Línea ${i + 1}: cantidad inválida.`;
      if (!(Number(it.precio_unitario) > 0)) return `Línea ${i + 1}: precio unitario inválido.`;
      if (!it.centro_costo) return `Línea ${i + 1}: falta el centro de costo (búscalo por código o nombre).`;
    }
    if (form.es_urgente && !form.motivo_urgencia.trim()) return 'Las requisiciones urgentes exigen motivo.';
    return '';
  };

  const guardar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setGuardando(true);
    const payload: PayloadRequisicion = {
      lugar_entrega: form.lugar_entrega,
      es_urgente: form.es_urgente,
      motivo_urgencia: form.es_urgente ? form.motivo_urgencia : null,
      proveedor_sugerido: form.proveedor_sugerido || null,
      proveedor_nit: form.proveedor_nit || null,
      observaciones: form.observaciones || null,
      items: items.map((i) => ({ ...i, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), total: Number(i.total) })),
      subtotal: total, iva: 0, total,
    };
    try {
      const r = editar
        ? await reenviarRequisicion(editar.id, payload, editar.version)
        : await crearRequisicion(payload);
      toastFin(editar ? `${r.consecutivo} corregida y reenviada` : `${r.consecutivo} radicada (${ETIQUETA[r.estado]})`);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  const importarExcel = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await importarLineasRequisicion(file);
      if (r.items.length) {
        setItems(r.items);
        toastFin(`${r.total_lineas} líneas importadas${r.errores.length ? ` · ${r.errores.length} filas con error` : ''}`);
      }
      if (r.errores.length) {
        setError(`Filas con error: ${r.errores.slice(0, 5).map((e) => `#${e.fila} (${e.errores.join(', ')})`).join(' · ')}`);
      }
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error importando', 'mal');
    }
  };

  return (
    <ModalFin titulo={editar ? `Corregir ${editar.consecutivo}` : 'Nueva requisición de compra'} onCerrar={onCerrar} ancho={960}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Lugar de entrega">
          <input className="fin-input" value={form.lugar_entrega}
                 onChange={(e) => setForm({ ...form, lugar_entrega: e.target.value })} />
        </Campo>
        <Campo etiqueta="Proveedor sugerido">
          <input className="fin-input" value={form.proveedor_sugerido}
                 onChange={(e) => setForm({ ...form, proveedor_sugerido: e.target.value })} />
        </Campo>
        <Campo etiqueta="NIT del proveedor">
          <input className="fin-input" value={form.proveedor_nit}
                 onChange={(e) => setForm({ ...form, proveedor_nit: e.target.value })} />
        </Campo>
        <Campo etiqueta="Observaciones">
          <input className="fin-input" value={form.observaciones}
                 onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
        </Campo>
      </div>
      <label className="fin-check">
        <input type="checkbox" checked={form.es_urgente}
               onChange={(e) => setForm({ ...form, es_urgente: e.target.checked })} />
        Urgente
      </label>
      {form.es_urgente && (
        <Campo etiqueta="Motivo de la urgencia">
          <input className="fin-input" value={form.motivo_urgencia}
                 onChange={(e) => setForm({ ...form, motivo_urgencia: e.target.value })} />
        </Campo>
      )}

      <div className="fin-filaAcciones">
        <button className="fin-btn fin-btnSecundario"
                onClick={() => setItems([...items, { descripcion: '', cantidad: 1, unidad: 'UND', precio_unitario: 0, total: 0, centro_costo: '' }])}>
          <FaPlus /> Línea
        </button>
        <label className="fin-btn fin-btnSecundario">
          <FaFileExcel /> Importar Excel
          <input type="file" hidden accept=".xlsx"
                 onChange={(e) => importarExcel(e.target.files?.[0])} />
        </label>
        <a className="fin-link" href="#" onClick={(e) => { e.preventDefault(); window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fin/requisiciones/formato-cargue`, '_blank'); }}>
          Descargar plantilla
        </a>
        <span className="fin-total">Total: <b>{pesos(total)}</b></span>
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead>
            <tr>
              <th style={{ minWidth: 140 }}>Centro de costo</th><th>Descripción</th>
              <th className="fin-num">Cant.</th><th>Unidad</th>
              <th className="fin-num">Vr. unitario</th><th className="fin-num">Dcto</th>
              <th className="fin-num">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><SelectorCentroCosto valor={it.centro_costo ?? ''}
                                         onElegir={(cc) => fijarItem(i, { centro_costo: cc })} /></td>
                <td><input className="fin-input" style={{ minWidth: 200 }} value={it.descripcion}
                           onChange={(e) => fijarItem(i, { descripcion: e.target.value })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 70 }} type="number" min={1} value={it.cantidad}
                           onChange={(e) => fijarItem(i, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                <td><input className="fin-input" style={{ width: 70 }} value={it.unidad}
                           onChange={(e) => fijarItem(i, { unidad: e.target.value })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 110 }} type="number" min={0} value={it.precio_unitario}
                           onChange={(e) => fijarItem(i, { precio_unitario: parseFloat(e.target.value) || 0 })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 90 }} type="number" min={0} value={it.descuento ?? 0}
                           onChange={(e) => fijarItem(i, { descuento: parseFloat(e.target.value) || 0 })} /></td>
                <td className="fin-num">{pesos(it.total)}</td>
                <td>{items.length > 1 && (
                  <button className="fin-btnIcono fin-icoMal"
                          onClick={() => setItems(items.filter((_, j) => j !== i))}><FaTimes /></button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : editar ? 'Reenviar' : 'Radicar'}
        </button>
      </div>
    </ModalFin>
  );
}

/** Autocomplete de centro de costo contra el catálogo paginado (~49k). */
function SelectorCentroCosto({ valor, onElegir }: { valor: string; onElegir: (cc: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const [sugerencias, setSugerencias] = useState<{ codigo: string; nombre: string }[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const buscar = async (q: string) => {
    if (q.trim().length < 2) { setSugerencias(null); return; }
    setCargando(true);
    try {
      const r = await buscarCentrosCosto(q, 12);
      setSugerencias(r.items);
    } catch { setSugerencias([]); }
    finally { setCargando(false); }
  };

  return (
    <div className="fin-ccWrap">
      <input className="fin-input" style={{ width: '100%' }} value={texto} placeholder="Código o nombre…"
             onChange={(e) => { setTexto(e.target.value); onElegir(e.target.value); void buscar(e.target.value); }} />
      {!!sugerencias?.length && (
        <ul className="fin-ccLista">
          {sugerencias.map((c) => (
            <li key={c.codigo} onMouseDown={() => {
              setTexto(c.codigo);
              onElegir(c.codigo);
              setSugerencias(null);
            }}>
              <b>{c.codigo}</b> · {c.nombre}
            </li>
          ))}
        </ul>
      )}
      {cargando && <span className="fin-suave">buscando…</span>}
    </div>
  );
}

// ── Modal: detalle con bandejas por rol ────────────────────────────────────

function ModalReqDetalle({ req, usuario, tope, onCerrar, onCambio, onCorregir }: {
  req: Requisicion; usuario: UsuarioFin; tope: number;
  onCerrar: () => void; onCambio: () => void; onCorregir: (r: Requisicion) => void;
}) {
  const r = req;
  const [error, setError] = useState('');
  const [pagoUrgenteFecha, setPagoUrgenteFecha] = useState('');
  const [notas, setNotas] = useState<Record<string, number>>({});

  const esSolicitante = r.solicitante_id === usuario.id;
  const pasoJefe = r.estado === 'PENDIENTE_JEFE' && ES_JEFE(usuario) && (usuario.area === r.area || ES_ADMIN(usuario));
  const pasoCompras = r.estado === 'PENDIENTE_COMPRAS' && ES_COMPRAS(usuario);
  const pasoFinanciera = r.estado === 'PENDIENTE_FINANCIERA'
    && ((Number(r.total) <= tope && (ES_CONTROLLER(usuario) || ES_GERENTE(usuario))) ||
        (Number(r.total) > tope && ES_GERENTE(usuario)));
  const pasoEntrega = r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en && ES_COMPRAS(usuario);
  const pasoRecepcion = r.estado === 'EN_ORDEN_COMPRA' && r.entregado_en && (esSolicitante || ES_ADMIN(usuario));
  const puedeCorregir = esSolicitante && (r.estado === 'RECHAZADA_JEFE' || r.estado === 'RECHAZADA_FINANCIERA');

  const aprobarFinanciera = async () => {
    let datos: Record<string, unknown> | undefined;
    if (r.pago_urgente) {
      const decision = await elegirSiNo(
        `Aprobar ${r.consecutivo} con pago urgente`,
        'Elige si apruebas el pago urgente tal como lo propuso Compras.',
        'Aprobar con pago urgente', 'Aprobar sin pago urgente');
      if (decision === null) return; // cerró el diálogo
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
      <div className="fin-grid">
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[r.estado]}`}>{ETIQUETA[r.estado]}</span></Campo>
        <Campo etiqueta="Orden de compra">{r.oc_numero ?? '—'}</Campo>
        <Campo etiqueta="Área">{r.area}</Campo>
        <Campo etiqueta="Solicitó">{r.solicitante_nombre}</Campo>
        <Campo etiqueta="Radicada">{fechaCorta(r.created_at)}</Campo>
        <Campo etiqueta="Total">{pesos(r.total)}{Number(r.total) > tope ? ' (supera tope Controller)' : ''}</Campo>
        {r.proveedor_sugerido && <Campo etiqueta="Proveedor sugerido">{r.proveedor_sugerido} {r.proveedor_nit ? `· ${r.proveedor_nit}` : ''}</Campo>}
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
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>Centro costo</th><th>Descripción</th><th className="fin-num">Cant.</th><th className="fin-num">Vr. unit.</th><th className="fin-num">Total</th></tr></thead>
          <tbody>
            {r.items.map((it, i) => (
              <tr key={i}>
                <td>{it.centro_costo ?? '—'}</td><td>{it.descripcion}</td>
                <td className="fin-num">{it.cantidad} {it.unidad}</td>
                <td className="fin-num">{pesos(it.precio_unitario)}</td>
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
          <b>Aprobación financiera {Number(r.total) > tope ? '(Gerente financiero: supera tope)' : '(Controller)'}</b>
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
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
