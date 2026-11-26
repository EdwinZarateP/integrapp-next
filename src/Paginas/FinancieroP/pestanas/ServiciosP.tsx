'use client';

/**
 * Servicios públicos y corporativos por inmueble/periodo (ex 'utilities').
 * Puerto React de views-servicios.js (2.429 líneas): contratos fijos que se
 * replican cada mes (generar-periodo), 6 estados de causación, categorías
 * (públicos/corporativos/orion) con subtotales, semáforo de vencimientos,
 * KPIs (facturación, progreso, alertas, recepción), edición en línea por
 * celda, vista calendario, modo Auditoría Calidad, Excel y ZIP.
 */
import { useState } from 'react';
import {
  FaPlus, FaStamp, FaMoneyBillWave, FaFileExcel, FaFileArchive, FaSyncAlt, FaCog,
} from 'react-icons/fa';
import {
  ContratoServicioFin, ServicioPublicoFin, UsuarioFin, ciclarUrgenciaServicio,
  crearServicio, descargarZipServicios, generarPeriodoServicios, listarContratosServicios,
  listarServicios, parchearCeldaServicio, soporteCargadoServicio, subirAdjuntoFin,
  transicionServicio,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirFecha } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';
import CalendarioServicios from './servicios/CalendarioServicios';
import { CATEGORIAS_INFO, ESTADOS_CAUSADO, alertaRecepcion, semaforo } from './servicios/utilidades';
import { exportarServiciosExcel } from './servicios/excelServicios';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const PUEDE_EDITAR = (u: UsuarioFin) => ['tesoreria', 'contabilidad'].includes(u.rol) || ES_ADMIN(u);
const ES_CALIDAD = (u: UsuarioFin) => u.rol === 'calidad' || ES_ADMIN(u);

const hoyPeriodo = () => new Date().toISOString().slice(0, 7);

export default function ServiciosP({ usuario }: { usuario: UsuarioFin }) {
  const [periodo, setPeriodo] = useState(hoyPeriodo());
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [modoCalidad, setModoCalidad] = useState('');
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<'tabla' | 'calendario'>('tabla');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalContratos, setModalContratos] = useState(false);
  const [detalle, setDetalle] = useState<ServicioPublicoFin | null>(null);
  const { datos, cargando, error, recargar } = useFinDatos(
    () => listarServicios({
      periodo: periodo || undefined, estado: estado || undefined,
      categoria: categoria || undefined, modo_calidad: modoCalidad || undefined,
      solo_vencidos: soloVencidos || undefined, q: busqueda.trim() || undefined,
    }), [periodo, estado, categoria, modoCalidad, soloVencidos, busqueda],
  );

  const servicios = datos?.servicios ?? [];
  const resumen = (datos as { resumen?: Record<string, unknown> } | undefined)?.resumen as
    | { cantidad: number; total: number; pendiente: number; pagados: number; vencidos: number; vence_hoy: number; por_categoria: Record<string, { cantidad: number; total: number; pagados: number }> }
    | undefined;

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

  const celda = async (s: ServicioPublicoFin, campo: string, valor: string | number | null) => {
    try {
      await parchearCeldaServicio(s.id, { campo, valor, version: s.version });
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  const generar = async () => {
    try {
      const r = await generarPeriodoServicios(periodo);
      toastFin(`${r.creados} fila(s) creada(s) de ${r.contratos_activos} contratos activos`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  const progreso = resumen && resumen.cantidad ? Math.round((resumen.pagados / resumen.cantidad) * 100) : 0;

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Servicios públicos</h2>
        <div className="fin-filtros">
          <input type="month" className="fin-input" value={periodo}
                 onChange={(e) => setPeriodo(e.target.value)} />
          <select className="fin-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS_INFO.map((c) => <option key={c.clave} value={c.clave}>{c.etiqueta}</option>)}
          </select>
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_CAUSADO.map((e) => <option key={e.clave} value={e.clave}>{e.etiqueta}</option>)}
          </select>
          <input className="fin-input" placeholder="Buscar concepto, contrato, NIT…"
                 value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          {PUEDE_EDITAR(usuario) && (
            <>
              <button className="fin-btn fin-btnSecundario" title="Replicar los contratos fijos en este periodo"
                      onClick={() => void generar()}><FaSyncAlt /> Generar mes</button>
              <button className="fin-btn fin-btnSecundario" onClick={() => setModalContratos(true)}>
                <FaCog /> Contratos
              </button>
              <button className="fin-btn fin-btnPrimario" onClick={() => setModalNuevo(true)}>
                <FaPlus /> Registrar
              </button>
            </>
          )}
          {ES_CALIDAD(usuario) && (
            <select className="fin-input" value={modoCalidad} onChange={(e) => setModoCalidad(e.target.value)}>
              <option value="">Modo normal</option>
              <option value="con_soporte">Calidad: con soporte</option>
              <option value="sin_soporte">Calidad: sin soporte</option>
            </select>
          )}
        </div>
      </div>

      {/* KPIs 4 del original */}
      {resumen && (
        <div className="fin-cards">
          <div className="fin-cardInd"><span className="fin-cardIcono">🧾</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{pesos(resumen.total)}</span>
              <span className="fin-cardTitulo">Total facturación · {resumen.cantidad} servicio(s)</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">📊</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{resumen.pagados}/{resumen.cantidad} · {progreso}%</span>
              <span className="fin-cardTitulo">Progreso de pagos</span>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginTop: 4 }}>
                <div style={{ width: `${progreso}%`, height: 6, background: '#16a34a', borderRadius: 3 }} />
              </div></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">⚠️</span>
            <div className="fin-cardInfo"><span className="fin-cardValor">{resumen.vencidos}/{resumen.vence_hoy}</span>
              <span className="fin-cardTitulo">Vencidos / vence hoy</span></div></div>
          <div className="fin-cardInd"><span className="fin-cardIcono">📥</span>
            <div className="fin-cardInfo">
              <span className="fin-cardValor">{servicios.filter((s) => s.urgente_recepcion === 'URGENTE').length}/{servicios.filter((s) => s.urgente_recepcion === 'PROXIMA').length}</span>
              <span className="fin-cardTitulo">Recepción urgente / próxima</span></div></div>
        </div>
      )}

      <div className="fin-filtros">
        <div className="fin-tabs" style={{ border: 'none' }}>
          <button className={`fin-tab ${vista === 'tabla' ? 'fin-tabActivo' : ''}`} onClick={() => setVista('tabla')}>Tabla</button>
          <button className={`fin-tab ${vista === 'calendario' ? 'fin-tabActivo' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
        </div>
        <label className="fin-check">
          <input type="checkbox" checked={soloVencidos} onChange={(e) => setSoloVencidos(e.target.checked)} />
          Solo vencidos
        </label>
        <button className="fin-btn fin-btnSecundario" onClick={() => exportarServiciosExcel(servicios)}>
          <FaFileExcel /> Excel
        </button>
        <button className="fin-btn fin-btnSecundario" onClick={() => void descargarZipServicios(periodo).catch((e) => toastFin(String(e), 'mal'))}>
          <FaFileArchive /> ZIP facturas
        </button>
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando servicios…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && servicios.length === 0 && !cargando && (
        <div className="fin-vacio">
          Sin servicios en {periodo}. Usa «Generar mes» para replicar los contratos fijos o registra uno manualmente.
        </div>
      )}

      {vista === 'calendario' && !!servicios.length && (
        <CalendarioServicios servicios={servicios} recargar={recargar} />
      )}

      {vista === 'tabla' && (
        <>
          {/* Subtotales por categoría */}
          {resumen?.por_categoria && (
            <div className="fin-filaAcciones">
              {CATEGORIAS_INFO.map((c) => {
                const d = resumen.por_categoria[c.clave];
                return d ? (
                  <span key={c.clave} style={{ fontSize: 12 }}>
                    <b style={{ color: c.color }}>{c.etiqueta}</b>: {d.cantidad} · {pesos(d.total)} · {d.pagados} pagado(s)
                  </span>
                ) : null;
              })}
            </div>
          )}
          {!!servicios.length && (
            <div className="fin-tablaWrap">
              <table className="fin-tabla">
                <thead>
                  <tr>
                    <th>Servicio</th><th>Inmueble</th><th>Categoría</th><th>Contrato / NIT</th>
                    <th className="fin-num">Valor</th><th>Límite</th><th>Semáforo</th><th>Causado</th><th>Pago</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map((s) => {
                    const pagado = s.estado === 'PAGADO' || s.estado === 'PAGADO_NO_CONTAB';
                    const sem = semaforo(s.fecha_limite, pagado);
                    const alerta = alertaRecepcion(s.fecha_exp, s.urgente_recepcion);
                    const cat = CATEGORIAS_INFO.find((c) => c.clave === (s.categoria ?? 'publicos'));
                    return (
                      <tr key={s.id} style={{ background: sem && !pagado ? sem.color : undefined }}>
                        <td><button className="fin-link" onClick={() => setDetalle(s)}>{s.servicio}</button>
                          {s.contrato && <div className="fin-suave" style={{ fontSize: 10 }}>{s.contrato}</div>}
                          {alerta && <span className={`fin-badge ${alerta.chip}`} style={{ fontSize: 9 }}>{alerta.texto}</span>}
                        </td>
                        <td>{s.inmueble}</td>
                        <td><span style={{ color: cat?.color, fontWeight: 700, fontSize: 11 }}>{cat?.etiqueta}</span></td>
                        <td className="fin-suave">{s.nit_tercero ?? '—'}{s.tercero ? <div style={{ fontSize: 10 }}>{s.tercero}</div> : null}</td>
                        <td className="fin-num">
                          {PUEDE_EDITAR(usuario) && s.estado !== 'NO_GENERADO' ? (
                            <input className="fin-input fin-num" style={{ width: 110 }} type="number" min={0} value={s.valor || ''}
                                   onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== s.valor) void celda(s, 'valor', v); }} />
                          ) : pesos(s.valor)}
                        </td>
                        <td>
                          {PUEDE_EDITAR(usuario) ? (
                            <input type="date" className="fin-input" style={{ width: 135 }} value={s.fecha_limite ?? ''}
                                   onChange={(e) => void celda(s, 'fecha_limite', e.target.value || null)} />
                          ) : (s.fecha_limite ?? '—')}
                        </td>
                        <td>{sem && <span className={`fin-badge ${sem.chip}`}>{sem.texto}</span>}</td>
                        <td>
                          {PUEDE_EDITAR(usuario) ? (
                            <select className="fin-input" style={{ width: 130 }} value={s.estado}
                                    onChange={(e) => void celda(s, 'estado', e.target.value)}>
                              {ESTADOS_CAUSADO.map((e2) => <option key={e2.clave} value={e2.clave}>{e2.etiqueta}</option>)}
                            </select>
                          ) : <span className="fin-badge fin-badgeGris">{ESTADOS_CAUSADO.find((e2) => e2.clave === s.estado)?.etiqueta ?? s.estado}</span>}
                        </td>
                        <td>
                          {PUEDE_EDITAR(usuario) && !pagado ? (
                            <input type="date" className="fin-input" style={{ width: 135 }} value={s.fecha_pago ?? ''}
                                   onChange={(e) => void celda(s, 'fecha_pago', e.target.value || null)} />
                          ) : (s.fecha_pago ?? '—')}
                        </td>
                        <td className="fin-acciones">
                          {PUEDE_EDITAR(usuario) && (
                            <button className="fin-btnIcono fin-icoGris" title="Ciclar urgencia de recepción"
                                    onClick={() => void ciclarUrgenciaServicio(s.id).then(recargar).catch((e) => toastFin(String(e), 'mal'))}>
                              📥
                            </button>
                          )}
                          {s.url_pago && !pagado && (
                            <a className="fin-btnIcono fin-icoOk" title="Pagar en el portal" href={s.url_pago}
                               target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>👉</a>
                          )}
                          {!pagado && PUEDE_EDITAR(usuario) && (
                            <>
                              <button className="fin-btnIcono fin-icoOk" title="Marcar pagado hoy"
                                      onClick={() => void celda(s, 'fecha_pago', new Date().toISOString().slice(0, 10))}>✓</button>
                              <button className="fin-btnIcono fin-icoAzul" title="Causar" onClick={() => void actuar(s, 'CAUSAR')}><FaStamp /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalNuevo && (
        <ModalServicioForm periodo={periodo}
                           onCerrar={() => setModalNuevo(false)}
                           onListo={() => { setModalNuevo(false); recargar(); }} />
      )}
      {modalContratos && (
        <ModalContratos onCerrar={() => setModalContratos(false)} />
      )}
      {detalle && (
        <ModalDetalle servicio={detalle} onCerrar={() => setDetalle(null)}
                      onSubida={() => { void soporteCargadoServicio(detalle.id).then(recargar); }} />
      )}
    </div>
  );
}

// ── Modal: registrar servicio ──────────────────────────────────────────────

function ModalServicioForm({ periodo, onCerrar, onListo }: {
  periodo: string; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState({
    servicio: '', inmueble: '', valor: 0, fecha_limite: '', categoria: 'publicos',
    contrato: '', nit_tercero: '', tercero: '', fecha_exp: '', url_pago: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo="Registrar servicio" onCerrar={onCerrar} ancho={720}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Servicio *"><input className="fin-input" value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} /></Campo>
        <Campo etiqueta="Inmueble *"><input className="fin-input" value={form.inmueble} onChange={(e) => setForm({ ...form, inmueble: e.target.value })} /></Campo>
        <Campo etiqueta="Categoría">
          <select className="fin-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATEGORIAS_INFO.map((c) => <option key={c.clave} value={c.clave}>{c.etiqueta}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Contrato"><input className="fin-input" value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })} /></Campo>
        <Campo etiqueta="NIT tercero"><input className="fin-input" value={form.nit_tercero} onChange={(e) => setForm({ ...form, nit_tercero: e.target.value })} /></Campo>
        <Campo etiqueta="Tercero"><input className="fin-input" value={form.tercero} onChange={(e) => setForm({ ...form, tercero: e.target.value })} /></Campo>
        <Campo etiqueta="Día de corte («20 de cada mes»)"><input className="fin-input" value={form.fecha_exp} onChange={(e) => setForm({ ...form, fecha_exp: e.target.value })} /></Campo>
        <Campo etiqueta="URL del portal de pago"><input className="fin-input" value={form.url_pago} onChange={(e) => setForm({ ...form, url_pago: e.target.value })} /></Campo>
        <Campo etiqueta="Valor"><input className="fin-input fin-num" type="number" min={0} value={form.valor || ''} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} /></Campo>
        <Campo etiqueta="Fecha límite de pago"><input type="date" className="fin-input" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} /></Campo>
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          if (!form.servicio.trim() || !form.inmueble.trim()) return setError('Servicio e inmueble son obligatorios.');
          setGuardando(true);
          crearServicio({
            servicio: form.servicio, inmueble: form.inmueble, periodo,
            valor: form.valor, fecha_limite: form.fecha_limite || undefined,
            datos: {
              categoria: form.categoria, contrato: form.contrato || null,
              nit_tercero: form.nit_tercero || null, tercero: form.tercero || null,
              fecha_exp: form.fecha_exp || null, url_pago: form.url_pago || null,
            },
          }).then(() => { toastFin('Servicio registrado'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>{guardando ? 'Guardando…' : 'Registrar'}</button>
      </div>
    </ModalFin>
  );
}

// ── Modal: detalle con soporte ─────────────────────────────────────────────

function ModalDetalle({ servicio, onCerrar, onSubida }: {
  servicio: ServicioPublicoFin; onCerrar: () => void; onSubida: () => void;
}) {
  const s = servicio;
  const cat = CATEGORIAS_INFO.find((c) => c.clave === (s.categoria ?? 'publicos'));
  return (
    <ModalFin titulo={`${s.servicio} · ${s.inmueble}`} onCerrar={onCerrar} ancho={720}>
      <div className="fin-grid">
        <Campo etiqueta="Periodo">{s.periodo}</Campo>
        <Campo etiqueta="Categoría"><span style={{ color: cat?.color, fontWeight: 700 }}>{cat?.etiqueta}</span></Campo>
        <Campo etiqueta="Contrato">{s.contrato ?? '—'}</Campo>
        <Campo etiqueta="Tercero">{s.tercero ?? '—'} {s.nit_tercero ? `· ${s.nit_tercero}` : ''}</Campo>
        <Campo etiqueta="Día de corte">{s.fecha_exp ?? '—'}</Campo>
        <Campo etiqueta="Valor">{pesos(s.valor)}</Campo>
        <Campo etiqueta="Fecha límite">{s.fecha_limite ?? '—'}</Campo>
        <Campo etiqueta="Estado">{ESTADOS_CAUSADO.find((e) => e.clave === s.estado)?.etiqueta ?? s.estado}</Campo>
        <Campo etiqueta="Fecha de pago">{s.fecha_pago ?? '—'}</Campo>
        {s.url_drive && <Campo etiqueta="Soporte externo"><a className="fin-link" href={s.url_drive} target="_blank" rel="noopener noreferrer">Abrir Drive</a></Campo>}
      </div>
      <p className="fin-suave" style={{ fontSize: 11 }}>
        Al subir la factura aquí se marca el soporte y Tesorería recibe el aviso.
      </p>
      <AdjuntosFin modulo="servicio" referencia={s.id} />
      <label className="fin-btn fin-btnSecundario" style={{ cursor: 'pointer' }}>
        📎 Subir factura del servicio
        <input type="file" hidden accept=".pdf,image/*"
               onChange={async (e) => {
                 const f = e.target.files?.[0];
                 if (!f) return;
                 try {
                   await subirAdjuntoFin(f, 'servicio', s.id);
                   onSubida();
                   toastFin('Factura subida');
                 } catch (err) { toastFin(err instanceof Error ? err.message : 'Error', 'mal'); }
               }} />
      </label>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}

// ── Modal: contratos fijos (maestro) ───────────────────────────────────────

function ModalContratos({ onCerrar }: { onCerrar: () => void }) {
  const { datos: contratos, recargar } = useFinDatos<ContratoServicioFin[]>(
    () => listarContratosServicios(), []);
  const [editando, setEditando] = useState<ContratoServicioFin | null>(null);
  return (
    <ModalFin titulo="Contratos fijos de servicios" onCerrar={onCerrar} ancho={900}>
      <p className="fin-suave" style={{ fontSize: 11 }}>
        Cada mes se replica una fila por contrato con «Generar mes». Editar y propagar actualiza los meses existentes.
      </p>
      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>Servicio</th><th>Inmueble</th><th>Categoría</th><th>Contrato</th><th>Tercero / NIT</th><th>Corte</th><th>URL pago</th><th></th></tr></thead>
          <tbody>
            {(contratos ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.servicio}</td><td>{c.inmueble}</td>
                <td>{CATEGORIAS_INFO.find((x) => x.clave === c.categoria)?.etiqueta ?? c.categoria}</td>
                <td>{c.contrato}</td>
                <td className="fin-suave">{c.tercero ?? '—'} {c.nit_tercero ? `· ${c.nit_tercero}` : ''}</td>
                <td>{c.fecha_exp ?? '—'}</td>
                <td className="fin-suave" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.url_pago ?? '—'}</td>
                <td><button className="fin-btn fin-btnSecundario" onClick={() => setEditando(c)}>Editar</button></td>
              </tr>
            ))}
            {!(contratos ?? []).length && (
              <tr><td colSpan={8} className="fin-suave" style={{ textAlign: 'center' }}>
                Sin contratos en el maestro. Registra los fijos para poder generar los meses.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editando && (
        <ModalEditarContrato contrato={editando}
                             onCerrar={() => setEditando(null)}
                             onListo={() => { setEditando(null); recargar(); }} />
      )}
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}

function ModalEditarContrato({ contrato, onCerrar, onListo }: {
  contrato: ContratoServicioFin; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState({
    servicio: contrato.servicio, inmueble: contrato.inmueble, categoria: contrato.categoria,
    concepto: contrato.concepto ?? '', contrato: contrato.contrato,
    nit_tercero: contrato.nit_tercero ?? '', tercero: contrato.tercero ?? '',
    fecha_exp: contrato.fecha_exp ?? '', url_pago: contrato.url_pago ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Editar contrato ${contrato.contrato}`} onCerrar={onCerrar} ancho={680}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Servicio"><input className="fin-input" value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} /></Campo>
        <Campo etiqueta="Inmueble"><input className="fin-input" value={form.inmueble} onChange={(e) => setForm({ ...form, inmueble: e.target.value })} /></Campo>
        <Campo etiqueta="Categoría">
          <select className="fin-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATEGORIAS_INFO.map((c) => <option key={c.clave} value={c.clave}>{c.etiqueta}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Contrato"><input className="fin-input" value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })} /></Campo>
        <Campo etiqueta="NIT tercero"><input className="fin-input" value={form.nit_tercero} onChange={(e) => setForm({ ...form, nit_tercero: e.target.value })} /></Campo>
        <Campo etiqueta="Tercero"><input className="fin-input" value={form.tercero} onChange={(e) => setForm({ ...form, tercero: e.target.value })} /></Campo>
        <Campo etiqueta="Día de corte"><input className="fin-input" value={form.fecha_exp} onChange={(e) => setForm({ ...form, fecha_exp: e.target.value })} /></Campo>
        <Campo etiqueta="URL del portal de pago"><input className="fin-input" value={form.url_pago} onChange={(e) => setForm({ ...form, url_pago: e.target.value })} /></Campo>
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnSecundario" disabled={guardando} onClick={() => {
          setGuardando(true);
          import('@/Funciones/ApiPedidos/financiero').then(({ editarContratoServicio, propagarContratoServicio }) =>
            editarContratoServicio(contrato.id, { ...form })
              .then(() => confirmar('Propagar a los meses existentes', 'Aplica estos datos a todas las filas mensuales de este contrato.'))
              .then((si) => (si ? propagarContratoServicio(contrato.id, 'todos') : null))
          ).then(() => { toastFin('Contrato actualizado'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Guardar {guardando ? '…' : '+ propagar'}</button>
      </div>
    </ModalFin>
  );
}
