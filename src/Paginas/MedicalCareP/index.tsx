'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Lottie from 'lottie-react';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUserCircle, FaSignOutAlt, FaChevronDown, FaRoute,
  FaCheckCircle, FaCircle, FaFileExcel, FaFilter,
} from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import animationPuntos from '@/Imagenes/AnimationPuntos.json';
import { obtenerOcupacionRutas, obtenerV3SinPaciente, recalcularCruce, exportarCruceExcel } from '@/Funciones/ApiPedidos/apiMedicalCare';
import type { RutaOcupacion, RutaV3SinPaciente, RecalcularCruceProgress } from '@/Funciones/ApiPedidos/tiposMedicalCare';
import './estilos.css';

const MedicalCareP: React.FC = () => {
  const router = useRouter();
  const usuario = typeof document !== 'undefined'
    ? (document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '')
    : '';
  const perfil = typeof document !== 'undefined'
    ? (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '')
    : '';
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [modalOcupacion, setModalOcupacion] = useState(false);
  const [tabActiva, setTabActiva] = useState<'ocupacion' | 'v3sinpaciente'>('ocupacion');
  const [rutas, setRutas] = useState<RutaOcupacion[]>([]);
  const [rutasV3Sin, setRutasV3Sin] = useState<RutaV3SinPaciente[]>([]);
  const [totalV3Sin, setTotalV3Sin] = useState(0);
  const [loadingOcupacion, setLoadingOcupacion] = useState(false);
  const [loadingV3Sin, setLoadingV3Sin] = useState(false);
  const [loadingRecalculo, setLoadingRecalculo] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [filtroRegional, setFiltroRegional] = useState<string>('TODAS');
  const [progresoRecalculo, setProgresoRecalculo] = useState<RecalcularCruceProgress | null>(null);
  const [fechaCalculo, setFechaCalculo] = useState<string | null>(null);
  const [calculadoPor, setCalculadoPor] = useState<string | null>(null);
  const [rutaExpandida, setRutaExpandida] = useState<string | null>(null);
  const [rutaV3Expandida, setRutaV3Expandida] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') router.replace('/Pedidos');
  }, [router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOcupacionRutas = async () => {
    setModalOcupacion(true);
    setTabActiva('ocupacion');
    setLoadingOcupacion(true);
    try {
      const data = await obtenerOcupacionRutas();
      setRutas(data.rutas);
      if (data.fecha_calculo) setFechaCalculo(data.fecha_calculo);
      if (data.calculado_por) setCalculadoPor(data.calculado_por);
    } catch (error) {
      console.error('Error al obtener ocupación de rutas:', error);
    } finally {
      setLoadingOcupacion(false);
    }
  };

  const handleCargarV3SinPaciente = async () => {
    setTabActiva('v3sinpaciente');
    if (rutasV3Sin.length > 0) return; // ya cargado
    setLoadingV3Sin(true);
    try {
      const data = await obtenerV3SinPaciente();
      setRutasV3Sin(data.rutas);
      setTotalV3Sin(data.total_sin_paciente);
      if (data.fecha_calculo) setFechaCalculo(data.fecha_calculo);
      if (data.calculado_por) setCalculadoPor(data.calculado_por);
    } catch (error) {
      console.error('Error al obtener V3 sin paciente:', error);
    } finally {
      setLoadingV3Sin(false);
    }
  };

  const handleRecalcular = async () => {
    setLoadingRecalculo(true);
    setProgresoRecalculo({ stage: 'loading', progress: 0, message: 'Iniciando...' });
    try {
      const data = await recalcularCruce(usuario, (p) => setProgresoRecalculo(p));
      setRutas(data.rutas);
      setRutasV3Sin(data.v3_sin_paciente);
      setTotalV3Sin(data.total_sin_paciente);
      setFechaCalculo(data.fecha_calculo);
      setCalculadoPor(data.calculado_por);
    } catch (error) {
      console.error('Error al recalcular cruce:', error);
    } finally {
      setLoadingRecalculo(false);
      setProgresoRecalculo(null);
    }
  };

  const handleExportar = async () => {
    setLoadingExport(true);
    try {
      await exportarCruceExcel(filtroRegional !== 'TODAS' ? filtroRegional : undefined);
    } catch (error) {
      console.error('Error al exportar:', error);
    } finally {
      setLoadingExport(false);
    }
  };

  const REGIONALES = ['TODAS', 'BARRANQUILLA', 'CALI', 'BUCARAMANGA', 'FUNZA', 'MEDELLIN'];

  const rutasFiltradas = filtroRegional === 'TODAS'
    ? rutas
    : rutas.filter(r => (r.cedi || '').toUpperCase() === filtroRegional);

  const rutasV3SinFiltradas = filtroRegional === 'TODAS'
    ? rutasV3Sin
    : rutasV3Sin.filter(r => (r.cedi || '').toUpperCase() === filtroRegional);

  const cerrarSesion = () => {
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie'].forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
    router.push('/LoginUsuario');
  };

  return (
    <div className="MC-layout">

      {/* ── HEADER ── */}
      <header className="MC-header">
        <div className="MC-headerInner">

          <button className="MC-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="MC-brandName">
              Integr<span className="MC-brandAccent">App</span>
            </span>
          </button>

          <div className="MC-clienteBadge">Fresenius Medical Care</div>

          <div className="MC-userZone" ref={menuRef}>
            <button className="MC-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="MC-userIcon" />
              <div className="MC-userInfo">
                <span className="MC-userName">{usuario || 'Usuario'}</span>
                <span className="MC-userPerfil">{perfil}</span>
              </div>
              <FaChevronDown className={`MC-chevron ${menuAbierto ? 'MC-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="MC-dropdown">
                <button className="MC-dropItem" onClick={() => router.push('/GestionPacientes')}>
                  <FaUserCircle /> Pacientes
                </button>
                <button className="MC-dropItem" onClick={() => router.push('/GestionPedidosV3')}>
                  <FaUserCircle /> Pedidos V3
                </button>
                <button className="MC-dropItem" onClick={() => router.push('/CrucePacientesV3')}>
                  <FaRoute /> Cruce Pacientes ↔ V3
                </button>
                <button className="MC-dropItem MC-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="MC-main">
        <div className="MC-welcome">
          <div className="MC-welcomeCard">
            <h1 className="MC-welcomeTitle">Gestión de Despachos Rutas</h1>
            <p className="MC-welcomeText">
              Sistema de gestión de despachos y rutas de Fresenius Medical Care. Utiliza el menú de usuario para acceder a las funciones disponibles.
            </p>
            
            <div className="MC-welcomeActions">
              <button
                className="MC-welcomeBtn MC-btnPrimary"
                onClick={() => router.push('/GestionPacientes')}
              >
                <FaUserCircle /> Ir a Gestión de Pacientes
              </button>
              <button
                className="MC-welcomeBtn MC-btnSecondary"
                onClick={() => router.push('/GestionPedidosV3')}
              >
                <FaUserCircle /> Ir a Gestión de Pedidos V3
              </button>
              <button
                className="MC-welcomeBtn MC-btnOcupacion"
                onClick={() => router.push('/CrucePacientesV3')}
              >
                <FaRoute /> Cruce Pacientes ↔ V3
              </button>
            </div>

            <div className="MC-welcomeFeatures">
              <div className="MC-feature">
                <div className="MC-featureIcon">📊</div>
                <h3 className="MC-featureTitle">Carga Masiva Pacientes</h3>
                <p className="MC-featureText">Importa pacientes desde Excel con normalización automática de datos</p>
              </div>
              
              <div className="MC-feature">
                <div className="MC-featureIcon">📦</div>
                <h3 className="MC-featureTitle">Carga Masiva Pedidos</h3>
                <p className="MC-featureText">Importa pedidos desde Excel con progreso en tiempo real</p>
              </div>
              
              <div className="MC-feature">
                <div className="MC-featureIcon">✏️</div>
                <h3 className="MC-featureTitle">Gestión Completa</h3>
                <p className="MC-featureText">Crea, edita y elimina pacientes y pedidos individualmente</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── MODAL OCUPACIÓN POR RUTAS ── */}
      {modalOcupacion && (
        <div className="MC-modalOverlay" onClick={() => setModalOcupacion(false)}>
          <div className="MC-modalOcupacion" onClick={(e) => e.stopPropagation()}>
            <div className="MC-modalHeader">
              <h2><FaRoute /> Cruce Pacientes ↔ V3</h2>
              <div className="MC-modalHeaderRight">
                {fechaCalculo && (
                  <span className="MC-fechaCalculo">
                    {fechaCalculo}{calculadoPor ? ` · ${calculadoPor}` : ''}
                  </span>
                )}
                <div className="MC-filtroRegional">
                  <FaFilter className="MC-filtroIcon" />
                  <select
                    value={filtroRegional}
                    onChange={e => setFiltroRegional(e.target.value)}
                    className="MC-filtroSelect"
                  >
                    {REGIONALES.map(r => (
                      <option key={r} value={r}>{r === 'TODAS' ? 'Todas las regionales' : r}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="MC-btnExportar"
                  onClick={handleExportar}
                  disabled={loadingExport || (!rutas.length && !rutasV3Sin.length)}
                  title="Exportar a Excel"
                >
                  <FaFileExcel /> {loadingExport ? 'Exportando...' : 'Exportar'}
                </button>
                <button
                  className="MC-btnRecalcular"
                  onClick={handleRecalcular}
                  disabled={loadingRecalculo}
                  title="Recalcular cruce desde cero"
                >
                  {loadingRecalculo ? 'Calculando...' : 'Recalcular'}
                </button>
                <button className="MC-modalClose" onClick={() => setModalOcupacion(false)}>×</button>
              </div>
            </div>

            {/* Pestañas */}
            <div className="MC-tabs">
              <button
                className={`MC-tab ${tabActiva === 'ocupacion' ? 'MC-tabActiva' : ''}`}
                onClick={() => setTabActiva('ocupacion')}
              >
                Ocupación por Rutas
              </button>
              <button
                className={`MC-tab ${tabActiva === 'v3sinpaciente' ? 'MC-tabActiva' : ''}`}
                onClick={handleCargarV3SinPaciente}
              >
                V3 sin Paciente {totalV3Sin > 0 && <span className="MC-badge">{totalV3Sin}</span>}
              </button>
            </div>

            <div className="MC-modalBody">
              {/* Pestaña 1: Ocupación por Rutas */}
              {tabActiva === 'ocupacion' && (
                loadingOcupacion ? (
                  <div className="MC-loadingOcupacion">
                    <div className="MC-spinner"></div>
                    <p>Calculando similitudes con V3...</p>
                  </div>
                ) : rutasFiltradas.length === 0 ? (
                  <p className="MC-sinDatos">No hay datos para la regional seleccionada.</p>
                ) : (
                  <div className="MC-rutasLista">
                    {rutasFiltradas.map((r) => {
                      const color = r.ocupacion_pct >= 80 ? '#155724' : r.ocupacion_pct >= 50 ? '#856404' : '#721c24';
                      const bgColor = r.ocupacion_pct >= 80 ? '#d4edda' : r.ocupacion_pct >= 50 ? '#fff3cd' : '#f8d7da';
                      const expandida = rutaExpandida === r.ruta;
                      return (
                        <div key={r.ruta} className="MC-rutaCard">
                          <div className="MC-rutaHeader" onClick={() => setRutaExpandida(expandida ? null : r.ruta)}>
                            <div className="MC-rutaInfo">
                              <span className="MC-rutaNombre">{r.ruta}</span>
                              <span className="MC-rutaStats">{r.pacientes_en_v3} / {r.total_pacientes} pacientes en V3</span>
                            </div>
                            <div className="MC-rutaOcupacion" style={{ background: bgColor, color }}>{r.ocupacion_pct}%</div>
                            <span className="MC-rutaChevron">{expandida ? '▲' : '▼'}</span>
                          </div>
                          {expandida && (
                            <table className="MC-pacientesTable">
                              <thead>
                                <tr><th>Paciente</th><th>Cédula</th><th>Estado</th><th>Similitud V3</th><th>Llave V3 más cercana</th></tr>
                              </thead>
                              <tbody>
                                {r.pacientes.map((p, i) => (
                                  <tr key={i} className={p.en_v3 ? 'MC-rowEnV3' : 'MC-rowNoV3'}>
                                    <td>{p.paciente}</td>
                                    <td>{p.cedula}</td>
                                    <td>{p.estado}</td>
                                    <td>
                                      <span className="MC-similitud" style={{ color: p.similitud >= 80 ? '#155724' : p.similitud >= 50 ? '#856404' : '#721c24' }}>
                                        {p.similitud}%
                                      </span>
                                    </td>
                                    <td className="MC-llaveV3">{p.llave_v3 || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Pestaña 2: V3 sin Paciente */}
              {tabActiva === 'v3sinpaciente' && (
                loadingV3Sin ? (
                  <div className="MC-loadingOcupacion">
                    <div className="MC-spinner"></div>
                    <p>Buscando registros V3 sin paciente...</p>
                  </div>
                ) : rutasV3Sin.length === 0 ? (
                  <p className="MC-sinDatos">Todos los registros V3 tienen paciente coincidente.</p>
                ) : (
                  <div className="MC-rutasLista">
                    <p className="MC-resumenV3Sin">
                      <strong>{rutasV3SinFiltradas.reduce((s, r) => s + r.total, 0)}</strong> registros en V3 sin paciente coincidente (similitud &lt; 80%)
                      {filtroRegional !== 'TODAS' && <span className="MC-filtroActivo"> · {filtroRegional}</span>}
                    </p>
                    {rutasV3SinFiltradas.map((r) => {
                      const expandida = rutaV3Expandida === r.ruta;
                      return (
                        <div key={r.ruta} className="MC-rutaCard">
                          <div className="MC-rutaHeader" onClick={() => setRutaV3Expandida(expandida ? null : r.ruta)}>
                            <div className="MC-rutaInfo">
                              <span className="MC-rutaNombre">{r.ruta}</span>
                              <span className="MC-rutaStats">{r.total} registro{r.total !== 1 ? 's' : ''} sin paciente</span>
                            </div>
                            <div className="MC-rutaOcupacion" style={{ background: '#f8d7da', color: '#721c24' }}>{r.total}</div>
                            <span className="MC-rutaChevron">{expandida ? '▲' : '▼'}</span>
                          </div>
                          {expandida && (
                            <table className="MC-pacientesTable">
                              <thead>
                                <tr><th>Cód. Pedido</th><th>Cliente Destino</th><th>Dirección</th><th>Teléfono</th><th>Estado Pedido</th><th>Similitud</th><th>Paciente más cercano</th></tr>
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
                                      <span className="MC-similitud" style={{ color: reg.similitud >= 50 ? '#856404' : '#721c24' }}>
                                        {reg.similitud}%
                                      </span>
                                    </td>
                                    <td className="MC-llaveV3">{reg.llave_paciente_cercana || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY DE RECÁLCULO ── */}
      {loadingRecalculo && progresoRecalculo && (() => {
        const steps: { key: RecalcularCruceProgress['stage']; label: string }[] = [
          { key: 'loading',             label: 'Cargando datos' },
          { key: 'comparing_patients',  label: 'Comparando pacientes' },
          { key: 'comparing_v3',        label: 'Verificando pedidos V3' },
          { key: 'saving',              label: 'Guardando resultados' },
        ];
        const stageOrder = ['loading', 'comparing_patients', 'comparing_v3', 'saving', 'complete'];
        const currentIdx = stageOrder.indexOf(progresoRecalculo.stage);

        return (
          <div className="MC-recalcOverlay">
            <div className="MC-recalcCard">
              <div className="MC-recalcLottie">
                <Lottie animationData={animationPuntos} loop style={{ width: 160, height: 160 }} />
              </div>

              <h2 className="MC-recalcTitle">Calculando Cruce</h2>
              <p className="MC-recalcSubtitle">Pacientes ↔ Pedidos V3</p>

              {/* Pasos */}
              <div className="MC-recalcSteps">
                {steps.map((s, i) => {
                  const done = currentIdx > i;
                  const active = stageOrder[currentIdx] === s.key;
                  return (
                    <div key={s.key} className={`MC-recalcStep ${done ? 'MC-stepDone' : active ? 'MC-stepActive' : 'MC-stepPending'}`}>
                      {done
                        ? <FaCheckCircle className="MC-stepIcon" />
                        : <FaCircle className="MC-stepIcon" />}
                      <span>{s.label}</span>
                      {active && progresoRecalculo.processed !== undefined && (
                        <span className="MC-stepCount">{progresoRecalculo.processed} / {progresoRecalculo.total}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Barra de progreso */}
              <div className="MC-recalcBarWrap">
                <div className="MC-recalcBar">
                  <div
                    className="MC-recalcBarFill"
                    style={{ width: `${progresoRecalculo.progress}%` }}
                  />
                </div>
                <span className="MC-recalcPct">{progresoRecalculo.progress}%</span>
              </div>

              <p className="MC-recalcMsg">{progresoRecalculo.message}</p>
            </div>
          </div>
        );
      })()}

      {/* ── FOOTER ── */}
      <footer className="MC-footer">
        <div className="MC-footerInner">
          <div className="MC-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="MC-footerLinks">
            <a href="tel:+573125443396" className="MC-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="MC-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="MC-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="MC-footerCopy">© {new Date().getFullYear()} Integra — Portal Medical Care</span>
        </div>
      </footer>
    </div>
  );
};

export default MedicalCareP;
