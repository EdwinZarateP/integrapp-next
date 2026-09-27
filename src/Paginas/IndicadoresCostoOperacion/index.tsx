'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaDownload, FaFilter } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
// Chrome compartido con Transporte + extras propios
import '../../Componentes/IndicadoresChrome/estilos.css';
import './estilos.css';

// Cada bucket combina las 3 etapas del viaje (todas se suman; son piernas distintas).
type SerieItem = {
  periodo: string;
  media_milla: number;
  ultima_milla: number;
  otros_costos: number;
  total: number;
  sobrecosto: number;  // >= 0 (diferencia positiva media + última milla)
  ahorro: number;      // <= 0 (diferencia negativa media + última milla)
  cajas_media: number;    // total_cajas_vehiculo (media milla)
  cajas_ultima: number;   // piezas (última milla)
  cajas_otros: number;    // datos_servicio.piezas (otros costos)
  total_cajas: number;
};

// Costo por caja por período (reglas por cliente: Kabi usa cajas de media milla +
// costo de 3 etapas; otros usan cajas de última milla + costo de última+otros).
type CostoCajaItem = {
  periodo: string;
  costo_por_caja: number;
  costo_kabi: number;
  costo_otros: number;
  cajas_kabi: number;
  cajas_otros: number;
};

// Pedidos atendidos por analista (serie por período). Cada bucket lleva una
// columna por usuario + total; la clave de cada columna es el CÓDIGO de
// usuario (o "Sin asignar") — el backend la manda como `columna` y coincide
// exactamente con la clave del bucket. `nombre` es solo el rótulo visible.
type AnalistaSerieItem = {
  periodo: string;
  total: number;
  [columna: string]: number | string;
};
type AnalistaUsuario = {
  usuario: string | null;
  nombre: string;   // rótulo visible (leyenda/CSV)
  columna: string;  // clave exacta en los buckets de las series (dataKey)
  perfil?: string | null;
};

type ApiResponse = {
  success: boolean;
  data?: {
    serieMensual: SerieItem[];
    serieDiaria: SerieItem[];
    anios: number[];
    clientes: string[];
    etiquetas?: Record<string, string>; // nombres visibles de las etapas (vienen del backend)
  };
  error?: string;
};

// Etiquetas por defecto (fallback). El backend envía las vigentes en data.etiquetas,
// que es donde se cambian los nombres visibles sin tocar el frontend. Las claves son
// técnicas y fijas (contrato backend↔frontend).
const ETIQUETAS_DEFAULT: Record<string, string> = {
  media_milla: 'Media milla',
  ultima_milla: 'Última milla',
  otros_costos: 'Otros costos',
};

const MESES = [
  { valor: 1, nombre: 'Enero' }, { valor: 2, nombre: 'Febrero' },
  { valor: 3, nombre: 'Marzo' }, { valor: 4, nombre: 'Abril' },
  { valor: 5, nombre: 'Mayo' }, { valor: 6, nombre: 'Junio' },
  { valor: 7, nombre: 'Julio' }, { valor: 8, nombre: 'Agosto' },
  { valor: 9, nombre: 'Septiembre' }, { valor: 10, nombre: 'Octubre' },
  { valor: 11, nombre: 'Noviembre' }, { valor: 12, nombre: 'Diciembre' },
];

// ── Uso de vehículos solicitados (drill-down, mismo gráfico que kabi) ──────
// % de uso por vehículo (media milla): una fila por consecutivo_vehiculo.
// uso_pct = kg_reales / tope de la categoría del tipo solicitado × 100
// (puede superar 100: viajaron más kg de los que el tipo solicitado admite).
type FilaUso = {
  consecutivo_vehiculo: string | number;
  fecha: string | null;
  tipo_solicitado: string; // CARRY…TRACTOMULA | 'SIN TIPO'
  kg_reales: number;
  destino: string;
  categoria_real: string; // la que corresponde por kg reales
  uso_pct: number | null; // null para SIN TIPO (sin tope conocido)
  costo_vehiculo: number; // Total Solicitado (flete+desvío+puntos+cargue)
  costo_teorico: number; // costo_teorico_vehiculo
  sobrecosto: number; // diferencia_flete (>0 sobrecosto, <0 ahorro)
  // Pedidos del vehículo (lo del "+" de PedidosCompletados): TODOS los docs
  // del consecutivo (incluye clientes de otras empresas en el mismo carro).
  pedidos?: PedidoUso[];
};

type PedidoUso = {
  pedido: string;           // consecutivo_integrapp
  pedido_vulcano: string;   // numero_pedido (el n° del Excel Vulcano)
  destinatario: string;     // ubicacion_descargue
  destino_real: string;
  cliente: string;
  entrega: string;          // planilla_siscore (guías, puede traer varias por coma)
  kilos: number;
};

type UsoVehiculosResponse = {
  success: boolean;
  data?: { filas: FilaUso[] };
  error?: string;
};

// Tope de kg por tipo (espejo de TOPES_TIPO_VEH del backend). TRACTOMULA:
// 34.000 kg de referencia (máxima capacidad legal).
const TOPES_USO: Record<string, number> = {
  CARRY: 1000, NHR: 2300, TURBO: 4500, NIES: 6100,
  SENCILLO: 9000, PATINETA: 17000, TRACTOMULA: 34000,
};

// Color del % de uso: rojo < 80 (subutilizado), verde ≥ 80.
const colorUso = (uso: number | null): string => {
  if (uso == null) return '#94a3b8';
  if (uso < 80) return '#e34948';
  return '#1baf7a';
};

// 'YYYY-MM-DD' → 'DD-MM-YYYY' (fechas legibles en la tabla de uso).
const formatearFechaUso = (v: string | null): string => {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
};

// Paleta categórica validada (CVD) — dataviz: azul / naranja / aqua.
const COLOR_MEDIA = '#2a78d6';   // media milla
const COLOR_ULTIMA = '#eb6834';  // última milla
const COLOR_OTROS = '#1baf7a';   // otros costos
// Sobrecosto/ahorro: rojo arriba (sobre el eje 0), verde abajo.
const COLOR_SOBRE = '#dc2626';
const COLOR_AHORRO = '#16a34a';

const IndicadoresCostoOperacion: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const clienteFiltroRef = useRef<HTMLDivElement>(null);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serieMensual, setSerieMensual] = useState<SerieItem[]>([]);
  const [serieDiaria, setSerieDiaria] = useState<SerieItem[]>([]);
  const [costoCajaMensual, setCostoCajaMensual] = useState<CostoCajaItem[]>([]);
  const [costoCajaDiaria, setCostoCajaDiaria] = useState<CostoCajaItem[]>([]);
  const [analistaUsuarios, setAnalistaUsuarios] = useState<AnalistaUsuario[]>([]);
  const [analistaMensual, setAnalistaMensual] = useState<AnalistaSerieItem[]>([]);
  const [analistaDiaria, setAnalistaDiaria] = useState<AnalistaSerieItem[]>([]);
  // Uso de vehículos solicitados (drill-down tipo → período → destino →
  // vehículo, mismo gráfico que el dashboard de kabi pero para TODAS las
  // operaciones). Una fila por consecutivo_vehiculo; los niveles se agregan
  // acá en el frontend.
  const [filasUso, setFilasUso] = useState<FilaUso[]>([]);
  const [cargandoUso, setCargandoUso] = useState(false);
  const [errorUso, setErrorUso] = useState<string | null>(null);
  const [vistaUso, setVistaUso] = useState<'mensual' | 'diaria'>('mensual');
  const [drillUso, setDrillUso] = useState<{ tipo: string | null; periodo: string | null; destino: string | null }>({ tipo: null, periodo: null, destino: null });
  const [usoAbiertos, setUsoAbiertos] = useState<Set<string>>(new Set());
  const alternarUsoAbierto = (cv: string) => {
    setUsoAbiertos(prev => {
      const n = new Set(prev);
      if (n.has(cv)) n.delete(cv); else n.add(cv);
      return n;
    });
  };
  // Trazabilidad del uso: buscar por pedido Vulcano (numero_pedido) → el
  // backend ignora los filtros y trae el(los) vehículo(s) que lo llevaron.
  const [inputUsoTraza, setInputUsoTraza] = useState('');
  const [trazaUsoActiva, setTrazaUsoActiva] = useState<string | null>(null);
  const aplicarTrazaUso = () => {
    const v = inputUsoTraza.trim();
    setTrazaUsoActiva(v || null);
  };
  const limpiarTrazaUso = () => {
    setInputUsoTraza('');
    setTrazaUsoActiva(null);
  };
  // Etiquetas vigentes de las etapas (vienen del backend; fallback por si faltan).
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>(ETIQUETAS_DEFAULT);
  const lbl = useMemo(() => ({ ...ETIQUETAS_DEFAULT, ...etiquetas }), [etiquetas]);

  // Vista de cada gráfico (toggle independiente): mensual (default) o diaria.
  const [vista, setVista] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaDif, setVistaDif] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaCajas, setVistaCajas] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaCaja, setVistaCaja] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaAnalista, setVistaAnalista] = useState<'mensual' | 'diaria'>('mensual');

  // Filtros en pantalla (no disparan fetch hasta "Filtrar")
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [aniosSeleccionados, setAniosSeleccionados] = useState<number[]>([new Date().getFullYear()]);
  const [mesesSeleccionados, setMesesSeleccionados] = useState<number[]>([]);
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>([]);
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [dropdownAnioAbierto, setDropdownAnioAbierto] = useState(false);
  const [dropdownMesAbierto, setDropdownMesAbierto] = useState(false);
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false);

  // Filtros aplicados (los que realmente se consultan)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    anios: [new Date().getFullYear()] as number[],
    meses: [] as number[],
    clientes: [] as string[],
  });

  // Formateadores
  const formatearMoneda = (num: number): string =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num || 0);
  const formatearMonedaCorta = (num: number): string => {
    const n = num || 0;
    if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return formatearMoneda(n);
  };
  // Formateador de enteros (cajas/piezas, sin decimales ni símbolo).
  const formatearEntero = (num: number): string =>
    new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num || 0);
  // Formateador de enteros corto para etiquetas sobre los puntos de la línea
  // (1.2k / 12k / 1.2M) — evita amontonar cifras grandes en el eje.
  const formatearEnteroCorto = (num: number): string => {
    const n = num || 0;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(Math.round(n));
  };

  // Usuario + cerrar menús al click fuera
  useEffect(() => {
    const usuarioMatch = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const perfilMatch = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/);
    const regionalMatch = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/);
    if (usuarioMatch) {
      setDatosUsuario({ usuario: usuarioMatch[2], perfil: perfilMatch?.[2], regional: regionalMatch?.[2] });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
      if (clienteFiltroRef.current && !clienteFiltroRef.current.contains(e.target as Node)) setDropdownClienteAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const obtenerDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      filtrosAplicados.anios.forEach(a => params.append('anio', String(a)));
      filtrosAplicados.meses.forEach(m => params.append('mes', String(m)));
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-costo-operacion/resumen?${params.toString()}`);
      if (!response.ok) throw new Error('Error al obtener datos');
      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setSerieMensual(data.data.serieMensual || []);
        setSerieDiaria(data.data.serieDiaria || []);
        if (data.data.etiquetas) setEtiquetas(data.data.etiquetas);
        if (data.data.anios?.length) setAniosDisponibles(data.data.anios);
        setClientesDisponibles(data.data.clientes || []);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  };

  const aplicarFiltros = () => {
    setFiltrosAplicados({
      anios: aniosSeleccionados,
      meses: mesesSeleccionados,
      clientes: clientesSeleccionados,
    });
  };

  // Costo por caja (endpoint dedicado, reglas por cliente). Fallo silencioso: si no
  // carga, simplemente no se muestra el gráfico.
  const obtenerCostoCaja = async () => {
    try {
      const params = new URLSearchParams();
      filtrosAplicados.anios.forEach(a => params.append('anio', String(a)));
      filtrosAplicados.meses.forEach(m => params.append('mes', String(m)));
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-costo-operacion/costo-por-caja?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setCostoCajaMensual(json.data?.mensual ?? []);
        setCostoCajaDiaria(json.data?.diario ?? []);
      }
    } catch { /* gráfico opcional: fallo silencioso */ }
  };

  // Pedidos atendidos por analista (mismos filtros). Fallo silencioso igual que
  // el costo por caja: si no carga, no se muestra la sección.
  const obtenerPedidosPorAnalista = async () => {
    try {
      const params = new URLSearchParams();
      filtrosAplicados.anios.forEach(a => params.append('anio', String(a)));
      filtrosAplicados.meses.forEach(m => params.append('mes', String(m)));
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-costo-operacion/pedidos-por-analista?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setAnalistaUsuarios(json.data?.usuarios ?? []);
        setAnalistaMensual(json.data?.serieMensual ?? []);
        setAnalistaDiaria(json.data?.serieDiaria ?? []);
      }
    } catch { /* sección opcional: fallo silencioso */ }
  };

  // Uso de vehículos: una fila por consecutivo_vehiculo; el drill-down se
  // arma acá en el frontend con esas filas. Con trazabilidad activa el
  // backend ignora año/mes/cliente y trae el vehículo del pedido Vulcano
  // buscado (sus pedidos se despliegan solos y el match queda resaltado).
  const obtenerUsoVehiculos = async (traza?: string | null) => {
    setCargandoUso(true);
    setErrorUso(null);
    try {
      const params = new URLSearchParams();
      filtrosAplicados.anios.forEach(a => params.append('anio', String(a)));
      filtrosAplicados.meses.forEach(m => params.append('mes', String(m)));
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      const q = traza !== undefined ? traza : trazaUsoActiva;
      if (q) params.set('q', q);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-costo-operacion/uso-vehiculos?${params.toString()}`);
      if (!response.ok) throw new Error('Error al obtener el uso de vehículos');
      const data: UsoVehiculosResponse = await response.json();
      if (data.success && data.data) {
        const filas = data.data.filas || [];
        setFilasUso(filas);
        if (q) {
          // Búsqueda puntual: todo desplegado para ver el pedido de una.
          setUsoAbiertos(new Set(filas.map(f => String(f.consecutivo_vehiculo))));
        } else {
          // Nuevo período de filtros → el drill-down arranca de cero.
          setDrillUso({ tipo: null, periodo: null, destino: null });
          setUsoAbiertos(new Set());
        }
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setErrorUso(err instanceof Error ? err.message : 'Error al cargar el uso de vehículos');
    } finally {
      setCargandoUso(false);
    }
  };

  useEffect(() => {
    obtenerDatos(); obtenerCostoCaja(); obtenerPedidosPorAnalista();
    // Con trazabilidad de uso activa, el "Filtrar" no la pisa: la búsqueda viaja sola.
    if (!trazaUsoActiva) obtenerUsoVehiculos();
    /* eslint-disable-next-line */
  }, [filtrosAplicados]);

  // Al cambiar la trazabilidad del uso, re-consultar (el backend busca en
  // TODO el histórico: los filtros de Año/Mes/Cliente no aplican a esa
  // consulta). Se omite el montaje inicial — ya lo cubre el efecto de filtros.
  const primerMontajeUso = useRef(true);
  useEffect(() => {
    if (primerMontajeUso.current) { primerMontajeUso.current = false; return; }
    obtenerUsoVehiculos(trazaUsoActiva);
    /* eslint-disable-next-line */
  }, [trazaUsoActiva]);

  // Datos del gráfico de costo según su vista (mensual/diaria).
  const dataChart = useMemo<SerieItem[]>(
    () => (vista === 'diaria' ? serieDiaria : serieMensual),
    [vista, serieDiaria, serieMensual],
  );

  // Datos del gráfico de sobrecosto/ahorro: NETO por período (sobrecosto + ahorro),
  // según su propia vista (toggle independiente). Lleva también el bruto para el tooltip.
  const dataDif = useMemo<{ periodo: string; neta: number; sobrecosto: number; ahorro: number }[]>(
    () => (vistaDif === 'diaria' ? serieDiaria : serieMensual).map(d => ({
      periodo: d.periodo,
      neta: (d.sobrecosto || 0) + (d.ahorro || 0),
      sobrecosto: d.sobrecosto || 0,
      ahorro: d.ahorro || 0,
    })),
    [vistaDif, serieDiaria, serieMensual],
  );

  // Datos del gráfico de cajas por etapa (3 líneas), según su propia vista.
  const dataCajas = useMemo<SerieItem[]>(
    () => (vistaCajas === 'diaria' ? serieDiaria : serieMensual),
    [vistaCajas, serieDiaria, serieMensual],
  );

  // Datos del gráfico de costo por caja, según su propia vista.
  const dataCaja = useMemo<CostoCajaItem[]>(
    () => (vistaCaja === 'diaria' ? costoCajaDiaria : costoCajaMensual),
    [vistaCaja, costoCajaDiaria, costoCajaMensual],
  );
  const intervalCaja = dataCaja.length > 1 ? Math.max(0, Math.ceil(dataCaja.length / 12) - 1) : 0;

  // Datos del gráfico por analista, según su propia vista (toggle independiente).
  const dataAnalista = useMemo<AnalistaSerieItem[]>(
    () => (vistaAnalista === 'diaria' ? analistaDiaria : analistaMensual),
    [vistaAnalista, analistaDiaria, analistaMensual],
  );
  const intervalAnalista = dataAnalista.length > 1 ? Math.max(0, Math.ceil(dataAnalista.length / 12) - 1) : 0;

  // Paleta categórica (misma fuente que los colores de etapa, orden validado
  // CVD): el color identifica al USUARIO, no a la etapa. Color sigue a la
  // entidad con orden fijo (total descendente que trae el backend); el slot 9+
  // no existe — por diseño hay máx. 8 series (aquí en la práctica: ~3 analistas
  // + "Sin asignar").
  const COLOR_SERIES_ANALISTA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const COLOR_SIN_ASIGNAR = '#64748b'; // gris neutro: no es una serie "real"
  const colorAnalista = (i: number, usuario: string | null) =>
    usuario === null ? COLOR_SIN_ASIGNAR : COLOR_SERIES_ANALISTA[i % COLOR_SERIES_ANALISTA.length];

  // Clientes filtrados por búsqueda en el dropdown.
  const clientesFiltradosDropdown = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    const res = q ? clientesDisponibles.filter(c => c.toLowerCase().includes(q)) : clientesDisponibles;
    return res.slice(0, 80);
  }, [clientesDisponibles, busquedaCliente]);

  // ── Uso de vehículos: agregaciones de los 4 niveles del drill-down ──
  // Todas se calculan en el frontend desde las filas de /uso-vehiculos.

  // Acumulador común: {sumaUso, viajes} promediando uso_pct (null no evalúa).
  type BucketUso = { sumaUso: number; viajes: number; sumaKg: number };
  const acumularUso = (b: BucketUso, f: FilaUso) => {
    if (f.uso_pct != null) b.sumaUso += f.uso_pct;
    b.viajes += 1;
    b.sumaKg += f.kg_reales || 0;
  };
  const aBucket = (m: Map<string, BucketUso>) =>
    [...m.entries()]
      .map(([clave, b]) => ({ clave, uso: b.sumaUso > 0 ? b.sumaUso / b.viajes : null, viajes: b.viajes, kgProm: b.viajes ? b.sumaKg / b.viajes : 0 }))
      .sort((a, b) => a.clave.localeCompare(b.clave));

  // Nivel 1: promedio de uso por tipo solicitado — ordenado de MENOR a MAYOR
  // uso (el peor aprovechado primero; SIN TIPO, sin % evaluable, al final).
  const usoPorTipo = useMemo(() => {
    const m = new Map<string, BucketUso>();
    for (const f of filasUso) {
      const b = m.get(f.tipo_solicitado) || { sumaUso: 0, viajes: 0, sumaKg: 0 };
      acumularUso(b, f);
      m.set(f.tipo_solicitado, b);
    }
    return aBucket(m).sort((a, b) => {
      if (a.uso == null) return 1;
      if (b.uso == null) return -1;
      return a.uso - b.uso;
    });
  }, [filasUso]);

  // Filas del tipo seleccionado (nivel ≥ 2 del drill-down).
  const filasTipoUso = useMemo(
    () => (drillUso.tipo ? filasUso.filter(f => f.tipo_solicitado === drillUso.tipo) : []),
    [filasUso, drillUso.tipo],
  );

  // Nivel 2: promedio de uso del tipo por período (mensual o diario).
  const usoPorPeriodo = useMemo(() => {
    if (!drillUso.tipo) return [];
    const largo = vistaUso === 'diaria' ? 10 : 7;
    const m = new Map<string, BucketUso>();
    for (const f of filasTipoUso) {
      const clave = (f.fecha || '').slice(0, largo);
      if (!clave) continue;
      const b = m.get(clave) || { sumaUso: 0, viajes: 0, sumaKg: 0 };
      acumularUso(b, f);
      m.set(clave, b);
    }
    return aBucket(m);
  }, [filasTipoUso, drillUso.tipo, vistaUso]);

  // Filas del período seleccionado (nivel ≥ 3).
  const filasPeriodoUso = useMemo(
    () => (drillUso.periodo ? filasTipoUso.filter(f => (f.fecha || '').startsWith(drillUso.periodo!)) : []),
    [filasTipoUso, drillUso.periodo],
  );

  // Nivel 3: promedio de uso por destino (tipo + período).
  const usoPorDestino = useMemo(() => {
    if (!drillUso.periodo) return [];
    const m = new Map<string, BucketUso>();
    for (const f of filasPeriodoUso) {
      const clave = f.destino || '(SIN DESTINO)';
      const b = m.get(clave) || { sumaUso: 0, viajes: 0, sumaKg: 0 };
      acumularUso(b, f);
      m.set(clave, b);
    }
    // Barras horizontales de MENOR a MAYOR uso: recharts pinta el PRIMER dato
    // del arreglo arriba → orden asc deja las más subutilizadas primero.
    return aBucket(m).sort((a, b) => {
      if (a.uso == null) return 1;
      if (b.uso == null) return -1;
      return a.uso - b.uso;
    });
  }, [filasPeriodoUso, drillUso.periodo]);

  // Nivel 4: tabla casi a nivel consecutivo (tipo + período + destino).
  const filasDestinoUso = useMemo(
    () => (drillUso.destino
      ? filasPeriodoUso
          .filter(f => (f.destino || '(SIN DESTINO)') === drillUso.destino)
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      : []),
    [filasPeriodoUso, drillUso.destino],
  );

  // Rango de filas del alcance actual del drill-down (para el export).
  const filasUsoAlcance = drillUso.destino ? filasDestinoUso : drillUso.periodo ? filasPeriodoUso : drillUso.tipo ? filasTipoUso : filasUso;

  // Rango de fechas aplicado (badge del título): "2026", "ene–mar 2026"…
  const rangoFiltros = useMemo(() => {
    const anios = filtrosAplicados.anios;
    const meses = filtrosAplicados.meses;
    if (anios.length === 0) return 'Todo el histórico';
    if (meses.length === 0) return anios.length === 1 ? String(anios[0]) : anios.join(', ');
    const nombres = meses
      .slice().sort((a, b) => a - b)
      .map(m => MESES.find(x => x.valor === m)?.nombre.slice(0, 3).toLowerCase())
      .join('–');
    return `${nombres} ${anios.length === 1 ? anios[0] : '(' + anios.join(', ') + ')'}`;
  }, [filtrosAplicados]);

  // Tooltips del drill-down de uso (mismo look que el resto del tablero).
  // Los tres niveles comparten bucket {clave, uso, viajes, kgProm}.
  const cuerpoTooltipUso = (titulo: string, d: { uso: number | null; viajes: number; kgProm: number }, extra?: string) => (
    <div className="IG-tooltipSerie">
      <p className="IG-tooltipSerieFecha">{titulo}</p>
      <p>
        <span className="IG-tooltipEtapa" style={{ background: colorUso(d.uso) }} />
        % uso promedio: <b>{d.uso == null ? '—' : `${Math.round(d.uso)}%`}</b>
      </p>
      <p className="IG-tooltipSerieSub">
        Viajes: {formatearEntero(d.viajes)} · Kg promedio: {formatearEntero(Math.round(d.kgProm))}{extra ? ` · Tope: ${extra}` : ''}
      </p>
      <p className="IG-tooltipSerieSub DC-usoTipClic">Clic para ver el detalle ↓</p>
    </div>
  );

  const tooltipUsoTipo = (props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as { clave: string; uso: number | null; viajes: number; kgProm: number };
    return cuerpoTooltipUso(d.clave, d, TOPES_USO[d.clave] ? `${formatearEntero(TOPES_USO[d.clave])} kg` : undefined);
  };

  const tooltipUsoPeriodo = (props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as { clave: string; uso: number | null; viajes: number; kgProm: number };
    let titulo = d.clave;
    try {
      titulo = format(parseISO(d.clave + (d.clave.length === 7 ? '-01' : '')), vistaUso === 'diaria' ? "d 'de' MMMM yyyy" : 'MMMM yyyy', { locale: es });
    } catch { /* clave cruda */ }
    return cuerpoTooltipUso(`${drillUso.tipo} · ${titulo}`, d, TOPES_USO[drillUso.tipo || ''] ? `${formatearEntero(TOPES_USO[drillUso.tipo!])} kg` : undefined);
  };

  const tooltipUsoDestino = (props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as { clave: string; uso: number | null; viajes: number; kgProm: number };
    return cuerpoTooltipUso(d.clave, d);
  };

  // Export Excel del alcance visible del drill-down.
  const exportarUsoExcel = () => {
    const datos = filasUsoAlcance.map(f => ({
      'Vehículo': f.consecutivo_vehiculo,
      'Fecha': f.fecha ? formatearFechaUso(f.fecha) : '',
      '% Uso': f.uso_pct ?? '',
      'Destino': f.destino || '',
      'Veh Solicitado': f.tipo_solicitado,
      'Kg Reales': f.kg_reales,
      // Un viaje puede ser UN pedido Vulcano repartido en varias entregas
      // (mismo numero_pedido en todos los docs): se listan los ÚNICOS.
      'Pedidos Vulcano': [...new Set((f.pedidos || []).map(p => p.pedido_vulcano).filter(Boolean))].join(', '),
      'Destinatarios (kg)': (f.pedidos || []).map(p => `${p.destinatario || p.pedido || '?'} (${formatearEntero(p.kilos)})`).join(' · '),
      'Entregas (guías)': (f.pedidos || []).map(p => p.entrega).filter(Boolean).join(', '),
      'Categoría (por kg)': f.categoria_real,
      'Costo Vehículo': f.costo_vehiculo || '',
      'Costo Teórico': f.costo_teorico || '',
      'Sobrecosto': f.sobrecosto || 0,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 34 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Uso vehículos');
    XLSX.writeFile(wb, `uso_vehiculos_costo_operacion_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Tabla de detalle del drill-down / trazabilidad: una fila por vehículo con
  // su "+" que despliega los pedidos (destinatario, entrega, kg). Con
  // trazabilidad activa, el pedido Vulcano que hizo match queda resaltado.
  const TablaDetalleUso: React.FC<{ filas: FilaUso[] }> = ({ filas }) => (
    <div className="DC-guiaTablaWrapper">
      <table className="IG-tabla">
        <thead>
          <tr>
            <th title="Despliega los pedidos del vehículo: destinatario, entrega (guía) y kg de cada uno">▸</th>
            <th>Fecha</th>
            <th>Vehículo</th>
            <th title="Kg reales ÷ tope del tipo solicitado">% Uso</th>
            <th>Destino</th>
            <th>Veh Solicitado</th>
            <th>Kg Reales</th>
            <th title="Categoría que corresponde por los kg reales">Categoría (por kg)</th>
            <th title="Total Solicitado del vehículo (flete + desvío + puntos + cargue)">Costo Veh.</th>
            <th title="costo_teorico_vehiculo: tarifa teórica del destino según el tipo (flete base + puntos + cargue)">Costo Teór.</th>
            <th title="diferencia_flete = costo real − costo teórico: rojo sobrecosto, verde ahorro">Sobrecosto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const cv = String(f.consecutivo_vehiculo);
            const abierto = usoAbiertos.has(cv);
            return (
              <React.Fragment key={cv}>
                <tr className={abierto ? 'DC-usoFilaAbierta' : ''}>
                  <td>
                    <button
                      className={`DC-usoBtnExpandir ${abierto ? 'DC-usoBtnExpandirAbierto' : ''}`}
                      onClick={() => alternarUsoAbierto(cv)}
                      title={`${f.pedidos?.length || 0} pedido(s): destinatario, entrega y kg de cada uno`}
                      disabled={!f.pedidos?.length}
                    >
                      {abierto ? '−' : '+'}
                    </button>
                  </td>
                  <td>{formatearFechaUso(f.fecha)}</td>
                  <td className="DC-usoCeldaVeh">{f.consecutivo_vehiculo}</td>
                  <td className="DC-guiaCeldaNum">
                    {f.uso_pct == null ? '—' : (
                      <b style={{ color: colorUso(f.uso_pct) }}>{Math.round(f.uso_pct)}%</b>
                    )}
                  </td>
                  <td className="DC-guiaCeldaDest">{f.destino || '—'}</td>
                  <td>{f.tipo_solicitado}</td>
                  <td className="DC-guiaCeldaNum">{formatearEntero(f.kg_reales)}</td>
                  <td>{f.categoria_real}</td>
                  <td className="DC-guiaCeldaNum" title="Total Solicitado (flete + desvío + puntos + cargue)">
                    {f.costo_vehiculo ? formatearMoneda(f.costo_vehiculo) : '—'}
                  </td>
                  <td className="DC-guiaCeldaNum" title="Costo teórico del destino según el tipo">
                    {f.costo_teorico ? formatearMoneda(f.costo_teorico) : '—'}
                  </td>
                  <td className="DC-guiaCeldaNum" title={f.sobrecosto > 0 ? 'Sobrecosto: el real supera el teórico' : f.sobrecosto < 0 ? 'Ahorro: el real quedó por debajo del teórico' : 'Real = teórico'}>
                    <b style={{ color: f.sobrecosto > 0 ? '#b91c1c' : f.sobrecosto < 0 ? '#047857' : undefined }}>
                      {f.sobrecosto ? formatearMoneda(f.sobrecosto) : '—'}
                    </b>
                  </td>
                </tr>
                {abierto && !!f.pedidos?.length && (
                  <tr className="DC-usoFilaDetalle">
                    <td colSpan={11}>
                      <table className="DC-usoSubTabla">
                        <thead>
                          <tr>
                            <th>Pedido</th>
                            <th title="Número de pedido Vulcano (numero_pedido)">Pedido Vulcano</th>
                            <th>Destinatario</th>
                            <th>Entrega (guía)</th>
                            <th>Kg</th>
                            <th>Cliente</th>
                            <th>Destino Real</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.pedidos.map((p, i) => {
                            const esHit = !!trazaUsoActiva
                              && !!p.pedido_vulcano
                              && p.pedido_vulcano.toUpperCase().includes(trazaUsoActiva.toUpperCase());
                            return (
                              <tr key={`${p.pedido}-${i}`} className={esHit ? 'DC-usoSubRowHit' : ''}>
                                <td>{p.pedido || '—'}</td>
                                <td className="DC-guiaCeldaNum">{p.pedido_vulcano || '—'}</td>
                                <td>{p.destinatario || '—'}</td>
                                <td className="DC-guiaCeldaNum">{p.entrega || '—'}</td>
                                <td className="DC-guiaCeldaNum">{formatearEntero(p.kilos)}</td>
                                <td>{p.cliente || '—'}</td>
                                <td>{p.destino_real || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const hasFiltrosActivos =
    filtrosAplicados.clientes.length > 0 ||
    filtrosAplicados.meses.length > 0 ||
    JSON.stringify([...filtrosAplicados.anios].sort()) !== JSON.stringify([new Date().getFullYear()]);

  // Exportar la serie visible a CSV (Excel-ES).
  const exportarSerie = () => {
    if (!dataChart.length) return;
    const colFecha = vista === 'diaria' ? 'Día' : 'Mes';
    const fmtFecha = (f: string) =>
      vista === 'diaria'
        ? format(parseISO(f), 'dd/MM/yyyy')
        : format(parseISO(f + '-01'), 'MM/yyyy');
    const cabeceras = [colFecha, lbl.media_milla, lbl.ultima_milla, lbl.otros_costos, 'Total', 'Sobrecosto', 'Ahorro'];
    const filas = dataChart.map(d => [
      fmtFecha(d.periodo),
      Math.round(d.media_milla || 0),
      Math.round(d.ultima_milla || 0),
      Math.round(d.otros_costos || 0),
      Math.round(d.total || 0),
      Math.round(d.sobrecosto || 0),
      Math.round(d.ahorro || 0),
    ]);
    const csv = [cabeceras, ...filas].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `costo_operacion_${vista === 'diaria' ? 'diario' : 'mensual'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const volverMenu = () => router.push('/indicadores');
  const manejarLogout = () => {
    document.cookie.split(';').forEach(cookie => {
      const cn = cookie.split('=')[0].trim();
      if (cn.includes('usuario') || cn.includes('cliente') || cn.includes('perfil') || cn.includes('regional'))
        document.cookie = `${cn}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    router.push('/LoginUsuario');
  };

  // Exportar la serie por analista de la vista activa a CSV (Excel-ES).
  const exportarAnalistas = () => {
    if (!dataAnalista.length) return;
    const colFecha = vistaAnalista === 'diaria' ? 'Día' : 'Mes';
    const fmtFecha = (f: string) =>
      vistaAnalista === 'diaria'
        ? format(parseISO(f), 'dd/MM/yyyy')
        : format(parseISO(f + '-01'), 'MM/yyyy');
    const cabeceras = [colFecha, ...analistaUsuarios.map(u => u.nombre), 'Total'];
    const filas = dataAnalista.map(d => [
      fmtFecha(String(d.periodo)),
      ...analistaUsuarios.map(u => Number(d[u.columna] ?? 0)),
      Number(d.total ?? 0),
    ]);
    const csv = [cabeceras, ...filas].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_por_analista_${vistaAnalista === 'diaria' ? 'diario' : 'mensual'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Etiqueta del eje X según la vista (cada gráfico pasa la suya).
  const formatoEje = (val: string, v: 'mensual' | 'diaria' = vista) => {
    try {
      if (v === 'diaria') return format(parseISO(val), 'd MMM', { locale: es });
      return format(parseISO(val + '-01'), 'MMM yy', { locale: es });
    } catch { return val; }
  };

  // Tooltip: desglose por etapa + total.
  const tooltipContenido = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as SerieItem;
    const fechaTxt = vista === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_MEDIA }} />{lbl.media_milla}: <b>{formatearMoneda(d.media_milla)}</b></p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_ULTIMA }} />{lbl.ultima_milla}: <b>{formatearMoneda(d.ultima_milla)}</b></p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_OTROS }} />{lbl.otros_costos}: <b>{formatearMoneda(d.otros_costos)}</b></p>
        <p className="IG-tooltipSerieTotal">Total operación: {formatearMoneda(d.total)}</p>
      </div>
    );
  };

  // Tooltip del gráfico de sobrecosto/ahorro NETO (media + última milla).
  const tooltipDiferencia = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as { periodo: string; neta: number; sobrecosto: number; ahorro: number };
    const fechaTxt = vistaDif === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    const esSobre = d.neta > 0;
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p className="IG-tooltipSerieTotal" style={{ color: esSobre ? '#fecaca' : '#bbf7d0' }}>
          {esSobre ? 'Sobrecosto neto' : 'Ahorro neto'}: {formatearMoneda(Math.abs(d.neta))}
        </p>
        <p className="IG-tooltipSerieSub">
          Sobrecosto {formatearMoneda(d.sobrecosto)} · Ahorro {formatearMoneda(Math.abs(d.ahorro))}
        </p>
      </div>
    );
  };

  // Tooltip del gráfico de cajas: desglose por etapa + total de cajas del período.
  const tooltipCajas = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as SerieItem;
    const fechaTxt = vistaCajas === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_MEDIA }} />{lbl.media_milla}: <b>{formatearEntero(d.cajas_media)}</b></p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_ULTIMA }} />{lbl.ultima_milla}: <b>{formatearEntero(d.cajas_ultima)}</b></p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_OTROS }} />{lbl.otros_costos}: <b>{formatearEntero(d.cajas_otros)}</b></p>
        <p className="IG-tooltipSerieTotal">Total cajas: {formatearEntero(d.total_cajas)}</p>
      </div>
    );
  };

  // Tooltip del costo por caja: total de dinero y cajas del período (sin segregación).
  const tooltipCostoCaja = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as CostoCajaItem;
    const fechaTxt = vistaCaja === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    const totalCosto = (d.costo_kabi || 0) + (d.costo_otros || 0);
    const totalCajas = (d.cajas_kabi || 0) + (d.cajas_otros || 0);
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p className="IG-tooltipSerieTotal">Costo por caja: {formatearMoneda(d.costo_por_caja)}</p>
        <p className="IG-tooltipSerieSub">
          Costo total: {formatearMoneda(totalCosto)} · {formatearEntero(totalCajas)} cajas
        </p>
      </div>
    );
  };

  // Tooltip del gráfico por analista: pedidos del período por usuario + total.
  const tooltipAnalista = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as AnalistaSerieItem;
    const fechaTxt = vistaAnalista === 'diaria'
      ? format(parseISO(String(d.periodo)), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(String(d.periodo) + '-01'), 'MMMM yyyy', { locale: es });
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        {analistaUsuarios.map((u, i) => (
          <p key={u.columna}>
            <span className="IG-tooltipEtapa" style={{ background: colorAnalista(i, u.usuario) }} />
            {u.nombre}: <b>{formatearEntero(Number(d[u.columna] ?? 0))}</b>
          </p>
        ))}
        <p className="IG-tooltipSerieTotal">Total pedidos: {formatearEntero(Number(d.total ?? 0))}</p>
      </div>
    );
  };

  // Intervalo del eje X para no amontonar etiquetas (uno por gráfico, según su vista).
  const interval = dataChart.length > 1 ? Math.max(0, Math.ceil(dataChart.length / 12) - 1) : 0;
  const intervalDif = dataDif.length > 1 ? Math.max(0, Math.ceil(dataDif.length / 12) - 1) : 0;
  const intervalCajas = dataCajas.length > 1 ? Math.max(0, Math.ceil(dataCajas.length / 12) - 1) : 0;

  // Dominio del eje Y del gráfico de sobrecosto/ahorro: anclado en 0. Holgura balanceada
  // (20 % de la mayor magnitud) a cada lado para que las etiquetas verticales —sobrecosto
  // arriba, ahorro debajo de la barra— no se recorten ni con datos asimétricos.
  const difMin = dataDif.length ? Math.min(0, ...dataDif.map(d => d.neta)) : 0;
  const difMax = dataDif.length ? Math.max(0, ...dataDif.map(d => d.neta)) : 0;
  const difPad = Math.max(Math.abs(difMin), Math.abs(difMax)) * 0.2;

  return (
    <div className="IG-container">
      {/* Header */}
      <header className="IG-header">
        <div className="IG-headerInner">
          <button className="IG-brand" onClick={volverMenu} title="Volver al menú de indicadores">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="IG-brandName">Integr<span className="IG-brandAccent">App</span></span>
          </button>
          <h1 className="IG-titulo">
            <span className="IG-tituloDesktop">Indicadores de Costo de Operación de Transporte</span>
            <span className="IG-tituloMobile">Costo operación</span>
          </h1>
          <div className="IG-userZone" ref={menuRef}>
            <button className="IG-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="IG-userIcon" />
              <div className="IG-userInfo">
                <span className="IG-userName">{datosUsuario?.usuario || 'Usuario'}</span>
                <span className="IG-userPerfil">{datosUsuario?.perfil}{datosUsuario?.regional ? ` · ${datosUsuario.regional}` : ''}</span>
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
          {/* Año */}
          <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
            <label>Año:</label>
            <div className="IG-dropdownFiltro">
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownAnioAbierto(!dropdownAnioAbierto); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); }}>
                <span className="IG-dropdownFiltroTexto">
                  {aniosSeleccionados.length === 0 ? 'Todos' : aniosSeleccionados.length === 1 ? String(aniosSeleccionados[0]) : `${aniosSeleccionados.length} años`}
                </span>
                <span className="IG-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownAnioAbierto && (
                <div className="IG-dropdownFiltroLista">
                  {aniosDisponibles.length === 0 ? <div className="IG-clienteOpcion">Cargando...</div> : aniosDisponibles.map(a => (
                    <label key={a} className={`IG-dropdownFiltroItem ${aniosSeleccionados.includes(a) ? 'seleccionado' : ''}`}>
                      <input type="checkbox" checked={aniosSeleccionados.includes(a)} onChange={() => setAniosSeleccionados(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a].sort())} />
                      {a}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mes */}
          <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
            <label>Mes:</label>
            <div className="IG-dropdownFiltro">
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownMesAbierto(!dropdownMesAbierto); setDropdownAnioAbierto(false); setDropdownClienteAbierto(false); }}>
                <span className="IG-dropdownFiltroTexto">
                  {mesesSeleccionados.length === 0 ? 'Todos' : mesesSeleccionados.length === 1 ? MESES.find(m => m.valor === mesesSeleccionados[0])?.nombre : `${mesesSeleccionados.length} meses`}
                </span>
                <span className="IG-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownMesAbierto && (
                <div className="IG-dropdownFiltroLista">
                  <label className={`IG-dropdownFiltroItem ${mesesSeleccionados.length === 0 ? 'seleccionado' : ''}`}>
                    <input type="checkbox" checked={mesesSeleccionados.length === 0} onChange={() => setMesesSeleccionados([])} />
                    Todos
                  </label>
                  {MESES.map(m => (
                    <label key={m.valor} className={`IG-dropdownFiltroItem ${mesesSeleccionados.includes(m.valor) ? 'seleccionado' : ''}`}>
                      <input type="checkbox" checked={mesesSeleccionados.includes(m.valor)} onChange={() => setMesesSeleccionados(prev => prev.includes(m.valor) ? prev.filter(x => x !== m.valor) : [...prev, m.valor].sort((a, b) => a - b))} />
                      {m.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div className="IG-filtroGrupo" ref={clienteFiltroRef} style={{ position: 'relative' }}>
            <label>Cliente:</label>
            <div className="IG-dropdownFiltro">
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownClienteAbierto(!dropdownClienteAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); }}>
                <span className="IG-dropdownFiltroTexto">
                  {clientesSeleccionados.length === 0 ? 'Todos' : clientesSeleccionados.length === 1 ? clientesSeleccionados[0] : `${clientesSeleccionados.length} clientes`}
                </span>
                <span className="IG-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownClienteAbierto && (
                <div className="IG-dropdownFiltroLista IG-dropdownClienteLista">
                  <div className="IG-clienteBusquedaWrap">
                    <input type="text" className="IG-clienteBusquedaInput" placeholder="Buscar cliente..." value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)} onClick={(e) => e.stopPropagation()} />
                  </div>
                  <label className={`IG-dropdownFiltroItem ${clientesSeleccionados.length === 0 ? 'seleccionado' : ''}`}>
                    <input type="checkbox" checked={clientesSeleccionados.length === 0} onChange={() => setClientesSeleccionados([])} />
                    Todos
                  </label>
                  {clientesFiltradosDropdown.map(c => (
                    <label key={c} className={`IG-dropdownFiltroItem ${clientesSeleccionados.includes(c) ? 'seleccionado' : ''}`}>
                      <input type="checkbox" checked={clientesSeleccionados.includes(c)} onChange={() => setClientesSeleccionados(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="IG-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); setBusquedaCliente(''); }}>
            <FaFilter /> Filtrar
          </button>
        </div>
      </div>

      {/* Chips de filtros activos */}
      {hasFiltrosActivos && (
        <div className="IG-filtrosActivos">
          <span className="IG-filtrosActivosLabel">Filtros:</span>
          {JSON.stringify([...filtrosAplicados.anios].sort()) !== JSON.stringify([new Date().getFullYear()]) && (
            <button className="IG-filtroChip" onClick={() => { const def = [new Date().getFullYear()]; setAniosSeleccionados(def); setFiltrosAplicados(f => ({ ...f, anios: def })); }}>
              Años: {filtrosAplicados.anios.join(', ')} ✕
            </button>
          )}
          {filtrosAplicados.meses.length > 0 && (
            <button className="IG-filtroChip" onClick={() => { setMesesSeleccionados([]); setFiltrosAplicados(f => ({ ...f, meses: [] })); }}>
              Meses: {filtrosAplicados.meses.map(m => MESES.find(x => x.valor === m)?.nombre).join(', ')} ✕
            </button>
          )}
          {filtrosAplicados.clientes.length > 0 && filtrosAplicados.clientes.map(c => (
            <button key={c} className="IG-filtroChip" onClick={() => { const n = clientesSeleccionados.filter(x => x !== c); setClientesSeleccionados(n); setFiltrosAplicados(f => ({ ...f, clientes: n })); }}>
              {c} ✕
            </button>
          ))}
          <button className="IG-filtroLimpiar" onClick={() => { const def = [new Date().getFullYear()]; setAniosSeleccionados(def); setMesesSeleccionados([]); setClientesSeleccionados([]); setFiltrosAplicados({ anios: def, meses: [], clientes: [] }); }}>
            Limpiar todo
          </button>
        </div>
      )}

      {/* Contenido */}
      <main className="IG-main">
        {cargando ? (
          <div className="IG-loading">
            <div className="IG-camionContainer">
              <div className="IG-camionPista"></div>
              <div className="IG-camion">
                <svg viewBox="0 0 120 50" className="IG-camionSvg">
                  <rect x="30" y="8" width="58" height="28" rx="3" fill="#0f1928" />
                  <rect x="88" y="14" width="28" height="22" rx="3" fill="#e8a000" />
                  <rect x="93" y="18" width="18" height="10" rx="2" fill="#dbeafe" />
                  <circle cx="45" cy="40" r="7" fill="#334155" stroke="#1e293b" strokeWidth="2" />
                  <circle cx="45" cy="40" r="3" fill="#94a3b8" />
                  <circle cx="100" cy="40" r="7" fill="#334155" stroke="#1e293b" strokeWidth="2" />
                  <circle cx="100" cy="40" r="3" fill="#94a3b8" />
                  <rect x="114" y="33" width="6" height="5" rx="1" fill="#64748b" />
                </svg>
              </div>
            </div>
            <p>Cargando costo de operación...</p>
          </div>
        ) : error ? (
          <div className="IG-error">
            <p>{error}</p>
            <button className="IG-reintentar" onClick={obtenerDatos}>Reintentar</button>
          </div>
        ) : (
          <>
            {/* Costo total de la operación: barras apiladas por etapa (mensual/diario) */}
            <div className="IG-graficoContainer">
              {dataChart.length > 0 ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        💰 Costo total de la operación
                        <span className="IG-graficoBadge">{vista === 'diaria' ? 'Diario' : 'Mensual'}</span>
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vista === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVista('mensual')}>Mensual</button>
                        <button className={`IG-toggleBtn ${vista === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVista('diaria')}>Diario</button>
                      </div>
                      <button className="IG-botonExportar" onClick={exportarSerie} title="Exportar serie a Excel">
                        <FaDownload /> Exportar
                      </button>
                    </div>
                  </div>
                  <p className="IG-graficoSub">
                    <span style={{ color: COLOR_MEDIA }}>●</span> <b>{lbl.media_milla}</b>
                    {'  '}<span style={{ color: COLOR_ULTIMA }}>●</span> <b>{lbl.ultima_milla}</b>
                    {'  '}<span style={{ color: COLOR_OTROS }}>●</span> <b>{lbl.otros_costos}</b>
                  </p>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={dataChart} margin={{ top: 36, right: 20, left: 20, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tickFormatter={(val) => formatoEje(val)} interval={interval} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                        <Tooltip content={tooltipContenido} cursor={{ fill: 'rgba(15,25,40,0.05)' }} />
                        <Legend />
                        <Bar dataKey="media_milla" stackId="a" fill={COLOR_MEDIA} name={lbl.media_milla} isAnimationActive={false} />
                        <Bar dataKey="ultima_milla" stackId="a" fill={COLOR_ULTIMA} name={lbl.ultima_milla} isAnimationActive={false} />
                        {/* Última barra del stack: su cima siempre corona la pila, así que un
                            LabelList position="top" cae en la cima real y dataKey="total" la etiqueta. */}
                        <Bar dataKey="otros_costos" stackId="a" fill={COLOR_OTROS} name={lbl.otros_costos} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          <LabelList
                            dataKey="total"
                            position="top"
                            offset={8}
                            formatter={(value: number) => (value > 0 ? formatearMonedaCorta(value) : '')}
                            style={{ fill: '#0f1928', fontWeight: 700, fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de costo para el período seleccionado</p></div>
              )}
            </div>

            {/* Sobrecosto/ahorro NETO de la operación (media + última milla) — divergente sobre el
                eje 0: una barra por período; rojo arriba = sobrecosto neto, verde abajo = ahorro neto.
                Toggle Mensual/Diario independiente del gráfico de costo. */}
            <div className="IG-graficoContainer">
              {dataDif.some(d => d.neta !== 0) ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        📉 Sobrecosto y ahorro de la operación
                        <span className="IG-graficoBadge">{vistaDif === 'diaria' ? 'Diario' : 'Mensual'}</span>
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vistaDif === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaDif('mensual')}>Mensual</button>
                        <button className={`IG-toggleBtn ${vistaDif === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaDif('diaria')}>Diario</button>
                      </div>
                      <button className="IG-botonExportar" onClick={exportarSerie} title="Exportar serie a Excel">
                        <FaDownload /> Exportar
                      </button>
                    </div>
                  </div>
                  <p className="IG-graficoSub">
                    <span style={{ color: COLOR_SOBRE }}>●</span> <b>Sobrecosto neto</b>
                    {'  '}<span style={{ color: COLOR_AHORRO }}>●</span> <b>Ahorro neto</b> 
                    {'  '}
                  </p>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={dataDif} margin={{ top: 36, right: 20, left: 20, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tickFormatter={(val) => formatoEje(val, vistaDif)} interval={intervalDif} tick={{ fontSize: 11 }} />
                        <YAxis domain={[difMin - difPad, difMax + difPad]} tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                        <ReferenceLine y={0} stroke="#0f1928" strokeWidth={1.5} />
                        <Tooltip content={tooltipDiferencia} cursor={{ fill: 'rgba(15,25,40,0.05)' }} />
                        <Bar dataKey="neta" name="Sobrecosto / ahorro neto" isAnimationActive={false}>
                          {dataDif.map((d, i) => (
                            <Cell key={i} fill={d.neta > 0 ? COLOR_SOBRE : COLOR_AHORRO} />
                          ))}
                          {/* Etiqueta vertical (rotada -90°, lee de abajo hacia arriba):
                              ahorro (negativa) DEBAJO de la barra, sobrecosto (positiva)
                              arriba. Los bordes se calculan con min/max de y/y+h para no
                              depender del signo de height que entrega Recharts. */}
                          <LabelList
                            dataKey="neta"
                            content={(props: any) => {
                              const { x, y, value } = props;
                              const w = typeof props.width === 'number' ? props.width : 0;
                              const h = typeof props.height === 'number' ? props.height : 0;
                              const v = Number(value) || 0;
                              if (!v) return null;
                              const isPos = v > 0;
                              const cx = x + w / 2;
                              const topY = Math.min(y, y + h);
                              const botY = Math.max(y, y + h);
                              const gap = 6;
                              const txt = formatearMonedaCorta(Math.abs(v));
                              if (isPos) {
                                return (
                                  <text
                                    x={cx}
                                    y={topY - gap}
                                    textAnchor="start"
                                    transform={`rotate(-90 ${cx} ${topY - gap})`}
                                    fill={COLOR_SOBRE}
                                    fontSize={11}
                                    fontWeight={700}
                                  >
                                    {txt}
                                  </text>
                                );
                              }
                              return (
                                <text
                                  x={cx}
                                  y={botY + gap}
                                  textAnchor="end"
                                  transform={`rotate(-90 ${cx} ${botY + gap})`}
                                  fill={COLOR_AHORRO}
                                  fontSize={11}
                                  fontWeight={700}
                                >
                                  {txt}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de sobrecosto/ahorro para el período seleccionado</p></div>
              )}
            </div>

            {/* Cantidad de cajas/piezas por etapa — 3 líneas (una por etapa) con toggle
                Mensual/Diario propio. Muestra el volumen de cada etapa del viaje.
                Nota: media milla suma cajas (total_cajas_vehiculo); las otras dos suman piezas. */}
            <div className="IG-graficoContainer">
              {dataCajas.some(d => (d.cajas_media || d.cajas_ultima || d.cajas_otros) > 0) ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        📦 Cantidad de cajas por etapa
                        <span className="IG-graficoBadge">{vistaCajas === 'diaria' ? 'Diario' : 'Mensual'}</span>
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vistaCajas === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCajas('mensual')}>Mensual</button>
                        <button className={`IG-toggleBtn ${vistaCajas === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCajas('diaria')}>Diario</button>
                      </div>
                    </div>
                  </div>
                  <p className="IG-graficoSub">
                    <span style={{ color: COLOR_MEDIA }}>●</span> <b>{lbl.media_milla}</b>
                    {'  '}<span style={{ color: COLOR_ULTIMA }}>●</span> <b>{lbl.ultima_milla}</b>
                    {'  '}<span style={{ color: COLOR_OTROS }}>●</span> <b>{lbl.otros_costos}</b>
                  </p>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <LineChart data={dataCajas} margin={{ top: 20, right: 20, left: 20, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tickFormatter={(val) => formatoEje(val, vistaCajas)} interval={intervalCajas} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatearEntero(v)} width={70} />
                        <Tooltip content={tooltipCajas} cursor={{ stroke: '#0f1928', strokeDasharray: '3 3' }} />
                        <Line type="monotone" dataKey="cajas_media" stroke={COLOR_MEDIA} strokeWidth={2} name={lbl.media_milla} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                          <LabelList dataKey="cajas_media" position="top" offset={6} formatter={(value: number) => (value > 0 ? formatearEnteroCorto(value) : '')} style={{ fill: COLOR_MEDIA, fontSize: 10, fontWeight: 700 }} />
                        </Line>
                        <Line type="monotone" dataKey="cajas_ultima" stroke={COLOR_ULTIMA} strokeWidth={2} name={lbl.ultima_milla} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                          <LabelList dataKey="cajas_ultima" position="top" offset={6} formatter={(value: number) => (value > 0 ? formatearEnteroCorto(value) : '')} style={{ fill: COLOR_ULTIMA, fontSize: 10, fontWeight: 700 }} />
                        </Line>
                        <Line type="monotone" dataKey="cajas_otros" stroke={COLOR_OTROS} strokeWidth={2} name={lbl.otros_costos} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                          <LabelList dataKey="cajas_otros" position="top" offset={6} formatter={(value: number) => (value > 0 ? formatearEnteroCorto(value) : '')} style={{ fill: COLOR_OTROS, fontSize: 10, fontWeight: 700 }} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de cajas para el período seleccionado</p></div>
              )}
            </div>

            {/* 🚛 Uso de vehículos solicitados (TODAS las operaciones, media
                milla) — mismo gráfico que el dashboard de kabi: drill-down
                promedio % de uso por tipo solicitado → evolución por período →
                destino → tabla casi a nivel de consecutivo. % de uso = kg
                reales / tope de la categoría del tipo solicitado (TRACTOMULA:
                34.000 kg de referencia). Todo se agrupa en el frontend con las
                filas de /uso-vehiculos (una por consecutivo_vehiculo). */}
            {cargandoUso ? (
              <div className="IG-graficoContainer">
                <div className="IG-sinDatos"><p>Cargando uso de vehículos…</p></div>
              </div>
            ) : errorUso ? (
              <div className="IG-graficoContainer">
                <div className="IG-sinDatos">
                  <p>{errorUso}</p>
                  <button className="DC-reintentar" onClick={() => obtenerUsoVehiculos()}>Reintentar</button>
                </div>
              </div>
            ) : (
              <div className="IG-graficoContainer">
                {/* Trazabilidad del uso: buscar por pedido Vulcano trae el(los)
                    vehículo(s) que lo llevaron, en todo el histórico. */}
                <div className="DC-trazaBarra">
                  <input
                    className="DC-trazaInput"
                    type="text"
                    placeholder="Trazabilidad: número de pedido Vulcano (trae el vehículo que lo llevó)…"
                    value={inputUsoTraza}
                    onChange={e => setInputUsoTraza(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && aplicarTrazaUso()}
                    disabled={cargandoUso}
                  />
                  <button className="DC-trazaBtn" onClick={aplicarTrazaUso} disabled={cargandoUso}>Buscar</button>
                  {trazaUsoActiva && (
                    <button className="DC-trazaBtn DC-trazaBtnLimpiar" onClick={limpiarTrazaUso} title="Quitar la búsqueda y volver al drill-down">
                      ✕ Limpiar
                    </button>
                  )}
                </div>
                {trazaUsoActiva && (
                  <p className="DC-trazaInfo">
                    🔎 Pedido Vulcano <strong>{trazaUsoActiva}</strong> — buscando en todo el histórico (los filtros de Año/Mes/Cliente no aplican ahora). El pedido encontrado queda resaltado.
                  </p>
                )}

                {filasUso.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader">
                      <div className="IG-graficoTituloWrap">
                        <h2 className="IG-graficoTitulo">
                          🚛 Uso de vehículos solicitados
                          <span className="IG-graficoBadge">
                            {trazaUsoActiva ? 'Búsqueda' : drillUso.destino ? 'Detalle por vehículo' : drillUso.periodo ? 'Por destino' : drillUso.tipo ? 'Por período' : 'Por tipo'}
                          </span>
                          {!trazaUsoActiva && <span className="IG-graficoBadge DC-badgeRango">{rangoFiltros}</span>}
                        </h2>
                      </div>
                      {drillUso.tipo && !drillUso.periodo && !trazaUsoActiva && (
                        <div className="IG-graficoAcciones">
                          <div className="IG-toggleGrupo" role="group" aria-label="Vista uso de vehículos">
                            <button
                              className={`IG-toggleBtn ${vistaUso === 'mensual' ? 'IG-toggleBtnActivo' : ''}`}
                              onClick={() => { setVistaUso('mensual'); setDrillUso(d => ({ ...d, periodo: null, destino: null })); }}
                            >Mensual</button>
                            <button
                              className={`IG-toggleBtn ${vistaUso === 'diaria' ? 'IG-toggleBtnActivo' : ''}`}
                              onClick={() => { setVistaUso('diaria'); setDrillUso(d => ({ ...d, periodo: null, destino: null })); }}
                            >Diario</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* El drill-down completo se oculta mientras hay una
                        búsqueda activa: la trazabilidad ES el nivel de detalle. */}
                    {!trazaUsoActiva && (<>

                    {/* Breadcrumb del drill-down: cada segmento vuelve a su nivel */}
                    <div className="DC-usoCrumb" aria-label="Nivel de detalle">
                      <button
                        className={`DC-usoCrumbBtn ${!drillUso.tipo ? 'DC-usoCrumbActual' : ''}`}
                        onClick={() => setDrillUso({ tipo: null, periodo: null, destino: null })}
                      >Todos los tipos</button>
                      {drillUso.tipo && (
                        <>
                          <span className="DC-usoCrumbSep">›</span>
                          <button
                            className={`DC-usoCrumbBtn ${drillUso.tipo && !drillUso.periodo ? 'DC-usoCrumbActual' : ''}`}
                            onClick={() => setDrillUso({ tipo: drillUso.tipo, periodo: null, destino: null })}
                          >{drillUso.tipo}</button>
                        </>
                      )}
                      {drillUso.periodo && (
                        <>
                          <span className="DC-usoCrumbSep">›</span>
                          <button
                            className={`DC-usoCrumbBtn ${drillUso.periodo && !drillUso.destino ? 'DC-usoCrumbActual' : ''}`}
                            onClick={() => setDrillUso({ tipo: drillUso.tipo, periodo: drillUso.periodo, destino: null })}
                          >
                            {(() => {
                              try {
                                return format(parseISO(drillUso.periodo!.length === 7 ? drillUso.periodo! + '-01' : drillUso.periodo!), vistaUso === 'diaria' ? 'd MMM yy' : 'MMM yy', { locale: es });
                              } catch { return drillUso.periodo; }
                            })()}
                          </button>
                        </>
                      )}
                      {drillUso.destino && (
                        <>
                          <span className="DC-usoCrumbSep">›</span>
                          <span className="DC-usoCrumbBtn DC-usoCrumbActual">{drillUso.destino}</span>
                        </>
                      )}
                    </div>

                    <p className="IG-graficoSub">
                      <span style={{ color: '#1baf7a' }}>●</span> ≥ 80% (bien utilizado) &nbsp;&nbsp;
                      <span style={{ color: '#e34948' }}>●</span> &lt; 80% (subutilizado) &nbsp;&nbsp;
                      <span style={{ color: '#64748b' }}>–</span> % uso = kg reales ÷ tope del tipo solicitado
                    </p>

                    {/* Nivel 1: promedio de uso por tipo solicitado */}
                    {!drillUso.tipo && (
                      <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={usoPorTipo} margin={{ top: 24, right: 20, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="clave" tick={{ fontSize: 11 }} interval={0} />
                            <YAxis unit="%" width={56} allowDecimals={false} />
                            <Tooltip content={tooltipUsoTipo} cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }} />
                            <ReferenceLine y={100} stroke="#64748b" strokeDasharray="6 4" label={{ value: 'Tope 100%', position: 'insideTopRight', fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                            <Bar
                              dataKey="uso"
                              name="% uso promedio"
                              isAnimationActive={false}
                              cursor="pointer"
                              onClick={(_: unknown, i: number) => {
                                const d = usoPorTipo[i];
                                if (d) setDrillUso({ tipo: d.clave, periodo: null, destino: null });
                              }}
                            >
                              {usoPorTipo.map(d => (
                                <Cell key={d.clave} fill={colorUso(d.uso)} />
                              ))}
                              <LabelList
                                dataKey="uso"
                                position="top"
                                offset={10}
                                formatter={(v: number | null) => (v == null ? '' : `${Math.round(v)}%`)}
                                style={{ fill: '#0f1928', fontSize: 10, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Nivel 2: evolución del % de uso del tipo por período */}
                    {drillUso.tipo && !drillUso.periodo && (
                      <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={usoPorPeriodo} margin={{ top: 24, right: 20, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="clave"
                              tick={{ fontSize: 11 }}
                              interval={0}
                              angle={vistaUso === 'diaria' ? -90 : 0}
                              textAnchor={vistaUso === 'diaria' ? 'end' : 'middle'}
                              height={vistaUso === 'diaria' ? 60 : 30}
                              tickFormatter={(v: string) => {
                                try {
                                  return format(parseISO(v + (v.length === 7 ? '-01' : '')), vistaUso === 'diaria' ? 'd MMM' : 'MMM yy', { locale: es });
                                } catch { return v; }
                              }}
                            />
                            <YAxis unit="%" width={56} allowDecimals={false} />
                            <Tooltip content={tooltipUsoPeriodo} cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }} />
                            <ReferenceLine y={100} stroke="#64748b" strokeDasharray="6 4" label={{ value: 'Tope 100%', position: 'insideTopRight', fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                            <Bar
                              dataKey="uso"
                              name="% uso promedio"
                              isAnimationActive={false}
                              cursor="pointer"
                              onClick={(_: unknown, i: number) => {
                                const d = usoPorPeriodo[i];
                                if (d) setDrillUso({ tipo: drillUso.tipo, periodo: d.clave, destino: null });
                              }}
                            >
                              {usoPorPeriodo.map(d => (
                                <Cell key={d.clave} fill={colorUso(d.uso)} />
                              ))}
                              <LabelList
                                dataKey="uso"
                                position="top"
                                offset={10}
                                formatter={(v: number | null) => (v == null ? '' : `${Math.round(v)}%`)}
                                style={{ fill: '#0f1928', fontSize: 10, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Nivel 3: % de uso por destino (barras horizontales) */}
                    {drillUso.periodo && !drillUso.destino && (
                      <div style={{ width: '100%', height: Math.max(160, usoPorDestino.length * 34 + 60) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={usoPorDestino} layout="vertical" margin={{ top: 10, right: 40, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" unit="%" allowDecimals={false} />
                            <YAxis type="category" dataKey="clave" width={150} tick={{ fontSize: 11 }} />
                            <Tooltip content={tooltipUsoDestino} cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }} />
                            <ReferenceLine x={100} stroke="#64748b" strokeDasharray="6 4" />
                            <Bar
                              dataKey="uso"
                              name="% uso promedio"
                              isAnimationActive={false}
                              cursor="pointer"
                              onClick={(_: unknown, i: number) => {
                                const d = usoPorDestino[i];
                                if (d) setDrillUso({ tipo: drillUso.tipo, periodo: drillUso.periodo, destino: d.clave });
                              }}
                            >
                              {usoPorDestino.map(d => (
                                <Cell key={d.clave} fill={colorUso(d.uso)} />
                              ))}
                              <LabelList
                                dataKey="uso"
                                position="right"
                                formatter={(v: number | null) => (v == null ? '' : `${Math.round(v)}%`)}
                                style={{ fill: '#0f1928', fontSize: 10, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Nivel 4: detalle casi a nivel de consecutivo_vehiculo */}
                    {drillUso.destino && (
                      <div className="DC-guiaCuerpo">
                        <div className="DC-guiaAcciones" style={{ justifyContent: 'flex-end' }}>
                          <button className="DC-guiaBotonExportar" onClick={exportarUsoExcel}>
                            ⬇ Exportar Excel ({formatearEntero(filasDestinoUso.length)})
                          </button>
                        </div>
                        <TablaDetalleUso filas={filasDestinoUso} />
                      </div>
                    )}

                    </>)}

                    {/* Resultado de la trazabilidad: el(los) vehículo(s) que
                        llevan el pedido Vulcano buscado, ya desplegados. */}
                    {trazaUsoActiva && (
                      <div className="DC-guiaCuerpo">
                        <div className="DC-guiaAcciones" style={{ justifyContent: 'flex-end' }}>
                          <button className="DC-guiaBotonExportar" onClick={exportarUsoExcel}>
                            ⬇ Exportar Excel ({formatearEntero(filasUso.length)})
                          </button>
                        </div>
                        <TablaDetalleUso filas={filasUso} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="IG-sinDatos">
                    <p>{trazaUsoActiva
                      ? `Ningún vehículo lleva el pedido Vulcano "${trazaUsoActiva}"`
                      : 'No hay vehículos para el período seleccionado'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Costo por caja: promedio ponderado por período (Σ costo / Σ cajas) con
                reglas por cliente (Fresenius Kabi usa cajas+costo de las 3 etapas;
                otros, cajas de última milla + costo de última+otros). Toggle propio. */}
            <div className="IG-graficoContainer">
              {dataCaja.some(d => d.costo_por_caja > 0) ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        💲 Costo por caja
                        <span className="IG-graficoBadge">{vistaCaja === 'diaria' ? 'Diario' : 'Mensual'}</span>
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vistaCaja === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCaja('mensual')}>Mensual</button>
                        <button className={`IG-toggleBtn ${vistaCaja === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCaja('diaria')}>Diario</button>
                      </div>
                    </div>
                  </div>
                  <p className="IG-graficoSub">
                    Costo por caja promedio del período. Fresenius Kabi toma cajas de {lbl.media_milla.toLowerCase()} y costo de las 3 etapas; los demás, cajas de {lbl.ultima_milla.toLowerCase()} y costo de {lbl.ultima_milla.toLowerCase()} + {lbl.otros_costos.toLowerCase()}.
                  </p>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={dataCaja} margin={{ top: 28, right: 20, left: 20, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tickFormatter={(val) => formatoEje(val, vistaCaja)} interval={intervalCaja} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                        <Tooltip content={tooltipCostoCaja} cursor={{ fill: 'rgba(15,25,40,0.05)' }} />
                        <Bar dataKey="costo_por_caja" name="Costo por caja" fill={COLOR_MEDIA} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          <LabelList
                            dataKey="costo_por_caja"
                            position="top"
                            offset={8}
                            formatter={(value: number) => (value > 0 ? formatearMoneda(value) : '')}
                            style={{ fill: '#0f1928', fontWeight: 700, fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de costo por caja para el período seleccionado</p></div>
              )}
            </div>

            {/* Pedidos atendidos por analista — barras APILADAS por período (una
                pila por mes/día), un segmento por analista; la leyenda es el
                usuario. Toggle Mensual/Diario propio, igual que el de costo total.
                "Sin asignar" agrupa docs sin tramitador registrado o tramitados
                por otro perfil (gris neutro, siempre al final). */}
            <div className="IG-graficoContainer">
              {dataAnalista.some(d => d.total > 0) ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        👥 Pedidos atendidos por analista
                        <span className="IG-graficoBadge">{vistaAnalista === 'diaria' ? 'Diario' : 'Mensual'}</span>
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vistaAnalista === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaAnalista('mensual')}>Mensual</button>
                        <button className={`IG-toggleBtn ${vistaAnalista === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaAnalista('diaria')}>Diario</button>
                      </div>
                      <button className="IG-botonExportar" onClick={exportarAnalistas} title="Exportar serie a Excel">
                        <FaDownload /> Exportar
                      </button>
                    </div>
                  </div>
                  <p className="IG-graficoSub">Pedidos tramitados por cada analista (etapas {lbl.media_milla.toLowerCase()} + {lbl.ultima_milla.toLowerCase()} + {lbl.otros_costos.toLowerCase()} sumadas).</p>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={dataAnalista} margin={{ top: 36, right: 20, left: 20, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tickFormatter={(val) => formatoEje(val, vistaAnalista)} interval={intervalAnalista} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatearEntero(v)} width={70} />
                        <Tooltip content={tooltipAnalista} cursor={{ fill: 'rgba(15,25,40,0.05)' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {analistaUsuarios.map((u, i) => {
                          // La última serie visible lleva la etiqueta del total
                          // (position="top" sobre la cima de la pila).
                          const esUltima = i === analistaUsuarios.length - 1;
                          return (
                            <Bar
                              key={u.columna}
                              dataKey={u.columna}
                              stackId="a"
                              name={u.nombre}
                              fill={colorAnalista(i, u.usuario)}
                              isAnimationActive={false}
                              radius={esUltima ? [3, 3, 0, 0] : undefined}
                            >
                              {esUltima && (
                                <LabelList
                                  dataKey="total"
                                  position="top"
                                  offset={8}
                                  formatter={(value: number) => (value > 0 ? formatearEnteroCorto(value) : '')}
                                  style={{ fill: '#0f1928', fontWeight: 700, fontSize: 11 }}
                                />
                              )}
                            </Bar>
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay pedidos atendidos por analista para el período seleccionado</p></div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="IG-footer">
        <p>© {new Date().getFullYear()} Integra — Indicadores de Costo de Operación de Transporte</p>
      </footer>
    </div>
  );
};

export default IndicadoresCostoOperacion;
