'use client';

/**
 * Cajas menores: bandeja del circuito FORM-FIN-007 con KPIs del pipeline,
 * semáforo de la política semanal (martes→viernes), form con folios y tipos
 * de documento, detalle con checkboxes Contabilidad/Tesorería e impresión
 * del formato oficial. Puerto React de views-cajas-menores.js (3.422 líneas).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  FaPlus, FaEye, FaCheck, FaTimes, FaBan, FaUndo, FaPrint, FaEllipsisV, FaTrash, FaPaperclip,
} from 'react-icons/fa';
import {
  CajaMenorFin, KpisCajas, MovimientoCajaFin, SedeCajaFin, UsuarioFin,
  crearCaja, eliminarCaja, guardarCaja, kpisCajas, listarCajas, listarSedesCajas,
  parchearItemCaja, radicarCaja, subirAdjuntoFin, transicionCaja,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';
import { ModalAprobacion, ModalCruce, ModalEgreso, ModalRegistrarFC } from './cajas/modales';
import { copiarTablaCaja, imprimirCajaMenor } from '../utiles/imprimirCajaMenor';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_CONTA = (u: UsuarioFin) => u.rol === 'contabilidad' || ES_ADMIN(u);
const ES_TESO = (u: UsuarioFin) => u.rol === 'tesoreria' || ES_ADMIN(u);
const ES_CTRL = (u: UsuarioFin) => ['controller', 'gerente_financiero'].includes(u.rol) || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = {
  EN_EDICION: 'Borrador', RADICADA: '⏳ Por Aprobar Jefe Inmediato', APROBADA_JEFE: '⏳ Por Aprobar Controller',
  APROBADA_CONTROLLER: '🟠 Por Contabilizar', CONTABILIZADA: '⚖️ En Cruce Tesorería',
  CRUZADA: '💵 Programada para Egreso', REEMBOLSADA: '🟢 Reembolso Pagado', RECHAZADA: '❌ Rechazada / Devuelta',
};
const BADGE: Record<string, string> = {
  EN_EDICION: 'fin-badgeGris', RADICADA: 'fin-badgeAmb', APROBADA_JEFE: 'fin-badgeAmb',
  APROBADA_CONTROLLER: 'fin-badgeInfo', CONTABILIZADA: 'fin-badgeInfo', CRUZADA: 'fin-badgeInfo',
  REEMBOLSADA: 'fin-badgeOk', RECHAZADA: 'fin-badgeMal',
};
const TIPOS_DOC = [
  { k: 'recibo_caja', l: 'RCM · Recibo de caja' },
  { k: 'cuenta_cobro', l: 'CxC · Cuenta de cobro' },
  { k: 'factura_electronica', l: 'FE · Factura electrónica' },
] as const;

type Vista = 'todas' | 'por_jefe' | 'por_controller' | 'por_contabilizar' | 'por_cruce' | 'por_egreso';

export default function CajasP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const [vista, setVista] = useState<Vista>('todas');
  const [busqueda, setBusqueda] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<CajaMenorFin[]>(
    () => listarCajas({ estado: estado || undefined, q: busqueda.trim() || undefined }), [estado, busqueda],
  );
  const [kpis, setKpis] = useState<KpisCajas | null>(null);
  const [sedes, setSedes] = useState<SedeCajaFin[]>([]);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editar, setEditar] = useState<CajaMenorFin | null>(null);
  const [detalle, setDetalle] = useState<CajaMenorFin | null>(null);
  const [menuFila, setMenuFila] = useState<string | null>(null);

  useEffect(() => {
    kpisCajas().then(setKpis).catch(() => setKpis(null));
    listarSedesCajas().then(setSedes).catch(() => setSedes([]));
  }, [datos]);

  const sedeDe = (c: CajaMenorFin) => sedes.find((s) => s.nombre === c.sede) ?? null;

  const filtradas = useMemo(() => {
    let base = datos ?? [];
    if (vista === 'por_jefe') base = base.filter((c) => c.estado === 'RADICADA');
    else if (vista === 'por_controller') base = base.filter((c) => c.estado === 'APROBADA_JEFE');
    else if (vista === 'por_contabilizar') base = base.filter((c) =>
      ['APROBADA_CONTROLLER', 'CONTABILIZADA', 'CRUZADA'].includes(c.estado) && !c.datos?.no_comprobante_fc);
    else if (vista === 'por_cruce') base = base.filter((c) => c.estado === 'CONTABILIZADA');
    else if (vista === 'por_egreso') base = base.filter((c) => c.estado === 'CRUZADA');
    return base;
  }, [datos, vista]);

  const eliminar = async (c: CajaMenorFin) => {
    if (!await confirmar(`Eliminar ${c.consecutivo ?? c.sede}`, 'Acción irreversible de administrador.')) return;
    const motivo = await pedirTexto('Eliminar caja', 'Motivo (informativo)');
    if (motivo === null) return;
    try {
      await eliminarCaja(c.id);
      toastFin('Caja eliminada');
      recargar();
      setDetalle(null);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <div className="fin-pagina" onClick={() => setMenuFila(null)}>
      <div className="fin-barra">
        <h2 className="fin-titulo">Cajas menores</h2>
        <div className="fin-filtros">
          <input className="fin-input" placeholder="Buscar consecutivo, sede, responsable…"
                 value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.keys(ETIQUETA).map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
          </select>
          {usuario.rol !== 'contabilidad' && (
            <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
              <FaPlus /> Nueva caja
            </button>
          )}
        </div>
      </div>

      {/* KPIs del pipeline (6 tarjetas) */}
      {kpis && (
        <div className="fin-cards">
          <div className="fin-cardInd"><span className="fin-cardIcono">💰</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{kpis.total_en_proceso}</span>
              <span className="fin-cardTitulo">Total en proceso · {pesos(kpis.monto_en_proceso)}</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">1️⃣</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{kpis.por_jefe}</span>
              <span className="fin-cardTitulo">Jefe Inmediato</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">2️⃣</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{kpis.por_controller}</span>
              <span className="fin-cardTitulo">Controller</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">3️⃣</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{kpis.por_contabilizar}</span>
              <span className="fin-cardTitulo">Por Contabilizar</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">⚖️</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{kpis.por_cruce}</span>
              <span className="fin-cardTitulo">Cruce Tesorería</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">4️⃣</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{kpis.por_egreso}</span>
              <span className="fin-cardTitulo">Devolución / Egreso</span></div></div>
        </div>
      )}

      <div className="fin-tabs">
        {([
          ['todas', 'Todas', (datos ?? []).length],
          ['por_jefe', 'Por Jefe', kpis?.por_jefe ?? 0],
          ['por_controller', 'Por Controller', kpis?.por_controller ?? 0],
          ['por_contabilizar', 'Por Contabilizar', kpis?.por_contabilizar ?? 0],
          ['por_cruce', 'Por Cruce', kpis?.por_cruce ?? 0],
          ['por_egreso', 'Por Egreso', kpis?.por_egreso ?? 0],
        ] as [Vista, string, number][]).map(([v, etiqueta, n]) => (
          <button key={v} className={`fin-tab ${vista === v ? 'fin-tabActivo' : ''}`} onClick={() => setVista(v)}>
            {etiqueta} <span className="fin-badge fin-badgeGris">{n}</span>
          </button>
        ))}
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando cajas…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && filtradas.length === 0 && !cargando && <div className="fin-vacio">No hay cajas en este filtro.</div>}

      {!!filtradas.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Consecutivo</th><th>Sede</th><th>Responsable</th><th>Periodo</th>
                <th>Política</th><th className="fin-num">A reembolsar</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id}>
                  <td><button className="fin-link" onClick={() => setDetalle(c)}>{c.consecutivo ?? '(borrador)'}</button></td>
                  <td>{c.sede}</td>
                  <td>{c.responsable}</td>
                  <td>{c.periodo}</td>
                  <td>
                    {c.politica?.aTiempoParaViernes === true
                      ? <span className="fin-badge fin-badgeOk">🟢 {String(c.politica.fechaEstimadaReembolso ?? '').slice(0, 10)}</span>
                      : c.politica?.aTiempoParaViernes === false
                        ? <span className="fin-badge fin-badgeAmb">🟡 {String(c.politica.fechaEstimadaReembolso ?? '').slice(0, 10)}</span>
                        : '—'}
                  </td>
                  <td className="fin-num">{pesos(c.total_reembolso)}</td>
                  <td><span className={`fin-badge ${BADGE[c.estado]}`}>{ETIQUETA[c.estado]}</span></td>
                  <td className="fin-acciones">
                    <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => setDetalle(c)}><FaEye /></button>
                    <span style={{ position: 'relative' }}>
                      <button className="fin-btnIcono fin-icoGris" title="Más opciones"
                              onClick={(e) => { e.stopPropagation(); setMenuFila(menuFila === c.id ? null : c.id); }}><FaEllipsisV /></button>
                      {menuFila === c.id && (
                        <div className="fin-menuFila" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setMenuFila(null); setDetalle(c); }}><FaEye /> Ver detalle</button>
                          <button onClick={() => { setMenuFila(null); imprimirCajaMenor(c); }}><FaPrint /> Imprimir FORM-FIN-007</button>
                          <button onClick={() => { setMenuFila(null); copiarTablaCaja(c); toastFin('Tabla copiada al portapapeles (TSV)'); }}>
                            📋 Copiar tabla para Outlook/Excel
                          </button>
                          {ES_ADMIN(usuario) && (
                            <button className="fin-textoMal" onClick={() => { setMenuFila(null); void eliminar(c); }}>
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
        <ModalCajaForm usuario={usuario} sedes={sedes} editar={editar}
                       onCerrar={() => { setModalNuevo(false); setEditar(null); }}
                       onListo={() => { setModalNuevo(false); setEditar(null); recargar(); }} />
      )}
      {detalle && (
        <ModalCajaDetalle caja={detalle} usuario={usuario} sede={sedeDe(detalle)}
                          onCerrar={() => setDetalle(null)}
                          onEditar={(c) => { setDetalle(null); setEditar(c); }}
                          onCambio={() => { recargar(); setDetalle(null); }}
                          onEliminar={() => void eliminar(detalle)} />
      )}
    </div>
  );
}

// ── Modal: nueva caja / edición del borrador ───────────────────────────────

const nuevaLinea = (): MovimientoCajaFin => ({
  concepto: '', valor: 0, tipo: 'gasto', tipo_documento: 'recibo_caja', fecha: new Date().toISOString().slice(0, 10),
});

function ModalCajaForm({ usuario, sedes, editar, onCerrar, onListo }: {
  usuario: UsuarioFin; sedes: SedeCajaFin[]; editar: CajaMenorFin | null;
  onCerrar: () => void; onListo: () => void;
}) {
  const [sede, setSede] = useState(editar?.sede ?? sedes[0]?.nombre ?? '');
  const [movs, setMovs] = useState<MovimientoCajaFin[]>(
    editar?.movimientos?.length ? editar.movimientos.map((m) => ({ ...m })) : [nuevaLinea()],
  );
  const [saldoInicial, setSaldoInicial] = useState(editar?.saldo_inicial ?? 0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const sedeInfo = sedes.find((s) => s.nombre === sede);
  const total = movs.reduce((s, m) => s + (Number(m.valor) || 0), 0);

  const fijar = (i: number, cambios: Partial<MovimientoCajaFin>) =>
    setMovs(movs.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

  const guardar = async (radicarDespues: boolean) => {
    if (!sede) return setError('Selecciona la sede.');
    if (!movs.length) return setError('Agrega al menos un renglón.');
    for (const [i, m] of movs.entries()) {
      if (!m.concepto.trim()) return setError(`Renglón ${i + 1}: falta el concepto.`);
      if (!(Number(m.valor) > 0)) return setError(`Renglón ${i + 1}: el valor debe ser mayor a cero.`);
    }
    setGuardando(true);
    try {
      const archivos: { archivo: File; folio: number }[] = [];
      for (const [i, m] of movs.entries()) {
        const pend = (m.datos as { archivo_pendiente?: File } | undefined)?.archivo_pendiente;
        if (pend) archivos.push({ archivo: pend, folio: i + 1 });
      }
      const payload = {
        sede, responsable: sedeInfo?.responsable ?? usuario.nombre,
        responsable_cc: sedeInfo?.identificacion ?? null,
        centro_costo_principal: sedeInfo?.cco ?? null,
        periodo: new Date().toISOString().slice(0, 7),
        saldo_inicial: Number(saldoInicial) || 0,
        movimientos: movs.map((m) => {
          const { archivo_pendiente, ...datos } = (m.datos ?? {}) as Record<string, unknown>;
          void archivo_pendiente;
          return { ...m, datos: Object.keys(datos).length ? datos : null };
        }),
      };
      let c: CajaMenorFin;
      if (editar) {
        c = await guardarCaja(editar.id, payload);
      } else {
        c = await crearCaja(payload);
      }
      // soportes por renglón (best-effort: suben tras crear la caja)
      for (const { archivo } of archivos) {
        try { await subirAdjuntoFin(archivo, 'caja', c.id, 'soporte_caja'); } catch { /* seguir */ }
      }
      if (radicarDespues) {
        c = await radicarCaja(c.id);
        toastFin(`${c.consecutivo} radicada · pendiente del jefe inmediato`);
      } else {
        toastFin(editar ? 'Borrador guardado' : 'Borrador creado (sin radicar)');
      }
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={editar ? `Editar ${editar.consecutivo ?? editar.sede}` : 'Nueva caja menor (FORM-FIN-007)'} onCerrar={onCerrar} ancho={1040}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Sede *">
          <select className="fin-input" value={sede} onChange={(e) => setSede(e.target.value)}>
            <option value="">— Selecciona —</option>
            {sedes.map((s) => <option key={s.id} value={s.nombre}>{s.etiqueta ?? s.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Responsable">
          <input className="fin-input" value={sedeInfo?.responsable ?? usuario.nombre} readOnly style={{ background: '#f8fafc' }} />
        </Campo>
        <Campo etiqueta="C.C / NIT">
          <input className="fin-input" value={sedeInfo?.identificacion ?? ''} readOnly style={{ background: '#f8fafc' }} />
        </Campo>
        <Campo etiqueta="Saldo inicial">
          <input className="fin-input fin-num" type="number" min={0} value={saldoInicial}
                 onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)} />
        </Campo>
      </div>

      <div className="fin-filaAcciones">
        <b style={{ fontSize: 13 }}>Renglones (folios)</b>
        <button className="fin-btn fin-btnSecundario" onClick={() => setMovs([...movs, nuevaLinea()])}><FaPlus /> Renglón</button>
        <span className="fin-total">Total a Reembolsar: <b>{pesos(total)}</b></span>
      </div>
      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead>
            <tr>
              <th>#</th><th>Fecha doc.</th><th>Tipo doc.</th><th>NIT/CC</th><th>Proveedor</th>
              <th>Concepto</th><th>Centro costo</th><th>No factura</th>
              <th className="fin-num">Valor</th><th>Soporte</th><th></th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input type="date" className="fin-input" style={{ width: 130 }} value={(m.fecha ?? '').slice(0, 10)}
                           onChange={(e) => fijar(i, { fecha: e.target.value })} /></td>
                <td>
                  <select className="fin-input" style={{ width: 70 }} value={m.tipo_documento ?? 'recibo_caja'}
                          onChange={(e) => fijar(i, { tipo_documento: e.target.value as MovimientoCajaFin['tipo_documento'] })}>
                    {TIPOS_DOC.map((t) => <option key={t.k} value={t.k}>{t.l.split(' · ')[0]}</option>)}
                  </select>
                </td>
                <td><input className="fin-input" style={{ width: 100 }} value={m.nit ?? ''}
                           onChange={(e) => fijar(i, { nit: e.target.value })} /></td>
                <td><input className="fin-input" style={{ width: 140 }} value={m.proveedor ?? ''}
                           onChange={(e) => fijar(i, { proveedor: e.target.value })} /></td>
                <td><input className="fin-input" style={{ minWidth: 150 }} value={m.concepto}
                           onChange={(e) => fijar(i, { concepto: e.target.value })} /></td>
                <td><input className="fin-input" style={{ width: 90 }} value={m.centro_costo ?? sedeInfo?.cco ?? ''}
                           onChange={(e) => fijar(i, { centro_costo: e.target.value })} /></td>
                <td><input className="fin-input" style={{ width: 90 }} value={m.no_factura ?? ''}
                           onChange={(e) => fijar(i, { no_factura: e.target.value })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 110 }} type="number" min={0} value={m.valor || ''}
                           onChange={(e) => fijar(i, { valor: parseFloat(e.target.value) || 0 })} /></td>
                <td>
                  <label className="fin-btnIcono fin-icoAzul" title="Adjuntar soporte del folio" style={{ cursor: 'pointer' }}>
                    <FaPaperclip size={11} />
                    <input type="file" hidden accept=".pdf,image/*"
                           onChange={(e) => fijar(i, { datos: { ...(m.datos ?? {}), archivo_pendiente: e.target.files?.[0],
                                                               nombre_pdf: e.target.files?.[0]?.name ?? '' } })} />
                  </label>
                  {(m.datos as { nombre_pdf?: string } | undefined)?.nombre_pdf && (
                    <span className="fin-suave" style={{ fontSize: 10, marginLeft: 4 }}>
                      📎{(m.datos as { nombre_pdf: string }).nombre_pdf.slice(0, 12)}
                    </span>
                  )}
                </td>
                <td>{movs.length > 1 && (
                  <button className="fin-btnIcono fin-icoMal"
                          onClick={() => setMovs(movs.filter((_, j) => j !== i))}><FaTimes /></button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnSecundario" onClick={() => void guardar(false)} disabled={guardando}>Guardar borrador</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar(true)} disabled={guardando}>
          {guardando ? 'Enviando…' : 'Radicar (pasa al jefe inmediato)'}
        </button>
      </div>
    </ModalFin>
  );
}

// ── Modal: detalle con bandejas por rol y checkboxes ───────────────────────

function ModalCajaDetalle({ caja, usuario, sede, onCerrar, onCambio, onEditar, onEliminar }: {
  caja: CajaMenorFin; usuario: UsuarioFin; sede: SedeCajaFin | null;
  onCerrar: () => void; onCambio: () => void; onEditar: (c: CajaMenorFin) => void; onEliminar: () => void;
}) {
  const c = caja;
  const [modal, setModal] = useState<'jefe' | 'controller' | 'fc' | 'cruce' | 'egreso' | null>(null);
  const [error, setError] = useState('');
  const datos = c.datos ?? {};

  const primerNombreJefe = sede?.jefe_inmediato?.split(' ')[0]?.toUpperCase() ?? '';
  const esJefeSede = Boolean(primerNombreJefe && usuario.nombre.toUpperCase().includes(primerNombreJefe));
  const pasoJefe = c.estado === 'RADICADA' && (esJefeSede || ES_ADMIN(usuario));
  const pasoController = c.estado === 'APROBADA_JEFE' && ES_CTRL(usuario);
  const pasoFC = c.estado === 'APROBADA_CONTROLLER' && ES_CONTA(usuario);
  const pasoCruce = c.estado === 'CONTABILIZADA' && ES_TESO(usuario);
  const pasoEgreso = c.estado === 'CRUZADA' && ES_TESO(usuario);
  const puedeEditar = c.estado === 'EN_EDICION';
  const puedeReabrir = c.estado === 'RECHAZADA' && ES_ADMIN(usuario);

  const alternar = async (folio: number, campo: 'contabilizado' | 'cruzado', valor: boolean) => {
    try {
      await parchearItemCaja(c.id, { folio, [campo]: valor });
      onCambio();
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <ModalFin titulo={`Caja ${c.consecutivo ?? ''} · ${c.sede}`} onCerrar={onCerrar} ancho={1040}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[c.estado]}`}>{ETIQUETA[c.estado]}</span></Campo>
        <Campo etiqueta="Sede / CCO / Cuenta">{c.sede} · {sede?.cco ?? '—'} · {sede?.cuenta ?? '—'}</Campo>
        <Campo etiqueta="Responsable">{c.responsable} {c.responsable_cc ? `· CC ${c.responsable_cc}` : ''}</Campo>
        <Campo etiqueta="Periodo">{c.periodo}</Campo>
        <Campo etiqueta="Política semanal">
          {c.politica?.aTiempoParaViernes === true
            ? `🟢 A tiempo para reembolso el viernes ${String(c.politica.fechaEstimadaReembolso ?? '').slice(0, 10)}`
            : c.politica?.aTiempoParaViernes === false
              ? `🟡 Extemporánea: pasa al viernes ${String(c.politica.fechaEstimadaReembolso ?? '').slice(0, 10)}`
              : '—'}
        </Campo>
        {Boolean(datos.no_comprobante_fc) && <Campo etiqueta="Comprobante FC">{String(datos.no_comprobante_fc)} · {String(datos.contabilizado_por ?? '')}</Campo>}
        {Boolean(datos.no_egreso_banco) && <Campo etiqueta="Egreso">{String(datos.no_egreso_banco)} · {String(datos.banco_pago ?? '')}</Campo>}
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead>
            <tr>
              <th>#</th><th>Fecha</th><th>Doc</th><th>NIT/CC</th><th>Proveedor</th><th>Concepto</th>
              <th>Centro costo</th><th>No factura</th><th className="fin-num">Valor</th>
              <th>Contabilidad (FC)</th><th>Cruce Tesorería</th>
            </tr>
          </thead>
          <tbody>
            {c.movimientos.map((m) => (
              <tr key={m.folio} style={m.contabilizado === false ? { background: '#fef2f2' } : undefined}>
                <td>{m.folio}</td>
                <td>{(m.fecha ?? '').slice(0, 10)}</td>
                <td>{m.tipo_documento === 'factura_electronica' ? 'FE' : m.tipo_documento === 'cuenta_cobro' ? 'CxC' : 'RCM'}</td>
                <td>{m.nit}</td>
                <td>{m.proveedor}</td>
                <td>{m.concepto}</td>
                <td>{m.centro_costo}</td>
                <td>{m.no_factura}</td>
                <td className="fin-num">{pesos(m.valor)}</td>
                <td>
                  {ES_CONTA(usuario) && ['APROBADA_CONTROLLER', 'CONTABILIZADA', 'CRUZADA'].includes(c.estado) ? (
                    <input type="checkbox" checked={m.contabilizado !== false}
                           onChange={(e) => void alternar(m.folio ?? 0, 'contabilizado', e.target.checked)} />
                  ) : m.contabilizado === false
                    ? <span className="fin-badge fin-badgeMal">🔴 NO Contab.</span>
                    : datos.no_comprobante_fc
                      ? <span className="fin-badge fin-badgeOk">🟢 Contab. (FC)</span>
                      : <span className="fin-badge fin-badgeAmb">🟠 Por Contab.</span>}
                </td>
                <td>
                  {(m.tipo_documento === 'cuenta_cobro' || m.tipo_documento === 'factura_electronica')
                    ? (ES_TESO(usuario) && datos.contabilizado_en
                        ? <input type="checkbox" checked={m.cruzado !== false}
                                 onChange={(e) => void alternar(m.folio ?? 0, 'cruzado', e.target.checked)} />
                        : m.cruzado === false
                          ? <span className="fin-badge fin-badgeMal">🔴 NO Cruzada</span>
                          : datos.cruzado_en
                            ? <span className="fin-badge fin-badgeOk">🟢 Cruzada</span>
                            : <span className="fin-badge fin-badgeAmb">⚖️ Por Cruzar</span>)
                    : <span className="fin-suave">— No aplica</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={8}><b>Total Solicitado</b></td>
                <td className="fin-num"><b>{pesos(c.total_gastos)}</b></td><td colSpan={2}></td></tr>
            {c.total_reembolso !== c.total_gastos && (
              <tr><td colSpan={8}><b>🔴 Excluido (No Causado)</b></td>
                  <td className="fin-num"><b>{pesos(c.total_gastos - c.total_reembolso)}</b></td><td colSpan={2}></td></tr>
            )}
            <tr><td colSpan={8}><b>🟢 Total Aprobado a Reembolsar</b></td>
                <td className="fin-num"><b>{pesos(c.total_reembolso)}</b></td><td colSpan={2}></td></tr>
          </tfoot>
        </table>
      </div>

      {/* Circuitos por rol */}
      {(pasoJefe || pasoController || pasoFC || pasoCruce || pasoEgreso || puedeEditar || puedeReabrir) && (
        <div className="fin-filaAcciones">
          {puedeEditar && <button className="fin-btn fin-btnSecundario" onClick={() => onEditar(c)}><FaUndo /> Editar borrador</button>}
          {pasoJefe && <button className="fin-btn fin-btnPrimario" onClick={() => setModal('jefe')}><FaCheck /> Aprobación Jefe Inmediato</button>}
          {pasoController && <button className="fin-btn fin-btnPrimario" onClick={() => setModal('controller')}><FaCheck /> Aprobación Controller</button>}
          {pasoFC && <button className="fin-btn fin-btnPrimario" onClick={() => setModal('fc')}>🏛️ Registrar comprobante FC</button>}
          {pasoCruce && <button className="fin-btn fin-btnPrimario" onClick={() => setModal('cruce')}>⚖️ Cruzar en Tesorería</button>}
          {pasoEgreso && <button className="fin-btn fin-btnPrimario" onClick={() => setModal('egreso')}>💵 Registrar egreso / reembolso</button>}
          {puedeReabrir && (
            <button className="fin-btn fin-btnSecundario" onClick={async () => {
              try { await transicionCaja(c.id, { accion: 'REABRIR', version: c.version }); toastFin('Caja reabierta'); onCambio(); }
              catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
            }}><FaUndo /> Reabrir (admin)</button>
          )}
        </div>
      )}
      {c.estado === 'CONTABILIZADA' && ES_CONTA(usuario) && !ES_TESO(usuario) && (
        <div className="fin-suave" style={{ fontSize: 12 }}>⏳ Desembolso y egreso en gestión por Tesorería.</div>
      )}

      <AdjuntosFin modulo="caja" referencia={c.id} />

      <h4 className="fin-subtitulo">Trazabilidad</h4>
      <div className="fin-historial">
        {((datos.historial as { fecha: string; usuario: string; etapa: string; observacion?: string }[] | undefined) ?? []).map((h, i) => (
          <div key={i} className="fin-evento">
            <span className="fin-eventoFecha">{fechaCorta(h.fecha)}</span>
            <span className="fin-eventoAccion">{h.etapa}</span>
            <span><b>{h.usuario}</b>{h.observacion ? ` — ${h.observacion}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="fin-modalPie">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="fin-btn fin-btnSecundario" onClick={() => imprimirCajaMenor(c)}><FaPrint /> Imprimir FORM-FIN-007</button>
          <button className="fin-btn fin-btnSecundario" onClick={() => { copiarTablaCaja(c); toastFin('Tabla copiada (TSV)'); }}>📋 Copiar tabla</button>
          {ES_ADMIN(usuario) && <button className="fin-btn fin-btnSecundario fin-textoMal" onClick={onEliminar}><FaTrash /> Eliminar</button>}
        </div>
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>

      {modal === 'jefe' && <ModalAprobacion caja={c} etapa="jefe" onCerrar={() => setModal(null)} onListo={onCambio} />}
      {modal === 'controller' && <ModalAprobacion caja={c} etapa="controller" onCerrar={() => setModal(null)} onListo={onCambio} />}
      {modal === 'fc' && <ModalRegistrarFC caja={c} onCerrar={() => setModal(null)} onListo={onCambio} />}
      {modal === 'cruce' && <ModalCruce caja={c} sede={sede} onCerrar={() => setModal(null)} onListo={onCambio} />}
      {modal === 'egreso' && <ModalEgreso caja={c} onCerrar={() => setModal(null)} onListo={onCambio} />}
    </ModalFin>
  );
}
