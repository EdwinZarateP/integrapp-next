'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, LineChart, Line } from 'recharts';
import { format, subDays, startOfDay, parseISO, addMonths, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { FaBox, FaCheckCircle, FaClock, FaExclamationTriangle, FaFilter, FaArrowLeft, FaSync, FaDownload, FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaBoxes, FaWeight } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

type KPIs = {
  totalGuias: number;
  porcentajeEntregados: string;
  porcentajePendientes: string;
  porcentajeConNovedad: string;
  conteo: {
    ENTREGADO: number;
    PENDIENTE: number;
    'CON NOVEDAD': number;
    otros: number;
  };
  conteoPorEstado: Record<string, number>;
  peso?: {
    totalPiezas: number;
    totalToneladas: number;
  };
};

type DatosGrafico = {
  fecha: string;
  ENTREGADO?: number;
  PENDIENTE?: number;
  'CON NOVEDAD'?: number;
  [key: string]: number | string | undefined;
};

type ApiResponse = {
  success: boolean;
  data?: {
    kpis: KPIs;
    datosGrafico: DatosGrafico[];
    datosPorCliente: any[];
    datosCajas: any[];
    estados: string[];
    clientes: string[];
  };
  error?: string;
};

const IndicadoresGuias: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollGraficoRef = useRef<HTMLDivElement>(null);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [datosGrafico, setDatosGrafico] = useState<DatosGrafico[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);
  const [datosPorCliente, setDatosPorCliente] = useState<any[]>([]);
  const [datosCajas, setDatosCajas] = useState<any[]>([]);

  // Filtros (valores en pantalla, no disparan fetch automáticamente)
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('');
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false);

  // Filtros aplicados (estos son los que realmente se usan para consultar)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    fechaInicio: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    fechaFin: format(new Date(), 'yyyy-MM-dd'),
    estado: '',
    clientes: [] as string[],
  });

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);

  // Estado para controlar la leyenda desplegable en móvil
  const [leyendaAbierta, setLeyendaAbierta] = useState(false);

  // Modal de detalle por día
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalFecha, setModalFecha] = useState('');
  const [modalRegistros, setModalRegistros] = useState<any[]>([]);
  const [modalCargando, setModalCargando] = useState(false);

  // Estado para controlar la visibilidad de los estados en el gráfico
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>([]);

  // Agrupar por mes (switch)
  const [agruparPorMes, setAgruparPorMes] = useState(false);

  // Resetear scroll al cambiar agrupación (después del re-render)
  useEffect(() => {
    const timer = setTimeout(() => {
      document.querySelectorAll('.IG-scrollGrafico').forEach((el: any) => {
        el.scrollLeft = 0;
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [agruparPorMes]);

  // Función para formatear números con separador de miles
  const formatearNumero = (num: number): string => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  // Abrir modal de detalle por día
  const abrirDetalleDia = async (fecha: string) => {
    setModalFecha(fecha);
    setModalAbierto(true);
    setModalCargando(true);
    setModalRegistros([]);

    try {
      const params = new URLSearchParams({ fecha });
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      // Si hay estados filtrados en la leyenda, enviar solo esos
      if (estadosSeleccionados.length > 0) {
        estadosSeleccionados.forEach(e => params.append('estado', e));
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-transporte/guias/detalle?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setModalRegistros(data.data || []);
      }
    } catch (err) {
      console.error('Error al cargar detalle:', err);
    } finally {
      setModalCargando(false);
    }
  };

  // Cargar datos del usuario
  useEffect(() => {
    const usuarioMatch = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const perfilMatch = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/);
    const regionalMatch = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/);

    if (usuarioMatch) {
      setDatosUsuario({
        usuario: usuarioMatch[2],
        perfil: perfilMatch?.[2],
        regional: regionalMatch?.[2],
      });
    }
  }, []);

  // Cerrar menú al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Función para seleccionar/deseleccionar estados
  const toggleEstado = (estado: string) => {
    setEstadosSeleccionados(prev => {
      // Si ya está seleccionado, lo quitamos
      if (prev.includes(estado)) {
        return prev.filter(e => e !== estado);
      }
      // Si no está seleccionado, lo agregamos
      return [...prev, estado];
    });
  };

  // Determinar qué estados mostrar: si hay seleccionados, solo esos; si no, todos
  const estadosAMostrar = estadosSeleccionados.length > 0 ? estadosSeleccionados : estados;

  // Filtrar datos del gráfico basado en estados seleccionados
  const datosFiltrados = datosGrafico.map(dia => {
    const diaFiltrado: any = { fecha: dia.fecha };

    // Agregar cada estado visible
    estadosAMostrar.forEach(estado => {
      diaFiltrado[estado] = dia[estado];
    });

    // Calcular el total del stack para este día
    const totalStack = estadosAMostrar.reduce((sum, estado) => {
      const valor = dia[estado];
      return sum + (typeof valor === 'number' ? valor : 0);
    }, 0);

    diaFiltrado.totalStack = totalStack;

    return diaFiltrado;
  });

  // Filtrar datos de cajas basado en estados seleccionados
  const cajasFiltradas = datosCajas.map(dia => {
    const diaFiltrado: any = { fecha: dia.fecha };

    estadosAMostrar.forEach(estado => {
      diaFiltrado[estado] = dia[estado];
    });

    const totalStack = estadosAMostrar.reduce((sum, estado) => {
      const valor = dia[estado];
      return sum + (typeof valor === 'number' ? valor : 0);
    }, 0);

    diaFiltrado.totalStack = totalStack;

    return diaFiltrado;
  });

  // Calcular total general basado solo en estados a mostrar
  const totalGeneral = datosFiltrados.reduce((sumTotal, dia) => {
    return sumTotal + estadosAMostrar.reduce((sumDia, estado) => {
      const valor = dia[estado];
      return sumDia + (typeof valor === 'number' ? valor : 0);
    }, 0);
  }, 0);

  // Función para agrupar datos por mes
  const agruparPorMesFn = (datos: any[]) => {
    const agrupado: Record<string, any> = {};
    datos.forEach(dia => {
      const date = parseISO(dia.fecha);
      const clave = format(date, 'yyyy-MM');
      if (!agrupado[clave]) {
        agrupado[clave] = { fecha: clave };
        estadosAMostrar.forEach(e => { agrupado[clave][e] = 0; });
        agrupado[clave].totalStack = 0;
      }
      estadosAMostrar.forEach(estado => {
        const valor = typeof dia[estado] === 'number' ? dia[estado] : 0;
        agrupado[clave][estado] = (agrupado[clave][estado] || 0) + valor;
      });
      agrupado[clave].totalStack += dia.totalStack || 0;
    });
    return Object.values(agrupado).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  };

  // Datos finales según agrupación
  const datosPedidosFinal = agruparPorMes ? agruparPorMesFn(datosFiltrados) : datosFiltrados;
  const datosCajasFinal = agruparPorMes ? agruparPorMesFn(cajasFiltradas) : cajasFiltradas;

  // Formateador de fecha según agrupación
  const formatoEjeX = (fecha: string) => {
    if (agruparPorMes && fecha.length === 7) {
      return format(parseISO(fecha + '-01'), 'MMM yy', { locale: es });
    }
    const date = parseISO(fecha);
    const inicio = parseISO(filtrosAplicados.fechaInicio);
    const fin = parseISO(filtrosAplicados.fechaFin);
    if (inicio.getFullYear() !== fin.getFullYear()) {
      return format(date, 'd MMM yy', { locale: es });
    }
    return format(date, 'd MMM', { locale: es });
  };

  const volverMenu = () => {
    router.push('/indicadores');
  };

  const manejarLogout = () => {
    // Eliminar todas las cookies relacionadas con la sesión
    const cookies = document.cookie.split(';');

    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.includes('usuario') || cookieName.includes('cliente') || cookieName.includes('perfil') || cookieName.includes('regional')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });

    // Redirigir al login
    router.push('/LoginUsuario');
  };

  const obtenerDatos = async () => {
    setCargando(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        fecha_inicio: filtrosAplicados.fechaInicio,
        fecha_fin: filtrosAplicados.fechaFin,
      });

      if (filtrosAplicados.estado) params.append('estado', filtrosAplicados.estado);
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-transporte/guias?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Error al obtener datos');
      }

      const data: ApiResponse = await response.json();

      if (data.success && data.data) {
        setKpis(data.data.kpis);
        setDatosGrafico(data.data.datosGrafico);
        setEstados(data.data.estados);
        setClientes(data.data.clientes);
        setDatosPorCliente(data.data.datosPorCliente || []);
        setDatosCajas(data.data.datosCajas || []);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
      console.error('Error al obtener datos:', err);
    } finally {
      setCargando(false);
    }
  };

  // Función que aplica los filtros y luego consulta
  const aplicarFiltros = () => {
    setFiltrosAplicados({
      fechaInicio,
      fechaFin,
      estado: estadoSeleccionado,
      clientes: clientesSeleccionados,
    });
  };

  useEffect(() => {
    obtenerDatos();
  }, [filtrosAplicados]);

  // Scroll al final del gráfico (fecha más reciente) cuando cargan datos
  useEffect(() => {
    if (scrollGraficoRef.current && datosFiltrados.length > 0) {
      setTimeout(() => {
        if (scrollGraficoRef.current) {
          scrollGraficoRef.current.scrollLeft = scrollGraficoRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [datosFiltrados]);


  // Saber si hay filtros activos distintos al default (1 mes atrás, sin estado/cliente)
  const hasFiltrosActivos =
    filtrosAplicados.estado !== '' ||
    filtrosAplicados.clientes.length > 0 ||
    filtrosAplicados.fechaInicio !== format(subDays(new Date(), 30), 'yyyy-MM-dd') ||
    filtrosAplicados.fechaFin !== format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="IG-container">
      {/* Header */}
      <header className="IG-header">
        <div className="IG-headerInner">
          <button className="IG-brand" onClick={volverMenu} title="Volver al menú de indicadores">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="IG-brandName">
              Integr<span className="IG-brandAccent">App</span>
            </span>
          </button>

          <h1 className="IG-titulo">
            <span className="IG-tituloDesktop">Indicadores de Guías de Transporte</span>
            <span className="IG-tituloMobile">Indicadores Transporte</span>
          </h1>

          {/* Usuario + menú */}
          <div className="IG-userZone" ref={menuRef}>
            <button className="IG-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="IG-userIcon" />
              <div className="IG-userInfo">
                <span className="IG-userName">{datosUsuario?.usuario || 'Usuario'}</span>
                <span className="IG-userPerfil">
                  {datosUsuario?.perfil}{datosUsuario?.regional ? ` · ${datosUsuario.regional}` : ''}
                </span>
              </div>
              <FaChevronDown className={`IG-chevron ${menuAbierto ? 'IG-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="IG-dropdown">
                <button className="IG-dropItem" onClick={() => { setMenuAbierto(false); volverMenu(); }}>
                  <FaChartBar /> Menú de indicadores
                </button>
                <div className="IG-dropDivider" />
                <button className="IG-dropItem IG-dropItemDanger" onClick={() => { setMenuAbierto(false); manejarLogout(); }}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="IG-filtrosSection">
        <button
          className="IG-filtrosToggle"
          onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
        >
          <FaFilter /> Filtros {filtrosAbiertos ? '▲' : '▼'}
        </button>

        {filtrosAbiertos && (
          <div className="IG-filtrosPanel">
            <div className="IG-filtroGrupo IG-rangoFechas">
              <label>Rango de fechas:</label>
              <div className="IG-rangoDisplay" onClick={() => setCalendarioAbierto(!calendarioAbierto)}>
                <span>{format(parseISO(fechaInicio), 'dd/MM/yy')}</span>
                <span className="IG-rangoSeparador">→</span>
                <span>{format(parseISO(fechaFin), 'dd/MM/yy')}</span>
              </div>
              <div className="IG-rangoAtajos">
                <button className="IG-atajoBtn" onClick={() => {
                  const hoy = new Date();
                  setFechaInicio(format(startOfMonth(hoy), 'yyyy-MM-dd'));
                  setFechaFin(format(hoy, 'yyyy-MM-dd'));
                  setCalendarioAbierto(false);
                }}>
                  Mes actual
                </button>
                <button className="IG-atajoBtn" onClick={() => {
                  const hoy = new Date();
                  setFechaInicio(format(new Date(hoy.getFullYear(), 0, 1), 'yyyy-MM-dd'));
                  setFechaFin(format(hoy, 'yyyy-MM-dd'));
                  setCalendarioAbierto(false);
                }}>
                  Este año
                </button>
              </div>
              {calendarioAbierto && (
                <div className="IG-calendarioPopover">
                  <DateRange
                    ranges={[{
                      startDate: parseISO(fechaInicio),
                      endDate: parseISO(fechaFin),
                      key: 'selection',
                    }]}
                    onChange={(ranges: any) => {
                      setFechaInicio(format(ranges.selection.startDate, 'yyyy-MM-dd'));
                      setFechaFin(format(ranges.selection.endDate, 'yyyy-MM-dd'));
                    }}
                    maxDate={new Date()}
                    locale={es}
                    months={1}
                    direction="horizontal"
                    showMonthAndYearPickers
                    showDateDisplay={false}
                    rangeColors={['#0f1928']}
                  />
                </div>
              )}
            </div>

            <div className="IG-filtroGrupo">
              <label>Estado:</label>
              <select
                value={estadoSeleccionado}
                onChange={(e) => setEstadoSeleccionado(e.target.value)}
                className="IG-select"
              >
                <option value="">Todos</option>
                {estados.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>

            <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
              <label>Cliente:</label>
              <div className="IG-clienteMulti">
                <div className="IG-clienteInputWrap" onClick={() => setDropdownClienteAbierto(!dropdownClienteAbierto)}>
                  {clientesSeleccionados.length > 0 && (
                    <div className="IG-clienteChips">
                      {clientesSeleccionados.map(c => (
                        <span key={c} className="IG-clienteChip">
                          {c}
                          <span className="IG-clienteChipX" onClick={(e) => {
                            e.stopPropagation();
                            setClientesSeleccionados(prev => prev.filter(x => x !== c));
                          }}>✕</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    className="IG-clienteBuscar"
                    placeholder={clientesSeleccionados.length === 0 ? 'Buscar cliente...' : ''}
                    value={busquedaCliente}
                    onChange={(e) => { setBusquedaCliente(e.target.value); setDropdownClienteAbierto(true); }}
                    onFocus={() => setDropdownClienteAbierto(true)}
                  />
                </div>
                {dropdownClienteAbierto && (
                  <div className="IG-clienteDropdown">
                    <div
                      className={`IG-clienteOpcion ${clientesSeleccionados.length === 0 ? 'IG-clienteOpcionSeleccionada' : ''}`}
                      onClick={() => { setClientesSeleccionados([]); setDropdownClienteAbierto(false); }}
                    >
                      Todos
                    </div>
                    {clientes
                      .filter(c => c.toLowerCase().includes(busquedaCliente.toLowerCase()))
                      .map(c => (
                        <div
                          key={c}
                          className={`IG-clienteOpcion ${clientesSeleccionados.includes(c) ? 'IG-clienteOpcionSeleccionada' : ''}`}
                          onClick={() => {
                            setClientesSeleccionados(prev =>
                              prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                            );
                          }}
                        >
                          <span className="IG-clienteCheck">{clientesSeleccionados.includes(c) ? '☑' : '☐'}</span>
                          {c}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <button className="IG-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownClienteAbierto(false); setCalendarioAbierto(false); setFiltrosAbiertos(false); setBusquedaCliente(''); }}>
              <FaFilter /> Filtrar
            </button>

          </div>
        )}
      </div>

      {/* Chips de filtros activos */}
      {hasFiltrosActivos && (
        <div className="IG-filtrosActivos">
          <span className="IG-filtrosActivosLabel">Filtros:</span>
          {(filtrosAplicados.fechaInicio !== format(subDays(new Date(), 30), 'yyyy-MM-dd') || filtrosAplicados.fechaFin !== format(new Date(), 'yyyy-MM-dd')) && (
            <button className="IG-filtroChip" onClick={() => {
              const fi = format(subDays(new Date(), 30), 'yyyy-MM-dd');
              const ff = format(new Date(), 'yyyy-MM-dd');
              setFechaInicio(fi);
              setFechaFin(ff);
              setFiltrosAplicados(f => ({ ...f, fechaInicio: fi, fechaFin: ff }));
            }}>
              {format(parseISO(filtrosAplicados.fechaInicio), 'dd/MM/yy')} – {format(parseISO(filtrosAplicados.fechaFin), 'dd/MM/yy')} ✕
            </button>
          )}
          {filtrosAplicados.estado && (
            <button className="IG-filtroChip" onClick={() => { setEstadoSeleccionado(''); setFiltrosAplicados(f => ({ ...f, estado: '' })); }}>
              Estado: {filtrosAplicados.estado} ✕
            </button>
          )}
          {filtrosAplicados.clientes.length > 0 && filtrosAplicados.clientes.map(c => (
            <button key={c} className="IG-filtroChip" onClick={() => {
              const nuevos = clientesSeleccionados.filter(x => x !== c);
              setClientesSeleccionados(nuevos);
              setFiltrosAplicados(f => ({ ...f, clientes: nuevos }));
            }}>
              {c} ✕
            </button>
          ))}
          <button className="IG-filtroLimpiar" onClick={() => {
            const fi = format(subDays(new Date(), 30), 'yyyy-MM-dd');
            const ff = format(new Date(), 'yyyy-MM-dd');
            setFechaInicio(fi);
            setFechaFin(ff);
            setEstadoSeleccionado('');
            setClientesSeleccionados([]);
            setFiltrosAplicados({ fechaInicio: fi, fechaFin: ff, estado: '', clientes: [] });
          }}>
            Limpiar todo
          </button>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="IG-main">
        {cargando ? (
          <div className="IG-loading">
            <div className="IG-camionContainer">
              <div className="IG-camionPista"></div>
              <div className="IG-camion">
                <svg viewBox="0 0 120 50" className="IG-camionSvg">
                  {/* Caja del camión */}
                  <rect x="30" y="8" width="58" height="28" rx="3" fill="#0f1928" />
                  {/* Cabina */}
                  <rect x="88" y="14" width="28" height="22" rx="3" fill="#e8a000" />
                  {/* Ventana */}
                  <rect x="93" y="18" width="18" height="10" rx="2" fill="#dbeafe" />
                  {/* Ruedas */}
                  <circle cx="45" cy="40" r="7" fill="#334155" stroke="#1e293b" strokeWidth="2" />
                  <circle cx="45" cy="40" r="3" fill="#94a3b8" />
                  <circle cx="100" cy="40" r="7" fill="#334155" stroke="#1e293b" strokeWidth="2" />
                  <circle cx="100" cy="40" r="3" fill="#94a3b8" />
                  {/* Parachoques */}
                  <rect x="114" y="33" width="6" height="5" rx="1" fill="#64748b" />
                </svg>
              </div>
            </div>
            <p>Cargando indicadores...</p>
          </div>
        ) : error ? (
          <div className="IG-error">
            <p>{error}</p>
            <button className="IG-reintentar" onClick={obtenerDatos}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            {kpis && (
              <div className="IG-kpisContainer">
                <div className="IG-kpiCard IG-kpiTotal">
                  <div className="IG-kpiIcon">
                    <FaBox />
                  </div>
                  <div className="IG-kpiContent">
                    <p className="IG-kpiLabel">Pedidos</p>
                    <p className="IG-kpiValor">{formatearNumero(kpis.totalGuias)}</p>
                  </div>
                </div>

                {kpis.conteoPorEstado && Object.entries(kpis.conteoPorEstado)
                  .sort(([,a], [,b]) => b - a)
                  .map(([estado, cantidad]) => {
                    const infoEstado: Record<string, { nombre: string; icon: React.ReactNode; clase: string }> = {
                      'ENTREGADO': { nombre: 'Entregados', icon: <FaCheckCircle />, clase: 'IG-kpiEntregado' },
                      'PENDIENTE': { nombre: 'Pendientes', icon: <FaClock />, clase: 'IG-kpiPendiente' },
                      'CON NOVEDAD': { nombre: 'Con Novedad', icon: <FaExclamationTriangle />, clase: 'IG-kpiNovedad' },
                      'En distribucion': { nombre: 'En distribución', icon: <FaChartBar />, clase: 'IG-kpiDistribucion' },
                      'Transito Nacional': { nombre: 'Tránsito', icon: <FaChartBar />, clase: 'IG-kpiTransito' },
                    };
                    const info = infoEstado[estado] || { nombre: estado, icon: <FaBox />, clase: 'IG-kpiOtro' };
                    const porcentaje = kpis.totalGuias > 0 ? ((cantidad / kpis.totalGuias) * 100).toFixed(1) : '0.0';

                    return (
                      <div key={estado} className={`IG-kpiCard ${info.clase}`}>
                        <div className="IG-kpiIcon">
                          {info.icon}
                        </div>
                        <div className="IG-kpiContent">
                          <p className="IG-kpiLabel">{info.nombre}</p>
                          <p className="IG-kpiValor">{porcentaje}%</p>
                          <p className="IG-kpiSub">{formatearNumero(cantidad)} pedidos</p>
                        </div>
                      </div>
                    );
                  })}

                <div className="IG-kpiCard IG-kpiPiezas">
                  <div className="IG-kpiIcon">
                    <FaBoxes />
                  </div>
                  <div className="IG-kpiContent">
                    <p className="IG-kpiLabel">Cajas</p>
                    <p className="IG-kpiValor IG-kpiValorPeq">{kpis.peso ? formatearNumero(kpis.peso.totalPiezas) : '0'}</p>
                  </div>
                </div>

                <div className="IG-kpiCard IG-kpiToneladas">
                  <div className="IG-kpiIcon">
                    <FaWeight />
                  </div>
                  <div className="IG-kpiContent">
                    <p className="IG-kpiLabel">Toneladas</p>
                    <p className="IG-kpiValor">{kpis.peso ? Math.round(kpis.peso.totalToneladas).toLocaleString('es-CO') : '0'}</p>
                  </div>
                </div>
              </div>
            )}

                {/* Gráfico */}
                <div className="IG-graficoContainer">
                  {datosGrafico && datosGrafico.length > 0 ? (
                    <>
                      <div className="IG-graficoHeader">
                        <h2 className="IG-graficoTitulo">Pedidos diarios</h2>
                        <label className="IG-switch">
                          <span className="IG-switchLabel">Agrupar por mes</span>
                          <input type="checkbox" checked={agruparPorMes} onChange={() => setAgruparPorMes(!agruparPorMes)} />
                          <span className="IG-switchSlider"></span>
                        </label>
                      </div>

                      {/* Leyenda personalizada con botones clickeables */}
                      <div className={`IG-leyendaPersonalizada ${leyendaAbierta ? 'IG-leyendaAbierta' : ''}`}>
                        {/* Botón toggle para móvil */}
                        <button className="IG-leyendaToggle" onClick={() => setLeyendaAbierta(!leyendaAbierta)}>
                          <FaFilter />
                          <span>Estados {leyendaAbierta ? '▲' : '▼'}</span>
                        </button>

                        <div className="IG-leyendaOpciones">
                          {estados.map(estado => {
                            const colores: Record<string, string> = {
                              'ENTREGADO': '#10b981',
                              'En distribucion': '#3b82f6',
                              'PENDIENTE': '#f59e0b',
                              'Transito Nacional': '#8b5cf6',
                              'CON NOVEDAD': '#ef4444'
                            };
                            const nombresAmigables: Record<string, string> = {
                              'ENTREGADO': 'Entregado',
                              'En distribucion': 'En distribución',
                              'PENDIENTE': 'Pendiente',
                              'Transito Nacional': 'Tránsito Nacional',
                              'CON NOVEDAD': 'Con Novedad'
                            };

                            const estaSeleccionado = estadosSeleccionados.includes(estado);
                            const todosVisibles = estadosSeleccionados.length === 0;
                            const esVisible = todosVisibles || estaSeleccionado;

                            return (
                              <button
                                key={estado}
                                className={`IG-leyendaBoton ${estaSeleccionado ? 'IG-leyendaBotonSeleccionado' : ''}`}
                                onClick={() => toggleEstado(estado)}
                                style={{
                                  '--color-estado': colores[estado] || '#6b7280',
                                  opacity: esVisible ? 1 : 0.4
                                } as React.CSSProperties}
                              >
                                <span className="IG-leyendaColor"></span>
                                <span className="IG-leyendaTexto">{nombresAmigables[estado] || estado}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="IG-scrollGrafico" ref={scrollGraficoRef} key={`pedidos-${agruparPorMes}`}>
                        <div style={{ minWidth: `${Math.max(datosPedidosFinal.length * 50, 400)}px`, height: 400 }}>
                          <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={datosPedidosFinal} margin={{ top: 50, right: 10, left: 30, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="fecha"
                                angle={agruparPorMes ? 0 : -90}
                                textAnchor={agruparPorMes ? 'middle' : 'end'}
                                interval={0}
                                height={70}
                                tick={({ x, y, payload }) => {
                                  const fecha = payload.value;
                                  const label = formatoEjeX(fecha);
                                  return (
                                    <g transform={`translate(${x},${y})`}>
                                      <text
                                        transform={agruparPorMes ? '' : 'rotate(-90)'}
                                        textAnchor={agruparPorMes ? 'middle' : 'end'}
                                        fontSize={11}
                                        fill="#0f1928"
                                        fontWeight={600}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => abrirDetalleDia(fecha)}
                                      >
                                        {label}
                                      </text>
                                    </g>
                                  );
                                }}
                              />
                              <YAxis />
                              <Tooltip
                                labelFormatter={(fecha) => format(parseISO(fecha), 'dd/MM/yyyy')}
                                formatter={(value: any, name: string) => [value, name]}
                                contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                                labelStyle={{ color: '#ffffff', fontWeight: '700', marginBottom: '4px' }}
                                itemStyle={{ color: '#ffffff' }}
                              />
                              {estadosAMostrar.map((estado, index) => {
                                const colores: Record<string, string> = {
                                  'ENTREGADO': '#10b981',
                                  'En distribucion': '#3b82f6',
                                  'PENDIENTE': '#f59e0b',
                                  'Transito Nacional': '#8b5cf6',
                                  'CON NOVEDAD': '#ef4444'
                                };
                                const nombresAmigables: Record<string, string> = {
                                  'ENTREGADO': 'Entregado',
                                  'En distribucion': 'En distribución',
                                  'PENDIENTE': 'Pendiente',
                                  'Transito Nacional': 'Tránsito Nacional',
                                  'CON NOVEDAD': 'Con Novedad'
                                };

                                const esUltimoEstado = index === estadosAMostrar.length - 1;

                                return (
                                  <Bar
                                    key={estado}
                                    dataKey={estado}
                                    fill={colores[estado] || '#6b7280'}
                                    name={nombresAmigables[estado] || estado}
                                    stackId="estados"
                                    isAnimationActive={false}
                                  >
                                    {esUltimoEstado && (
                                      <LabelList
                                        dataKey="totalStack"
                                        position="top"
                                        offset={10}
                                        formatter={(value: number) => value > 0 ? formatearNumero(value) : ''}
                                        style={{ fill: '#0f1928', fontWeight: '700', fontSize: '11px' }}
                                      />
                                    )}
                                  </Bar>
                                );
                              })}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="IG-sinDatos">
                      <p>No hay datos disponibles para el período seleccionado</p>
                    </div>
                  )}
                </div>

                {/* Gráfico de distribución por estado */}
                <div className="IG-graficoContainer">
                  {kpis && kpis.conteoPorEstado && Object.keys(kpis.conteoPorEstado).length > 0 ? (
                    <>
                      <div className="IG-graficoHeader">
                        <h2 className="IG-graficoTitulo">Distribución por Estado</h2>
                      </div>
                      <div className="IG-barrasHorizontales">
                        {(() => {
                          const colores: Record<string, string> = {
                            'ENTREGADO': '#10b981',
                            'En distribucion': '#3b82f6',
                            'PENDIENTE': '#f59e0b',
                            'Transito Nacional': '#8b5cf6',
                            'CON NOVEDAD': '#ef4444'
                          };
                          const nombres: Record<string, string> = {
                            'ENTREGADO': 'Entregado',
                            'En distribucion': 'En distribución',
                            'PENDIENTE': 'Pendiente',
                            'Transito Nacional': 'Tránsito Nacional',
                            'CON NOVEDAD': 'Con Novedad'
                          };
                          const total = kpis.totalGuias || 1;
                          const estadosOrdenados = Object.entries(kpis.conteoPorEstado)
                            .sort(([,a], [,b]) => b - a);
                          const maxCantidad = estadosOrdenados[0]?.[1] || 1;

                          return estadosOrdenados.map(([estado, cantidad]) => {
                            const porcentaje = ((cantidad / total) * 100).toFixed(1);
                            const ancho = ((cantidad / maxCantidad) * 100).toFixed(1);

                            return (
                              <div key={estado} className="IG-barraHItem">
                                <div className="IG-barraHLabel">
                                  <span className="IG-barraHPunto" style={{ background: colores[estado] || '#6b7280' }}></span>
                                  <span className="IG-barraHNombre">{nombres[estado] || estado}</span>
                                </div>
                                <div className="IG-barraHTrack">
                                  <div
                                    className="IG-barraHFill"
                                    style={{
                                      width: `${ancho}%`,
                                      background: colores[estado] || '#6b7280',
                                    }}
                                  >
                                    <span className="IG-barraHValor">{formatearNumero(cantidad)}</span>
                                  </div>
                                </div>
                                <span className="IG-barraHPorcentaje">{porcentaje}%</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="IG-sinDatos">
                      <p>No hay datos disponibles</p>
                    </div>
                  )}
                </div>

                {/* Gráfico de Cajas por Día */}
                <div className="IG-graficoContainer">
                  {datosCajas && datosCajas.length > 0 ? (
                    <>
                      <div className="IG-graficoHeader">
                        <h2 className="IG-graficoTitulo">📦 Cajas por Día</h2>
                        <label className="IG-switch">
                          <span className="IG-switchLabel">Agrupar por mes</span>
                          <input type="checkbox" checked={agruparPorMes} onChange={() => setAgruparPorMes(!agruparPorMes)} />
                          <span className="IG-switchSlider"></span>
                        </label>
                      </div>
                      <div className="IG-scrollGrafico" key={`cajas-${agruparPorMes}`}>
                        <div style={{ minWidth: `${Math.max(datosCajasFinal.length * 50, 400)}px`, height: 350 }}>
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={datosCajasFinal} margin={{ top: 20, right: 20, left: 30, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="fecha"
                                angle={agruparPorMes ? 0 : -90}
                                textAnchor={agruparPorMes ? 'middle' : 'end'}
                                interval={0}
                                height={70}
                                padding={{ left: 30, right: 30 }}
                                tick={{ fontSize: 11 }}
                                tickFormatter={(fecha) => formatoEjeX(fecha)}
                              />
                              <YAxis tickFormatter={(v) => formatearNumero(v)} />
                              <Tooltip
                                labelFormatter={(fecha) => agruparPorMes && fecha.length === 7
                                  ? format(parseISO(fecha + '-01'), 'MMMM yyyy', { locale: es })
                                  : format(parseISO(fecha), 'dd/MM/yyyy')}
                                formatter={(value: any) => [formatearNumero(value), 'Cajas']}
                                contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                                labelStyle={{ color: '#ffffff', fontWeight: '700', marginBottom: '4px' }}
                                itemStyle={{ color: '#ffffff' }}
                              />
                              <Line
                                type="monotone"
                                dataKey="totalStack"
                                stroke="#e8a000"
                                strokeWidth={3}
                                dot={{ r: 5, fill: '#e8a000', stroke: '#ffffff', strokeWidth: 2 }}
                                activeDot={{ r: 7, fill: '#0f1928', stroke: '#e8a000', strokeWidth: 2 }}
                                name="Cajas"
                              >
                                <LabelList
                                  dataKey="totalStack"
                                  position="top"
                                  offset={10}
                                  formatter={(value: number) => value > 0 ? formatearNumero(value) : ''}
                                  style={{ fill: '#0f1928', fontWeight: '700', fontSize: '11px' }}
                                />
                              </Line>
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="IG-sinDatos">
                      <p>No hay datos disponibles</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>

          {/* Modal de detalle por día */}
          {modalAbierto && (
            <div className="IG-modalOverlay" onClick={() => setModalAbierto(false)}>
              <div className="IG-modalContenido" onClick={(e) => e.stopPropagation()}>
                <div className="IG-modalHeader">
                  <h2 className="IG-modalTitulo">
                    Detalle del {modalFecha ? format(parseISO(modalFecha), "dd/MM/yyyy", { locale: es }) : ''}
                  </h2>
                  <span className="IG-modalTotal">{modalRegistros.length} registros</span>
                  <button className="IG-modalCerrar" onClick={() => setModalAbierto(false)}>✕</button>
                </div>
                {modalCargando ? (
                  <div className="IG-modalCargando">
                    <div className="IG-spinner"></div>
                    <p>Cargando registros...</p>
                  </div>
                ) : modalRegistros.length === 0 ? (
                  <div className="IG-modalVacio">No se encontraron registros</div>
                ) : (
                  <div className="IG-modalTablaWrap">
                    <table className="IG-modalTabla">
                      <thead>
                        <tr>
                          <th>Guía</th>
                          <th>Cliente</th>
                          <th>Destino</th>
                          <th>Estado</th>
                          <th>Novedad</th>
                          <th>Servicio</th>
                          <th>Piezas</th>
                          <th>Kilos</th>
                          <th>Destinatario</th>
                          <th>F. Entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalRegistros.map((reg, i) => (
                          <tr key={i}>
                            <td>{reg.guia}</td>
                            <td>{reg.nombre_cliente}</td>
                            <td>{reg.ciudad_destino}</td>
                            <td>
                              <span className="IG-estadoBadge" style={{
                                background: ((): string => {
                                  const colores: Record<string, string> = {
                                    'ENTREGADO': '#10b981',
                                    'PENDIENTE': '#f59e0b',
                                    'CON NOVEDAD': '#ef4444',
                                    'En distribucion': '#3b82f6',
                                    'Transito Nacional': '#8b5cf6',
                                  };
                                  return colores[reg.estado] || '#6b7280';
                                })()
                              }}>
                                {reg.estado}
                              </span>
                            </td>
                            <td>{reg.novedad || '—'}</td>
                            <td>{reg.servicio || '—'}</td>
                            <td>{reg.piezas || 0}</td>
                            <td>{reg.kilos ? parseFloat(reg.kilos).toLocaleString('es-CO') : 0}</td>
                            <td>{reg.destinatario || '—'}</td>
                            <td>{reg.fecha_entrega || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="IG-footer">
            <p>© {new Date().getFullYear()} Integra — Indicadores de Guías de Transporte</p>
          </footer>
        </div>
      );
    };

    export default IndicadoresGuias;
