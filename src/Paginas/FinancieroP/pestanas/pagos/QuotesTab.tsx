'use client';

/**
 * Pestaña «Cotizaciones y anticipos» (ex 'quotes' del original): segmentos
 * Todos pendientes / Cotizaciones / Anticipos / Historial, anticipo con
 * comprobante EGC/ANT/BG-TR (proceso + sede de caja menor) y checkbox
 * «Programar también en Pagos Urgentes», legalización y cruce con facturas
 * DIAN por cercanía de valor.
 */
import { useEffect, useState } from 'react';
import { FaPlus, FaCheck, FaTimes, FaUndo, FaExchangeAlt, FaTrash } from 'react-icons/fa';
import {
  PagoUrgente, QuoteFin, ResumenPagos, SedeCajaFin, UsuarioFin, candidatosQuote, cerrarQuote,
  crearQuote, cruzarQuote, descruzarQuote, eliminarQuote, listarQuotes, legalizarQuote,
  listarSedesCajas, listarPagos,
} from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../../nucleo/componentes';
import { useFinDatos } from '../../nucleo/useFinDatos';
import { confirmar, pedirTexto, pedirTextoOpcional } from '../../nucleo/dialogos';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';

const ETIQUETA: Record<string, string> = {
  PENDIENTE: 'Por cruzar', CRUZADA: 'Cruzada', LEGALIZADA: 'Legalizada', CERRADA: 'Cerrada',
};
const BADGE: Record<string, string> = {
  PENDIENTE: 'fin-badgeAmb', CRUZADA: 'fin-badgeInfo', LEGALIZADA: 'fin-badgeOk', CERRADA: 'fin-badgeGris',
};
const TIPOS_COMPROBANTE = ['EGC', 'ANT', 'BG-TR'] as const;
const PROCESOS = ['CAJAS MENORES', 'VIAJES VIATICOS', 'OTROS'] as const;

export default function QuotesTab({ usuario, onPagoCreado }: {
  usuario: UsuarioFin; onPagoCreado: () => void;
}) {
  const [segmento, setSegmento] = useState('pendientes');
  const [busqueda, setBusqueda] = useState('');
  const [modalAnticipo, setModalAnticipo] = useState(false);
  const [cruce, setCruce] = useState<QuoteFin | null>(null);
  const { datos, cargando, error, recargar } = useFinDatosWrapper(segmento, busqueda);

  const actuar = async (fn: () => Promise<unknown>, mensaje: string, refrescar = recargar) => {
    try {
      await fn();
      toastFin(mensaje);
      refrescar();
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <div>
      <div className="fin-tabs">
        {([
          ['pendientes', 'Todos pendientes'],
          ['cotizaciones', 'Cotizaciones'],
          ['anticipos', 'Anticipos'],
          ['historial', 'Historial cerradas'],
        ] as [string, string][]).map(([s, l]) => (
          <button key={s} className={`fin-tab ${segmento === s ? 'fin-tabActivo' : ''}`} onClick={() => setSegmento(s)}>
            {l} {(datos ?? []).length > 0 && segmento === s && <span className="fin-badge fin-badgeGris">{datos!.length}</span>}
          </button>
        ))}
        <input className="fin-input" style={{ width: 220, marginLeft: 'auto' }}
               placeholder="Buscar proveedor, NIT, sede…" value={busqueda}
               onChange={(e) => setBusqueda(e.target.value)} />
        <button className="fin-btn fin-btnPrimario" onClick={() => setModalAnticipo(true)}>
          <FaPlus /> {segmento === 'cotizaciones' ? 'Nueva cotización' : 'Nuevo anticipo'}
        </button>
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && <div className="fin-vacio">Sin registros en este segmento.</div>}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Tipo</th><th>Comprobante / Proceso</th><th>Proveedor</th><th className="fin-num">Valor</th>
                <th>Fecha</th><th>Estado</th><th>Factura</th><th>Pago</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((q) => (
                <tr key={q.id}>
                  <td>{q.tipo === 'ANTICIPO' ? '💵 Anticipo' : '🧾 Cotización'}</td>
                  <td>{q.tipo_comprobante ?? '—'}{q.proceso ? ` · ${q.proceso}` : ''}{q.sede_cm ? ` · ${q.sede_cm}` : ''}</td>
                  <td title={q.nit ?? ''}>{q.proveedor}</td>
                  <td className="fin-num">{pesos(q.valor)}</td>
                  <td>{(q.fecha ?? '').slice(0, 10)}</td>
                  <td><span className={`fin-badge ${BADGE[q.estado]}`}>{ETIQUETA[q.estado]}</span></td>
                  <td>{q.factura_numero ?? '—'}</td>
                  <td>{q.pago_id ? '✅ Programado' : '—'}</td>
                  <td className="fin-acciones">
                    {q.estado === 'PENDIENTE' && (
                      <button className="fin-btnIcono fin-icoAzul" title="Cruzar con factura DIAN"
                              onClick={() => setCruce(q)}><FaExchangeAlt /></button>
                    )}
                    {q.estado === 'CRUZADA' && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Legalizar (fecha, soportes, recibos)"
                                onClick={async () => {
                                  const obs = await pedirTextoOpcional(`Legalizar ${q.proveedor}`, 'Observaciones de la legalización');
                                  if (obs === null) return;
                                  void actuar(() => legalizarQuote(q.id, { observaciones: obs ?? undefined }), 'Legalizada');
                                }}><FaCheck /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Deshacer cruce"
                                onClick={() => void actuar(() => descruzarQuote(q.id), 'Cruce deshecho')}><FaTimes /></button>
                      </>
                    )}
                    {q.estado === 'LEGALIZADA' && (
                      <button className="fin-btnIcono fin-icoOk" title="Cerrar"
                              onClick={() => void actuar(() => cerrarQuote(q.id), 'Cerrada')}><FaCheck /></button>
                    )}
                    {ES_ADMIN(usuario) && (
                      <button className="fin-btnIcono fin-icoGris" title="Eliminar (admin)"
                              onClick={async () => {
                                if (await confirmar('Eliminar registro', 'Acción irreversible.')) {
                                  void actuar(() => eliminarQuote(q.id), 'Eliminado');
                                }
                              }}><FaTrash /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAnticipo && (
        <ModalAnticipo tipo={segmento === 'cotizaciones' ? 'COTIZACION' : 'ANTICIPO'}
                       onCerrar={() => setModalAnticipo(false)}
                       onListo={() => { setModalAnticipo(false); recargar(); onPagoCreado(); }} />
      )}
      {cruce && (
        <ModalCruceQuote quote={cruce} onCerrar={() => setCruce(null)}
                         onListo={() => { setCruce(null); recargar(); }} />
      )}
    </div>
  );
}

function useFinDatosWrapper(segmento: string, busqueda: string) {
  return useFinDatos<QuoteFin[]>(
    () => listarQuotes({ segmento, q: busqueda.trim() || undefined }), [segmento, busqueda],
  );
}

function ModalAnticipo({ tipo, onCerrar, onListo }: {
  tipo: 'COTIZACION' | 'ANTICIPO'; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState({
    tipo_comprobante: 'EGC' as string, proceso: 'CAJAS MENORES' as string,
    sede_cm: '', proveedor: '', nit: '', valor: 0, fecha: new Date().toISOString().slice(0, 10),
    crearPago: false, observaciones: '',
  });
  const { datos: sedes } = useFinDatosWrapper2();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  return (
    <ModalFin titulo={tipo === 'ANTICIPO' ? 'Nuevo anticipo interno' : 'Nueva cotización'} onCerrar={onCerrar} ancho={640}>
      {error && <div className="fin-error">{error}</div>}
      {tipo === 'ANTICIPO' && (
        <div className="fin-grid">
          <Campo etiqueta="Tipo de comprobante *">
            <select className="fin-input" value={form.tipo_comprobante}
                    onChange={(e) => setForm({ ...form, tipo_comprobante: e.target.value })}>
              {TIPOS_COMPROBANTE.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Proceso *">
            <select className="fin-input" value={form.proceso}
                    onChange={(e) => setForm({ ...form, proceso: e.target.value })}>
              {PROCESOS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Sede de caja menor (para CAJAS MENORES)">
            <select className="fin-input" value={form.sede_cm}
                    onChange={(e) => setForm({ ...form, sede_cm: e.target.value })}>
              <option value="">— Ninguna —</option>
              {(sedes ?? []).map((s) => <option key={s.id} value={s.nombre}>{s.etiqueta ?? s.nombre}</option>)}
            </select>
          </Campo>
        </div>
      )}
      <div className="fin-grid">
        <Campo etiqueta="Proveedor / Beneficiario *">
          <input className="fin-input" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
        </Campo>
        <Campo etiqueta="NIT / C.C.">
          <input className="fin-input" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
        </Campo>
        <Campo etiqueta="Valor *">
          <input className="fin-input fin-num" type="number" min={0} value={form.valor || ''}
                 onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" className="fin-input" value={form.fecha}
                 onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </Campo>
      </div>
      <Campo etiqueta="Observaciones">
        <input className="fin-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
      </Campo>
      <label className="fin-check">
        <input type="checkbox" checked={form.crearPago}
               onChange={(e) => setForm({ ...form, crearPago: e.target.checked })} />
        Programar también en Pagos Urgentes
      </label>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          if (!form.proveedor.trim() || !(form.valor > 0)) {
            setError('Proveedor y valor son obligatorios.');
            return;
          }
          setGuardando(true);
          crearQuote({
            tipo, tipo_comprobante: tipo === 'ANTICIPO' ? form.tipo_comprobante : null,
            proceso: tipo === 'ANTICIPO' ? form.proceso : null,
            sede_cm: form.sede_cm || null, proveedor: form.proveedor, nit: form.nit || null,
            valor: form.valor, fecha: `${form.fecha}T12:00:00`,
            crear_pago: form.crearPago, observaciones: form.observaciones || null,
          }).then(() => {
            toastFin(form.crearPago ? 'Creado y programado en Pagos Urgentes' : 'Creado');
            onListo();
          }).catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>{guardando ? 'Guardando…' : 'Crear'}</button>
      </div>
    </ModalFin>
  );
}

function useFinDatosWrapper2() {
  return useFinDatos<SedeCajaFin[]>(() => listarSedesCajas(), []);
}

function ModalCruceQuote({ quote, onCerrar, onListo }: {
  quote: QuoteFin; onCerrar: () => void; onListo: () => void;
}) {
  const [candidatos, setCandidatos] = useState<{ id: string; numero_factura: string; proveedor: string; total: number; estado: string; diferencia: number }[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const { datos } = useFinDatos(candidatosQuote.bind(null, quote.id), [quote.id]);
  useEffect(() => { if (datos) setCandidatos(datos); }, [datos]);
  return (
    <ModalFin titulo={`Cruzar con factura · ${quote.proveedor}`} onCerrar={onCerrar} ancho={680}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Candidatas del mismo NIT ordenadas por cercanía de valor ({pesos(quote.valor)}).
      </p>
      {!candidatos && <div className="fin-vacio">Buscando candidatas…</div>}
      {candidatos && candidatos.length === 0 && (
        <div className="fin-vacio">No hay facturas cruzables de este proveedor. Cárgala primero desde Facturas DIAN.</div>
      )}
      {!!candidatos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla fin-tablaCompacta">
            <thead><tr><th>Nº factura</th><th>Estado</th><th className="fin-num">Total</th><th className="fin-num">Diferencia</th><th></th></tr></thead>
            <tbody>
              {candidatos.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero_factura}</td>
                  <td>{c.estado}</td>
                  <td className="fin-num">{pesos(c.total)}</td>
                  <td className="fin-num">{Math.abs(c.diferencia) < 1 ? 'Igual valor' : `Dif: ${pesos(c.diferencia)}`}</td>
                  <td>
                    <button className="fin-btn fin-btnSecundario" disabled={guardando}
                            onClick={() => {
                              setGuardando(true);
                              cruzarQuote(quote.id, c.id)
                                .then(() => { toastFin('Cruzada'); onListo(); })
                                .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
                                .finally(() => setGuardando(false));
                            }}>Cruzar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalFin>
  );
}
