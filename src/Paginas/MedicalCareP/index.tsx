'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Lottie from 'lottie-react';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUserCircle,
  FaCheckCircle, FaCircle, FaFileExcel, FaFilter, FaRoute, FaCog, FaPlus, FaTrash, FaDollarSign,
  FaTimes, FaEye, FaEyeSlash, FaEdit,
} from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import animationPuntos from '@/Imagenes/AnimationPuntos.json';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
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
  const [modalOcupacion, setModalOcupacion] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
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

  // Configuración de sync
  const [syncConfig, setSyncConfig] = useState<{ horarios: string[], activo: boolean } | null>(null);
  const [nuevoHorario, setNuevoHorario] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Gestión de causales
  const [modalCausales, setModalCausales] = useState(false);
  const [causales, setCausales] = useState<{ _id: string; nombre: string; activo: boolean }[]>([]);
  const [nuevaCausal, setNuevaCausal] = useState('');
  const [loadingCausales, setLoadingCausales] = useState(false);
  const [causalEditando, setCausalEditando] = useState<string | null>(null);
  const [nombreEditando, setNombreEditando] = useState('');

  // Verificar si el usuario puede ver configuración (solo ADMIN)
  const puedeVerConfig = perfil === 'ADMIN';

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') router.replace('/Pedidos');

    // Cargar configuración de sync al inicio
    cargarConfigSync();
  }, [router]);


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

  // Funciones de configuración de sync
  const cargarConfigSync = async () => {
    setLoadingConfig(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/sync-v3/config`);
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios || [], activo: data.activo ?? true });
      }
    } catch (error) {
      console.error('Error al cargar config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleAgregarHorario = async () => {
    if (!nuevoHorario) return;

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/sync-v3/horarios?horario=${nuevoHorario}`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios, activo: data.activo });
        setNuevoHorario('');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al agregar horario');
      }
    } catch (error) {
      console.error('Error al agregar horario:', error);
      alert('Error al agregar horario');
    }
  };

  const handleEliminarHorario = async (horario: string) => {
    if (!confirm(`¿Eliminar el horario ${horario}?`)) return;

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/sync-v3/horarios/${horario}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios, activo: data.activo });
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al eliminar horario');
      }
    } catch (error) {
      console.error('Error al eliminar horario:', error);
      alert('Error al eliminar horario');
    }
  };

  const handleToggleActivo = async () => {
    if (!syncConfig) return;

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/sync-v3/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !syncConfig.activo }),
      });
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios, activo: data.activo });
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  };

  // Funciones para gestión de causales
  const cargarCausales = async () => {
    setLoadingCausales(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

      // Primero inicializar causales por defecto si no existen
      await fetch(`${API}/siscore/causales/inicializar`, { method: 'POST' });

      // Luego cargar todas las causales
      const response = await fetch(`${API}/siscore/causales/todas`);
      if (response.ok) {
        const data = await response.json();
        setCausales(data.causales || []);
      }
    } catch (error) {
      alert('Error al cargar causales');
    } finally {
      setLoadingCausales(false);
    }
  };

  const handleAbrirModalCausales = () => {
    setModalCausales(true);
    cargarCausales();
  };

  const handleCrearCausal = async () => {
    if (!nuevaCausal.trim()) return;

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/siscore/causales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevaCausal.trim(), activo: true })
      });

      if (response.ok) {
        await cargarCausales();
        setNuevaCausal('');
        alert('Causal creada exitosamente');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al crear causal');
      }
    } catch (error) {
      alert('Error al crear causal');
    }
  };

  const handleActualizarCausal = async (id: string, nuevoNombre: string) => {
    if (!nuevoNombre.trim()) {
      alert('El nombre no puede estar vacío');
      return;
    }

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const causal = causales.find(c => c._id === id);
      if (!causal) return;

      const response = await fetch(`${API}/siscore/causales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), activo: causal.activo })
      });

      if (response.ok) {
        await cargarCausales();
        setCausalEditando(null);
        setNombreEditando('');
        alert('Causal actualizada exitosamente');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al actualizar causal');
      }
    } catch (error) {
      alert('Error al actualizar causal');
    }
  };

  const iniciarEdicion = (id: string, nombre: string) => {
    setCausalEditando(id);
    setNombreEditando(nombre);
  };

  const cancelarEdicion = () => {
    setCausalEditando(null);
    setNombreEditando('');
  };

  const guardarEdicion = (id: string) => {
    handleActualizarCausal(id, nombreEditando);
  };

  const handleEliminarCausal = async (id: string) => {
    if (!confirm('¿Eliminar esta causal?')) return;

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/siscore/causales/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await cargarCausales();
        alert('Causal eliminada exitosamente');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al eliminar causal');
      }
    } catch (error) {
      alert('Error al eliminar causal');
    }
  };

  const handleToggleCausalActiva = async (id: string, activo: boolean) => {
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const causal = causales.find(c => c._id === id);
      if (!causal) return;

      // Actualización optimista del estado local
      const nuevasCausales = causales.map(c =>
        c._id === id ? { ...c, activo: activo } : c
      );
      setCausales(nuevasCausales);

      const response = await fetch(`${API}/siscore/causales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: causal.nombre, activo: activo })
      });

      if (response.ok) {
        await cargarCausales();
        alert(`Causal ${activo ? 'activada' : 'desactivada'} exitosamente`);
      } else {
        // Si falla, recargar para revertir el cambio optimista
        await cargarCausales();
        const error = await response.json();
        alert(error.detail || 'Error al actualizar estado');
      }
    } catch (error) {
      await cargarCausales();
      alert('Error al actualizar estado de causal');
    }
  };

  const REGIONALES = ['TODAS', 'BARRANQUILLA', 'CALI', 'BUCARAMANGA', 'FUNZA', 'MEDELLIN'];

  const rutasFiltradas = filtroRegional === 'TODAS'
    ? rutas
    : rutas.filter(r => (r.cedi || '').toUpperCase() === filtroRegional);

  const rutasV3SinFiltradas = filtroRegional === 'TODAS'
    ? rutasV3Sin
    : rutasV3Sin.filter(r => (r.cedi || '').toUpperCase() === filtroRegional);


  return (
    <div className="MC-layout">

      <NavMedicalCare paginaActual="medicalcare" />

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
              <button
                className="MC-welcomeBtn MC-btnPrimary"
                onClick={() => router.push('/SolicitudVehiculos')}
              >
                <FaFilter /> Solicitud de Vehículos
              </button>
              {puedeVerConfig && (
                <>
                  <button
                    className="MC-welcomeBtn MC-btnConfig"
                    onClick={() => setModalConfig(true)}
                  >
                    <FaCog /> Configuración Sync
                  </button>
                  <button
                    className="MC-welcomeBtn MC-btnConfig"
                    onClick={handleAbrirModalCausales}
                  >
                    <FaFilter /> Editar Causales
                  </button>
                  <button
                    className="MC-welcomeBtn MC-btnPrimary"
                    onClick={() => router.push('/GestionTarifasRutas')}
                  >
                    <FaDollarSign /> Tarifas Rutas FMC
                  </button>
                </>
              )}
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

      {/* ── MODAL CONFIGURACIÓN SYNC ── */}
      {modalConfig && (
        <div className="MC-modalOverlay" onClick={() => setModalConfig(false)}>
          <div className="MC-modalConfig" onClick={(e) => e.stopPropagation()}>
            <div className="MC-modalHeader">
              <h2><FaCog /> Configuración de Sincronización V3</h2>
              <button className="MC-modalClose" onClick={() => setModalConfig(false)}>×</button>
            </div>

            <div className="MC-modalBody MC-configBody">
              {loadingConfig ? (
                <div className="MC-loadingConfig">
                  <div className="MC-spinner"></div>
                  <p>Cargando configuración...</p>
                </div>
              ) : syncConfig ? (
                <>
                  <div className="MC-configSection">
                    <div className="MC-configHeader">
                      <h3>Estado del Sync</h3>
                      <button
                        className={`MC-toggleBtn ${syncConfig.activo ? 'MC-toggleActivo' : 'MC-toggleInactivo'}`}
                        onClick={handleToggleActivo}
                      >
                        {syncConfig.activo ? '● Activo' : '○ Inactivo'}
                      </button>
                    </div>
                    <p className="MC-configHint">
                      {syncConfig.activo
                        ? 'El sync se ejecutará automáticamente en los horarios configurados'
                        : 'El sync está pausado. No se ejecutará automáticamente.'}
                    </p>
                  </div>

                  <div className="MC-configSection">
                    <h3>Horarios Programados</h3>
                    <p className="MC-configHint">Formato HH:MM (ej: 08:00, 14:30)</p>

                    <div className="MC-agregarHorario">
                      <input
                        type="time"
                        className="MC-timeInput"
                        value={nuevoHorario}
                        onChange={e => setNuevoHorario(e.target.value)}
                      />
                      <button
                        className="MC-btnAgregarHorario"
                        onClick={handleAgregarHorario}
                        disabled={!nuevoHorario}
                      >
                        <FaPlus /> Agregar
                      </button>
                    </div>

                    <div className="MC-horariosList">
                      {syncConfig.horarios.length === 0 ? (
                        <p className="MC-sinHorarios">No hay horarios configurados</p>
                      ) : (
                        syncConfig.horarios.map(horario => (
                          <div key={horario} className="MC-horarioItem">
                            <span className="MC-horarioTime">{horario}</span>
                            <button
                              className="MC-btnEliminarHorario"
                              onClick={() => handleEliminarHorario(horario)}
                              title="Eliminar horario"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="MC-configInfo">
                    <p><strong>Información:</strong></p>
                    <ul>
                      <li>El sync consume datos del API de Siscore V3 automáticamente</li>
                      <li>Se ejecuta a la hora exacta en cada horario configurado</li>
                      <li>Puedes agregar o quitar horarios según lo necesites</li>
                      <li>Los cambios se guardan en la base de datos inmediatamente</li>
                    </ul>
                  </div>
                </>
              ) : null}
            </div>

            <div className="MC-modalFooter">
              <button
                className="MC-btnCerrarConfig"
                onClick={() => setModalConfig(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CAUSALES ── */}
      {modalCausales && (
        <div className="MC-modalOverlay" onClick={() => setModalCausales(false)}>
          <div className="MC-modalContent MC-modalCausales" onClick={(e) => e.stopPropagation()}>
            <div className="MC-modalHeader">
              <h2 className="MC-modalTitle">Gestión de Causales</h2>
              <button
                className="MC-modalCloseBtn"
                onClick={() => setModalCausales(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="MC-modalBody MC-modalCausalesBody">
              {/* Crear nueva causal */}
              <div className="MC-crearCausalSection">
                <h3 className="MC-sectionTitle">
                  <FaPlus className="MC-sectionIcon" />
                  Nueva Causal
                </h3>
                <div className="MC-crearCausalForm">
                  <input
                    type="text"
                    value={nuevaCausal}
                    onChange={(e) => setNuevaCausal(e.target.value)}
                    placeholder="Ej: lleva paqueteo"
                    className="MC-inputCausal"
                  />
                  <button
                    onClick={handleCrearCausal}
                    disabled={!nuevaCausal.trim()}
                    className={`MC-btnCrear ${nuevaCausal.trim() ? 'MC-btnCrearActive' : ''}`}
                  >
                    <FaPlus /> Crear
                  </button>
                </div>
              </div>

              {/* Lista de causales */}
              <div className="MC-listaCausalesSection">
                <h3 className="MC-sectionTitle">
                  <FaFilter className="MC-sectionIcon" />
                  Causales Registradas
                  <span className="MC-countBadge">{causales.filter(c => c.activo).length} / {causales.length}</span>
                </h3>

                {loadingCausales ? (
                  <div className="MC-loadingState">
                    <div className="MC-spinner"></div>
                    <p>Cargando causales...</p>
                  </div>
                ) : causales.length === 0 ? (
                  <div className="MC-emptyState">
                    <FaFilter className="MC-emptyIcon" />
                    <p>No hay causales registradas</p>
                    <span>Crea una nueva causal para comenzar</span>
                  </div>
                ) : (
                  <div className="MC-causalesGrid">
                    {causales.map((causal) => (
                      <div
                        key={causal._id}
                        className={`MC-causalCard ${causal.activo ? 'MC-causalActive' : 'MC-causalInactive'}`}
                      >
                        {causalEditando === causal._id ? (
                          <div className="MC-causalMain">
                            <input
                              type="text"
                              value={nombreEditando}
                              onChange={(e) => setNombreEditando(e.target.value)}
                              className="MC-causalInput MC-causalInputEditing"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') guardarEdicion(causal._id);
                                if (e.key === 'Escape') cancelarEdicion();
                              }}
                            />
                          </div>
                        ) : (
                          <div className="MC-causalMain">
                            <div className="MC-causalNombre">{causal.nombre}</div>
                            <span className={`MC-statusBadge ${causal.activo ? 'MC-statusActive' : 'MC-statusInactive'}`}>
                              {causal.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        )}
                        <div className="MC-causalActions">
                          {causalEditando === causal._id ? (
                            <>
                              <button
                                onClick={() => guardarEdicion(causal._id)}
                                className="MC-btnAction MC-btnSave"
                                title="Guardar"
                              >
                                <FaCheckCircle />
                              </button>
                              <button
                                onClick={cancelarEdicion}
                                className="MC-btnAction MC-btnCancel"
                                title="Cancelar"
                              >
                                <FaTimes />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => iniciarEdicion(causal._id, causal.nombre)}
                                className="MC-btnAction MC-btnEdit"
                                title="Editar"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleToggleCausalActiva(causal._id, !causal.activo)}
                                className={`MC-btnAction MC-btnToggle ${causal.activo ? 'MC-btnToggleActive' : 'MC-btnToggleInactive'}`}
                                title={causal.activo ? 'Desactivar' : 'Activar'}
                              >
                                {causal.activo ? <FaEyeSlash /> : <FaEye />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="MC-modalFooter">
              <button
                className="MC-btnCerrarConfig"
                onClick={() => setModalCausales(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
