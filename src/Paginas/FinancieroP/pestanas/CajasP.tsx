'use client';

/** Cajas menores: legalización de gastos por sede y periodo (ex 'minorCash'). */
import { useMemo, useState } from 'react';
import { FaPlus, FaCheck, FaBalanceScale, FaLockOpen } from 'react-icons/fa';
import {
  CajaMenorFin, MovimientoCajaFin, UsuarioFin, crearCaja, guardarCaja,
  listarCajas, transicionCaja,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, pesos, toastFin } from '../nucleo/componentes';
import { confirmar } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_CONTA = (u: UsuarioFin) => u.rol === 'contabilidad' || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = { EN_EDICION: 'En edición', LEGALIZADA: 'Legalizada', CONTABILIZADA: 'Contabilizada' };
const BADGE: Record<string, string> = { EN_EDICION: 'fin-badgeAmb', LEGALIZADA: 'fin-badgeInfo', CONTABILIZADA: 'fin-badgeOk' };

const hoyPeriodo = () => new Date().toISOString().slice(0, 7);

export default function CajasP({ usuario }: { usuario: UsuarioFin }) {
  const [periodo, setPeriodo] = useState(hoyPeriodo());
  const [estado, setEstado] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<CajaMenorFin[]>(
    () => listarCajas({ periodo: periodo || undefined, estado: estado || undefined }), [periodo, estado],
  );
  const [abierta, setAbierta] = useState<CajaMenorFin | null>(null);
  const [modalNueva, setModalNueva] = useState(false);

  const actuar = async (c: CajaMenorFin, accion: 'LEGALIZAR' | 'CONTABILIZAR' | 'REABRIR') => {
    if (accion === 'CONTABILIZAR' &&
        !(await confirmar(`Contabilizar caja ${c.sede}`, `Periodo ${c.periodo} · gastos ${pesos(c.total_gastos)}. Se genera el asiento contable.`))) return;
    try {
      await transicionCaja(c.id, { accion, version: c.version });
      toastFin(`${c.sede}: ${ETIQUETA[accion === 'REABRIR' ? 'EN_EDICION' : accion === 'LEGALIZAR' ? 'LEGALIZADA' : 'CONTABILIZADA']}`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Cajas menores</h2>
        <div className="fin-filtros">
          <input type="month" className="fin-input" value={periodo}
                 onChange={(e) => setPeriodo(e.target.value)} />
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {Object.keys(ETIQUETA).map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
          </select>
          <button className="fin-btn fin-btnPrimario" onClick={() => setModalNueva(true)}>
            <FaPlus /> Nueva caja
          </button>
        </div>
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando cajas…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && (
        <div className="fin-vacio">Sin cajas en {periodo}. Crea la de cada sede con «Nueva caja».</div>
      )}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Sede</th><th>Responsable</th><th>Periodo</th>
                <th className="fin-num">Saldo inicial</th><th className="fin-num">Gastos</th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((c) => (
                <tr key={c.id}>
                  <td><button className="fin-link" onClick={() => setAbierta(c)}>{c.sede}</button></td>
                  <td>{c.responsable}</td>
                  <td>{c.periodo}</td>
                  <td className="fin-num">{pesos(c.saldo_inicial)}</td>
                  <td className="fin-num">{pesos(c.total_gastos)}</td>
                  <td><span className={`fin-badge ${BADGE[c.estado]}`}>{ETIQUETA[c.estado]}</span></td>
                  <td className="fin-acciones">
                    {c.estado === 'EN_EDICION' && (
                      <button className="fin-btnIcono fin-icoOk" title="Legalizar"
                              onClick={() => actuar(c, 'LEGALIZAR')}><FaCheck /></button>
                    )}
                    {c.estado === 'LEGALIZADA' && ES_CONTA(usuario) && (
                      <button className="fin-btnIcono fin-icoOk" title="Contabilizar"
                              onClick={() => actuar(c, 'CONTABILIZAR')}><FaBalanceScale /></button>
                    )}
                    {c.estado !== 'EN_EDICION' && ES_ADMIN(usuario) && (
                      <button className="fin-btnIcono fin-icoGris" title="Reabrir edición"
                              onClick={() => actuar(c, 'REABRIR')}><FaLockOpen /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNueva && (
        <ModalCajaNueva periodo={periodo} onCerrar={() => setModalNueva(false)}
                        onCreada={(c) => { setModalNueva(false); setAbierta(c); recargar(); }} />
      )}
      {abierta && (
        <ModalCajaDetalle caja={abierta} onCerrar={() => setAbierta(null)}
                          onCambio={(c) => { setAbierta(c); recargar(); }} />
      )}
    </div>
  );
}

// ── Modal: nueva caja ──────────────────────────────────────────────────────

function ModalCajaNueva({ periodo, onCerrar, onCreada }: {
  periodo: string; onCerrar: () => void; onCreada: (c: CajaMenorFin) => void;
}) {
  const [form, setForm] = useState({ sede: '', responsable: '', saldo_inicial: 0 });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const crear = async () => {
    if (!form.sede.trim() || !form.responsable.trim()) return setError('Sede y responsable son obligatorios.');
    setGuardando(true);
    try {
      const c = await crearCaja({ ...form, periodo, movimientos: [] });
      toastFin(`Caja de ${c.sede} creada`);
      onCreada(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={`Nueva caja · ${periodo}`} onCerrar={onCerrar} ancho={560}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Sede"><input className="fin-input" value={form.sede}
               onChange={(e) => setForm({ ...form, sede: e.target.value })} /></Campo>
        <Campo etiqueta="Responsable"><input className="fin-input" value={form.responsable}
               onChange={(e) => setForm({ ...form, responsable: e.target.value })} /></Campo>
        <Campo etiqueta="Saldo inicial"><input className="fin-input fin-num" type="number" min={0}
               value={form.saldo_inicial}
               onChange={(e) => setForm({ ...form, saldo_inicial: parseFloat(e.target.value) || 0 })} /></Campo>
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={crear} disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear y agregar renglones'}
        </button>
      </div>
    </ModalFin>
  );
}

// ── Modal: detalle con renglones editables ─────────────────────────────────

function ModalCajaDetalle({ caja, onCerrar, onCambio }: {
  caja: CajaMenorFin; onCerrar: () => void; onCambio: (c: CajaMenorFin) => void;
}) {
  const c = caja;
  const editable = c.estado === 'EN_EDICION';
  const [movs, setMovs] = useState<MovimientoCajaFin[]>(c.movimientos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const total = useMemo(() => movs.reduce((s, m) => s + (Number(m.valor) || 0), 0), [movs]);

  const fijar = (i: number, cambios: Partial<MovimientoCajaFin>) =>
    setMovs(movs.map((m, j) => j === i ? { ...m, ...cambios } : m));

  const guardar = async () => {
    if (editable && movs.some((m) => !m.concepto.trim() || !(Number(m.valor) > 0))) {
      return setError('Todos los renglones necesitan concepto y valor mayor a cero.');
    }
    setGuardando(true);
    try {
      const actualizada = await guardarCaja(c.id, {
        sede: c.sede, responsable: c.responsable, periodo: c.periodo,
        saldo_inicial: c.saldo_inicial, movimientos: movs,
      });
      toastFin('Caja guardada');
      setError('');
      onCambio(actualizada);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={`Caja menor · ${c.sede} ${c.periodo}`} onCerrar={onCerrar} ancho={880}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Responsable">{c.responsable}</Campo>
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[c.estado]}`}>{ETIQUETA[c.estado]}</span></Campo>
        <Campo etiqueta="Saldo inicial">{pesos(c.saldo_inicial)}</Campo>
        <Campo etiqueta="Total gastos"><b>{pesos(total)}</b></Campo>
      </div>

      {editable && (
        <button className="fin-btn fin-btnSecundario"
                onClick={() => setMovs([...movs, { concepto: '', valor: 0, tipo: 'gasto' }])}>
          <FaPlus /> Renglón
        </button>
      )}

      {!!movs.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla fin-tablaCompacta">
            <thead>
              <tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Centro costo</th><th className="fin-num">Valor</th>{editable && <th></th>}</tr>
            </thead>
            <tbody>
              {movs.map((m, i) => (
                <tr key={i}>
                  <td style={{ width: 130 }}>{editable ? (
                    <input type="date" className="fin-input" value={m.fecha?.slice(0, 10) ?? ''}
                           onChange={(e) => fijar(i, { fecha: e.target.value })} />
                  ) : (m.fecha?.slice(0, 10) ?? '—')}</td>
                  <td>{editable ? (
                    <input className="fin-input" style={{ minWidth: 200 }} value={m.concepto}
                           onChange={(e) => fijar(i, { concepto: e.target.value })} />
                  ) : m.concepto}</td>
                  <td style={{ width: 120 }}>{editable ? (
                    <select className="fin-input" value={m.tipo}
                            onChange={(e) => fijar(i, { tipo: e.target.value as 'gasto' | 'reposicion' })}>
                      <option value="gasto">Gasto</option>
                      <option value="reposicion">Reposición</option>
                    </select>
                  ) : m.tipo}</td>
                  <td style={{ width: 120 }}>{editable ? (
                    <input className="fin-input" value={m.centro_costo ?? ''}
                           onChange={(e) => fijar(i, { centro_costo: e.target.value })} />
                  ) : (m.centro_costo ?? '—')}</td>
                  <td className="fin-num">{editable ? (
                    <input className="fin-input fin-num" type="number" min={0} value={m.valor}
                           onChange={(e) => fijar(i, { valor: parseFloat(e.target.value) || 0 })} />
                  ) : pesos(m.valor)}</td>
                  {editable && (
                    <td><button className="fin-btnIcono fin-icoMal" onClick={() => setMovs(movs.filter((_, j) => j !== i))}>✕</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!movs.length && <p className="fin-suave">Sin renglones todavía.</p>}

      <p className="fin-suave">Los soportes de pago (PDF/imagen) se adjuntan abajo y quedan asociados a esta caja.</p>
      <AdjuntosFin modulo="caja" referencia={c.id} />

      <div className="fin-modalPie">
        {editable && (
          <button className="fin-btn fin-btnPrimario" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar renglones'}
          </button>
        )}
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
