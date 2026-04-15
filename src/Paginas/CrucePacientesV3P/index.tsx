'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Lottie from 'lottie-react';
import {
  FaUserCircle, FaSignOutAlt, FaArrowLeft, FaChevronDown,
  FaRoute, FaFileExcel, FaFilter, FaCheckCircle, FaCircle, FaSync, FaSearch,
} from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import animationPuntos from '@/Imagenes/AnimationPuntos.json';
import {
  obtenerOcupacionRutas,
  obtenerV3SinPaciente,
  recalcularCruce,
  exportarCruceExcel,
  obtenerHistoricoMeses,
  obtenerHistoricoMes,
} from '@/Funciones/ApiPedidos/apiMedicalCare';
import type {
  RutaOcupacion,
  RutaV3SinPaciente,
  RecalcularCruceProgress,
  MesHistorico,
  HistoricoMesDetalle,
} from '@/Funciones/ApiPedidos/tiposMedicalCare';
import './estilos.css';

const REGIONALES = ['TODAS', 'BARRANQUILLA', 'CALI', 'BUCARAMANGA', 'FUNZA', 'MEDELLIN'];

const CrucePacientesV3P: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [usuario, setUsuario]   = useState('');
  const [perfil, setPerfil]     = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [tab, setTab]                       = useState<'ocupacion' | 'v3sin' | 'historico'>('ocupacion');

  // ── Histórico ──────────────────────────────────────────────────────────────
  const [mesesHistorico, setMesesHistorico]       = useState<MesHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico]   = useState(false);
  const [mesSeleccionado, setMesSeleccionado]     = useState<{anio:number;mes:number} | null>(null);
  const [detalleHistorico, setDetalleHistorico]   = useState<HistoricoMesDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle]       = useState(false);
  const [rutas, setRutas]                   = useState<RutaOcupacion[]>([]);
  const [rutasV3Sin, setRutasV3Sin]         = useState<RutaV3SinPaciente[]>([]);
  const [totalV3Sin, setTotalV3Sin]         = useState(0);
  const [fechaCalculo, setFechaCalculo]     = useState<string | null>(null);
  const [calculadoPor, setCalculadoPor]     = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);

  const [filtroRegional, setFiltroRegional] = useState('TODAS');
  const [filtroRutaInput, setFiltroRutaInput] = useState('');
  const [filtroRuta, setFiltroRuta]           = useState('');
  const [rutaExpandida, setRutaExpandida]   = useState<string | null>(null);
  const [rutaV3Expandida, setRutaV3Expandida] = useState<string | null>(null);

  const [loadingOcupacion, setLoadingOcupacion] = useState(true);
  const [loadingV3Sin, setLoadingV3Sin]         = useState(false);
  const [loadingRecalculo, setLoadingRecalculo] = useState(false);
  const [loadingExport, setLoadingExport]       = useState(false);
  const [progresoRecalculo, setProgresoRecalculo] = useState<RecalcularCruceProgress | null>(null);
  const [mostrarConfirmCorreo, setMostrarConfirmCorreo] = useState(false);

  // ── Polling última sincronización V3 ────────────────────────────────────────
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
    let timestampActual: string | null = null;
    const fetchSync = () =>
      fetch(`${API}/sync-v3/estado`)
        .then(r => r.json())
        .then(d => {
          if (d.timestamp && d.timestamp !== timestampActual) {
            timestampActual = d.timestamp;
            setUltimaActualizacion(d.timestamp);
          }
        })
        .catch(() => {});
    fetchSync();
    const id = setInterval(fetchSync, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') { router.replace('/MedicalCare'); return; }
    setUsuario(match[2] || '');
    setPerfil(document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '');
    cargarOcupacion();
  }, [router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Carga inicial desde cache ────────────────────────────────────────────────
  const cargarOcupacion = async () => {
    setLoadingOcupacion(true);
    try {
      const data = await obtenerOcupacionRutas();
      setRutas(data.rutas);
      if (data.fecha_calculo) setFechaCalculo(data.fecha_calculo);
      if (data.calculado_por) setCalculadoPor(data.calculado_por);
      if (data.total_sin_paciente) setTotalV3Sin(data.total_sin_paciente);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOcupacion(false);
    }
  };

  const cargarV3Sin = async () => {
    if (rutasV3Sin.length > 0) return;
    setLoadingV3Sin(true);
    try {
      const data = await obtenerV3SinPaciente();
      setRutasV3Sin(data.rutas);
      setTotalV3Sin(data.total_sin_paciente);
      if (data.fecha_calculo) setFechaCalculo(data.fecha_calculo);
      if (data.calculado_por) setCalculadoPor(data.calculado_por);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingV3Sin(false);
    }
  };

  const handleTabV3Sin = () => {
    setTab('v3sin');
    cargarV3Sin();
  };

  const handleTabHistorico = async () => {
    setTab('historico');
    if (mesesHistorico.length > 0) return;
    setLoadingHistorico(true);
    try {
      const data = await obtenerHistoricoMeses();
      setMesesHistorico(data.meses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleVerMes = async (anio: number, mes: number) => {
    if (mesSeleccionado?.anio === anio && mesSeleccionado?.mes === mes) {
      setMesSeleccionado(null);
      setDetalleHistorico(null);
      return;
    }
    setMesSeleccionado({ anio, mes });
    setLoadingDetalle(true);
    try {
      const data = await obtenerHistoricoMes(anio, mes);
      setDetalleHistorico(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetalle(false);
    }
  };

  // ── Recalcular ───────────────────────────────────────────────────────────────
  const handleRecalcular = () => {
    setMostrarConfirmCorreo(true);
  };

  const ejecutarRecalculo = async (enviarCorreo: boolean) => {
    setMostrarConfirmCorreo(false);
    setLoadingRecalculo(true);
    setProgresoRecalculo({ stage: 'loading', progress: 0, message: 'Iniciando...' });
    try {
      const data = await recalcularCruce(usuario, (p) => setProgresoRecalculo(p), enviarCorreo);
      setRutas(data.rutas);
      setRutasV3Sin(data.v3_sin_paciente);
      setTotalV3Sin(data.total_sin_paciente);
      setFechaCalculo(data.fecha_calculo);
      setCalculadoPor(data.calculado_por);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecalculo(false);
      setProgresoRecalculo(null);
    }
  };

  // ── Exportar ─────────────────────────────────────────────────────────────────
  const handleExportar = async () => {
    setLoadingExport(true);
    try {
      await exportarCruceExcel(filtroRegional !== 'TODAS' ? filtroRegional : undefined);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExport(false);
    }
  };

  // ── Cerrar sesión ────────────────────────────────────────────────────────────
  const cerrarSesion = () => {
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie'].forEach(n => {
      document.cookie = `${n}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
    router.push('/LoginUsuario');
  };

  // ── Filtros derivados ────────────────────────────────────────────────────────
  const rutasFiltradas = rutas
    .filter(r => filtroRegional === 'TODAS' || (r.cedi || '').toUpperCase() === filtroRegional)
    .filter(r => !filtroRuta || r.ruta.toUpperCase().includes(filtroRuta.toUpperCase()));

  const rutasV3SinFiltradas = rutasV3Sin
    .filter(r => filtroRegional === 'TODAS' || (r.cedi || '').toUpperCase() === filtroRegional)
    .filter(r => !filtroRuta || r.ruta.toUpperCase().includes(filtroRuta.toUpperCase()));

  // ── Steps del overlay ────────────────────────────────────────────────────────
  const STEPS: { key: RecalcularCruceProgress['stage']; label: string }[] = [
    { key: 'loading',            label: 'Cargando datos' },
    { key: 'comparing_patients', label: 'Comparando pacientes' },
    { key: 'comparing_v3',       label: 'Verificando pedidos V3' },
    { key: 'saving',             label: 'Guardando resultados' },
  ];
  const STAGE_ORDER = ['loading', 'comparing_patients', 'comparing_v3', 'saving', 'complete'];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="CRV3-layout">

      {/* HEADER */}
      <header className="CRV3-header">
        <div className="CRV3-headerInner">
          <button className="CRV3-brand" onClick={() => router.push('/MedicalCare')} title="Volver a Medical Care">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="CRV3-brandName">Integr<span className="CRV3-brandAccent">App</span></span>
          </button>
          <div className="CRV3-title"><FaRoute /> Cruce Pacientes ↔ V3</div>
          <div className="CRV3-userZone" ref={menuRef}>
            <button className="CRV3-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="CRV3-userIcon" />
              <div className="CRV3-userInfo">
                <span className="CRV3-userName">{usuario || 'Usuario'}</span>
                <span className="CRV3-userPerfil">{perfil}</span>
              </div>
              <FaChevronDown className={`CRV3-chevron ${menuAbierto ? 'CRV3-chevronOpen' : ''}`} />
            </button>
            {menuAbierto && (
              <div className="CRV3-dropdown">
                <button className="CRV3-dropItem" onClick={() => router.push('/GestionPacientes')}>
                  <FaUserCircle /> Pacientes
                </button>
                <button className="CRV3-dropItem" onClick={() => router.push('/GestionPedidosV3')}>
                  <FaFileExcel /> Pedidos V3
                </button>
                <button className="CRV3-dropItem CRV3-dropItemActive" onClick={() => setMenuAbierto(false)}>
                  <FaRoute /> Cruce Pacientes ↔ V3
                </button>
                <button className="CRV3-dropItem CRV3-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="CRV3-main">

        {/* Toolbar */}
        <div className="CRV3-toolbar">
          <div className="CRV3-toolbarLeft">
            {(() => {
              const _meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
              const _fmt = (ts: string) => {
                const d = new Date(ts.replace(' ', 'T'));
                return `${d.getDate()} ${_meses[d.getMonth()]} ${d.getFullYear()} ${ts.slice(11, 16)}`;
              };
              // Mostrar el más reciente: recálculo manual vs sync automático
              const esManual = fechaCalculo && (!ultimaActualizacion || fechaCalculo > ultimaActualizacion);
              if (esManual) {
                return (
                  <span className="CRV3-syncInfo" title="Último recálculo manual">
                    ⟳ {_fmt(fechaCalculo!)}{calculadoPor && calculadoPor !== 'sync_automatico' ? ` · ${calculadoPor}` : ''}
                  </span>
                );
              }
              if (ultimaActualizacion) {
                return (
                  <span className="CRV3-syncInfo" title="Última sincronización automática V3">
                    ⟳ {_fmt(ultimaActualizacion)}
                  </span>
                );
              }
              return null;
            })()}
          </div>
          <div className="CRV3-toolbarRight">
            <div className="CRV3-filtroRegional">
              <FaFilter className="CRV3-filtroIcon" />
              <select
                value={filtroRegional}
                onChange={e => setFiltroRegional(e.target.value)}
                className="CRV3-filtroSelect"
              >
                {REGIONALES.map(r => (
                  <option key={r} value={r}>{r === 'TODAS' ? 'Todas las regionales' : r}</option>
                ))}
              </select>
            </div>
            <div className="CRV3-filtroRuta">
              <input
                className="CRV3-rutaInput"
                placeholder="Buscar ruta..."
                value={filtroRutaInput}
                onChange={e => setFiltroRutaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setFiltroRuta(filtroRutaInput.trim()); }}
              />
              <button
                className="CRV3-btnBuscarRuta"
                onClick={() => setFiltroRuta(filtroRutaInput.trim())}
                title="Buscar ruta"
              >
                <FaSearch />
              </button>
              {filtroRuta && (
                <button
                  className="CRV3-btnLimpiarRuta"
                  onClick={() => { setFiltroRuta(''); setFiltroRutaInput(''); }}
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="CRV3-toolbarBtns">
              <button
                className="CRV3-btn CRV3-btnExport"
                onClick={handleExportar}
                disabled={loadingExport || (rutas.length === 0 && rutasV3Sin.length === 0)}
              >
                <FaFileExcel /> {loadingExport ? 'Exportando...' : 'Exportar Excel'}
              </button>
              <button
                className="CRV3-btn CRV3-btnRecalc"
                onClick={handleRecalcular}
                disabled={loadingRecalculo}
              >
                <FaSync className={loadingRecalculo ? 'CRV3-spin' : ''} />
                {loadingRecalculo ? 'Calculando...' : 'Recalcular'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="CRV3-tabs">
          <button
            className={`CRV3-tab ${tab === 'ocupacion' ? 'CRV3-tabActive' : ''}`}
            onClick={() => setTab('ocupacion')}
          >
            Ocupación por Rutas
            {rutas.length > 0 && (() => {
              const enV3  = rutas.reduce((s, r) => s + r.pacientes_en_v3, 0);
              const total = rutas.reduce((s, r) => s + r.total_pacientes, 0);
              const pct   = total > 0 ? Math.round(enV3 / total * 100) : 0;
              return (
                <span style={{ marginLeft: 6, fontSize: '0.78rem', fontWeight: 600, opacity: 0.75 }}>
                  {enV3}/{total} · {pct}%
                </span>
              );
            })()}
          </button>
          <button
            className={`CRV3-tab ${tab === 'v3sin' ? 'CRV3-tabActive' : ''}`}
            onClick={handleTabV3Sin}
          >
            V3 sin Paciente
            {totalV3Sin > 0 && (
              <span className="CRV3-badge">{totalV3Sin}</span>
            )}
          </button>
          <button
            className={`CRV3-tab ${tab === 'historico' ? 'CRV3-tabActive' : ''}`}
            onClick={handleTabHistorico}
          >
            Histórico
            {mesesHistorico.length > 0 && (
              <span className="CRV3-badge" style={{ background: '#1565c0' }}>{mesesHistorico.length}</span>
            )}
          </button>
        </div>

        {/* Contenido */}
        <div className="CRV3-content">

          {/* ── Tab Ocupación ── */}
          {tab === 'ocupacion' && (
            loadingOcupacion ? (
              <div className="CRV3-loading">
                <div className="CRV3-spinner" />
                <p>Cargando datos del cache...</p>
              </div>
            ) : rutasFiltradas.length === 0 ? (
              <div className="CRV3-empty">
                <FaRoute className="CRV3-emptyIcon" />
                <h3>{rutas.length === 0 ? 'Sin datos calculados' : 'Sin rutas para esta regional'}</h3>
                <p>{rutas.length === 0 ? 'Usa el botón Recalcular para generar el cruce.' : `No hay rutas en ${filtroRegional}.`}</p>
                {rutas.length === 0 && (
                  <button className="CRV3-btn CRV3-btnRecalc" onClick={handleRecalcular}>
                    <FaSync /> Recalcular ahora
                  </button>
                )}
              </div>
            ) : (
              <div className="CRV3-rutasGrid">
                {rutasFiltradas.map(r => {
                  const color  = r.ocupacion_pct >= 80 ? '#155724' : r.ocupacion_pct >= 50 ? '#856404' : '#721c24';
                  const bgColor= r.ocupacion_pct >= 80 ? '#d4edda' : r.ocupacion_pct >= 50 ? '#fff3cd' : '#f8d7da';
                  const expandida = rutaExpandida === r.ruta;
                  return (
                    <div key={r.ruta} className="CRV3-rutaCard">
                      <div className="CRV3-rutaHeader" onClick={() => setRutaExpandida(expandida ? null : r.ruta)}>
                        <div className="CRV3-rutaMeta">
                          {r.cedi && <span className="CRV3-cediTag">{r.cedi}</span>}
                          <span className="CRV3-rutaNombre">{r.ruta}</span>
                        </div>
                        <div className="CRV3-rutaStats">
                          <span className="CRV3-rutaCount">{r.pacientes_en_v3} / {r.total_pacientes}</span>
                          <span className="CRV3-rutaPct" style={{ background: bgColor, color }}>{r.ocupacion_pct}%</span>
                          {r.pct_entregados !== undefined && (() => {
                            const pct = r.pct_entregados!;
                            const bg  = pct === 100 ? '#d4edda' : pct >= 50 ? '#fff3cd' : '#f8d7da';
                            const cl  = pct === 100 ? '#155724' : pct >= 50 ? '#856404' : '#721c24';
                            return (
                              <span className="CRV3-rutaPctEntregados" style={{ background: bg, color: cl }} title={`${r.pacientes_entregados} entregados`}>
                                {pct}% entregado
                              </span>
                            );
                          })()}
                          {!!r.vehiculos && (
                            <span className="CRV3-vehiculosBadge" title="Vehículos (planillas únicas)">
                              🚛 {r.vehiculos}
                            </span>
                          )}
                          {(() => {
                            const cambiosRuta = r.pacientes.filter(p => p.en_v3 && (!p.ruta_v3 || p.ruta_v3 !== r.ruta)).length;
                            return cambiosRuta > 0 ? (
                              <span className="CRV3-rutaCambio" title={`${cambiosRuta} paciente(s) cruzaron con una ruta V3 diferente a ${r.ruta} — requiere validación`}>
                                ⚠️ {cambiosRuta} cambio{cambiosRuta > 1 ? 's' : ''}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <span className="CRV3-chevronRow">{expandida ? '▲' : '▼'}</span>
                      </div>
                      {expandida && (
                        <div className="CRV3-tableWrap">
                          <table className="CRV3-table">
                            <thead>
                              <tr>
                                <th>Paciente</th>
                                <th>Cédula</th>
                                <th>Dirección</th>
                                <th>En V3</th>
                                <th>Ruta V3</th>
                                <th>Estado Pedido</th>
                                <th>F. Pedido</th>
                                <th>F. Preferente</th>
                                <th>F. Entrega</th>
                                <th>Planilla</th>
                                <th>Municipio</th>
                                <th>Divipola</th>
                                <th>Cel. Paciente</th>
                                <th>Tel. V3</th>
                                <th>Similitud</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.pacientes.map((p, i) => {
                                const hoy = new Date(); hoy.setHours(0,0,0,0);
                                const limite = new Date(hoy); limite.setDate(limite.getDate() + 5);
                                const fechaPref = p.fecha_preferente ? new Date(p.fecha_preferente) : null;
                                const esEntregado = p.en_v3 && p.estado_pedido === 'ENTREGADO';
                                const esRojo = !esEntregado && (
                                  !p.en_v3 ||
                                  p.estado_pedido === 'POR PROGRAMAR' ||
                                  (fechaPref !== null && fechaPref <= limite)
                                );
                                const rowClass = esEntregado ? 'CRV3-rowEntregado' : esRojo ? 'CRV3-rowUrgente' : '';
                                return (
                                  <tr key={i} className={rowClass}>
                                    <td>{p.paciente}</td>
                                    <td>{p.cedula}</td>
                                    <td className="CRV3-llaveCell">{p.direccion_original || '—'}</td>
                                    <td>
                                      <span className={`CRV3-enV3 ${p.en_v3 ? 'CRV3-enV3Yes' : 'CRV3-enV3No'}`}>
                                        {p.en_v3 ? 'SÍ' : 'NO'}
                                      </span>
                                    </td>
                                    {(() => {
                                      const esCambio = p.en_v3 && (!p.ruta_v3 || p.ruta_v3 !== r.ruta);
                                      return esCambio ? (
                                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', background: '#7f0000', color: '#fff', fontWeight: 700 }}>
                                          {p.ruta_v3 || '—'}
                                        </td>
                                      ) : (
                                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                          {p.ruta_v3 || '—'}
                                        </td>
                                      );
                                    })()}
                                    <td>{p.estado_pedido || '—'}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{p.fecha_pedido || '—'}</td>
                                    <td style={{ whiteSpace: 'nowrap', color: (fechaPref !== null && fechaPref <= limite && !esEntregado) ? '#c62828' : undefined, fontWeight: (fechaPref !== null && fechaPref <= limite && !esEntregado) ? 700 : undefined }}>
                                      {p.fecha_preferente || '—'}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{p.fecha_entrega || '—'}</td>
                                    <td>{p.planilla || '—'}</td>
                                    <td>{p.municipio_destino || '—'}</td>
                                    <td>{p.divipola || '—'}</td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#555' }}>{p.celular_paciente || '—'}</td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#555' }}>{p.telefono_v3 || '—'}</td>
                                    <td>
                                      {p.match_tipo === 'celular' && p.en_v3 && (
                                        <span className="CRV3-celularBadge">📱 Celular</span>
                                      )}
                                      <span className="CRV3-sim" style={{
                                        color: p.similitud >= 80 ? '#155724' : p.similitud >= 50 ? '#856404' : '#721c24',
                                        display: 'block',
                                      }}>
                                        {p.similitud}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Tab V3 sin Paciente ── */}
          {tab === 'v3sin' && (
            loadingV3Sin ? (
              <div className="CRV3-loading">
                <div className="CRV3-spinner" />
                <p>Cargando datos del cache...</p>
              </div>
            ) : rutasV3SinFiltradas.length === 0 ? (
              <div className="CRV3-empty">
                <FaRoute className="CRV3-emptyIcon" />
                <h3>{rutasV3Sin.length === 0 ? 'Sin datos calculados' : 'Sin registros para esta regional'}</h3>
                <p>{rutasV3Sin.length === 0 ? 'Usa el botón Recalcular.' : `No hay V3 sin paciente en ${filtroRegional}.`}</p>
              </div>
            ) : (
              <>
                <p className="CRV3-resumenV3">
                  <strong>{rutasV3SinFiltradas.reduce((s, r) => s + r.total, 0)}</strong> registros V3 sin paciente (similitud &lt; 80%)
                  {filtroRegional !== 'TODAS' && <span className="CRV3-filtroTag"> · {filtroRegional}</span>}
                </p>
                <div className="CRV3-rutasGrid">
                  {rutasV3SinFiltradas.map(r => {
                    const expandida = rutaV3Expandida === r.ruta;
                    return (
                      <div key={r.ruta} className="CRV3-rutaCard">
                        <div className="CRV3-rutaHeader" onClick={() => setRutaV3Expandida(expandida ? null : r.ruta)}>
                          <div className="CRV3-rutaMeta">
                            {r.cedi && <span className="CRV3-cediTag">{r.cedi}</span>}
                            <span className="CRV3-rutaNombre">{r.ruta}</span>
                          </div>
                          <div className="CRV3-rutaStats">
                            <span className="CRV3-rutaCount">{r.total} sin paciente</span>
                            <span className="CRV3-rutaPct" style={{ background: '#f8d7da', color: '#721c24' }}>{r.total}</span>
                          </div>
                          <span className="CRV3-chevronRow">{expandida ? '▲' : '▼'}</span>
                        </div>
                        {expandida && (
                          <div className="CRV3-tableWrap">
                            <table className="CRV3-table">
                              <thead>
                                <tr>
                                  <th>Cód. Pedido</th>
                                  <th>Cliente Destino</th>
                                  <th>Dirección</th>
                                  <th>Teléfono</th>
                                  <th>Estado Pedido</th>
                                  <th>Similitud</th>
                                  <th>Paciente más cercano</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.registros.map((reg, i) => (
                                  <tr key={i}>
                                    <td>{reg.codigo_pedido}</td>
                                    <td>{reg.cliente_destino}</td>
                                    <td>{reg.direccion_destino}</td>
                                    <td>{reg.telefono}</td>
                                    <td>{reg.estado_pedido}</td>
                                    <td>
                                      <span className="CRV3-sim" style={{
                                        color: reg.similitud >= 50 ? '#856404' : '#721c24'
                                      }}>
                                        {reg.similitud}%
                                      </span>
                                    </td>
                                    <td className="CRV3-llaveCell">{reg.llave_paciente_cercana || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}

          {/* ── Tab Histórico ── */}
          {tab === 'historico' && (() => {
            const _MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            return loadingHistorico ? (
              <div className="CRV3-loading"><div className="CRV3-spinner" /><p>Cargando histórico...</p></div>
            ) : mesesHistorico.length === 0 ? (
              <div className="CRV3-empty">
                <FaRoute className="CRV3-emptyIcon" />
                <h3>Sin histórico disponible</h3>
                <p>El primer corte se generará automáticamente el último día del mes a las 00:00.</p>
              </div>
            ) : (
              <div className="CRV3-historicoGrid">
                {mesesHistorico.map(m => {
                  const clave = `${m.anio}-${m.mes}`;
                  const activo = mesSeleccionado?.anio === m.anio && mesSeleccionado?.mes === m.mes;
                  return (
                    <div key={clave} className="CRV3-rutaCard">
                      <div className="CRV3-rutaHeader" onClick={() => handleVerMes(m.anio, m.mes)}>
                        <div className="CRV3-rutaMeta">
                          <span className="CRV3-cediTag">{m.anio}</span>
                          <span className="CRV3-rutaNombre">{_MESES_ES[m.mes - 1]}</span>
                        </div>
                        <div className="CRV3-rutaStats">
                          <span className="CRV3-rutaCount">{m.total} pedidos</span>
                          <span className="CRV3-rutaCount" style={{ color: '#78909c' }}>
                            {m.fecha_corte?.slice(0, 10)}
                          </span>
                        </div>
                        <span className="CRV3-chevronRow">{activo ? '▲' : '▼'}</span>
                      </div>

                      {activo && (
                        loadingDetalle ? (
                          <div className="CRV3-loading" style={{ padding: '24px' }}>
                            <div className="CRV3-spinner" /><p>Cargando detalle...</p>
                          </div>
                        ) : detalleHistorico && (
                          <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
                            <p className="CRV3-resumenV3" style={{ marginBottom: 12 }}>
                              Cruce al <strong>{m.fecha_corte?.slice(0, 10)}</strong> · {detalleHistorico.rutas.length} rutas · {detalleHistorico.total_sin_paciente} sin paciente
                            </p>
                            <div className="CRV3-rutasGrid">
                              {detalleHistorico.rutas.map(r => {
                                const color   = r.ocupacion_pct >= 80 ? '#155724' : r.ocupacion_pct >= 50 ? '#856404' : '#721c24';
                                const bgColor = r.ocupacion_pct >= 80 ? '#d4edda' : r.ocupacion_pct >= 50 ? '#fff3cd' : '#f8d7da';
                                const exp = `hist-${clave}-${r.ruta}`;
                                const expandida = rutaExpandida === exp;
                                return (
                                  <div key={r.ruta} className="CRV3-rutaCard" style={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                                    <div className="CRV3-rutaHeader" onClick={() => setRutaExpandida(expandida ? null : exp)}>
                                      <div className="CRV3-rutaMeta">
                                        {r.cedi && <span className="CRV3-cediTag">{r.cedi}</span>}
                                        <span className="CRV3-rutaNombre">{r.ruta}</span>
                                      </div>
                                      <div className="CRV3-rutaStats">
                                        <span className="CRV3-rutaCount">{r.pacientes_en_v3} / {r.total_pacientes}</span>
                                        <span className="CRV3-rutaPct" style={{ background: bgColor, color }}>{r.ocupacion_pct}%</span>
                                        {r.pct_entregados !== undefined && (() => {
                                          const pct = r.pct_entregados!;
                                          const bg  = pct === 100 ? '#d4edda' : pct >= 50 ? '#fff3cd' : '#f8d7da';
                                          const cl  = pct === 100 ? '#155724' : pct >= 50 ? '#856404' : '#721c24';
                                          return <span className="CRV3-rutaPctEntregados" style={{ background: bg, color: cl }}>{pct}% entregado</span>;
                                        })()}
                                        {!!r.vehiculos && (
                                          <span className="CRV3-vehiculosBadge" title="Vehículos">🚛 {r.vehiculos}</span>
                                        )}
                                      </div>
                                      <span className="CRV3-chevronRow">{expandida ? '▲' : '▼'}</span>
                                    </div>
                                    {expandida && (
                                      <div className="CRV3-tableWrap">
                                        <table className="CRV3-table">
                                          <thead>
                                            <tr>
                                              <th>Paciente</th><th>Cédula</th><th>Dirección</th>
                                              <th>En V3</th><th>Ruta V3</th><th>Estado Pedido</th>
                                              <th>F. Pedido</th><th>F. Preferente</th>
                                              <th>F. Entrega</th><th>Planilla</th><th>Municipio</th><th>Divipola</th><th>Cel. Paciente</th><th>Tel. V3</th><th>Similitud</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {r.pacientes.map((p, i) => {
                                              const esEntregado = p.en_v3 && p.estado_pedido === 'ENTREGADO';
                                              const esRojo = !esEntregado && (!p.en_v3 || p.estado_pedido === 'POR PROGRAMAR');
                                              return (
                                                <tr key={i} className={esEntregado ? 'CRV3-rowEntregado' : esRojo ? 'CRV3-rowUrgente' : ''}>
                                                  <td>{p.paciente}</td>
                                                  <td>{p.cedula}</td>
                                                  <td className="CRV3-llaveCell">{p.direccion_original || '—'}</td>
                                                  <td><span className={`CRV3-enV3 ${p.en_v3 ? 'CRV3-enV3Yes' : 'CRV3-enV3No'}`}>{p.en_v3 ? 'SÍ' : 'NO'}</span></td>
                                                  {(() => {
                                                    const esCambio = p.en_v3 && (!p.ruta_v3 || p.ruta_v3 !== r.ruta);
                                                    return esCambio ? (
                                                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', background: '#7f0000', color: '#fff', fontWeight: 700 }}>{p.ruta_v3 || '—'}</td>
                                                    ) : (
                                                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{p.ruta_v3 || '—'}</td>
                                                    );
                                                  })()}
                                                  <td>{p.estado_pedido || '—'}</td>
                                                  <td style={{ whiteSpace: 'nowrap' }}>{p.fecha_pedido || '—'}</td>
                                                  <td style={{ whiteSpace: 'nowrap' }}>{p.fecha_preferente || '—'}</td>
                                                  <td style={{ whiteSpace: 'nowrap' }}>{p.fecha_entrega || '—'}</td>
                                                  <td>{p.planilla || '—'}</td>
                                                  <td>{p.municipio_destino || '—'}</td>
                                                  <td>{p.divipola || '—'}</td>
                                                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#555' }}>{p.celular_paciente || '—'}</td>
                                                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#555' }}>{p.telefono_v3 || '—'}</td>
                                                  <td>
                                                    {p.match_tipo === 'celular' && p.en_v3 && (
                                                      <span className="CRV3-celularBadge">📱 Celular</span>
                                                    )}
                                                    <span className="CRV3-sim" style={{ color: p.similitud >= 80 ? '#155724' : p.similitud >= 50 ? '#856404' : '#721c24', display: 'block' }}>{p.similitud}%</span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </main>

      {/* MODAL CONFIRMACIÓN CORREO */}
      {mostrarConfirmCorreo && (
        <div className="CRV3-recalcOverlay">
          <div className="CRV3-recalcCard" style={{ maxWidth: 420 }}>
            <h2 className="CRV3-recalcTitle">Recalcular Cruce</h2>
            <p className="CRV3-recalcSubtitle" style={{ marginBottom: 24 }}>
              ¿Desea enviar el informe por correo a los usuarios de la app que tienen acceso?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="CRV3-btn CRV3-btnRecalc"
                onClick={() => ejecutarRecalculo(true)}
              >
                Sí, recalcular y enviar
              </button>
              <button
                className="CRV3-btn"
                style={{ background: '#546e7a', color: '#fff' }}
                onClick={() => ejecutarRecalculo(false)}
              >
                Solo recalcular
              </button>
              <button
                className="CRV3-btn"
                style={{ background: '#e0e0e0', color: '#333' }}
                onClick={() => setMostrarConfirmCorreo(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY RECÁLCULO */}
      {loadingRecalculo && progresoRecalculo && (() => {
        const currentIdx = STAGE_ORDER.indexOf(progresoRecalculo.stage);
        return (
          <div className="CRV3-recalcOverlay">
            <div className="CRV3-recalcCard">
              <div className="CRV3-recalcLottie">
                <Lottie animationData={animationPuntos} loop style={{ width: 160, height: 160 }} />
              </div>
              <h2 className="CRV3-recalcTitle">Calculando Cruce</h2>
              <p className="CRV3-recalcSubtitle">Pacientes ↔ Pedidos V3</p>
              <div className="CRV3-recalcSteps">
                {STEPS.map((s, i) => {
                  const done   = currentIdx > i;
                  const active = STAGE_ORDER[currentIdx] === s.key;
                  return (
                    <div key={s.key} className={`CRV3-recalcStep ${done ? 'CRV3-stepDone' : active ? 'CRV3-stepActive' : 'CRV3-stepPending'}`}>
                      {done ? <FaCheckCircle className="CRV3-stepIcon" /> : <FaCircle className="CRV3-stepIcon" />}
                      <span>{s.label}</span>
                      {active && progresoRecalculo.processed !== undefined && (
                        <span className="CRV3-stepCount">{progresoRecalculo.processed} / {progresoRecalculo.total}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="CRV3-recalcBarWrap">
                <div className="CRV3-recalcBar">
                  <div className="CRV3-recalcBarFill" style={{ width: `${progresoRecalculo.progress}%` }} />
                </div>
                <span className="CRV3-recalcPct">{progresoRecalculo.progress}%</span>
              </div>
              <p className="CRV3-recalcMsg">{progresoRecalculo.message}</p>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default CrucePacientesV3P;
