'use client';

/** Servicios públicos y corporativos por inmueble/periodo (ex 'utilities'). */
import { useState } from 'react';
import { FaPlus, FaStamp, FaMoneyBillWave } from 'react-icons/fa';
import {
  ServicioPublicoFin, UsuarioFin, crearServicio, listarServicios, transicionServicio,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirFecha } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const PUEDE_EDITAR = (u: UsuarioFin) => ['tesoreria', 'contabilidad'].includes(u.rol) || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = { PENDIENTE: 'Pendiente', CAUSADO: 'Causado', PAGADO: 'Pagado' };
const BADGE: Record<string, string> = { PENDIENTE: 'fin-badgeAmb', CAUSADO: 'fin-badgeInfo', PAGADO: 'fin-badgeOk' };

const hoyPeriodo = () => new Date().toISOString().slice(0, 7);

export default function ServiciosP({ usuario }: { usuario: UsuarioFin }) {
  const [periodo, setPeriodo] = useState(hoyPeriodo());
  const [estado, setEstado] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos(
    () => listarServicios({ periodo: periodo || undefined, estado: estado || undefined }), [periodo, estado],
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalle, setDetalle] = useState<ServicioPublicoFin | null>(null);

  const actuar = async (s: ServicioPublicoFin, accion: 'CAUSAR' | 'PAGAR') => {
    let fechaPago: string | undefined;
    if (accion === 'PAGAR') {
      const f = await pedirFecha(`Pagar ${s.servicio} · ${s.inmueble}`);
      if (f === null) return;
      fechaPago = f || undefined;
    } else if (!(await confirmar(`Causar ${s.servicio}`, `Inmueble ${s.inmueble} · ${s.periodo}`))) return;
    try {
      await transicionServicio(s.id, { accion, fecha_pago: fechaPago, version: s.version });
      toastFin(`${s.servicio} · ${s.inmueble}: ${accion === 'PAGAR' ? 'pagado' : 'causado'}`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Servicios públicos</h2>
        <div className="fin-filtros">
          <input type="month" className="fin-input" value={periodo}
                 onChange={(e) => setPeriodo(e.target.value)} />
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {Object.keys(ETIQUETA).map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
          </select>
          {PUEDE_EDITAR(usuario) && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
              <FaPlus /> Registrar servicio
            </button>
          )}
        </div>
      </div>

      {datos && (
        <p className="fin-suave">
          {datos.resumen.cantidad} servicio(s) · Total <b>{pesos(datos.resumen.total)}</b> ·
          Pendiente <b>{pesos(datos.resumen.pendiente)}</b>
        </p>
      )}
      {cargando && !datos && <div className="fin-vacio">Cargando servicios…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.servicios.length === 0 && !cargando && (
        <div className="fin-vacio">Sin servicios registrados en {periodo}.</div>
      )}

      {!!datos?.servicios.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Servicio</th><th>Inmueble</th><th>Periodo</th><th>Límite</th>
                <th className="fin-num">Valor</th><th>Estado</th><th>Pagado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.servicios.map((s) => (
                <tr key={s.id}>
                  <td><button className="fin-link" onClick={() => setDetalle(s)}>{s.servicio}</button></td>
                  <td>{s.inmueble}</td>
                  <td>{s.periodo}</td>
                  <td>{s.fecha_limite ?? '—'}</td>
                  <td className="fin-num">{pesos(s.valor)}</td>
                  <td><span className={`fin-badge ${BADGE[s.estado]}`}>{ETIQUETA[s.estado]}</span></td>
                  <td className="fin-suave">{s.fecha_pago ?? '—'}</td>
                  <td className="fin-acciones">
                    {s.estado === 'PENDIENTE' && PUEDE_EDITAR(usuario) && (
                      <button className="fin-btnIcono fin-icoAzul" title="Causar"
                              onClick={() => actuar(s, 'CAUSAR')}><FaStamp /></button>
                    )}
                    {s.estado !== 'PAGADO' && PUEDE_EDITAR(usuario) && (
                      <button className="fin-btnIcono fin-icoOk" title="Marcar pagado"
                              onClick={() => actuar(s, 'PAGAR')}><FaMoneyBillWave /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevo && (
        <ModalServicioNuevo periodo={periodo} onCerrar={() => setModalNuevo(false)}
                             onCreado={() => { setModalNuevo(false); recargar(); }} />
      )}
      {detalle && (
        <ModalFin titulo={`${detalle.servicio} · ${detalle.inmueble}`} onCerrar={() => setDetalle(null)} ancho={640}>
          <div className="fin-grid">
            <Campo etiqueta="Periodo">{detalle.periodo}</Campo>
            <Campo etiqueta="Valor">{pesos(detalle.valor)}</Campo>
            <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[detalle.estado]}`}>{ETIQUETA[detalle.estado]}</span></Campo>
            {detalle.datos.contrato ? <Campo etiqueta="Contrato">{String(detalle.datos.contrato)}</Campo> : null}
            {detalle.datos.portal ? (
              <Campo etiqueta="Portal de pago">
                <a className="fin-link" href={String(detalle.datos.portal)} target="_blank" rel="noopener noreferrer">Abrir portal ↗</a>
              </Campo>
            ) : null}
          </div>
          <AdjuntosFin modulo="servicio" referencia={detalle.id} />
          <div className="fin-modalPie">
            <button className="fin-btn fin-btnSecundario" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
        </ModalFin>
      )}
    </div>
  );
}

function ModalServicioNuevo({ periodo, onCerrar, onCreado }: {
  periodo: string; onCerrar: () => void; onCreado: () => void;
}) {
  const [form, setForm] = useState({ servicio: 'Energía', inmueble: '', valor: 0, fecha_limite: '', contrato: '', portal: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (!form.inmueble.trim()) return setError('Indica el inmueble.');
    if (!(form.valor > 0)) return setError('El valor debe ser mayor a cero.');
    setGuardando(true);
    try {
      await crearServicio({
        servicio: form.servicio, inmueble: form.inmueble, periodo, valor: form.valor,
        fecha_limite: form.fecha_limite || null,
        datos: { contrato: form.contrato || null, portal: form.portal || null },
      });
      toastFin('Servicio registrado');
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={`Registrar servicio · ${periodo}`} onCerrar={onCerrar} ancho={620}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Servicio">
          <select className="fin-input" value={form.servicio}
                  onChange={(e) => setForm({ ...form, servicio: e.target.value })}>
            {['Energía', 'Agua', 'Gas', 'Internet', 'Telefonía', 'Aseo', 'Alquiler', 'Seguridad', 'Otro'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Inmueble">
          <input className="fin-input" value={form.inmueble}
                 onChange={(e) => setForm({ ...form, inmueble: e.target.value })} />
        </Campo>
        <Campo etiqueta="Valor">
          <input className="fin-input fin-num" type="number" min={0} value={form.valor}
                 onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
        </Campo>
        <Campo etiqueta="Fecha límite (opcional)">
          <input type="date" className="fin-input" value={form.fecha_limite}
                 onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
        </Campo>
        <Campo etiqueta="Contrato / NIT (opcional)">
          <input className="fin-input" value={form.contrato}
                 onChange={(e) => setForm({ ...form, contrato: e.target.value })} />
        </Campo>
        <Campo etiqueta="Portal de pago (opcional)">
          <input className="fin-input" value={form.portal} placeholder="https://…"
                 onChange={(e) => setForm({ ...form, portal: e.target.value })} />
        </Campo>
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Registrar'}
        </button>
      </div>
    </ModalFin>
  );
}
