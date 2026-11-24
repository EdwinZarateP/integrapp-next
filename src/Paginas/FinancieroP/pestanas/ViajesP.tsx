'use client';

/**
 * Viajes y anticipos: solicitud → autorización → presupuesto (tarifa A/B/C
 * confidencial) → tiquetes → anticipo → legalización → cierre.
 * Puerto React de views-viajes.js del módulo externo (1.135 líneas).
 */
import { useEffect, useState } from 'react';
import { FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaUndo, FaMoneyBillWave } from 'react-icons/fa';
import {
  AutorizadorViaje, CIUDADES_VIAJE, UsuarioFin, Viaje,
  corregirViaje, crearViaje, listarAutorizadores, listarViajes, transicionViaje,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirNumero, pedirTexto } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

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

export default function ViajesP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<Viaje[]>(
    () => listarViajes(estado || undefined), [estado],
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<Viaje | null>(null);
  const [detalle, setDetalle] = useState<Viaje | null>(null);

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Viajes y anticipos</h2>
        <div className="fin-filtros">
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e ? ETIQUETA[e] : 'Todos los estados'}</option>)}
          </select>
          <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
            <FaPlus /> Solicitar viaje
          </button>
        </div>
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando viajes…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && <div className="fin-vacio">No hay viajes para ti en este filtro.</div>}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>Ruta</th><th>Viajero</th><th>Fecha viaje</th>
                <th className="fin-num">Presupuesto</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((v) => (
                <tr key={v.id} className={`fin-fila fin-filaV-${v.estado}`}>
                  <td><button className="fin-link" onClick={() => setDetalle(v)}>{v.consecutivo}</button></td>
                  <td>{v.origen} → {v.destino}</td>
                  <td>{v.viajero_nombre}</td>
                  <td>{(v.fecha_inicio || '').slice(0, 10)}</td>
                  <td className="fin-num">{pesos(v.total_presupuesto)}</td>
                  <td><BadgeEstadoViaje estado={v.estado} /></td>
                  <td className="fin-acciones">
                    {v.estado === 'SOLICITADO' && ES_AUTORIZADOR(usuario) && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Autorizar"
                                onClick={() => accion(v, 'AUTORIZAR', recargar)}><FaCheck /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                onClick={() => accion(v, 'RECHAZAR', recargar)}><FaTimes /></button>
                      </>
                    )}
                    {(v.estado === 'SOLICITADO' || v.estado === 'RECHAZADO') && v.solicitante_id === usuario.id && (
                      v.estado === 'RECHAZADO'
                        ? <button className="fin-btnIcono fin-icoAzul" title="Corregir y reenviar"
                                  onClick={() => setEditar(v)}><FaUndo /></button>
                        : <button className="fin-btnIcono fin-icoGris" title="Anular"
                                  onClick={() => accion(v, 'ANULAR', recargar)}><FaBan /></button>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => setDetalle(v)}><FaEye /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modalNuevo || editar) && (
        <ModalViajeForm
          usuario={usuario}
          editar={editar}
          onCerrar={() => { setModalNuevo(false); setEditar(null); }}
          onListo={() => { setModalNuevo(false); setEditar(null); recargar(); }}
        />
      )}
      {detalle && (
        <ModalViajeDetalle viaje={detalle} usuario={usuario}
                           onCerrar={() => setDetalle(null)}
                           onCorregir={(v) => { setDetalle(null); setEditar(v); }}
                           onCambio={() => { recargar(); setDetalle(null); }} />
      )}
    </div>
  );
}

function BadgeEstadoViaje({ estado }: { estado: string }) {
  const claves: Record<string, string> = {
    SOLICITADO: 'fin-badgeAmb', AUTORIZADO: 'fin-badgeInfo', PRESUPUESTO_ASIGNADO: 'fin-badgeInfo',
    TIQUETES_GESTIONADOS: 'fin-badgeAmb', ANTICIPO_PAGADO: 'fin-badgeOk',
    LEGALIZADO: 'fin-badgeOk', CERRADO: 'fin-badgeGris', RECHAZADO: 'fin-badgeMal', ANULADO: 'fin-badgeMal',
  };
  return <span className={`fin-badge ${claves[estado] ?? 'fin-badgeGris'}`}>{ETIQUETA[estado] ?? estado}</span>;
}

async function accion(v: Viaje, acc: string, recargar: () => void, datosAdicionales?: Record<string, unknown>) {
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
    recargar();
  } catch (e) {
    toastFin(e instanceof Error ? e.message : 'Error', 'mal');
  }
}

// ── Modal: solicitar / corregir viaje ──────────────────────────────────────

function ModalViajeForm({ usuario, editar, onCerrar, onListo }: {
  usuario: UsuarioFin; editar: Viaje | null; onCerrar: () => void; onListo: () => void;
}) {
  const [autorizadores, setAutorizadores] = useState<AutorizadorViaje[] | null>(null);
  const [form, setForm] = useState({
    origen: editar?.origen ?? 'BARRANQUILLA',
    destino: editar?.destino ?? 'BOGOTA',
    fecha_inicio: (editar?.fecha_inicio ?? '').slice(0, 10),
    fecha_fin: (editar?.fecha_fin ?? '').slice(0, 10),
    objetivo: editar?.objetivo ?? '',
    autorizador_id: editar?.autorizador_id ?? '',
    requiere_tiquetes: editar?.requiere_tiquetes ?? true,
    observaciones: editar?.observaciones ?? '',
    viajero_cargo: editar?.viajero_cargo ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarAutorizadores().then(setAutorizadores).catch(() => setAutorizadores([]));
  }, []);

  const guardar = async () => {
    if (!form.fecha_inicio || !form.fecha_fin) return setError('Define las fechas del viaje.');
    if (form.objetivo.trim().length < 3) return setError('Describe el objetivo del viaje.');
    if (!form.autorizador_id) return setError('Elige quién autoriza.');
    if (form.fecha_fin < form.fecha_inicio) return setError('La fecha de fin es anterior a la de inicio.');
    setGuardando(true);
    const payload = {
      viajero_nombre: usuario.nombre,
      origen: form.origen, destino: form.destino,
      fecha_inicio: new Date(form.fecha_inicio + 'T08:00:00').toISOString(),
      fecha_fin: new Date(form.fecha_fin + 'T18:00:00').toISOString(),
      objetivo: form.objetivo,
      autorizador_id: form.autorizador_id,
      requiere_tiquetes: form.requiere_tiquetes,
      observaciones: form.observaciones || null,
      viajero_cargo: form.viajero_cargo || null,
    };
    try {
      const r = editar
        ? await corregirViaje(editar.id, payload, editar.version)
        : await crearViaje(payload);
      toastFin(editar
        ? `${r.consecutivo} corregido y reenviado a autorización`
        : `Solicitud ${r.consecutivo} enviada a autorización`);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={editar ? `Corregir viaje ${editar.consecutivo}` : 'Solicitud de viaje'} onCerrar={onCerrar} ancho={680}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave">Viajero: <b>{usuario.nombre}</b> (solo puedes solicitar viajes para ti).</p>
      <div className="fin-grid">
        <Campo etiqueta="Origen">
          <select className="fin-input" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
            {CIUDADES_VIAJE.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Destino">
          <select className="fin-input" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}>
            {CIUDADES_VIAJE.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha inicio">
          <input type="date" className="fin-input" value={form.fecha_inicio}
                 onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Fecha fin">
          <input type="date" className="fin-input" value={form.fecha_fin}
                 onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
        </Campo>
        <Campo etiqueta="Cargo del viajero (opcional)">
          <input className="fin-input" value={form.viajero_cargo}
                 onChange={(e) => setForm({ ...form, viajero_cargo: e.target.value })} />
        </Campo>
        <Campo etiqueta="Autoriza">
          <select className="fin-input" value={form.autorizador_id}
                  onChange={(e) => setForm({ ...form, autorizador_id: e.target.value })}>
            <option value="">— elegir —</option>
            {autorizadores?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Objetivo del viaje">
        <textarea className="fin-input" rows={2} value={form.objetivo}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
      </Campo>
      <Campo etiqueta="Observaciones (opcional)">
        <textarea className="fin-input" rows={2} value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
      </Campo>
      <label className="fin-check">
        <input type="checkbox" checked={form.requiere_tiquetes}
               onChange={(e) => setForm({ ...form, requiere_tiquetes: e.target.checked })} />
        Requiere gestión de tiquetes por Compras
      </label>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={guardar} disabled={guardando}>
          {guardando ? 'Enviando…' : editar ? 'Reenviar a autorización' : 'Enviar a autorización'}
        </button>
      </div>
    </ModalFin>
  );
}

// ── Modal: detalle con acciones por paso ───────────────────────────────────

function ModalViajeDetalle({ viaje, usuario, onCerrar, onCambio, onCorregir }: {
  viaje: Viaje; usuario: UsuarioFin; onCerrar: () => void; onCambio: () => void; onCorregir: (v: Viaje) => void;
}) {
  const v = viaje;
  const [ppto, setPpto] = useState({ categoria_tarifa: v.categoria_tarifa ?? 'A', total: v.total_presupuesto || 0 });
  const [error, setError] = useState('');

  const puedePpto = v.estado === 'AUTORIZADO' && ES_CONTROLLER(usuario);
  const puedeTiquetes = v.estado === 'PRESUPUESTO_ASIGNADO' && ES_COMPRAS(usuario) && v.requiere_tiquetes;
  const puedeAnticipo = v.estado === 'TIQUETES_GESTIONADOS' && ES_TESORERIA(usuario);
  const puedeLegalizar = v.estado === 'ANTICIPO_PAGADO'
    && (v.solicitante_id === usuario.id || ['contabilidad', 'tesoreria'].includes(usuario.rol) || ES_ADMIN(usuario));
  const puedeCerrar = v.estado === 'LEGALIZADO' && ES_CONTA(usuario);
  const puedeCorregir = v.solicitante_id === usuario.id && v.estado === 'RECHAZADO';

  return (
    <ModalFin titulo={`Viaje ${v.consecutivo}`} onCerrar={onCerrar} ancho={860}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Estado"><BadgeEstadoViaje estado={v.estado} /></Campo>
        <Campo etiqueta="Ruta">{v.origen} → {v.destino}</Campo>
        <Campo etiqueta="Viajero">{v.viajero_nombre}{v.viajero_cargo ? ` (${v.viajero_cargo})` : ''}</Campo>
        <Campo etiqueta="Fechas">{fechaCorta(v.fecha_inicio)} → {fechaCorta(v.fecha_fin)}</Campo>
        <Campo etiqueta="Objetivo">{v.objetivo}</Campo>
        <Campo etiqueta="Presupuesto">{pesos(v.total_presupuesto)}</Campo>
        <Campo etiqueta="Categoría de tarifa">
          {v.categoria_tarifa ?? <span className="fin-suave">confidencial</span>}
        </Campo>
        {v.observacion_autorizacion && (
          <Campo etiqueta="Observación de autorización">
            <span className={v.estado === 'RECHAZADO' ? 'fin-textoMal' : ''}>{v.observacion_autorizacion}</span>
          </Campo>
        )}
      </div>

      {puedePpto && (
        <div className="fin-pasoCard">
          <h4 className="fin-subtitulo">Asignar presupuesto y tarifa (Controller)</h4>
          <div className="fin-filaAcciones">
            <select className="fin-input" value={ppto.categoria_tarifa}
                    onChange={(e) => setPpto({ ...ppto, categoria_tarifa: e.target.value })}>
              <option value="A">Categoría A</option><option value="B">Categoría B</option><option value="C">Categoría C</option>
            </select>
            <input className="fin-input fin-num" type="number" min={0} value={ppto.total}
                   onChange={(e) => setPpto({ ...ppto, total: parseFloat(e.target.value) || 0 })} />
            <button className="fin-btn fin-btnPrimario" onClick={async () => {
              try {
                await transicionViaje(v.id, {
                  accion: 'ASIGNAR_PRESUPUESTO', version: v.version,
                  datos_adicionales: { categoria_tarifa: ppto.categoria_tarifa, total: ppto.total },
                });
                toastFin('Presupuesto asignado'); onCambio();
              } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
            }}>Asignar</button>
          </div>
        </div>
      )}

      {(puedeTiquetes || puedeAnticipo || puedeLegalizar || puedeCerrar) && (
        <div className="fin-pasoCard fin-filaAcciones">
          {puedeTiquetes && (
            <button className="fin-btn fin-btnPrimario"
                    onClick={() => accion(v, 'REGISTRAR_TIQUETES', onCambio, { registrado_por: usuario.nombre })}>
              Registrar tiquetes gestionados
            </button>
          )}
          {puedeAnticipo && (
            <button className="fin-btn fin-btnPrimario" onClick={async () => {
              const valor = await pedirNumero('Registrar anticipo pagado', `${v.consecutivo} · presupuesto ${pesos(v.total_presupuesto)}`);
              if (valor === null) return;
              accion(v, 'PAGAR_ANTICIPO', onCambio, { valor });
            }}><FaMoneyBillWave /> Registrar anticipo pagado</button>
          )}
          {puedeLegalizar && (
            <button className="fin-btn fin-btnPrimario"
                    onClick={() => accion(v, 'LEGALIZAR', onCambio, { legalizado_por: usuario.nombre })}>
              Legalizar viaje
            </button>
          )}
          {puedeCerrar && (
            <button className="fin-btn fin-btnPrimario" onClick={() => accion(v, 'CERRAR', onCambio)}>Cerrar viaje</button>
          )}
        </div>
      )}

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
        {v.estado === 'SOLICITADO' && ES_AUTORIZADOR(usuario) && (
          <>
            <button className="fin-btn fin-btnPrimario" onClick={() => { onCerrar(); accion(v, 'AUTORIZAR', onCambio); }}><FaCheck /> Autorizar</button>
            <button className="fin-btn fin-btnMal" onClick={() => { onCerrar(); accion(v, 'RECHAZAR', onCambio); }}><FaTimes /> Rechazar</button>
          </>
        )}
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
