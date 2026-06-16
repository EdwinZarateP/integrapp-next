'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaBox, FaCheckCircle, FaClock, FaExclamationTriangle, FaFilter, FaArrowLeft, FaSync, FaDownload, FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaBoxes, FaWeight, FaClipboardList } from 'react-icons/fa';
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
    datosCajasPorCliente: any[];
    anios: number[];
    estados: string[];
    clientes: string[];
  };
  error?: string;
};

const IndicadoresGuias: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollGraficoRef = useRef<HTMLDivElement>(null);
  const scrollCajasRef = useRef<HTMLDivElement>(null);
  const clienteFiltroRef = useRef<HTMLDivElement>(null);

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
  const [datosCajasPorCliente, setDatosCajasPorCliente] = useState<any[]>([]);

  // Estado para mostrar datos del cliente seleccionado en el pie
  const [clienteSeleccionadoPie, setClienteSeleccionadoPie] = useState<{
    name: string;
    value: number;
    porcentaje: string;
  } | null>(null);

  // Filtros (valores en pantalla, no disparan fetch automáticamente)
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false);

  // Años disponibles y seleccionados (por defecto año actual)
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [aniosSeleccionados, setAniosSeleccionados] = useState<number[]>([new Date().getFullYear()]);
  const [dropdownAnioAbierto, setDropdownAnioAbierto] = useState(false);

  // Meses seleccionados (vacío = todos). 1-12
  const MESES = [
    { valor: 1, nombre: 'Enero' }, { valor: 2, nombre: 'Febrero' },
    { valor: 3, nombre: 'Marzo' }, { valor: 4, nombre: 'Abril' },
    { valor: 5, nombre: 'Mayo' }, { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' }, { valor: 8, nombre: 'Agosto' },
    { valor: 9, nombre: 'Septiembre' }, { valor: 10, nombre: 'Octubre' },
    { valor: 11, nombre: 'Noviembre' }, { valor: 12, nombre: 'Diciembre' },
  ];
  const [mesesSeleccionados, setMesesSeleccionados] = useState<number[]>([]);
  const [dropdownMesAbierto, setDropdownMesAbierto] = useState(false);

  // Filtros aplicados (estos son los que realmente se usan para consultar)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    anios: [new Date().getFullYear()] as number[],
    meses: [] as number[],
    clientes: [] as string[],
  });

  // Vista del gráfico de Cajas: false = por día (diario), true = comparativo por año
  const [cajasComparativo, setCajasComparativo] = useState(false);

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
    console.log('🔍 Click en fecha:', fecha);
    setModalFecha(fecha);
    setModalAbierto(true);
    setModalCargando(true);
    setModalRegistros([]);

    try {
      const params = new URLSearchParams();

      // Determinar si es una fecha agrupada por mes (YYYY-MM) o día individual (YYYY-MM-DD)
      if (fecha.length === 7) {
        // Es un mes agrupado (ej: "2025-12") -> enviar rango completo del mes
        const [anio, mesNum] = fecha.split('-');
        const primerDia = `${fecha}-01`;
        const ultimoDia = new Date(parseInt(anio), parseInt(mesNum) + 1, 0).getDate();
        const ultimoDiaStr = `${fecha}-${ultimoDia.toString().padStart(2, '0')}`;

        params.append('fecha_inicio', primerDia);
        params.append('fecha_fin', ultimoDiaStr);

        // Filtros de clientes
        filtrosAplicados.clientes.forEach(c => params.append('cliente', c));

        // Si hay estados seleccionados, enviar solo esos
        if (estadosSeleccionados.length > 0) {
          estadosSeleccionados.forEach(e => params.append('estado', e));
        } else {
          // Si no hay estados seleccionados, excluir ENTREGADO
          // Agregar todos los estados excepto ENTREGADO
          const estadosNoEntregado = estados.filter(e => e !== 'ENTREGADO');
          estadosNoEntregado.forEach(e => params.append('estado', e));
        }
      } else {
        // Es un día individual (ej: "2025-12-16") -> enviar fecha exacta
        params.append('fecha', fecha);

        // Filtros de clientes
        filtrosAplicados.clientes.forEach(c => params.append('cliente', c));

        // Si hay estados seleccionados, enviar solo esos
        if (estadosSeleccionados.length > 0) {
          estadosSeleccionados.forEach(e => params.append('estado', e));
        }
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

  // Cerrar el desplegable de cliente al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteFiltroRef.current && !clienteFiltroRef.current.contains(e.target as Node)) {
        setDropdownClienteAbierto(false);
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

    // Mover scroll al final - versión simplificada
    setTimeout(() => {
      [scrollGraficoRef, scrollCajasRef].forEach(ref => {
        if (ref.current) {
          ref.current.scrollLeft = ref.current.scrollWidth;
        }
      });
    }, 50);

    setTimeout(() => {
      [scrollGraficoRef, scrollCajasRef].forEach(ref => {
        if (ref.current && ref.current.scrollLeft < ref.current.scrollWidth - ref.current.clientWidth) {
          ref.current.scrollLeft = ref.current.scrollWidth;
        }
      });
    }, 150);
  };

  // Determinar qué estados mostrar: si hay seleccionados, solo esos; si no, todos
  const estadosAMostrar = useMemo(
    () => estadosSeleccionados.length > 0 ? estadosSeleccionados : estados,
    [estadosSeleccionados, estados]
  );

  // Filtrar datos del gráfico basado en estados seleccionados (memoizado)
  const datosFiltrados = useMemo(() => {
    return datosGrafico
      .map(dia => {
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
      })
      .filter(dia => dia.totalStack > 0); // Solo días con datos
  }, [datosGrafico, estadosAMostrar]);

  // Filtrar datos de cajas basado en estados seleccionados (memoizado)
  const cajasFiltradas = useMemo(() => {
    return datosCajas
      .map(dia => {
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
      })
      .filter(dia => dia.totalStack > 0); // Solo días con datos
  }, [datosCajas, estadosAMostrar]);

  // Calcular total general basado solo en estados a mostrar
  const totalGeneral = useMemo(() => datosFiltrados.reduce((sumTotal, dia) => {
    return sumTotal + estadosAMostrar.reduce((sumDia, estado) => {
      const valor = dia[estado];
      return sumDia + (typeof valor === 'number' ? valor : 0);
    }, 0);
  }, 0), [datosFiltrados, estadosAMostrar]);

  // Calcular cajas por cliente (para gráfico tipo pie) basado en datos del backend
  const cajasPorCliente = useMemo(() => {
    if (!datosCajasPorCliente || datosCajasPorCliente.length === 0) return [];

    // Filtrar por estados seleccionados y calcular totales
    const clienteCajasMap: Record<string, number> = {};

    datosCajasPorCliente.forEach((cliente: any) => {
      const nombreCliente = cliente.cliente || 'Sin cliente';
      // Sumar cajas de todos los estados visibles para este cliente
      const totalCajasCliente = estadosAMostrar.reduce((sum: number, estado: string) => {
        const valor = cliente[estado];
        return sum + (typeof valor === 'number' ? valor : 0);
      }, 0);

      if (totalCajasCliente > 0) {
        clienteCajasMap[nombreCliente] = totalCajasCliente;
      }
    });

    // Convertir a array para el gráfico tipo pie
    const totalCajas = Object.values(clienteCajasMap).reduce((sum, val) => sum + val, 0);
    return Object.entries(clienteCajasMap)
      .map(([cliente, cajas]) => ({
        name: cliente,
        value: cajas,
        porcentaje: totalCajas > 0 ? ((cajas / totalCajas) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 clientes
  }, [datosCajasPorCliente, estadosAMostrar]);

  // Lista de clientes filtrada por búsqueda (memoizada y limitada a 80 para no colgar el render)
  const clientesFiltradosDropdown = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    const res = q ? clientes.filter(c => c.toLowerCase().includes(q)) : clientes;
    return res.slice(0, 80);
  }, [clientes, busquedaCliente]);

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

  // Datos finales según agrupación (memoizado)
  const datosPedidosFinal = useMemo(
    () => agruparPorMes ? agruparPorMesFn(datosFiltrados) : datosFiltrados,
    [agruparPorMes, datosFiltrados]
  );
  const datosCajasFinal = useMemo(
    () => agruparPorMes ? agruparPorMesFn(cajasFiltradas) : cajasFiltradas,
    [agruparPorMes, cajasFiltradas]
  );

  // Datos de cajas para comparación multianual: una serie por año, agrupada por mes (memoizado)
  const aniosGraficoCajas = useMemo(
    () => Array.from(new Set(cajasFiltradas.map(d => parseISO(d.fecha).getFullYear()))).sort(),
    [cajasFiltradas]
  );
  const COLORES_ANIOS = ['#0f1928', '#e8a000', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];
  const cajasMultianual = useMemo(() => {
    return MESES.map(m => {
      const punto: any = { periodo: m.nombre };
      aniosGraficoCajas.forEach(a => {
        const total = cajasFiltradas
          .filter(d => parseISO(d.fecha).getMonth() + 1 === m.valor && parseISO(d.fecha).getFullYear() === a)
          .reduce((s, d) => s + (d.totalStack || 0), 0);
        punto[a] = total > 0 ? total : null;
      });
      return punto;
    }).filter(p => aniosGraficoCajas.some(a => p[a] !== null));
  }, [cajasFiltradas, aniosGraficoCajas]);

  // Formateador de fecha según agrupación
  const formatoEjeX = (fecha: string) => {
    if (agruparPorMes && fecha.length === 7) {
      return format(parseISO(fecha + '-01'), 'MMM yy', { locale: es });
    }
    const date = parseISO(fecha);
    // Si los datos abarcan varios años, mostrar el año en el eje
    const aniosEnDatos = new Set(datosGrafico.map(d => parseISO(d.fecha).getFullYear()));
    if (aniosEnDatos.size > 1) {
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
      const params = new URLSearchParams();

      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      filtrosAplicados.anios.forEach(a => params.append('anio', String(a)));
      filtrosAplicados.meses.forEach(m => params.append('mes', String(m)));

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
        setDatosCajasPorCliente(data.data.datosCajasPorCliente || []);
        // Cargar años disponibles si vienen
        if (data.data.anios && data.data.anios.length > 0) {
          setAniosDisponibles(data.data.anios);
        }
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
      anios: aniosSeleccionados,
      meses: mesesSeleccionados,
      clientes: clientesSeleccionados,
    });
  };

  useEffect(() => {
    obtenerDatos();
  }, [filtrosAplicados]);


  // Saber si hay filtros activos distintos al default (año actual, sin mes/cliente)
  const hasFiltrosActivos =
    filtrosAplicados.clientes.length > 0 ||
    filtrosAplicados.meses.length > 0 ||
    JSON.stringify([...filtrosAplicados.anios].sort()) !== JSON.stringify([new Date().getFullYear()]);

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
          <div className="IG-filtrosPanel">
            {/* Selector de Año (dropdown estilo Power BI) */}
            <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
              <label>Año:</label>
              <div className="IG-dropdownFiltro">
                <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownAnioAbierto(!dropdownAnioAbierto); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); }}>
                  <span className="IG-dropdownFiltroTexto">
                    {aniosSeleccionados.length === 0
                      ? 'Todos'
                      : aniosSeleccionados.length === 1
                        ? String(aniosSeleccionados[0])
                        : `${aniosSeleccionados.length} años`}
                  </span>
                  <span className="IG-dropdownFiltroFlecha">▾</span>
                </button>
                {dropdownAnioAbierto && (
                  <div className="IG-dropdownFiltroLista">
                    {aniosDisponibles.length === 0 ? (
                      <div className="IG-clienteOpcion">Cargando...</div>
                    ) : aniosDisponibles.map(a => (
                      <label key={a} className={`IG-dropdownFiltroItem ${aniosSeleccionados.includes(a) ? 'seleccionado' : ''}`}>
                        <input
                          type="checkbox"
                          checked={aniosSeleccionados.includes(a)}
                          onChange={() => {
                            setAniosSeleccionados(prev =>
                              prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a].sort()
                            );
                          }}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selector de Mes (dropdown estilo Power BI) */}
            <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
              <label>Mes:</label>
              <div className="IG-dropdownFiltro">
                <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownMesAbierto(!dropdownMesAbierto); setDropdownAnioAbierto(false); setDropdownClienteAbierto(false); }}>
                  <span className="IG-dropdownFiltroTexto">
                    {mesesSeleccionados.length === 0
                      ? 'Todos'
                      : mesesSeleccionados.length === 1
                        ? MESES.find(m => m.valor === mesesSeleccionados[0])?.nombre
                        : `${mesesSeleccionados.length} meses`}
                  </span>
                  <span className="IG-dropdownFiltroFlecha">▾</span>
                </button>
                {dropdownMesAbierto && (
                  <div className="IG-dropdownFiltroLista">
                    <label className={`IG-dropdownFiltroItem ${mesesSeleccionados.length === 0 ? 'seleccionado' : ''}`}>
                      <input
                        type="checkbox"
                        checked={mesesSeleccionados.length === 0}
                        onChange={() => setMesesSeleccionados([])}
                      />
                      Todos
                    </label>
                    {MESES.map(m => (
                      <label key={m.valor} className={`IG-dropdownFiltroItem ${mesesSeleccionados.includes(m.valor) ? 'seleccionado' : ''}`}>
                        <input
                          type="checkbox"
                          checked={mesesSeleccionados.includes(m.valor)}
                          onChange={() => {
                            setMesesSeleccionados(prev =>
                              prev.includes(m.valor) ? prev.filter(x => x !== m.valor) : [...prev, m.valor].sort((a,b) => a-b)
                            );
                          }}
                        />
                        {m.nombre}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="IG-filtroGrupo" ref={clienteFiltroRef} style={{ position: 'relative' }}>
              <label>Cliente:</label>
              <div className="IG-dropdownFiltro">
                <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownClienteAbierto(!dropdownClienteAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); }}>
                  <span className="IG-dropdownFiltroTexto">
                    {clientesSeleccionados.length === 0
                      ? 'Todos'
                      : clientesSeleccionados.length === 1
                        ? clientesSeleccionados[0]
                        : `${clientesSeleccionados.length} clientes`}
                  </span>
                  <span className="IG-dropdownFiltroFlecha">▾</span>
                </button>
                {dropdownClienteAbierto && (
                  <div className="IG-dropdownFiltroLista IG-dropdownClienteLista">
                    <div className="IG-clienteBusquedaWrap">
                      <input
                        type="text"
                        className="IG-clienteBusquedaInput"
                        placeholder="Buscar cliente..."
                        value={busquedaCliente}
                        onChange={(e) => setBusquedaCliente(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <label className={`IG-dropdownFiltroItem ${clientesSeleccionados.length === 0 ? 'seleccionado' : ''}`}>
                      <input
                        type="checkbox"
                        checked={clientesSeleccionados.length === 0}
                        onChange={() => setClientesSeleccionados([])}
                      />
                      Todos
                    </label>
                    {clientesFiltradosDropdown.map(c => (
                      <label key={c} className={`IG-dropdownFiltroItem ${clientesSeleccionados.includes(c) ? 'seleccionado' : ''}`}>
                        <input
                          type="checkbox"
                          checked={clientesSeleccionados.includes(c)}
                          onChange={() => {
                            setClientesSeleccionados(prev =>
                              prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                            );
                          }}
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button className="IG-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownClienteAbierto(false); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setBusquedaCliente(''); }}>
              <FaFilter /> Filtrar
            </button>

          </div>
      </div>

      {/* Chips de filtros activos */}
      {hasFiltrosActivos && (
        <div className="IG-filtrosActivos">
          <span className="IG-filtrosActivosLabel">Filtros:</span>
          {filtrosAplicados.anios.length > 0 && JSON.stringify([...filtrosAplicados.anios].sort()) !== JSON.stringify([new Date().getFullYear()]) && (
            <button className="IG-filtroChip" onClick={() => {
              const def = [new Date().getFullYear()];
              setAniosSeleccionados(def);
              setFiltrosAplicados(f => ({ ...f, anios: def }));
            }}>
              Años: {filtrosAplicados.anios.join(', ')} ✕
            </button>
          )}
          {filtrosAplicados.meses.length > 0 && (
            <button className="IG-filtroChip" onClick={() => {
              setMesesSeleccionados([]);
              setFiltrosAplicados(f => ({ ...f, meses: [] }));
            }}>
              Meses: {filtrosAplicados.meses.map(m => MESES.find(x => x.valor === m)?.nombre).join(', ')} ✕
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
            const def = [new Date().getFullYear()];
            setAniosSeleccionados(def);
            setMesesSeleccionados([]);
            setClientesSeleccionados([]);
            setFiltrosAplicados({ anios: def, meses: [], clientes: [] });
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
                    <FaClipboardList />
                  </div>
                  <div className="IG-kpiContent">
                    <p className="IG-kpiLabel">Pedidos</p>
                    <p className="IG-kpiValor">{formatearNumero(kpis.totalGuias)}</p>
                  </div>
                </div>

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

                {/* Gráfico de Cajas por Día */}
                <div className="IG-graficoContainer">
                  {datosCajas && datosCajas.length > 0 ? (
                    <>
                      <div className="IG-graficoHeader">
                        <h2 className="IG-graficoTitulo">📦 {cajasComparativo ? 'Cajas por mes' : 'Cajas por Día'}</h2>
                        <label className="IG-switch">
                          <span className="IG-switchLabel">Agrupar por mes</span>
                          <input type="checkbox" checked={cajasComparativo} onChange={() => setCajasComparativo(!cajasComparativo)} />
                          <span className="IG-switchSlider"></span>
                        </label>
                      </div>

                      {cajasComparativo && aniosGraficoCajas.length > 0 ? (
                        /* Vista comparativa: una línea por año, agrupada por mes */
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={cajasMultianual} margin={{ top: 30, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="periodo" interval={0} height={50} tick={{ fontSize: 11 }} padding={{ left: 30, right: 30 }} />
                            <YAxis tickFormatter={(v) => formatearNumero(v)} />
                            <Tooltip
                              formatter={(value: any, name: string) => [formatearNumero(value), `Año ${name}`]}
                              contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                              labelStyle={{ color: '#ffffff', fontWeight: '700', marginBottom: '4px' }}
                              itemStyle={{ color: '#ffffff' }}
                            />
                            <Legend />
                            {aniosGraficoCajas.map((a, i) => {
                              const esActual = a === new Date().getFullYear();
                              return (
                              <Line
                                key={a}
                                type="monotone"
                                dataKey={String(a)}
                                stroke={COLORES_ANIOS[i % COLORES_ANIOS.length]}
                                strokeWidth={esActual ? 3 : 2}
                                strokeDasharray={esActual ? undefined : '6 4'}
                                dot={{ r: 3 }}
                                activeDot={{ r: 6 }}
                                connectNulls={false}
                                name={String(a)}
                              >
                                <LabelList
                                  dataKey={String(a)}
                                  position="top"
                                  offset={8}
                                  formatter={(value: number) => value > 0 ? formatearNumero(value) : ''}
                                  style={{ fill: '#0f1928', fontWeight: '700', fontSize: '10px' }}
                                />
                              </Line>
                              );
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        /* Vista por día: una línea (siempre diario, independiente del switch de Pedidos) */
                        <div className="IG-scrollGrafico" key="cajas-diario" ref={scrollCajasRef}>
                          <div style={{ minWidth: `${Math.max(cajasFiltradas.length * 50, 400)}px`, height: 350 }}>
                            <ResponsiveContainer width="100%" height={350}>
                              <LineChart data={cajasFiltradas} margin={{ top: 20, right: 20, left: 30, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="fecha"
                                  angle={-90}
                                  textAnchor="end"
                                  interval={0}
                                  height={70}
                                  padding={{ left: 30, right: 30 }}
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(fecha) => formatoEjeX(fecha)}
                                />
                                <YAxis tickFormatter={(v) => formatearNumero(v)} />
                                <Tooltip
                                  labelFormatter={(fecha) => format(parseISO(fecha), 'dd/MM/yyyy')}
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
                                  dot={{ r: 4 }}
                                  activeDot={{ r: 6 }}
                                  name="Cajas"
                                >
                                  <LabelList
                                    dataKey="totalStack"
                                    position="top"
                                    offset={8}
                                    formatter={(value: number) => value > 0 ? formatearNumero(value) : ''}
                                    style={{ fill: '#0f1928', fontWeight: '700', fontSize: '10px' }}
                                  />
                                </Line>
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="IG-sinDatos">
                      <p>No hay datos disponibles</p>
                    </div>
                  )}
                </div>

                {/* Gráfico Pedidos diarios */}
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

                {/* Distribución por Estado + Cajas por Cliente */}
                <div className="IG-graficosFila">
                  {/* Distribución por Estado */}
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

                  {/* Cajas por Cliente (gráfico tipo pie) */}
                  <div className="IG-graficoContainer">
                    {cajasPorCliente && cajasPorCliente.length > 0 ? (
                      <>
                        <div className="IG-graficoHeader">
                          <h2 className="IG-graficoTitulo">Cajas por Cliente</h2>
                          {clienteSeleccionadoPie && (
                            <button
                              className="IG-botonCerrarSeleccion"
                              onClick={() => setClienteSeleccionadoPie(null)}
                            >
                              Limpiar selección
                            </button>
                          )}
                        </div>

                        {/* Panel de información del cliente seleccionado */}
                        {clienteSeleccionadoPie && (
                          <div className="IG-clienteSeleccionadoInfo">
                            <div className="IG-clienteInfoHeader">
                              <span className="IG-clienteInfoNombre">{clienteSeleccionadoPie.name}</span>
                              <span className="IG-clienteInfoPorcentaje">{clienteSeleccionadoPie.porcentaje}%</span>
                            </div>
                            <div className="IG-clienteInfoValor">
                              {formatearNumero(clienteSeleccionadoPie.value)} cajas
                            </div>
                          </div>
                        )}

                        <div className="IG-graficoPieWrap">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={cajasPorCliente}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent, index }) => {
                                  // Solo mostrar etiqueta para los top 3
                                  if (index >= 3) return null;
                                  // Abreviar nombre: máximo 12 caracteres
                                  const nombreAbreviado = name.length > 12 ? name.substring(0, 12) + '...' : name;
                                  return `${nombreAbreviado}: ${(percent * 100).toFixed(1)}%`;
                                }}
                                labelLine={false}
                                onClick={(data: any) => {
                                  setClienteSeleccionadoPie({
                                    name: data.name,
                                    value: data.value,
                                    porcentaje: ((data.value / cajasPorCliente.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)
                                  });
                                }}
                                cursor="pointer"
                              >
                                {cajasPorCliente.map((entry, index) => {
                                  // Colores variados para cada cliente
                                  const coloresPie = [
                                    '#0f1928', '#1e3a5f', '#2d4f7a', '#3b82f6', '#0ea5e9',
                                    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
                                  ];
                                  const isSelected = clienteSeleccionadoPie?.name === entry.name;
                                  return (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={isSelected ? '#e8a000' : coloresPie[index % coloresPie.length]}
                                      stroke="#fff"
                                      strokeWidth={isSelected ? 3 : 2}
                                    />
                                  );
                                })}
                              </Pie>
                              <Tooltip
                                formatter={(value: number, name: string) => [formatearNumero(value), name]}
                                contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                                labelStyle={{ color: '#ffffff', fontWeight: '700', marginBottom: '4px' }}
                                itemStyle={{ color: '#ffffff' }}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Lista de clientes para móvil (solo en pantallas pequeñas) */}
                        <div className="IG-clientesListaMobile">
                          {cajasPorCliente.map((cliente, index) => {
                            const coloresPie = [
                              '#0f1928', '#1e3a5f', '#2d4f7a', '#3b82f6', '#0ea5e9',
                              '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
                            ];
                            const isSelected = clienteSeleccionadoPie?.name === cliente.name;
                            return (
                              <div
                                key={cliente.name}
                                className={`IG-clienteListItem ${isSelected ? 'IG-clienteListItemActive' : ''}`}
                                onClick={() => {
                                  setClienteSeleccionadoPie({
                                    name: cliente.name,
                                    value: cliente.value,
                                    porcentaje: cliente.porcentaje
                                  });
                                }}
                              >
                                <span
                                  className="IG-clienteListColor"
                                  style={{ background: isSelected ? '#e8a000' : coloresPie[index % coloresPie.length] }}
                                ></span>
                                <div className="IG-clienteListInfo">
                                  <span className="IG-clienteListNombre">{cliente.name}</span>
                                  <span className="IG-clienteListValor">{formatearNumero(cliente.value)}</span>
                                </div>
                                <span className="IG-clienteListPorcentaje">{cliente.porcentaje}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="IG-sinDatos">
                        <p>No hay datos disponibles</p>
                      </div>
                    )}
                  </div>
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
                    {modalFecha ? (
                      modalFecha.length === 7 ? (
                        // Es un mes (YYYY-MM) -> mostrar nombre completo del mes
                        <>Detalle de {format(parseISO(modalFecha + '-01'), 'MMMM yyyy', { locale: es })}</>
                      ) : (
                        // Es un día (YYYY-MM-DD) -> mostrar fecha formateada
                        <>Detalle del {format(parseISO(modalFecha), "dd/MM/yyyy", { locale: es })}</>
                      )
                    ) : ''}
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
