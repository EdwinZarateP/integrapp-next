'use client';

/**
 * Traslados de presupuesto: jefe de área pide → Presidencia aprueba/rechaza.
 * Puerto React de views-traslados.js del módulo externo (772 líneas JS plano).
 */
import { useMemo, useState } from 'react';
import { FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaUndo } from 'react-icons/fa';
import {
  Traslado, TrasladoLinea, UsuarioFin,
  crearTraslado, listarTraslados, reenviarTraslado, transicionTraslado,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { BadgeEstadoFin, Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto, pedirTextoOpcional } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_PRESIDENCIA = (u: UsuarioFin) => u.rol === 'presidencia' || ES_ADMIN(u);
const PUEDE_CREAR = (u: UsuarioFin) => u.rol === 'jefe_area' || ES_ADMIN(u);

const ESTADOS = ['', 'PENDIENTE_PRESIDENCIA', 'APROBADO', 'RECHAZADO', 'ANULADO'];

interface LineaForm extends TrasladoLinea {}

export default function TrasladosP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<Traslado[]>(
    () => listarTraslados(estado || undefined), [estado],
  );

  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalle, setDetalle] = useState<Traslado | null>(null);

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Traslados de presupuesto</h2>
        <div className="fin-filtros">
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

      {cargando && !datos && <div className="fin-vacio">Cargando traslados…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && (
        <div className="fin-vacio">
          No hay traslados {estado ? 'en este estado' : 'todavía'}.{' '}
          {PUEDE_CREAR(usuario) && 'Crea la primera solicitud con «Nueva solicitud».'}
        </div>
      )}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>Área</th><th>Solicitó</th><th>Fecha</th>
                <th className="fin-num">Total</th><th>Estado</th><th>Decisión</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((t) => (
                <tr key={t.id} className={`fin-fila fin-fila-${t.estado}`}>
                  <td><button className="fin-link" onClick={() => setDetalle(t)}>{t.consecutivo}</button></td>
                  <td>{t.area}</td>
                  <td>{t.solicitante_nombre}</td>
                  <td>{fechaCorta(t.created_at)}</td>
                  <td className="fin-num">{pesos(t.total)}</td>
                  <td><BadgeEstadoFin estado={t.estado} /></td>
                  <td className="fin-suave">{t.aprobacion?.nombre ?? t.motivo_rechazo ?? '—'}</td>
                  <td className="fin-acciones">
                    {t.estado === 'PENDIENTE_PRESIDENCIA' && ES_PRESIDENCIA(usuario) && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Aprobar"
                                onClick={() => decidir(t, 'APROBAR', recargar)}><FaCheck /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                onClick={() => decidir(t, 'RECHAZAR', recargar)}><FaTimes /></button>
                      </>
                    )}
                    {t.estado === 'PENDIENTE_PRESIDENCIA' && (ES_ADMIN(usuario) || t.solicitante_id === usuario.id) && (
                      <button className="fin-btnIcono fin-icoGris" title="Anular"
                              onClick={() => decidir(t, 'ANULAR', recargar)}><FaBan /></button>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Detalle"
                            onClick={() => setDetalle(t)}><FaEye /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevo && (
        <ModalTrasladoNuevo
          usuario={usuario}
          onCerrar={() => setModalNuevo(false)}
          onCreado={() => { setModalNuevo(false); recargar(); }}
        />
      )}
      {detalle && (
        <ModalTrasladoDetalle
          traslado={detalle}
          usuario={usuario}
          onCerrar={() => setDetalle(null)}
          onCambio={() => { recargar(); setDetalle(null); }}
        />
      )}
    </div>
  );
}

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE_PRESIDENCIA: 'Pendiente Presidencia',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

async function decidir(t: Traslado, accion: 'APROBAR' | 'RECHAZAR' | 'ANULAR', recargar: () => void) {
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
    const r = await transicionTraslado(t.id, { accion, observacion, version: t.version });
    toastFin(`${t.consecutivo}: ${ETIQUETA_ESTADO[r.estado] ?? r.estado}`);
    recargar();
  } catch (e) {
    toastFin(e instanceof Error ? e.message : 'Error', 'mal');
  }
}

// ── Modal: nueva solicitud ─────────────────────────────────────────────────

function ModalTrasladoNuevo({ usuario, onCerrar, onCreado }: {
  usuario: UsuarioFin; onCerrar: () => void; onCreado: () => void;
}) {
  const [lineas, setLineas] = useState<LineaForm[]>([{ destinoRubro: '', monto: 0, motivo: '' }]);
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const total = useMemo(() => lineas.reduce((s, l) => s + (parseFloat(String(l.monto)) || 0), 0), [lineas]);

  const validar = () => {
    if (!lineas.length) return 'Agrega al menos una línea.';
    for (const [i, l] of lineas.entries()) {
      if (!l.destinoRubro.trim()) return `Línea ${i + 1}: falta el rubro destino.`;
      if (!(parseFloat(String(l.monto)) > 0)) return `Línea ${i + 1}: el monto debe ser mayor a cero.`;
      if (!l.motivo.trim()) return `Línea ${i + 1}: falta el motivo.`;
    }
    return '';
  };

  const guardar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setGuardando(true);
    try {
      const r = await crearTraslado({
        area: usuario.area || undefined,
        lineas: lineas.map((l) => ({ ...l, monto: parseFloat(String(l.monto)) })),
        observaciones: observaciones || null,
      });
      toastFin(`Solicitud ${r.consecutivo} enviada a Presidencia`);
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalFin titulo="Nueva solicitud de traslado" onCerrar={onCerrar} ancho={820}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave">
        Área destino: <b>{usuario.area ?? '(sin área configurada — consulta al administrador)'}</b> · El origen
        siempre es la Reserva de Presidencia.
      </p>
      <table className="fin-tabla fin-tablaCompacta">
        <thead>
          <tr><th>Rubro destino</th><th className="fin-num">Monto</th><th>Motivo</th><th></th></tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i}>
              <td><input className="fin-input" value={l.destinoRubro}
                         onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, destinoRubro: e.target.value } : x))}
                         placeholder="Grupo › Cuenta" /></td>
              <td><input className="fin-input fin-num" type="number" min={0} value={l.monto}
                         onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))} /></td>
              <td><input className="fin-input" value={l.motivo}
                         onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, motivo: e.target.value } : x))} /></td>
              <td>{lineas.length > 1 && (
                <button className="fin-btnIcono fin-icoMal"
                        onClick={() => setLineas(lineas.filter((_, j) => j !== i))}><FaTimes /></button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fin-filaAcciones">
        <button className="fin-btn fin-btnSecundario"
                onClick={() => setLineas([...lineas, { destinoRubro: '', monto: 0, motivo: '' }])}>
          <FaPlus /> Línea
        </button>
        <span className="fin-total">Total: <b>{pesos(total)}</b></span>
      </div>
      <Campo etiqueta="Observaciones (opcional)">
        <textarea className="fin-input" rows={2} value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={guardar} disabled={guardando}>
          {guardando ? 'Enviando…' : 'Enviar a Presidencia'}
        </button>
      </div>
    </ModalFin>
  );
}

// ── Modal: detalle (+ corrección si rechazado, adjuntos, historial) ────────

function ModalTrasladoDetalle({ traslado, usuario, onCerrar, onCambio }: {
  traslado: Traslado; usuario: UsuarioFin; onCerrar: () => void; onCambio: () => void;
}) {
  const t = traslado;
  const esCreador = t.solicitante_id === usuario.id;
  const puedeCorregir = esCreador && t.estado === 'RECHAZADO';
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [lineas, setLineas] = useState<LineaForm[]>(t.lineas);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  return (
    <ModalFin titulo={`Traslado ${t.consecutivo}`} onCerrar={onCerrar} ancho={860}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Estado"><BadgeEstadoFin estado={t.estado} /></Campo>
        <Campo etiqueta="Área destino">{t.area}</Campo>
        <Campo etiqueta="Solicitó">{t.solicitante_nombre}</Campo>
        <Campo etiqueta="Creado">{fechaCorta(t.created_at)}</Campo>
        {t.aprobacion && <Campo etiqueta="Aprobó">{t.aprobacion.nombre} ({t.aprobacion.cargo}) · {fechaCorta(t.aprobacion.at)}</Campo>}
        {t.motivo_rechazo && <Campo etiqueta="Motivo del rechazo"><span className="fin-textoMal">{t.motivo_rechazo}</span></Campo>}
      </div>

      <table className="fin-tabla fin-tablaCompacta">
        <thead><tr><th>Rubro destino</th><th className="fin-num">Monto</th><th>Motivo</th></tr></thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i}>
              <td>{corrigiendo ? (
                <input className="fin-input" value={l.destinoRubro}
                       onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, destinoRubro: e.target.value } : x))} />
              ) : l.destinoRubro}</td>
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
        <tfoot><tr><td><b>Total</b></td><td className="fin-num"><b>{pesos(lineas.reduce((s, l) => s + (parseFloat(String(l.monto)) || 0), 0))}</b></td><td></td></tr></tfoot>
      </table>

      {t.observaciones && <p className="fin-suave">Observaciones: {t.observaciones}</p>}

      {puedeCorregir && !corrigiendo && (
        <button className="fin-btn fin-btnSecundario" onClick={() => setCorrigiendo(true)}>
          <FaUndo /> Corregir y reenviar
        </button>
      )}
      {corrigiendo && (
        <div className="fin-filaAcciones">
          <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={async () => {
            setGuardando(true);
            try {
              const r = await reenviarTraslado(t.id, {
                lineas: lineas.map((l) => ({ ...l, monto: parseFloat(String(l.monto)) })),
                version: t.version,
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
        {t.estado === 'PENDIENTE_PRESIDENCIA' && (usuario.rol === 'presidencia' || ES_ADMIN(usuario)) && (
          <>
            <button className="fin-btn fin-btnPrimario" onClick={() => { onCerrar(); decidir(t, 'APROBAR', onCambio); }}><FaCheck /> Aprobar</button>
            <button className="fin-btn fin-btnMal" onClick={() => { onCerrar(); decidir(t, 'RECHAZAR', onCambio); }}><FaTimes /> Rechazar</button>
          </>
        )}
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
