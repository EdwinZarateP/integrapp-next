'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ReferenceLine, Customized, BarChart, Bar, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaUpload } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import { obtenerCliente } from '../clientes';
import '@/Componentes/IndicadoresChrome/estilos.css';
import './estilos.css';

// Perfiles que pueden cargar el Excel de citas (plan B del OT). Espejo de
// PERFILES_CARGA_CITAS del backend (indicadores_cliente.py).
const PERFILES_CARGA_CITAS = ['ADMIN', 'ANALISTA', 'COORDINADOR', 'CONTROL'];

/** Skeleton de un gráfico: título + subtítulo + barras shimmer con alturas
 *  variadas que anticipan el contenido. `bajo` para el gráfico OT (320px). */
const SkeletonGrafico: React.FC<{ bajo?: boolean }> = ({ bajo }) => (
  <div className="DC-skelCard">
    <div className="DC-skel DC-skelTitulo" />
    <div className="DC-skel DC-skelSub" />
    <div className={`DC-skelGrafico ${bajo ? 'DC-skelGraficoBajo' : ''}`}>
      {Array.from({ length: bajo ? 9 : 12 }, (_, i) => (
        <div key={i} className="DC-skelBarra" />
      ))}
    </div>
  </div>
);

type SerieCajas = { periodo: string; cajas: number; vehiculos: number };

type ApiResponse = {
  success: boolean;
  data?: { cliente: string; mensual: SerieCajas[]; diario: SerieCajas[]; anios: number[] };
  error?: string;
};

// Informe de guías TMS: contexto del vehículo (Mongo) + estado/fechas (Postgres).
// planilla_siscore puede traer varias guías por coma → una fila por guía.
type FilaGuia = {
  guia: string;
  consecutivo_vehiculo: string | number;
  fecha_creacion: string | null;
  cajas_vehiculo: number;
  destino?: string;
  estado: string | null;
  fecha_emision: string | null;
  fecha_entrega: string | null;
  fecha_digitalizacion: string | null;
  // TEXT crudo del TMS: histórico con basura (zonas, teléfonos); llegará
  // YYYY-MM-DD cuando la operación digite fechas reales.
  fecha_cita: string | null;
  destinatario: string | null;
  // On Time: fecha inicial (emision ?? creacion) vs fecha promesa (CITA si es
  // servible, si no inicial + promesa_entrega_dias hábiles del destino en
  // Tarifas). ot=1 cumplió, 0 no, null no evaluable.
  fecha_promesa: string | null;
  origen_promesa: 'CITA' | 'PROMESA' | null;
  dias_habiles: number | null;
  ot: number | null;
};

type ResumenGuias = {
  total_vehiculos: number;
  total_guias: number;
  entregadas: number;
  en_proceso: number;
  sin_info: number;
  anuladas: number;
  por_estado: Record<string, number>;
  ot_cumplen: number;
  ot_no_cumplen: number;
  ot_no_evaluables: number;
  ot_pct: number | null;
  truncada: boolean;
};

type InformeGuiasResponse = {
  success: boolean;
  data?: { cliente: string; filas: FilaGuia[]; resumen: ResumenGuias; advertencia?: string | null };
  error?: string;
};

type UsoVehiculosResponse = {
  success: boolean;
  data?: { cliente: string; filas: FilaUso[] };
  error?: string;
};

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

// Mismo azul de la etapa media milla en Costo de Operación.
const COLOR_CAJAS = '#606060';

const MESES = [
  { valor: 1, nombre: 'Enero' }, { valor: 2, nombre: 'Febrero' },
  { valor: 3, nombre: 'Marzo' }, { valor: 4, nombre: 'Abril' },
  { valor: 5, nombre: 'Mayo' }, { valor: 6, nombre: 'Junio' },
  { valor: 7, nombre: 'Julio' }, { valor: 8, nombre: 'Agosto' },
  { valor: 9, nombre: 'Septiembre' }, { valor: 10, nombre: 'Octubre' },
  { valor: 11, nombre: 'Noviembre' }, { valor: 12, nombre: 'Diciembre' },
];

/**
 * Dashboard de indicadores de UN cliente (registro: ../clientes.ts).
 * Por ahora: gráfico "Cantidad de cajas" (media milla) con toggle Mensual/Diario.
 */
const DashboardCliente: React.FC<{ clienteId: string }> = ({ clienteId }) => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const cliente = obtenerCliente(clienteId);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serieMensual, setSerieMensual] = useState<SerieCajas[]>([]);
  const [serieDiaria, setSerieDiaria] = useState<SerieCajas[]>([]);

  // Informe de guías TMS (colapsable bajo el gráfico de cajas).
  const [informeAbierto, setInformeAbierto] = useState(false);
  const [filasGuias, setFilasGuias] = useState<FilaGuia[]>([]);
  const [resumenGuias, setResumenGuias] = useState<ResumenGuias | null>(null);
  const [cargandoGuias, setCargandoGuias] = useState(false);
  const [errorGuias, setErrorGuias] = useState<string | null>(null);
  const [advertenciaGuias, setAdvertenciaGuias] = useState<string | null>(null);
  // Trazabilidad: búsqueda por guía o consecutivo de vehículo (va al backend
  // como ?q= y reemplaza el filtro de fechas).
  const [inputTraza, setInputTraza] = useState('');
  const [trazaActiva, setTrazaActiva] = useState<string | null>(null);

  // Carga del Excel de citas (plan B del OT): solo ADMIN/ANALISTA/COORDINADOR/CONTROL.
  const puedeCargarCitas = PERFILES_CARGA_CITAS.includes((datosUsuario?.perfil || '').toUpperCase());
  const [cargandoCitas, setCargandoCitas] = useState(false);

  const handleCargarCitas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!window.confirm(
      'Se cargarán las fechas de cita del Excel (GUIA + FECHA_CITA) a la colección citas_kabi.\n\n' +
      'Si una guía ya tiene cita cargada, se REEMPLAZA por la del Excel.\n\n¿Continuar?'
    )) {
      if (e.target) e.target.value = '';
      return;
    }
    setCargandoCitas(true);
    try {
      const params = new URLSearchParams({ perfil: datosUsuario?.perfil || '' });
      const fd = new FormData();
      fd.append('archivo', archivo);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/citas?${params.toString()}`,
        { method: 'POST', body: fd },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || 'Error al cargar las citas.');
      }
      const { cargadas, invalidas, errores } = data.data;
      let msg = `✅ ${cargadas} citas cargadas.`;
      if (invalidas > 0) {
        msg += `\n⚠ ${invalidas} filas con fecha inválida fueron ignoradas`;
        if (errores?.length) msg += `:\n${errores.join('\n')}`;
      }
      alert(msg);
      // Recalcular el informe con las citas nuevas.
      obtenerInformeGuias();
    } catch (err) {
      alert(`❌ ${err instanceof Error ? err.message : 'Error al cargar las citas.'}`);
    } finally {
      setCargandoCitas(false);
      if (e.target) e.target.value = '';
    }
  };

  // Vista del gráfico de cajas: mensual (default) o diaria.
  const [vistaCajas, setVistaCajas] = useState<'mensual' | 'diaria'>('mensual');

  // Uso de vehículos solicitados (drill-down tipo → período → destino).
  const [filasUso, setFilasUso] = useState<FilaUso[]>([]);
  const [cargandoUso, setCargandoUso] = useState(false);
  const [errorUso, setErrorUso] = useState<string | null>(null);
  const [vistaUso, setVistaUso] = useState<'mensual' | 'diaria'>('mensual');
  const [drillUso, setDrillUso] = useState<{ tipo: string | null; periodo: string | null; destino: string | null }>({ tipo: null, periodo: null, destino: null });
  // Filas del detalle con sus pedidos desplegados (el "+" de cada vehículo).
  const [usoAbiertos, setUsoAbiertos] = useState<Set<string>>(new Set());
  const alternarUsoAbierto = (cv: string) => {
    setUsoAbiertos(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(cv)) nuevo.delete(cv); else nuevo.add(cv);
      return nuevo;
    });
  };
  // Trazabilidad del uso: buscar por pedido Vulcano (numero_pedido) → el
  // backend busca en TODO el histórico (ignora año/mes) y trae el vehículo.
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

  // Nivel 1 arcade: el trazo se dibuja solo SOLO en la carga inicial de la
  // página (en cada "Filtrar" ya no sorprende, solo demora).
  const [primeraCarga, setPrimeraCarga] = useState(true);

  // Filtros en pantalla (no disparan fetch hasta "Filtrar")
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [aniosSeleccionados, setAniosSeleccionados] = useState<number[]>([new Date().getFullYear()]);
  const [mesesSeleccionados, setMesesSeleccionados] = useState<number[]>([]);
  const [dropdownAnioAbierto, setDropdownAnioAbierto] = useState(false);
  const [dropdownMesAbierto, setDropdownMesAbierto] = useState(false);

  // Filtros aplicados (los que realmente se consultan)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    anios: [new Date().getFullYear()] as number[],
    meses: [] as number[],
  });

  useEffect(() => {
    const usuarioMatch = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const perfilMatch = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/);
    const regionalMatch = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/);
    if (usuarioMatch) {
      setDatosUsuario({ usuario: usuarioMatch[2], perfil: perfilMatch?.[2], regional: regionalMatch?.[2] });
    }
  }, []);

  // Cerrar menús al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Params de consulta compartidos por /cajas y /guias (mismos filtros aplicados).
  const construirParams = () => {
    const params = new URLSearchParams();
    filtrosAplicados.anios.forEach(a => params.append('anio', String(a)));
    filtrosAplicados.meses.forEach(m => params.append('mes', String(m)));
    return params;
  };

  // Params del informe de guías: los del período + la trazabilidad activa (q).
  const construirParamsGuias = () => {
    const params = construirParams();
    if (trazaActiva) params.set('q', trazaActiva);
    return params;
  };

  const obtenerDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/cajas?${construirParams().toString()}`);
      if (!response.ok) throw new Error('Error al obtener datos');
      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setSerieMensual(data.data.mensual || []);
        setSerieDiaria(data.data.diario || []);
        if (data.data.anios?.length) setAniosDisponibles(data.data.anios);
        // NOTA: primeraCarga NO se apaga acá — lo hace el onAnimationEnd de la
        // Line. Un timeout era frágil: si el fetch corre 2 veces (StrictMode)
        // o tarda, cambiaba la duración a mitad del trazo y la línea saltaba.
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  };

  const obtenerInformeGuias = async () => {
    setCargandoGuias(true);
    setErrorGuias(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/guias?${construirParamsGuias().toString()}`);
      if (!response.ok) throw new Error('Error al obtener el informe de guías');
      const data: InformeGuiasResponse = await response.json();
      if (data.success && data.data) {
        setFilasGuias(data.data.filas || []);
        setResumenGuias(data.data.resumen || null);
        setAdvertenciaGuias(data.data.advertencia || null);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setErrorGuias(err instanceof Error ? err.message : 'Error al cargar el informe de guías');
    } finally {
      setCargandoGuias(false);
    }
  };

  // Uso de vehículos: una fila por consecutivo_vehiculo; el drill-down se
  // arma acá en el frontend con esas filas. Con trazabilidad activa el
  // backend ignora año/mes y trae el vehículo del pedido Vulcano buscado
  // (sus pedidos se despliegan solos y el match queda resaltado).
  const obtenerUsoVehiculos = async (traza?: string | null) => {
    setCargandoUso(true);
    setErrorUso(null);
    try {
      const params = construirParams();
      const q = traza !== undefined ? traza : trazaUsoActiva;
      if (q) params.set('q', q);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/uso-vehiculos?${params.toString()}`);
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
    if (cliente) {
      obtenerDatos();
      // Con trazabilidad de uso activa, el "Filtrar" no la pisa (igual que
      // el informe de guías): la búsqueda viaja sola.
      if (!trazaUsoActiva) obtenerUsoVehiculos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, clienteId]);

  // Al cambiar la trazabilidad del uso, re-consultar (el backend busca en
  // TODO el histórico: los filtros de Año/Mes no aplican a esa consulta).
  useEffect(() => {
    if (cliente) obtenerUsoVehiculos(trazaUsoActiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trazaUsoActiva]);

  // El informe de guías viaja junto con /cajas desde la CARGA INICIAL (el
  // gráfico On Time lo necesita) — salvo cuando hay trazabilidad activa, que
  // es una consulta aparte del usuario.
  useEffect(() => {
    if (cliente && !trazaActiva) obtenerInformeGuias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, clienteId]);

  const alternarInforme = () => {
    setInformeAbierto(o => !o);
  };

  // Trazabilidad: aplicar la búsqueda (Enter o botón) y limpiarla.
  const aplicarTraza = () => {
    const v = inputTraza.trim();
    setTrazaActiva(v || null);
  };
  const limpiarTraza = () => {
    setInputTraza('');
    setTrazaActiva(null);
  };

  // Al cambiar la trazabilidad, re-consultar el informe (la trazabilidad
  // reemplaza el filtro de fechas en el backend: busca en TODO el histórico).
  useEffect(() => {
    if (cliente) obtenerInformeGuias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trazaActiva]);

  const aplicarFiltros = () => {
    setFiltrosAplicados({ anios: aniosSeleccionados, meses: mesesSeleccionados });
  };

  // ── Serie OT por período (para el gráfico sobre el informe de guías) ──
  // Bucket = fecha de ENTREGA (cuándo se cerró la promesa); fallback a la de
  // creación. Tres segmentos: cumplieron (ot=1), no cumplieron (ot=0) y
  // PENDIENTES (sin fecha de entrega aún — en proceso/con novedad/sin cargar;
  // las ANULADAS quedan fuera). El % OT se calcula solo sobre las evaluables.
  const [vistaOT, setVistaOT] = useState<'mensual' | 'diaria'>('mensual');
  const acumularOT = (buckets: Map<string, { cumplieron: number; noCumplieron: number; pendientes: number }>, f: FilaGuia, largo: number) => {
    const clave = (f.fecha_entrega || f.fecha_creacion || '').slice(0, largo);
    if (!clave) return;
    const b = buckets.get(clave) || { cumplieron: 0, noCumplieron: 0, pendientes: 0 };
    if (f.ot === 1) b.cumplieron += 1;
    else if (f.ot === 0) b.noCumplieron += 1;
    else if ((f.estado || '').toUpperCase() !== 'ANULADA') b.pendientes += 1;
    buckets.set(clave, b);
  };
  const serieOTMensual = useMemo(() => {
    const buckets = new Map<string, { cumplieron: number; noCumplieron: number; pendientes: number }>();
    for (const f of filasGuias) acumularOT(buckets, f, 7);
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodo, v]) => ({ periodo, ...v, evaluables: v.cumplieron + v.noCumplieron, total: v.cumplieron + v.noCumplieron + v.pendientes }));
  }, [filasGuias]);

  const serieOTDiaria = useMemo(() => {
    const buckets = new Map<string, { cumplieron: number; noCumplieron: number; pendientes: number }>();
    for (const f of filasGuias) acumularOT(buckets, f, 10);
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodo, v]) => ({ periodo, ...v, evaluables: v.cumplieron + v.noCumplieron, total: v.cumplieron + v.noCumplieron + v.pendientes }));
  }, [filasGuias]);

  const dataOT = useMemo(
    () => (vistaOT === 'diaria' ? serieOTDiaria : serieOTMensual),
    [vistaOT, serieOTDiaria, serieOTMensual],
  );

  // % OT por período para etiqueta y tooltip.
  const pctOT = (d: { cumplieron: number; total: number }) =>
    d.total > 0 ? Math.round((d.cumplieron / d.total) * 100) : null;

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

  // Tooltips del drill-down de uso (mismo look que el de OT/cajas).
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
      'Fecha': f.fecha ? formatearFecha(f.fecha) : '',
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
    ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 34 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Uso vehículos');
    XLSX.writeFile(wb, `uso_vehiculos_${clienteId}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Rango de fechas aplicado (para el título del gráfico OT): "2026" o
  // "ene–mar 2026" según los filtros de Año/Mes activos.
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

  // Tooltip del gráfico OT: período, cumplidas/no cumplidas/pendientes y %.
  const tooltipOT = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as { periodo: string; cumplieron: number; noCumplieron: number; pendientes: number; evaluables: number; total: number };
    const fechaTxt = vistaOT === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    const pct = pctOT(d);
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p><span className="IG-tooltipEtapa" style={{ background: '#15803d' }} />Cumplieron: <b>{formatearEntero(d.cumplieron)}</b></p>
        <p><span className="IG-tooltipEtapa" style={{ background: '#b91c1c' }} />No cumplieron: <b>{formatearEntero(d.noCumplieron)}</b></p>
        <p><span className="IG-tooltipEtapa" style={{ background: '#94a3b8' }} />Pendientes: <b>{formatearEntero(d.pendientes)}</b></p>
        <p className="IG-tooltipSerieSub">
          Evaluables: {formatearEntero(d.evaluables)}{pct != null ? ` · ${pct}% OT` : ''} · Total: {formatearEntero(d.total)}
        </p>
      </div>
    );
  };

  // Datos visibles según la vista del gráfico. En vista diaria cada punto lleva
  // `ts` (ms de su fecha) para el eje de tiempo numérico, en orden ascendente.
  const dataCajas = useMemo<(SerieCajas & { ts?: number })[]>(
    () => vistaCajas === 'diaria'
      ? serieDiaria
          .map(d => ({ ...d, ts: parseISO(d.periodo).getTime() }))
          .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
      : serieMensual,
    [vistaCajas, serieDiaria, serieMensual],
  );

  // Eje de tiempo estilo Excel (solo vista diaria): fila 1 = día del mes,
  // fila 2 = mes, fila 3 = año. Cada mes/año es una CELDA con bordes que
  // encierra exactamente los días que cubre (como la tabla dinámica de Excel:
  // se ve de un golpe qué días pertenecen a qué mes/año).
  const ejeDiario = useMemo(() => {
    const DIA = 86_400_000;
    const puntos = dataCajas.filter((d): d is SerieCajas & { ts: number } => d.ts !== undefined);
    if (vistaCajas !== 'diaria' || puntos.length === 0) return null;
    const minTs = puntos[0].ts;
    const maxTs = puntos[puntos.length - 1].ts;

    // Días continuos min→max; en rangos largos se salta de a `paso` para que
    // los números no se solapen (Excel también espacia las etiquetas al alejarse).
    const totalDias = Math.round((maxTs - minTs) / DIA) + 1;
    const paso = totalDias <= 62 ? 1 : Math.ceil(totalDias / 45);
    const ticksDias: number[] = [];
    for (let t = minTs; t <= maxTs; t += paso * DIA) ticksDias.push(t);

    // Celdas de mes (YYYY-MM): [inicio, fin] en ms. La celda va del primer día
    // del bloque hasta el inicio del siguiente mes (o el último día con datos
    // si es la última celda) — así encierra visualmente a sus días.
    const celdasMes: { clave: string; inicio: number; fin: number; nombre: string }[] = [];
    puntos.forEach(p => {
      const clave = p.periodo.slice(0, 7);
      const ult = celdasMes[celdasMes.length - 1];
      if (ult && ult.clave === clave) ult.fin = p.ts;
      else celdasMes.push({ clave, inicio: p.ts, fin: p.ts, nombre: format(p.ts, 'MMM', { locale: es }) });
    });

    // Celdas de año agrupando las de mes.
    const celdasAnio: { anio: string; inicio: number; fin: number }[] = [];
    celdasMes.forEach(c => {
      const anio = c.clave.slice(0, 4);
      const ult = celdasAnio[celdasAnio.length - 1];
      if (ult && ult.anio === anio) ult.fin = c.fin;
      else celdasAnio.push({ anio, inicio: c.inicio, fin: c.fin });
    });

    return {
      // Dominio degenerado (un solo día) se ensancha para que la escala exista.
      dominio: [minTs === maxTs ? minTs - DIA / 2 : minTs, minTs === maxTs ? maxTs + DIA / 2 : maxTs] as [number, number],
      ticksDias,
      celdasMes,
      celdasAnio,
      formatoDia: (v: number) => format(v, 'd'),
    };
  }, [vistaCajas, dataCajas]);

  // Media de cajas de los períodos visibles — referencia punteada y área
  // roja/azul según cada punto quede por encima/debajo de ella (vista diaria).
  // `corte` es la fracción [0..1] del bbox del área donde cae la media: el
  // gradiente corta el color exactamente ahí (arriba rojo, abajo azul).
  const mediaDiaria = useMemo(() => {
    if (dataCajas.length === 0) return null;
    const suma = dataCajas.reduce((acc, d) => acc + (d.cajas || 0), 0);
    const media = suma / dataCajas.length;
    const maxV = Math.max(...dataCajas.map(d => d.cajas || 0));
    const minV = Math.min(...dataCajas.map(d => d.cajas || 0));
    const corte = maxV > minV ? (maxV - media) / (maxV - minV) : 0.5;
    return { media, corte };
  }, [dataCajas]);

  // Proporción de días POR ENCIMA de la media (solo vista diaria, junto a la
  // línea de referencia): "45% días > media (14/31)".
  const diasSobreMedia = useMemo(() => {
    if (vistaCajas !== 'diaria' || !mediaDiaria || dataCajas.length === 0) return null;
    const total = dataCajas.length;
    const encima = dataCajas.filter(d => (d.cajas || 0) > mediaDiaria.media).length;
    return { total, encima, pct: Math.round((encima / total) * 100) };
  }, [vistaCajas, dataCajas, mediaDiaria]);

  const formatearEntero = (num: number): string =>
    new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num || 0);
  // Pesos colombianos sin decimales (costo del vehículo en el detalle de uso).
  const formatearMoneda = (num: number): string =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num || 0);
  const formatearEnteroCorto = (num: number): string => {
    const n = num || 0;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(Math.round(n));
  };

  // Chip de estado del TMS: ENTREGADO (exacto, valor real de la BD) → verde;
  // ANULADA (sin registro TMS y antigua) → gris; el resto → ámbar.
  const claseChipEstado = (estado: string) => {
    const e = estado.toUpperCase();
    if (e === 'ENTREGADO') return 'DC-guiaChipEntregada';
    if (e === 'ANULADA') return 'DC-guiaChipAnulada';
    return 'DC-guiaChipProceso';
  };

  // '2026-08-14' → '14-08-2026' (día primero, como lo lee el usuario). Solo
  // reformattea si calza exacto con ISO; fecha_cita puede traer basura y se
  // muestra tal cual.
  const formatearFecha = (v: string | null): string => {
    if (!v) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
  };

  // Export Excel (.xlsx) del informe — SheetJS, mismo patrón que el Export de
  // Tarifas. Fechas ya en DD-MM-AAAA (formatearFecha) para que Excel-ES las lea.
  const exportarGuiasExcel = () => {
    const datos = filasGuias.map(f => ({
      'Guía': f.guia,
      'Vehículo': f.consecutivo_vehiculo,
      'Destinatario': f.destinatario ?? '',
      'Destino': f.destino ?? '',
      'Fecha': f.fecha_creacion ? formatearFecha(f.fecha_creacion) : '',
      'Cajas': f.cajas_vehiculo,
      'Estado': f.estado ?? '',
      'F. Emisión': f.fecha_emision ? formatearFecha(f.fecha_emision) : '',
      'F. Entrega': f.fecha_entrega ? formatearFecha(f.fecha_entrega) : '',
      'F. Promesa': f.fecha_promesa ? formatearFecha(f.fecha_promesa) : '',
      'Origen Promesa': f.origen_promesa ?? '',
      'Días Hábiles': f.dias_habiles ?? '',
      'OT': f.ot ?? '',
      'F. Digitalización': f.fecha_digitalizacion ? formatearFecha(f.fecha_digitalizacion) : '',
      'F. Cita': f.fecha_cita ? formatearFecha(f.fecha_cita) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    ws['!cols'] = [
      { wch: 12 }, { wch: 34 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 8 },
      { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 6 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Guías TMS');
    XLSX.writeFile(wb, `guias_tms_${clienteId}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Etiquetas de valor VERTICALES adaptativas: sobre un pico suben desde justo
  // encima del punto; en valle/ladera bajan desde justo debajo — nunca tapan el
  // punto ni cruzan la línea. Halo blanco (CSS) para leerse sobre el área.
  const renderEtiquetaCajas = (props: any) => {
    const { x, y, value, index } = props;
    const valor = Number(value);
    if (!valor || valor <= 0) return null;
    const prev = index > 0 ? (dataCajas[index - 1]?.cajas ?? null) : null;
    const next = index < dataCajas.length - 1 ? (dataCajas[index + 1]?.cajas ?? null) : null;
    const esPico = (prev === null || valor >= prev) && (next === null || valor >= next);
    const cx = Number(x) + 4; // la baseline queda en cx; los glifos se centran sobre el punto
    const cy = Number(y);
    const OFFSET = 8;
    return esPico ? (
      <text x={cx} y={cy - OFFSET} transform={`rotate(-90 ${cx} ${cy - OFFSET})`} textAnchor="start" className="DC-etiquetaCajas">
        {formatearEnteroCorto(valor)}
      </text>
    ) : (
      <text x={cx} y={cy + OFFSET} transform={`rotate(-90 ${cx} ${cy + OFFSET})`} textAnchor="end" className="DC-etiquetaCajas">
        {formatearEnteroCorto(valor)}
      </text>
    );
  };

  const formatoEje = (val: string) => {
    try {
      if (vistaCajas === 'diaria') return format(parseISO(val), 'd MMM', { locale: es });
      return format(parseISO(val + '-01'), 'MMM yy', { locale: es });
    } catch { return val; }
  };

  // Banda inferior del eje diario (mes + año) dibujada como celdas con bordes,
  // estilo tabla dinámica de Excel: cada mes encierra a sus días y el año
  // agrupa a sus meses. Recharts inyecta a Customized el `offset` (espacio
  // reservado alrededor del plot) y el `xAxisMap` (escalas). El borde inferior
  // del plot está en svgHeight - offset.bottom; de ahí hacia abajo: fila de
  // días (XAxis) y las bandas de mes/año de este componente.
  const renderBandaMeses = (props: any) => {
    if (!ejeDiario) return null;
    const escala = props?.xAxisMap?.[0]?.scale;
    const offset = props?.offset;
    if (!escala || !offset) return null;
    const x = (ts: number) => escala(ts);
    const ALTO_MES = 20;
    const ALTO_ANIO = 18;
    // Fin del eje de días (svgHeight - margen inferior) → ahí arrancan las bandas.
    const yTop = props.height - (props.margin?.bottom ?? 0);
    const BORDE = '#94a3b8';
    const TEXTO_MES = '#334155';
    const TEXTO_ANIO = '#64748b';
    const FONDO = '#f1f5f9';
    return (
      <g className="DC-bandaMeses">
        {/* Banda de meses: una celda por mes */}
        {ejeDiario.celdasMes.map((c, i) => {
          // La celda cubre hasta la mitad del hueco que la separa del siguiente
          // mes (o hasta su último día si es la última): encierra a SUS días.
          const esUltima = i === ejeDiario.celdasMes.length - 1;
          const x0 = x(c.inicio);
          const x1 = esUltima ? x(c.fin) : (x(c.fin) + x(ejeDiario.celdasMes[i + 1].inicio)) / 2;
          return (
            <g key={c.clave}>
              <rect
                x={x0}
                y={yTop}
                width={Math.max(x1 - x0, 0)}
                height={ALTO_MES}
                fill={FONDO}
                stroke={BORDE}
                strokeWidth={1}
              />
              <text
                x={(x0 + x1) / 2}
                y={yTop + ALTO_MES / 2}
                dominantBaseline="central"
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={TEXTO_MES}
              >
                {c.nombre}
              </text>
            </g>
          );
        })}
        {/* Banda de años: una celda por año, debajo de los meses */}
        {ejeDiario.celdasAnio.map(c => {
          const x0 = x(c.inicio);
          const x1 = x(c.fin);
          return (
            <g key={c.anio}>
              <rect
                x={x0}
                y={yTop + ALTO_MES + 1}
                width={Math.max(x1 - x0, 0)}
                height={ALTO_ANIO}
                fill="#ffffff"
                stroke={BORDE}
                strokeWidth={1}
              />
              <text
                x={(x0 + x1) / 2}
                y={yTop + ALTO_MES + 1 + ALTO_ANIO / 2}
                dominantBaseline="central"
                textAnchor="middle"
                fontSize={11}
                fill={TEXTO_ANIO}
              >
                {c.anio}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // Tooltip: cajas + vehículos del período.
  const tooltipCajas = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as SerieCajas;
    const fechaTxt = vistaCajas === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p><span className="IG-tooltipEtapa" style={{ background: COLOR_CAJAS }} />Cajas: <b>{formatearEntero(d.cajas)}</b></p>
        <p className="IG-tooltipSerieSub">Vehículos: {formatearEntero(d.vehiculos)}</p>
      </div>
    );
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
                  <td>{formatearFecha(f.fecha)}</td>
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

  const cerrarSesion = () => {
    document.cookie.split(';').forEach(cookie => {
      const cn = cookie.split('=')[0].trim();
      if (cn.includes('usuario') || cn.includes('cliente') || cn.includes('perfil') || cn.includes('regional'))
        document.cookie = `${cn}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    router.push('/LoginUsuario');
  };

  if (!cliente) {
    return (
      <div className="DC-container">
        <main className="DC-main">
          <div className="DC-vacio">
            <p>Cliente no encontrado: <strong>{clienteId}</strong></p>
            <button className="DC-botonVolver" onClick={() => router.push('/indicadores/clientes')}>← Volver al panel de clientes</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="DC-container">
      {/* Header */}
      <header className="DC-header">
        <div className="DC-headerInner">
          <button className="DC-brand" onClick={() => router.push('/indicadores/clientes')} title="Panel de clientes">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="DC-brandName">Integr<span className="DC-brandAccent">App</span></span>
          </button>

          <div className="DC-logoCliente">
            <span className="DC-nombreCliente">{cliente.nombre}</span>
          </div>

          <div className="DC-userZone" ref={menuRef}>
            <button className="DC-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="DC-userIcon" />
              <div className="DC-userInfo">
                <span className="DC-userName">{datosUsuario?.usuario || 'Usuario'}</span>
                <span className="DC-userPerfil">
                  {datosUsuario?.perfil}{datosUsuario?.regional ? ` · ${datosUsuario.regional}` : ''}
                </span>
              </div>
              <FaChevronDown className={`DC-chevron ${menuAbierto ? 'DC-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="DC-dropdown">
                <button className="DC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/indicadores/clientes'); }}>
                  <FaChartBar /> Panel de clientes
                </button>
                <button className="DC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/indicadores'); }}>
                  <FaChartBar /> Menú de indicadores
                </button>
                <div className="DC-dropDivider" />
                <button className="DC-dropItem DC-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="DC-filtrosSection">
        <div className="DC-filtrosPanel">
          {/* Año */}
          <div className="DC-filtroGrupo" style={{ position: 'relative' }}>
            <label>Año:</label>
            <div className="DC-dropdownFiltro">
              <button className="DC-dropdownFiltroBtn" onClick={() => { setDropdownAnioAbierto(!dropdownAnioAbierto); setDropdownMesAbierto(false); }}>
                <span className="DC-dropdownFiltroTexto">
                  {aniosSeleccionados.length === 0
                    ? 'Todos'
                    : aniosSeleccionados.length === 1
                      ? String(aniosSeleccionados[0])
                      : `${aniosSeleccionados.length} años`}
                </span>
                <span className="DC-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownAnioAbierto && (
                <div className="DC-dropdownFiltroLista">
                  {aniosDisponibles.length === 0 ? (
                    <div className="DC-clienteOpcion">Cargando...</div>
                  ) : aniosDisponibles.map(a => (
                    <label key={a} className={`DC-dropdownFiltroItem ${aniosSeleccionados.includes(a) ? 'seleccionado' : ''}`}>
                      <input
                        type="checkbox"
                        checked={aniosSeleccionados.includes(a)}
                        onChange={() => {
                          setAniosSeleccionados(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a].sort());
                        }}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mes */}
          <div className="DC-filtroGrupo" style={{ position: 'relative' }}>
            <label>Mes:</label>
            <div className="DC-dropdownFiltro">
              <button className="DC-dropdownFiltroBtn" onClick={() => { setDropdownMesAbierto(!dropdownMesAbierto); setDropdownAnioAbierto(false); }}>
                <span className="DC-dropdownFiltroTexto">
                  {mesesSeleccionados.length === 0
                    ? 'Todos'
                    : mesesSeleccionados.length === 1
                      ? MESES.find(m => m.valor === mesesSeleccionados[0])?.nombre
                      : `${mesesSeleccionados.length} meses`}
                </span>
                <span className="DC-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownMesAbierto && (
                <div className="DC-dropdownFiltroLista">
                  <label className={`DC-dropdownFiltroItem ${mesesSeleccionados.length === 0 ? 'seleccionado' : ''}`}>
                    <input type="checkbox" checked={mesesSeleccionados.length === 0} onChange={() => setMesesSeleccionados([])} />
                    Todos
                  </label>
                  {MESES.map(m => (
                    <label key={m.valor} className={`DC-dropdownFiltroItem ${mesesSeleccionados.includes(m.valor) ? 'seleccionado' : ''}`}>
                      <input
                        type="checkbox"
                        checked={mesesSeleccionados.includes(m.valor)}
                        onChange={() => {
                          setMesesSeleccionados(prev => prev.includes(m.valor) ? prev.filter(x => x !== m.valor) : [...prev, m.valor].sort((a, b) => a - b));
                        }}
                      />
                      {m.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="DC-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); }}>
            Filtrar
          </button>
        </div>
      </div>

      {/* Contenido */}
      <main className="DC-main">
        {cargando ? (
          <>
            <SkeletonGrafico />
            <SkeletonGrafico bajo />
          </>
        ) : error ? (
          <div className="DC-error">
            <p>{error}</p>
            <button className="DC-reintentar" onClick={obtenerDatos}>Reintentar</button>
          </div>
        ) : (
          <>
            {/* Cantidad de cajas — misma lógica/look que el gráfico de cajas por
                etapa de Costo de Operación, pero acotado a este cliente y a la
                media milla (pedidos_completados). Toggle Mensual/Diario propio. */}
            <div className="IG-graficoContainer">
              {dataCajas.some(d => d.cajas > 0) ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        📦 Cantidad de cajas
                        <span className="IG-graficoBadge">{vistaCajas === 'diaria' ? 'Diario' : 'Mensual'}</span>
                        {diasSobreMedia && (
                          <span className="DC-badgeSobreMedia" title="Días con cajas por encima de la media del período visible">
                            {diasSobreMedia.pct}% días &gt; media ({diasSobreMedia.encima}/{diasSobreMedia.total})
                          </span>
                        )}
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vistaCajas === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCajas('mensual')}>Mensual</button>
                        <button className={`IG-toggleBtn ${vistaCajas === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCajas('diaria')}>Diario</button>
                      </div>
                    </div>
                  </div>
                  {/* <p className="IG-graficoSub">
                    <span style={{ color: COLOR_CAJAS }}>●</span> <b>Cajas despachadas</b> (media milla)
                  </p> */}
                  <div className={`DC-chartWrap ${primeraCarga ? 'DC-chartWrapPrimera' : ''}`} style={{ width: '100%', height: 420 }}>
                    <ResponsiveContainer width="100%" height={420}>
                      <ComposedChart data={dataCajas} margin={{ top: 20, right: 20, left: 20, bottom: 46 }}>
                        <defs>
                          {/* Gradiente del área: rojo por encima de la media, azul por debajo */}
                          <linearGradient id="gradCajasMedia" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                            <stop offset={`${(mediaDiaria?.corte ?? 0.5) * 100}%`} stopColor="#ef4444" stopOpacity={0.95} />
                            <stop offset={`${(mediaDiaria?.corte ?? 0.5) * 100}%`} stopColor="#3b82f6" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.95} />
                          </linearGradient>
                          {/* Neón: filtro glow reutilizable por la línea y el activeDot */}
                          <filter id="glowNeon" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="DC-gridArcade" />
                        {/* padding: el primer/último punto no quedan pegados al eje Y.
                            Ticks verticales: los meses/días ya no se solapan ni se
            ahorra el interval que saltaba etiquetas. */}
                        {/* Eje X jerárquico estilo Excel (vista diaria): días arriba,
                            mes centrado bajo sus días y año abajo. La vista mensual
                            conserva su eje de categorías original. */}
                        {ejeDiario ? (
                          <>
                            <XAxis
                              type="number"
                              dataKey="ts"
                              domain={ejeDiario.dominio}
                              ticks={ejeDiario.ticksDias}
                              tickFormatter={ejeDiario.formatoDia}
                              interval={0}
                              height={24}
                              tick={{ fontSize: 11 }}
                              axisLine={{ stroke: '#94a3b8' }}
                              tickLine={false}
                              padding={{ left: 30, right: 30 }}
                              allowDecimals={false}
                            />
                            {/* Bandas de mes/año con bordes de celda (estilo tabla
                                dinámica de Excel) bajo la fila de días */}
                            <Customized component={renderBandaMeses} />
                          </>
                        ) : (
                          <XAxis
                            dataKey="periodo"
                            tickFormatter={formatoEje}
                            interval={0}
                            angle={-90}
                            textAnchor="end"
                            height={70}
                            tick={{ fontSize: 11 }}
                            padding={{ left: 30, right: 30 }}
                          />
                        )}
                        <YAxis tickFormatter={(v) => formatearEntero(v)} width={70} />
                        {/* Crosshair neón: la vertical glow sigue el mouse */}
                        <Tooltip content={tooltipCajas} cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4', className: 'DC-crosshairArcade' }} />
                        {/* Área entre la curva y la media — roja por encima, azul por debajo */}
                        {vistaCajas === 'diaria' && mediaDiaria !== null && (
                          <Area
                            type="monotone"
                            dataKey="cajas"
                            stroke="none"
                            fill="url(#gradCajasMedia)"
                            baseValue={mediaDiaria.media}
                            isAnimationActive={false}
                            name="Cajas"
                            legendType="none"
                          />
                        )}
                        {/* Media de los días visibles — solo en vista diaria */}
                        {vistaCajas === 'diaria' && mediaDiaria !== null && (
                          <ReferenceLine
                            y={mediaDiaria.media}
                            stroke="#64748b"
                            strokeDasharray="6 4"
                            strokeWidth={1.5}
                            label={{
                              value: `Media: ${formatearEntero(Math.round(mediaDiaria.media))}`,
                              position: 'insideTopRight',
                              fill: '#64748b',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="cajas"
                          stroke={COLOR_CAJAS}
                          strokeWidth={2.5}
                          name="Cajas"
                          dot={{ r: 3, fill: '#fff', stroke: COLOR_CAJAS, strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: COLOR_CAJAS, stroke: '#fff', strokeWidth: 2, filter: 'url(#glowNeon)', className: 'DC-activeDotArcade' }}
                          /* El trazo se anima SOLO la primera vez. Después de eso
                             NO se desactiva la animación (el flip de la prop
                             remueve el path y produce un salto brusco a mitad
                             del trazo): se deja activa con duración ~0, así los
                             "Filtrar" posteriores aparecen directos. */
                          isAnimationActive
                          animationDuration={primeraCarga ? 1600 : 1}
                          animationEasing="ease-out"
                          filter="url(#glowNeon)"
                          onAnimationEnd={() => setPrimeraCarga(false)}
                        >
                          {/* Etiquetas verticales adaptativas (pico→arriba, valle→abajo).
                              Sin animación propia: la Line anima y estas la siguen. */}
                          <LabelList dataKey="cajas" content={renderEtiquetaCajas} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de cajas para el período seleccionado</p></div>
              )}
            </div>

            {/* 🎯 On Time por período — mismo chrome/toggle que el gráfico de
                cajas. Carga junto con la data (mismo fetch del informe de
                guías); mientras consulta muestra su skeleton. Barras apiladas:
                verdes cumplieron (ot=1), rojas no cumplieron (ot=0), grises
                pendientes (sin entrega aún). */}
            {cargandoGuias ? (
              <SkeletonGrafico bajo />
            ) : (
              <div className="IG-graficoContainer">
                {dataOT.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader">
                      <div className="IG-graficoTituloWrap">
                        <h2 className="IG-graficoTitulo">
                          🎯 On Time por período
                          <span className="IG-graficoBadge">{vistaOT === 'diaria' ? 'Diario' : 'Mensual'}</span>
                          <span className="IG-graficoBadge DC-badgeRango">{rangoFiltros}</span>
                          {resumenGuias?.ot_pct != null && (
                            <span className="DC-badgeSobreMedia" title="Guías entregadas dentro de la fecha promesa (total del período filtrado)">
                              {resumenGuias.ot_pct}% OT total
                            </span>
                          )}
                        </h2>
                      </div>
                      <div className="IG-graficoAcciones">
                        <div className="IG-toggleGrupo" role="group" aria-label="Vista On Time">
                          <button className={`IG-toggleBtn ${vistaOT === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaOT('mensual')}>Mensual</button>
                          <button className={`IG-toggleBtn ${vistaOT === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaOT('diaria')}>Diario</button>
                        </div>
                      </div>
                    </div>
                    <p className="IG-graficoSub">
                      <span style={{ color: '#15803d' }}>●</span> <b>Cumplieron</b> (entrega ≤ fecha promesa) &nbsp;&nbsp;
                      <span style={{ color: '#b91c1c' }}>●</span> <b>No cumplieron</b> (entrega tarde) &nbsp;&nbsp;
                      <span style={{ color: '#94a3b8' }}>●</span> <b>Pendientes</b> (sin fecha de entrega aún)
                    </p>
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={dataOT} margin={{ top: 24, right: 20, left: 20, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="periodo"
                            tickFormatter={(v: string) => {
                              try {
                                return vistaOT === 'diaria'
                                  ? format(parseISO(v), 'd MMM', { locale: es })
                                  : format(parseISO(v + '-01'), 'MMM yy', { locale: es });
                              } catch { return v; }
                            }}
                            tick={{ fontSize: 11 }}
                            angle={vistaOT === 'diaria' ? -90 : 0}
                            textAnchor={vistaOT === 'diaria' ? 'end' : 'middle'}
                            height={vistaOT === 'diaria' ? 60 : 30}
                          />
                          <YAxis tickFormatter={(v: number) => formatearEntero(v)} width={60} allowDecimals={false} />
                          <Tooltip content={tooltipOT} cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }} />
                          <Bar dataKey="cumplieron" name="Cumplieron" stackId="ot" fill="#15803d" isAnimationActive={false} />
                          <Bar dataKey="noCumplieron" name="No cumplieron" stackId="ot" fill="#b91c1c" isAnimationActive={false} />
                          <Bar dataKey="pendientes" name="Pendientes" stackId="ot" fill="#94a3b8" isAnimationActive={false}>
                            <LabelList
                              dataKey="total"
                              position="top"
                              offset={10}
                              formatter={(v: number) => (v > 0 ? `${v}` : '')}
                              style={{ fill: '#0f1928', fontSize: 10, fontWeight: 700 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="IG-sinDatos">
                    <p>No hay guías evaluables On Time para el período seleccionado</p>
                  </div>
                )}
              </div>
            )}

            {/* 🚛 Uso de vehículos solicitados — drill-down: promedio % de uso
                por tipo solicitado → evolución por período → destino → tabla
                casi a nivel de consecutivo. % de uso = kg reales / tope de la
                categoría del tipo solicitado (TRACTOMULA: 34.000 kg de
                referencia). Todo se agrupa en el frontend con las filas de
                /uso-vehiculos (una por consecutivo_vehiculo). */}
            {cargandoUso ? (
              <SkeletonGrafico bajo />
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
                    🔎 Pedido Vulcano <strong>{trazaUsoActiva}</strong> — buscando en todo el histórico (los filtros de Año/Mes no aplican ahora). El pedido encontrado queda resaltado.
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
                      ? `Ningún vehículo de este cliente lleva el pedido Vulcano "${trazaUsoActiva}"`
                      : 'No hay vehículos para el período seleccionado'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Informe de guías TMS — colapsable. planilla_siscore (Mongo, media
                milla) == guia (PostgreSQL informe_guias_tms); puede traer varias
                guías por coma → una fila por guía. Fetch perezoso al abrir. */}
            <section className="DC-guiaSeccion">
              {/* Trazabilidad: guía o consecutivo → el backend busca en TODO el
                  histórico (ignora año/mes) y muestra el vehículo con sus guías. */}
              <div className="DC-trazaBarra">
                <input
                  className="DC-trazaInput"
                  type="text"
                  placeholder="Trazabilidad: número de guía o consecutivo del vehículo…"
                  value={inputTraza}
                  onChange={e => setInputTraza(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && aplicarTraza()}
                  disabled={cargandoGuias}
                />
                <button className="DC-trazaBtn" onClick={aplicarTraza} disabled={cargandoGuias}>Buscar</button>
                {trazaActiva && (
                  <button className="DC-trazaBtn DC-trazaBtnLimpiar" onClick={limpiarTraza} title="Quitar filtro de trazabilidad">
                    ✕ Limpiar
                  </button>
                )}
              </div>
              {trazaActiva && (
                <p className="DC-trazaInfo">
                  🔎 Trazabilidad por <strong>{trazaActiva}</strong> — buscando en todo el histórico (los filtros de Año/Mes no aplican ahora).
                </p>
              )}
              <button className="DC-guiaToggle" onClick={alternarInforme} aria-expanded={informeAbierto}>
                <h2 className="DC-guiaTitulo">🚚 Informe de guías TMS</h2>
                {resumenGuias && !cargandoGuias && (
                  <div className="DC-guiaTiles">
                    <div className="DC-guiaTile">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.total_guias)}</span>
                      <span className="DC-guiaTileLabel">Guías</span>
                    </div>
                    <div className="DC-guiaTile">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.total_vehiculos)}</span>
                      <span className="DC-guiaTileLabel">Vehículos</span>
                    </div>
                    <div className="DC-guiaTile DC-guiaTileExito">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.entregadas)}</span>
                      <span className="DC-guiaTileLabel">Entregadas</span>
                    </div>
                    <div
                      className="DC-guiaTile DC-guiaTileOT"
                      title={`On Time: ${resumenGuias.ot_cumplen}/${resumenGuias.ot_cumplen + resumenGuias.ot_no_cumplen} guías entregadas dentro de la fecha promesa (días hábiles, sin sáb/dom/festivos)`}
                    >
                      <span className="DC-guiaTileValor">
                        {resumenGuias.ot_pct != null ? `${resumenGuias.ot_pct}%` : '—'}
                      </span>
                      <span className="DC-guiaTileLabel">On Time</span>
                    </div>
                    <div className="DC-guiaTile DC-guiaTileProceso">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.en_proceso)}</span>
                      <span className="DC-guiaTileLabel">En proceso</span>
                    </div>
                    <div className="DC-guiaTile DC-guiaTileMuta">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.sin_info)}</span>
                      <span className="DC-guiaTileLabel">Sin info</span>
                    </div>
                  </div>
                )}
                <FaChevronDown className={`DC-chevron DC-guiaChevron ${informeAbierto ? 'DC-chevronOpen' : ''}`} />
              </button>

              {informeAbierto && (
                <div className="DC-guiaCuerpo">
                  {cargandoGuias ? (
                    <div className="DC-skelTabla">
                      {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="DC-skelFila">
                          <div className="DC-skel DC-skelCelda" />
                          <div className="DC-skel DC-skelCelda" />
                          <div className="DC-skel DC-skelCelda" />
                          <div className="DC-skel DC-skelCelda" />
                        </div>
                      ))}
                    </div>
                  ) : errorGuias ? (
                    <div className="IG-sinDatos">
                      <p>{errorGuias}</p>
                      <button className="DC-reintentar" onClick={obtenerInformeGuias}>Reintentar</button>
                    </div>
                  ) : filasGuias.length === 0 ? (
                    <div className="IG-sinDatos"><p>No hay guías para el período seleccionado</p></div>
                  ) : (
                    <>
                      {advertenciaGuias && <p className="DC-guiaAdvertencia">⚠ {advertenciaGuias}</p>}
                      {resumenGuias?.truncada && (
                        <p className="DC-guiaAdvertencia">Mostrando las {formatearEntero(filasGuias.length)} guías más recientes (límite alcanzado).</p>
                      )}
                      <div className="DC-guiaTablaWrapper">
                        <table className="IG-tabla">
                          <thead>
                            <tr>
                              <th>Guía</th>
                              <th>Vehículo</th>
                              <th>Destino</th>
                              <th>Destinatario</th>
                              <th>Fecha</th>
                              <th>Cajas</th>
                              <th>Estado</th>
                              <th>F. Emisión</th>
                              <th>F. Entrega</th>
                              <th title="Fecha límite: la de CITA si es válida; si no, inicial + promesa del destino (días hábiles)">F. Promesa</th>
                              <th title="Días hábiles transcurridos (sin sáb/dom/festivos)">Días háb.</th>
                              <th title="1 = entregada dentro de la fecha promesa; 0 = tarde; — = no evaluable">OT</th>
                              <th>F. Digitalización</th>
                              <th>F. Cita</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filasGuias.map(f => (
                              <tr key={f.guia}>
                                <td className="DC-guiaCeldaNum">{f.guia}</td>
                                <td className="DC-guiaCeldaVeh">{f.consecutivo_vehiculo}</td>
                                <td className="DC-guiaCeldaDest">{f.destino || '—'}</td>
                                <td className="DC-guiaCeldaDest">{f.destinatario ?? '—'}</td>
                                <td>{formatearFecha(f.fecha_creacion)}</td>
                                <td className="DC-guiaCeldaNum">{formatearEntero(f.cajas_vehiculo)}</td>
                                <td>{f.estado ? <span className={`DC-guiaChip ${claseChipEstado(f.estado)}`}>{f.estado}</span> : '—'}</td>
                                <td>{formatearFecha(f.fecha_emision)}</td>
                                <td>{formatearFecha(f.fecha_entrega)}</td>
                                <td>
                                  {f.fecha_promesa
                                    ? <span title={f.origen_promesa === 'CITA' ? 'Promesa: fecha de cita' : 'Promesa: inicial + días del destino (hábiles)'}>
                                        {formatearFecha(f.fecha_promesa)}
                                        {f.origen_promesa === 'CITA' && <span className="DC-guiaOrigPromesa DC-guiaOrigPromesaCita"> cita</span>}
                                      </span>
                                    : '—'}
                                </td>
                                <td className="DC-guiaCeldaNum">{f.dias_habiles ?? '—'}</td>
                                <td>
                                  {f.ot === null
                                    ? '—'
                                    : <span className={`DC-guiaChip ${f.ot === 1 ? 'DC-guiaChipOTSi' : 'DC-guiaChipOTNo'}`}>{f.ot === 1 ? '✓ 1' : '✗ 0'}</span>}
                                </td>
                                <td>{formatearFecha(f.fecha_digitalizacion)}</td>
                                <td>{formatearFecha(f.fecha_cita)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="DC-guiaAcciones">
                        <button className="DC-guiaBotonExportar" onClick={exportarGuiasExcel}>⬇ Exportar Excel</button>
                        {puedeCargarCitas && (
                          <label className="DC-guiaBotonCargar" title="Carga fechas de cita (GUIA + FECHA_CITA) que reemplazan las del TMS para el cálculo On Time">
                            <FaUpload /> {cargandoCitas ? 'Cargando…' : '⬆ Cargar Citas'}
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handleCargarCitas}
                              disabled={cargandoCitas}
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="DC-footer">
        <p>© {new Date().getFullYear()} Integra — Indicadores por cliente</p>
      </footer>
    </div>
  );
};

export default DashboardCliente;
