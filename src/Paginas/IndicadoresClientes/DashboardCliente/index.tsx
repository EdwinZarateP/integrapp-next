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

/** Skeleton del tacómetro del portal: título + subtítulo + dial shimmer
 * (semicírculo grande que anticipa el velocímetro). */
const SkeletonTacometro: React.FC = () => (
  <div className="DC-skelCard">
    <div className="DC-skel DC-skelTitulo" />
    <div className="DC-skel DC-skelSub" />
    <div className="DC-skel DC-skelDial" />
  </div>
);

/** Buscador de destinatarios con estado PROPIO: cada tecla re-renderiza
 * solo este componente (antes escribía en el estado del dashboard y cada
 * letra re-renderizaba TODOS los gráficos — se sentía lento). Avisa al padre
 * ya debounced (350 ms) con el texto estable. */
const InputDestinatario: React.FC<{ onEstable: (v: string) => void }> = ({ onEstable }) => {
  const [texto, setTexto] = useState('');
  const onEstableRef = useRef(onEstable);
  onEstableRef.current = onEstable;
  useEffect(() => {
    const t = setTimeout(() => onEstableRef.current(texto), 350);
    return () => clearTimeout(t);
  }, [texto]);
  return (
    <div className="DC-destBuscar">
      <span aria-hidden="true">🔎</span>
      <input
        type="text"
        placeholder="Buscar destinatario (mín. 5 letras)"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        autoFocus
      />
      {texto && (
        <button type="button" className="DC-destBuscarX" onClick={() => setTexto('')} title="Limpiar búsqueda">✕</button>
      )}
    </div>
  );
};

type SerieCajas = { periodo: string; cajas: number; vehiculos: number };

type ApiResponse = {
  success: boolean;
  data?: { cliente: string; mensual: SerieCajas[]; diario: SerieCajas[]; anios: number[] };
  error?: string;
};

// Informe de guías TMS (PostgreSQL puro desde 2026-10-29: todo sale de
// informe_guias_tms — sin Mongo, sin consecutivo de vehículo ni cajas).
type FilaGuia = {
  guia: string;
  planilla: string | null;      // n° de planilla del TMS (null si '0'/vacía)
  ciudad_destino: string | null;
  destinatario: string | null;
  servicio: string | null;
  piezas: number | null;
  kilos: number | null;
  estado: string | null;        // canónico; null si el TMS trajo basura
  estado_crudo: string | null;  // valor original del TMS (diagnóstico/export)
  // (2026-10-30) Novedad del TMS (columna `novedad` de informe_guias_tms):
  // texto crudo del evento («ENTREGA DIGITALIZADA», «REHUSADO»…). Distinta de
  // la novedad JUSTIFICADA (novedades_ot) — viaja aparte para el Excel.
  novedad_tms?: string | null;
  fecha_emision: string | null;
  fecha_entrega: string | null;
  fecha_digitalizacion: string | null;
  // TEXT crudo del TMS ('D/M/YYYY' cuando la operación digita; basura histórica
  // también) — el backend la parsea para el OT pero viaja tal cual.
  fecha_cita: string | null;
  // On Time: emisión vs fecha promesa (CITA si es servible, si no emisión +
  // promesa_entrega_dias hábiles del destino en Tarifas). ot=1/0/null.
  fecha_promesa: string | null;
  origen_promesa: 'CITA' | 'PROMESA' | null;
  dias_habiles: number | null;
  ot: number | null;
  // (2026-10-29) Novedad justificada (gestión en /NovedadesOT): si existe, la
  // guía cuenta en el segmento «Cumplieron con novedad» y suma al % OT como
  // cumplida (numerador y denominador).
  novedad?: {
    causal: string;
    justificacion: string;
    usuario?: string;
    nombre?: string;
    fecha?: string;
  } | null;
};

type ResumenGuias = {
  total_guias: number;
  total_planillas: number;
  entregadas: number;
  en_proceso: number;
  sin_info: number; // estados basura del TMS (no reconocidos)
  por_estado: Record<string, number>;
  ot_cumplen: number;
  ot_no_cumplen: number;
  ot_justificadas: number;
  ot_no_evaluables: number;
  ot_pct: number | null;
};

type PaginacionGuias = { pagina: number; limite: number; total: number; hay_mas: boolean };

// Bucket del gráfico OT — lo agrega el BACKEND (misma pasada que la tabla).
// Bucket = FECHA DE EMISIÓN; segmentos = división real de estados del TMS
// (ENTREGADO partido en cumplieron/no cumplieron + estados en curso).
type BucketOT = {
  periodo: string;
  cumplieron: number;
  noCumplieron: number;
  justificadas: number;
  con_novedad: number;
  en_distribucion: number;
  transito: number;
  pendiente: number;
  sin_info: number;
  evaluables: number;
  total: number;
};

// (2026-10-30) ¿Viewport móvil? — para elegir el render adaptado de los
// gráficos OT-por-campo (lista táctil en móvil, recharts en escritorio).
const useEsMovil = () => {
  const [es, setEs] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const fn = () => setEs(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return es;
};

// Definición única de los segmentos del gráfico OT (orden de la pila, color,
// etiqueta y explicación para title/tooltip) — barras, leyenda y tooltip.
const SEGMENTOS_OT: { clave: keyof BucketOT; color: string; etiqueta: string; explica: string }[] = [
  { clave: 'cumplieron', color: '#15803d', etiqueta: 'Cumplieron', explica: 'ENTREGADO en fecha ≤ fecha promesa (días hábiles)' },
  { clave: 'noCumplieron', color: '#b91c1c', etiqueta: 'No cumplieron', explica: 'ENTREGADO después de la fecha promesa' },
  { clave: 'justificadas', color: '#4a3aa7', etiqueta: 'Cumplieron con novedad', explica: 'Con novedad justificada (causal + justificación cargados en Novedades OT): cuentan como cumplidas en el % OT' },
  { clave: 'en_distribucion', color: '#eda100', etiqueta: 'En distribución', explica: 'Estado TMS: En distribucion' },
  { clave: 'transito', color: '#2a78d6', etiqueta: 'Tránsito Nacional', explica: 'Estado TMS: Transito Nacional' },
  { clave: 'pendiente', color: '#94a3b8', etiqueta: 'Pendiente', explica: 'Estado TMS: PENDIENTE' },
  { clave: 'con_novedad', color: '#eb6834', etiqueta: 'Con novedad', explica: 'Entrega con novedad reportada (el bot sigue actualizándola)' },
  { clave: 'sin_info', color: '#cbd5e1', etiqueta: 'Sin info', explica: 'Sin estado servible del TMS, o ENTREGADO sin fecha de entrega (no evaluable)' },
];

// (2026-10-30) OT agregado por un campo PG (ciudad_destino / destinatario)
// para las barras horizontales del portal de clientes — mismos conteos del
// % OT (justificadas cuentan como cumplidas).
type OTPorCampo = {
  clave: string;
  cumplieron: number;
  no_cumplieron: number;
  justificadas: number;
  evaluables: number;
  total: number;
  pct: number;
};

type InformeGuiasResponse = {
  success: boolean;
  data?: {
    cliente: string;
    grupos?: string[];
    filas: FilaGuia[];
    resumen: ResumenGuias;
    serie_mensual?: BucketOT[];
    serie_diaria?: BucketOT[];
    ot_por_ciudad?: OTPorCampo[];
    ot_por_destinatario?: OTPorCampo[];
    paginacion?: PaginacionGuias;
    advertencia?: string | null;
  };
  error?: string;
};

type FilasGuiasResponse = {
  success: boolean;
  data?: { cliente: string; filas: FilaGuia[]; paginacion: PaginacionGuias };
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
 *
 * `modoExterno` (2026-10-29): portal «Mis Indicadores» para clientes externos
 * (perfil CLIENTE). Reduce el dashboard a «🎯 On Time por período» + «🚚 Informe
 * de guías TMS»: sin cajas, sin uso de vehículos, sin «⬆ Cargar Citas». El
 * fetch de guías viaja con ?usuario= para que el backend valide la asignación.
 */
const DashboardCliente: React.FC<{ clienteId: string; modoExterno?: boolean }> = ({ clienteId, modoExterno = false }) => {
  // (2026-10-29) Transición del OT al cambiar de vista (Mensual↔Diario, zoom de
  // mes): el wrapper del gráfico se re-monta con key → fade + slide corto del
  // contenedor (ejes y etiquetas no "saltan") mientras las barras crecen con el
  // easing de recharts. prefers-reduced-motion: sin animación.
  const REDUCE_MOTION = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ANIM_BARRAS = { isAnimationActive: !REDUCE_MOTION, animationDuration: 650, animationEasing: 'ease-out' as const };

  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const cliente = obtenerCliente(clienteId);
  // Portal de regreso: externos vuelven a «Mis Indicadores», internos al panel.
  const rutaPanel = modoExterno ? '/indicadores/mis-clientes' : '/indicadores/clientes';

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
  const [exportandoOT, setExportandoOT] = useState(false);
  const [errorGuias, setErrorGuias] = useState<string | null>(null);
  const [advertenciaGuias, setAdvertenciaGuias] = useState<string | null>(null);
  // Series OT del BACKEND (agregación en el servidor; antes se agrupaban en el
  // navegador con TODAS las filas del período).
  const [serieOTMensual, setSerieOTMensual] = useState<BucketOT[]>([]);
  const [serieOTDiaria, setSerieOTDiaria] = useState<BucketOT[]>([]);
  // (2026-10-30) OT por ciudad destino / destinatario (barras horizontales
  // del portal de clientes) — llegan en el mismo fetch de /guias.
  const [otPorCiudad, setOtPorCiudad] = useState<OTPorCampo[]>([]);
  const [otPorDestinatario, setOtPorDestinatario] = useState<OTPorCampo[]>([]);
  // Fila expandida de la lista móvil de OT-por-campo (`<idCampo>|<clave>`).
  const [filaCampoAbierta, setFilaCampoAbierta] = useState<string | null>(null);
  const esMovil = useEsMovil();

  // (2026-10-30) Pestañas del portal de clientes: «Gerenciales» (todos los
  // gráficos) y «Operación» (consulta de guía en Siscore por SOAP — el
  // mismo servicio del bot de WhatsApp).
  const [pestanaPortal, setPestanaPortal] = useState<'gerenciales' | 'operacion'>('gerenciales');
  const [inputGuiaOp, setInputGuiaOp] = useState('');
  const [tlHayMas, setTlHayMas] = useState(false);
  const tlRef = useRef<HTMLDivElement | null>(null);
  const [consultandoGuiaOp, setConsultandoGuiaOp] = useState(false);
  const [errorGuiaOp, setErrorGuiaOp] = useState<string | null>(null);
  const [resultadoGuiaOp, setResultadoGuiaOp] = useState<any>(null);

  // Timeline de la trayectoria: SIEMPRE horizontal. Arranca posicionada en
  // el estado MÁS RECIENTE (final del recorrido; los movimientos vienen en
  // orden cronológico) y muestra la pista «Desliza…» solo cuando hay más
  // pasos que ancho visible (re-evaluado al cambiar de resultado o de tamaño).
  useEffect(() => {
    const el = tlRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    setTlHayMas(el.scrollWidth - el.clientWidth > 8);
  }, [resultadoGuiaOp, esMovil]);

  const consultarGuiaSiscore = async (guiaDirecta?: string) => {
    const g = (guiaDirecta ?? inputGuiaOp).trim();
    if (!g || consultandoGuiaOp) return;
    setConsultandoGuiaOp(true);
    setErrorGuiaOp(null);
    setResultadoGuiaOp(null);
    try {
      const params = new URLSearchParams({ guia: g });
      if (modoExterno) {
        const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2];
        if (u) params.set('usuario', u);
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/consulta-guia?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(j?.detail || 'No se pudo consultar la guía en este momento');
      setResultadoGuiaOp(j.data);
    } catch (err) {
      setErrorGuiaOp(err instanceof Error ? err.message : 'No se pudo consultar la guía en este momento');
    } finally {
      setConsultandoGuiaOp(false);
    }
  };
  // Paginación de la tabla (la 1ª página viaja en /guias; el resto en /filas).
  const [paginacionGuias, setPaginacionGuias] = useState<PaginacionGuias | null>(null);
  const [cargandoMasGuias, setCargandoMasGuias] = useState(false);
  // Trazabilidad: búsqueda por guía/planilla/destinatario (va al backend como
  // ?q= en /guias/filas y reemplaza el filtro de fechas SOLO en la tabla).
  const [inputTraza, setInputTraza] = useState('');
  const [trazaActiva, setTrazaActiva] = useState<string | null>(null);

  // Carga del Excel de citas (plan B del OT): solo ADMIN/ANALISTA/COORDINADOR/CONTROL.
  const puedeCargarCitas = !modoExterno && PERFILES_CARGA_CITAS.includes((datosUsuario?.perfil || '').toUpperCase());
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
  // Sub-grupo del informe de guías (p. ej. Fresenius Kabi vs FK Servicio
  // Técnico): etiquetas que llegan del backend en /guias (grupos); SOLO viaja
  // en las consultas de guías (cajas/uso son por NIT en Mongo, no aplica).
  const [gruposCliente, setGruposCliente] = useState<string[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string | null>(null);
  const [grupoAplicado, setGrupoAplicado] = useState<string | null>(null);
  const [dropdownGrupoAbierto, setDropdownGrupoAbierto] = useState(false);
  // Mostrar/ocultar la barra de filtros (SOLO móvil, CSS la controla): en
  // pantallas chicas arranca OCULTA para dar paso a los gráficos; el botón
  // «Filtros» la despliega. En escritorio el botón no existe y siempre se ve.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(
    () => (typeof window === 'undefined' ? true : window.innerWidth > 768)
  );

  // Zoom de día del OT (2026-10-30): 'YYYY-MM-DD' del día drill-down en la
  // vista diaria. Desde la v5 NO es solo visual: con `dia` el backend
  // recalcula todo el payload para ese día (ver obtenerInformeGuias).
  const [diaOT, setDiaOT] = useState<string | null>(null);

  // (2026-10-30) Filtro «Cliente final» (destinatario del TMS): autocomplete
  // desde la 5ª letra + multi-selección; se aplica con «Filtrar».
  const [destDropdownAbierto, setDestDropdownAbierto] = useState(false);
  const [busquedaDest, setBusquedaDest] = useState('');
  const [opcionesDest, setOpcionesDest] = useState<string[]>([]);
  const [cargandoDest, setCargandoDest] = useState(false);
  const [destSel, setDestSel] = useState<string[]>([]);       // borrador
  const [destAplicado, setDestAplicado] = useState<string[]>([]); // los que viajan

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

  // Params base del informe de guías: SOLO los del período (la trazabilidad
  // viaja aparte en /guias/filas) + el sub-grupo si hay uno aplicado. En
  // modoExterno va además ?usuario= (la cookie se lee directo: el estado
  // datosUsuario puede no estar resuelto en el fetch de la carga inicial).
  const construirParamsGuias = () => {
    const params = construirParams();
    if (grupoAplicado) params.set('grupo', grupoAplicado);
    destAplicado.forEach(d => params.append('destinatario', d));
    if (modoExterno) {
      const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2];
      if (u) params.set('usuario', u);
    }
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

  // Informe del PERÍODO: resumen + series OT (backend) + 1ª página de filas.
  const obtenerInformeGuias = async () => {
    setCargandoGuias(true);
    setErrorGuias(null);
    try {
      // (2026-10-30) Zoom de día: con `dia` el backend recalcula todo el
      // payload para las guías emitidas ese día (resumen, series y OT por
      // ciudad/destinatario) — así el portal entero sigue al día del zoom.
      const paramsGuias = construirParamsGuias();
      if (diaOT) paramsGuias.set('dia', diaOT);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/guias?${paramsGuias.toString()}`);
      if (!response.ok) throw new Error('Error al obtener el informe de guías');
      const data: InformeGuiasResponse = await response.json();
      if (data.success && data.data) {
        setGruposCliente(data.data.grupos || []);
        setFilasGuias(data.data.filas || []);
        setResumenGuias(data.data.resumen || null);
        setSerieOTMensual(data.data.serie_mensual || []);
        setSerieOTDiaria(data.data.serie_diaria || []);
        setOtPorCiudad(data.data.ot_por_ciudad || []);
        setOtPorDestinatario(data.data.ot_por_destinatario || []);
        setPaginacionGuias(data.data.paginacion || null);
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

  // Fetch de /guias/filas con params arbitrarios (trazabilidad, más páginas,
  // export completo). Devuelve las filas o lanza.
  const obtenerFilasGuias = async (extra: URLSearchParams): Promise<{ filas: FilaGuia[]; paginacion: PaginacionGuias }> => {
    const params = construirParamsGuias();
    extra.forEach((v, k) => params.set(k, v));
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/guias/filas?${params.toString()}`);
    if (!response.ok) throw new Error('Error al obtener las guías');
    const data: FilasGuiasResponse = await response.json();
    if (!data.success || !data.data) throw new Error(data.error || 'Error desconocido');
    return { filas: data.data.filas || [], paginacion: data.data.paginacion };
  };

  // «Cargar más»: página siguiente de la tabla, append al final.
  const cargarMasGuias = async () => {
    if (!paginacionGuias?.hay_mas || cargandoMasGuias) return;
    setCargandoMasGuias(true);
    try {
      const { filas, paginacion } = await obtenerFilasGuias(new URLSearchParams({
        pagina: String(paginacionGuias.pagina + 1),
        limite: String(paginacionGuias.limite),
      }));
      setFilasGuias(prev => [...prev, ...filas]);
      setPaginacionGuias(paginacion);
    } catch (err) {
      setErrorGuias(err instanceof Error ? err.message : 'Error al cargar más guías');
    } finally {
      setCargandoMasGuias(false);
    }
  };

  // Trazabilidad: SOLO la tabla (ILIKE guía/planilla/destinatario en todo el
  // histórico); el gráfico OT sigue mostrando el período filtrado.
  const buscarTrazaGuias = async (q: string) => {
    setCargandoGuias(true);
    setErrorGuias(null);
    try {
      const { filas, paginacion } = await obtenerFilasGuias(new URLSearchParams({ q }));
      setFilasGuias(filas);
      setPaginacionGuias(paginacion);
      setAdvertenciaGuias(null);
    } catch (err) {
      setErrorGuias(err instanceof Error ? err.message : 'Error en la trazabilidad');
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
      if (modoExterno) {
        // Portal externo: solo On Time + informe de guías — no se consultan
        // /cajas ni /uso-vehiculos. Sin /cajas no llegan los años del filtro:
        // se ofrecen el actual y el anterior (default = año actual).
        const anioActual = new Date().getFullYear();
        setAniosDisponibles([anioActual - 1, anioActual].filter(a => a >= 2025));
        setCargando(false);
      } else {
        obtenerDatos();
        // Con trazabilidad de uso activa, el "Filtrar" no la pisa (igual que
        // el informe de guías): la búsqueda viaja sola.
        if (!trazaUsoActiva) obtenerUsoVehiculos();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, clienteId]);

  // Al cambiar la trazabilidad del uso, re-consultar (el backend busca en
  // TODO el histórico: los filtros de Año/Mes no aplican a esa consulta).
  useEffect(() => {
    if (cliente && !modoExterno) obtenerUsoVehiculos(trazaUsoActiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trazaUsoActiva]);

  // Autocomplete de destinatarios: el texto ya llega DEBOUNCED desde
  // InputDestinatario (estado local — las teclas no re-renderizan el
  // dashboard); acá solo se consulta (>= 5 letras, ~4ms con la caché).
  useEffect(() => {
    if (!destDropdownAbierto) return;
    const q = busquedaDest.trim();
    if (q.length < 5) {
      setOpcionesDest([]);
      setCargandoDest(false);
      return;
    }
    let vigente = true;
    // «Buscando…» solo si la búsqueda tarda de verdad (>250ms): con la caché
    // en memoria la respuesta es de ms y el texto no debe parpadear.
    const tCargando = setTimeout(() => { if (vigente) setCargandoDest(true); }, 250);
    (async () => {
      try {
        const params = new URLSearchParams({ q });
        if (modoExterno) {
          const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2];
          if (u) params.set('usuario', u);
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/destinatarios?${params.toString()}`);
        const j = await res.json().catch(() => null);
        if (vigente) setOpcionesDest(j?.data?.destinatarios || []);
      } catch {
        if (vigente) setOpcionesDest([]);
      } finally {
        clearTimeout(tCargando);
        if (vigente) setCargandoDest(false);
      }
    })();
    return () => { vigente = false; clearTimeout(tCargando); };
  }, [busquedaDest, destDropdownAbierto, clienteId, modoExterno]);

  // El informe de guías viaja junto con /cajas desde la CARGA INICIAL (el
  // gráfico On Time lo necesita) — salvo cuando hay trazabilidad activa, que
  // es una consulta aparte del usuario. (2026-10-30) El ZOOM DE DÍA del
  // portal también re-consulta: con `dia` el backend recalcula TODO el
  // payload para ese día (resumen, series y OT por ciudad/destinatario).
  useEffect(() => {
    if (cliente && !trazaActiva) obtenerInformeGuias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, clienteId, diaOT, destAplicado]);

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

  // Al cambiar la trazabilidad, re-consultar SOLO la tabla (busca en TODO el
  // histórico; el gráfico OT y los tiles siguen siendo del período filtrado).
  // Al limpiar, se restaura el informe del período.
  useEffect(() => {
    if (!cliente) return;
    if (trazaActiva) buscarTrazaGuias(trazaActiva);
    else obtenerInformeGuias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trazaActiva]);

  const aplicarFiltros = () => {
    setGrupoAplicado(grupoSeleccionado);
    setDestAplicado(destSel);
    setFiltrosAplicados({ anios: aniosSeleccionados, meses: mesesSeleccionados });
  };

  // Quitar el filtro de cliente final (miga): limpia borrador y aplicado.
  const quitarDestMiga = () => {
    setDestSel([]);
    setDestAplicado([]);
  };

  // Quitar el grupo de las migas: sincroniza el dropdown y re-consulta (pisa
  // filtrosAplicados con un objeto NUEVO de los mismos valores para que el
  // useEffect del informe reaccione — el grupo NO viaja en filtrosAplicados).
  const quitarGrupoMiga = () => {
    setGrupoSeleccionado(null);
    setGrupoAplicado(null);
    setFiltrosAplicados(prev => ({ ...prev }));
  };

  // ── Breadcrumb de período (2026-10-30 rediseño UX) ──
  // La navegación reemplazó a las migas-chip de año/mes/día: la ruta
  // «Histórico › 2026 › Septiembre › 25 de septiembre» vuelve a cada nivel
  // (cada nivel anterior es clicable, el último es la ubicación actual).
  // Todos aplican DE INMEDIATO (sin pasar por «Filtrar») y sincronizan los
  // dropdowns; sin años/meses → todo el histórico (mismo contrato backend).
  const irAHistorico = () => {
    setAniosSeleccionados([]);
    setMesesSeleccionados([]);
    setFiltrosAplicados({ anios: [], meses: [] });
    setDiaOT(null);
    setVistaOT('mensual');
  };
  const irAlAnio = () => {
    setMesesSeleccionados([]);
    setFiltrosAplicados(prev => ({ ...prev, meses: [] }));
    setDiaOT(null);
    setVistaOT('mensual');
  };
  const irAlMes = () => {
    setDiaOT(null);
    setVistaOT('diaria');
  };

  // Etiquetas cortas de la ruta (multi-selección → «3 años» / «3 meses»).
  const lblAnios = filtrosAplicados.anios.length === 1
    ? String(filtrosAplicados.anios[0])
    : `${filtrosAplicados.anios.length} años`;
  const lblMeses = filtrosAplicados.meses.length === 1
    ? MESES.find(m => m.valor === filtrosAplicados.meses[0])?.nombre ?? 'Mes'
    : `${filtrosAplicados.meses.length} meses`;

  // Resumen discreto de los filtros aplicados (se ve en el toggle de filtros
  // contraído en móvil).
  const resumenFiltros = useMemo(() => {
    const p: string[] = [];
    if (filtrosAplicados.anios.length > 0) p.push(lblAnios);
    if (filtrosAplicados.meses.length > 0) p.push(lblMeses);
    if (grupoAplicado) p.push(grupoAplicado);
    if (trazaActiva) p.push('🔎 traza');
    return p.length ? p.join(' · ') : 'Sin filtros';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, grupoAplicado, trazaActiva, lblAnios, lblMeses]);

  // ── Serie OT por período ──
  // Desde 2026-10-29 los buckets los agrega el BACKEND sobre la pasada
  // completa del período (serie_mensual/serie_diaria del /guias) — antes se
  // agrupaban acá con TODAS las filas (cap 20k) en el navegador. Bucket =
  // fecha de ENTREGA (fallback emisión); % OT solo sobre evaluables.
  const [vistaOT, setVistaOT] = useState<'mensual' | 'diaria'>('mensual');

  const dataOT = useMemo(
    () => (vistaOT === 'mensual' ? serieOTMensual : serieOTDiaria),
    [vistaOT, serieOTDiaria, serieOTMensual]
  );

  // Bucket del día en zoom (si el filtro cambió y el día ya no existe, cae a
  // null y el gráfico vuelve solo a la vista diaria).
  const bucketDiaOT = useMemo(
    () => (diaOT ? serieOTDiaria.find(b => b.periodo === diaOT) ?? null : null),
    [diaOT, serieOTDiaria]
  );

  // Filtro de leyenda del OT (2026-10-30): los términos de la leyenda son
  // seleccionables — uno o varios — y el gráfico muestra SOLO esos segmentos
  // (barras, tooltip, etiqueta de total y zoom de día). Set vacío = todos.
  // Como el zoom de día, es puramente visual: persiste al cambiar Mensual ↔
  // Diario ↔ Día y NO viaja en ningún fetch (la base no cambia).
  const [segSelOT, setSegSelOT] = useState<Set<string>>(new Set());
  // Leyenda del OT plegable en MÓVIL (desktop siempre visible) — mismo patrón
  // que filtrosAbiertos.
  const [leyendaOTAbierta, setLeyendaOTAbierta] = useState(
    () => (typeof window === 'undefined' ? true : window.innerWidth > 768)
  );
  const alternarSegmentoOT = (clave: string) => {
    setSegSelOT(prev => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave); else s.add(clave);
      return s;
    });
  };
  const segActivosOT = useMemo(
    () => SEGMENTOS_OT.filter(s => segSelOT.size === 0 || segSelOT.has(s.clave as string)),
    [segSelOT]
  );
  // Datos con el total de la selección (para la etiqueta encima de la pila).
  const dataOTVis = useMemo(
    () =>
      dataOT.map(b => ({
        ...b,
        totalSel: segActivosOT.reduce((acc, s) => acc + (b[s.clave] as number), 0),
      })),
    [dataOT, segActivosOT]
  );

  // Filas del gráfico horizontal del día: un segmento >0 por barra (respeta
  // el filtro de leyenda).
  const segmentosDiaOT = useMemo(
    () =>
      bucketDiaOT
        ? SEGMENTOS_OT
            .filter(s => segSelOT.size === 0 || segSelOT.has(s.clave as string))
            .map(s => ({ etiqueta: s.etiqueta, color: s.color, cantidad: bucketDiaOT[s.clave] as number }))
            .filter(s => s.cantidad > 0)
        : [],
    [bucketDiaOT, segSelOT]
  );

  // Clic en una barra mensual del OT → APLICA el filtro real de ese mes (Año+Mes
  // quedan marcados en los dropdowns y viajan en el fetch — sin estado paralelo
  // de zoom) y pasa a la vista diaria, que llega ya acotada del backend.
  // Clic en una barra DIARIA → zoom de ese día: barras horizontales con sus
  // segmentos (sin fetch, todo sale de la serie diaria).
  const clicBarraOT = (estado: any) => {
    const periodo = String(estado?.activeLabel ?? '');
    if (vistaOT === 'mensual' && /^\d{4}-\d{2}$/.test(periodo)) {
      const [a, m] = periodo.split('-').map(Number);
      setAniosSeleccionados([a]);
      setMesesSeleccionados([m]);
      setFiltrosAplicados({ anios: [a], meses: [m] });
      setVistaOT('diaria');
      setDiaOT(null);
    } else if (vistaOT === 'diaria' && /^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
      setDiaOT(periodo);
    }
  };
  const alternarVistaOT = (v: 'mensual' | 'diaria') => {
    setVistaOT(v);
    setDiaOT(null);
  };

  // % OT por período para etiqueta y tooltip — evaluables + JUSTIFICADAS:
  // las justificadas cuentan como cumplidas (numerador y denominador).
  const pctOT = (d: { cumplieron: number; justificadas: number; evaluables: number }) => {
    const base = d.evaluables + d.justificadas;
    // 1 decimal (2026-10-30: antes redondeaba a entero y el gráfico de meta
    // mostraba "79,0" — un decimal falso sobre un entero).
    return base > 0 ? Math.round(((d.cumplieron + d.justificadas) / base) * 1000) / 10 : null;
  };

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

  // Tooltip del gráfico OT: período, cada estado con su conteo (solo >0 para
  // no llenar de ceros; solo los segmentos del filtro de leyenda) y el pie con
  // evaluables / % OT / total — con leyenda filtrada: Selección de Total y el
  // % OT recalculado sobre los segmentos OT seleccionados.
  // ── (2026-10-30) Portal de clientes: gauge del OT + barras por campo ──
  // Color del % OT por umbral (gauge y barras): ≥90 verde, ≥75 ámbar, <75 rojo.
  const colorOT = (pct: number) => (pct >= 90 ? '#15803d' : pct >= 75 ? '#eda100' : '#b91c1c');

  // % del gauge: el del DÍA en zoom si hay, si no el del período filtrado
  // (resumen.ot_pct — justificadas cuentan como cumplidas).
  const gaugeOT = useMemo(() => {
    if (diaOT && bucketDiaOT) {
      // 1 decimal (mismo formato del resumen): redondeo a décimas, no enteros.
      const b = bucketDiaOT;
      const base = b.evaluables + b.justificadas;
      const pct = base > 0 ? Math.round(((b.cumplieron + b.justificadas) / base) * 1000) / 10 : null;
      return {
        pct,
        cumplidas: pct != null ? bucketDiaOT.cumplieron + bucketDiaOT.justificadas : null,
        evaluables: bucketDiaOT.evaluables + bucketDiaOT.justificadas,
        alcance: format(parseISO(diaOT), "d 'de' MMMM yyyy", { locale: es }),
      };
    }
    return {
      pct: resumenGuias?.ot_pct ?? null,
      cumplidas: resumenGuias ? resumenGuias.ot_cumplen + resumenGuias.ot_justificadas : null,
      evaluables: resumenGuias ? resumenGuias.ot_cumplen + resumenGuias.ot_no_cumplen + resumenGuias.ot_justificadas : null,
      alcance: rangoFiltros,
    };
  }, [diaOT, bucketDiaOT, resumenGuias, rangoFiltros]);

  // (2026-10-30) Gráfico «On Time vs meta»: barra por período con el %
  // de cumplimiento (misma fórmula del tacómetro), ReferenceLine punteada
  // en la META 96% y barras ROJAS por debajo de ella (verdes al alcanzarla).
  // Comparte vista Mensual/Diario y serie con el gráfico OT principal.
  const META_OT = 96;
  const dataOTMeta = useMemo(
    () => dataOT.map(b => ({
      periodo: b.periodo,
      pct: pctOT(b),
      cumplidas: b.cumplieron + b.justificadas,
      evaluables: b.evaluables + b.justificadas,
    })),
    [dataOT]
  );
  // (2026-10-30) Ancho mínimo de los gráficos OT en MÓVIL: cada barra necesita
  // su espacio (mensual ~72px para la etiqueta del mes, diario ~26px) — si no
  // caben en el viewport, el contenedor (.DC-scrollOT) hace scroll horizontal
  // en vez de amontonarlas. En escritorio no aplica (undefined → ancho normal).
  const anchoMinOT = (nBarras: number): number | undefined => {
    if (!esMovil) return undefined;
    const porBarra = vistaOT === 'diaria' ? 26 : 72;
    return Math.min(Math.max(nBarras * porBarra, 320), 6000);
  };
  // (2026-10-30) Etiqueta % DIAGONAL dentro de cada barra del «On Time vs
  // meta»: rotada -45° (de izquierda a derecha, de abajo hacia arriba),
  // centrada en la barra, blanca — se lee sobre el rojo/verde de la barra y
  // sobre el fondo oscuro de la tarjeta si sobresale. Barra muy baja (<40px)
  // → no se pinta (queda el tooltip).
  const etiquetaVerticalMeta = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value == null || height < 40) return null;
    const cx = Number(x) + Number(width) / 2;
    const cy = Number(y) + Number(height) / 2;
    return (
      <text
        x={cx}
        y={cy}
        transform={`rotate(-45 ${cx} ${cy})`}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={13}
        fontWeight={700}
      >
        {`${Number(value).toFixed(1).replace('.', ',')}%`}
      </text>
    );
  };
  const tooltipOTMeta = (props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as { periodo: string; pct: number | null; cumplidas: number; evaluables: number };
    const fechaTxt = vistaOT === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    const delta = d.pct != null ? d.pct - META_OT : null;
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt} <span style={{ color: '#8aa0b8' }}>(emisión)</span></p>
        {d.pct != null && (
          <p><b>{d.pct.toFixed(1).replace('.', ',')}%</b> OT · {delta != null ? (delta >= 0 ? `+${delta.toFixed(1).replace('.', ',')}` : delta.toFixed(1).replace('.', ',')) : ''} vs meta 96%</p>
        )}
        <p className="IG-tooltipSerieSub">
          {formatearEntero(d.cumplidas)} de {formatearEntero(d.evaluables)} guías evaluables
        </p>
      </div>
    );
  };
  const graficoOTMeta = () => (
    <div className="IG-graficoContainer DC-metaCard">
      <div className="IG-graficoHeader">
        <div className="IG-graficoTituloWrap">
          <h2 className="IG-graficoTitulo">
            🎯 On Time vs meta
            <span className="IG-graficoBadge">{vistaOT === 'diaria' ? 'Diario' : 'Mensual'}</span>
            <span className="IG-graficoBadge DC-badgeRango">{rangoFiltros}</span>
          </h2>
        </div>
        <div className="IG-graficoAcciones">
          <div className="IG-toggleGrupo" role="group" aria-label="Vista On Time vs meta">
            <button className={`IG-toggleBtn ${vistaOT === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => alternarVistaOT('mensual')}>Mensual</button>
            <button className={`IG-toggleBtn ${vistaOT === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => alternarVistaOT('diaria')}>Diario</button>
          </div>
        </div>
      </div>
      <div className="DC-scrollOT">
      <div className="DC-swapOT" key={`meta-${vistaOT}`} style={{ width: '100%', height: 320, minWidth: anchoMinOT(dataOTMeta.length) }}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={dataOTMeta}
            margin={{ top: 24, right: 16, left: 8, bottom: 10 }}
            /* Mismo clic que el OT por período: barra mensual → aplica Año+Mes
               y salta a Diario; barra diaria → zoom de ese día. */
            onClick={clicBarraOT}
            style={{ cursor: 'pointer' }}
          >
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
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} width={54} />
            <Tooltip content={tooltipOTMeta} cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }} />
            <ReferenceLine
              y={META_OT}
              stroke="#98c74c"
              strokeDasharray="6 4"
              /* Etiqueta ARRIBA de la línea (dy negativo), pegada al extremo
                 derecho — antes quedaba debajo y se perdía. */
              label={{ value: `Meta ${META_OT}%`, fill: '#98c74c', fontSize: 11, fontWeight: 700, position: 'insideTopRight', dy: -14, dx: -6 }}
            />
            <Bar
              dataKey="pct"
              name="% OT"
              radius={[4, 4, 0, 0]}
              isAnimationActive={ANIM_BARRAS.isAnimationActive}
              animationDuration={ANIM_BARRAS.animationDuration}
              animationEasing={ANIM_BARRAS.animationEasing}
            >
              {dataOTMeta.map(d => (
                <Cell key={d.periodo} fill={d.pct == null ? '#334155' : d.pct < META_OT ? '#b91c1c' : '#15803d'} />
              ))}
              <LabelList dataKey="pct" content={etiquetaVerticalMeta} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
    </div>
  );

  // Tacómetro del OT (2026-10-30): SVG puro estilo velocímetro de vehículo —
  // dial de 240° con pista, ticks mayores/menores con cifras (0..100), arco de
  // avance con color por umbral, aguja con cubo central y % grande al pie.
  const TacometroOT = ({ pct }: { pct: number | null }) => {
    const cx = 160, cy = 150, r = 118;
    const A0 = 210, A1 = -30; // ángulos matemáticos: entrada/fin del dial
    const ang = (v: number) => A0 + (Math.max(0, Math.min(100, v)) / 100) * (A1 - A0);
    const pt = (v: number, radio: number) => {
      const a = (ang(v) * Math.PI) / 180;
      return [cx + radio * Math.cos(a), cy - radio * Math.sin(a)] as const;
    };
    const arco = (v0: number, v1: number, radio: number) => {
      const [x0, y0] = pt(v0, radio);
      const [x1, y1] = pt(v1, radio);
      const large = Math.abs(ang(v1) - ang(v0)) > 180 ? 1 : 0;
      return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radio} ${radio} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };
    const val = pct ?? 0;
    const color = pct != null ? colorOT(pct) : '#334155';
    const [nx, ny] = pt(val, r - 34);
    // % con UN decimal y coma (85,4%) — igual que el resumen del backend.
    const txt = pct != null ? `${pct.toFixed(1).replace('.', ',')}%` : '—';
    // (2026-10-30) viewBox ajustado al contenido real del dial: antes era
    // "0 0 320 210" (dejaba ~35px vacíos por lado y el dial ocupaba solo el
    // 79% del ancho); ahora lo llena y con alto para las cifras 0/100.
    return (
      <svg viewBox="26 0 272 232" className="DC-tacometro" role="img" aria-label={`On Time ${txt}`}>
        {/* pista del dial */}
        <path d={arco(0, 100, r)} fill="none" stroke="#22314e" strokeWidth={16} />
        {/* avance */}
        {val > 0 && (
          <path d={arco(0, val, r)} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
        )}
        {/* ticks mayores con cifra */}
        {[0, 25, 50, 75, 100].map(t => {
          const [x1, y1] = pt(t, r - 12);
          const [x2, y2] = pt(t, r - 26);
          const [tx, ty] = pt(t, r + 20);
          return (
            <g key={t}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#566a89" strokeWidth={2.5} />
              <text x={tx} y={ty + 4} textAnchor="middle" fontSize={11} fill="#7d8ea8">{t}</text>
            </g>
          );
        })}
        {/* ticks menores */}
        {[10, 20, 30, 40, 60, 70, 80, 90].map(t => {
          const [x1, y1] = pt(t, r - 12);
          const [x2, y2] = pt(t, r - 21);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a4c6b" strokeWidth={1.5} />;
        })}
        {/* aguja + cubo */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={9} fill="#0b1526" stroke={color} strokeWidth={3} />
        {/* cifra central */}
        <text x={cx} y={cy + 54} textAnchor="middle" fontSize={34} fontWeight={800} fill={color}>
          {txt}
        </text>
      </svg>
    );
  };

  // Tooltip compartido de las barras OT por campo (ciudad/destinatario).
  // Fecha de un movimiento de la trayectoria: ISO → dd/mm/aaaa hh:mm
  // (las fechas de la línea de tiempo se mostraban en ISO).
  const fechaMov = (v?: string) => {
    if (!v) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(String(v).trim());
    if (!m) return String(v);
    return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}` : ''}`;
  };

  const tooltipOTCampo = (props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as OTPorCampo;
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{d.clave}</p>
        <p>Cumplieron: <b>{formatearEntero(d.cumplieron)}</b></p>
        <p>Cumplieron con novedad: <b>{formatearEntero(d.justificadas)}</b></p>
        <p>No cumplieron: <b>{formatearEntero(d.no_cumplieron)}</b></p>
        <p className="IG-tooltipSerieSub">
          {d.pct}% OT · {formatearEntero(d.cumplieron + d.justificadas)} de {formatearEntero(d.evaluables)} evaluables · {formatearEntero(d.total)} guías
        </p>
      </div>
    );
  };

  // Gráfico de barras horizontales del OT por campo (una por grupo, % como
  // longitud y etiqueta; color por umbral). data llega ordenada por volumen.
  const graficoOTCampo = (titulo: string, data: OTPorCampo[], idCampo: string) => (
    <div className="IG-graficoContainer">
      {data.length > 0 ? (
        <>
          <div className="IG-graficoHeader">
            <div className="IG-graficoTituloWrap">
              <h2 className="IG-graficoTitulo">
                {titulo}
                <span className="IG-graficoBadge DC-badgeRango">{rangoFiltros}</span>
              </h2>
            </div>
          </div>
          {/* Subtítulo corto; la explicación completa viaja en el title (ⓘ). */}
          <p
            className="IG-graficoSub"
            title="% OT del período filtrado con las justificadas contando como cumplidas · todas las opciones · de la mayor a la menor cumplimiento"
          >
            De mayor a menor cumplimiento <span aria-hidden="true">ⓘ</span>
            {esMovil ? ' · toca una fila para su detalle' : ''}
          </p>
          {/* Scroll INTERNO con altura acotada: las dos tarjetas quedan
              iguales y la página no crece con la lista completa. */}
          <div className="DC-otCampoScroll">
          {esMovil ? (
            <div className="DC-otCampoLista">
              {data.map(d => {
                const key = `${idCampo}|${d.clave}`;
                const abierta = filaCampoAbierta === key;
                return (
                  <button
                    type="button"
                    key={key}
                    className="DC-otCampoFila"
                    onClick={() => setFilaCampoAbierta(abierta ? null : key)}
                    aria-expanded={abierta}
                  >
                    <span className="DC-otCampoFilaTop">
                      <span className="DC-otCampoNombre" title={d.clave}>{d.clave}</span>
                      <span className="DC-otCampoPct" style={{ color: colorOT(d.pct) }}>
                        {d.pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </span>
                    {/* Pista 0-100 completa + barra proporcional (misma escala
                        que el eje del gráfico de escritorio). */}
                    <span className="DC-otCampoPista">
                      <span className="DC-otCampoBarra" style={{ width: `${Math.max(d.pct, 1)}%`, background: colorOT(d.pct) }} />
                    </span>
                    {abierta && (
                      <span className="DC-otCampoDetalle">
                        Cumplieron {formatearEntero(d.cumplieron)} · Con novedad {formatearEntero(d.justificadas)} · No cumplieron {formatearEntero(d.no_cumplieron)} · {formatearEntero(d.total)} guías ({formatearEntero(d.evaluables)} evaluables)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
          // Escritorio: TODAS las opciones (scroll); filas más compactas cuando
          // la lista es larga para no estirar el gráfico innecesariamente.
          <div style={{ width: '100%', height: Math.max(220, data.length * (data.length > 60 ? 26 : 34) + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="clave"
                  width={190}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)}
                />
                <Tooltip content={tooltipOTCampo} cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }} />
                <Bar
                  dataKey="pct"
                  name="% OT"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={ANIM_BARRAS.isAnimationActive}
                  animationDuration={ANIM_BARRAS.animationDuration}
                  animationEasing={ANIM_BARRAS.animationEasing}
                >
                  {data.map(d => (
                    <Cell key={`${idCampo}-${d.clave}`} fill={colorOT(d.pct)} />
                  ))}
                  <LabelList
                    dataKey="pct"
                    position="right"
                    offset={12}
                    formatter={(v: number) => `${v}%`}
                    style={{ fill: '#0f1928', fontSize: 11, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
          </div>
        </>
      ) : (
        <div className="IG-sinDatos"><p>No hay guías evaluables para desagregar en el período</p></div>
      )}
    </div>
  );

  const tooltipOT = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as BucketOT;
    const fechaTxt = vistaOT === 'diaria'
      ? format(parseISO(d.periodo), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.periodo + '-01'), 'MMMM yyyy', { locale: es });
    const filtrando = segSelOT.size > 0;
    const selTotal = filtrando ? segActivosOT.reduce((a, s) => a + (d[s.clave] as number), 0) : 0;
    let pct: number | null;
    if (!filtrando) {
      pct = pctOT(d);
    } else {
      // % OT solo sobre los segmentos OT de la selección (cumplieron /
      // noCumplieron / justificadas); si la selección no toca evaluables,
      // no se muestra (no aplica a lo que se está viendo).
      const c = segSelOT.has('cumplieron') ? d.cumplieron : 0;
      const n = segSelOT.has('noCumplieron') ? d.noCumplieron : 0;
      const j = segSelOT.has('justificadas') ? d.justificadas : 0;
      const base = c + n + j;
      pct = c + n > 0 ? Math.round(((c + j) / base) * 1000) / 10 : null;
    }
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt} <span style={{ color: '#8aa0b8' }}>(emisión)</span></p>
        {segActivosOT.map(s => (d[s.clave] as number) > 0 ? (
          <p key={s.clave}>
            <span className="IG-tooltipEtapa" style={{ background: s.color }} />{s.etiqueta}: <b>{formatearEntero(d[s.clave] as number)}</b>
          </p>
        ) : null)}
        {filtrando ? (
          <p className="IG-tooltipSerieSub">
            Selección: {formatearEntero(selTotal)} de {formatearEntero(d.total)}{pct != null ? ` · ${pct.toFixed(1).replace('.', ',')}% OT` : ''}
          </p>
        ) : (
          <p className="IG-tooltipSerieSub">
            Evaluables: {formatearEntero(d.evaluables + d.justificadas)} (con novedad cuentan como cumplidas){pct != null ? ` · ${pct.toFixed(1).replace('.', ',')}% OT` : ''} · Total: {formatearEntero(d.total)}
          </p>
        )}
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

  // Chip de estado del TMS: ENTREGADO → verde; el resto → ámbar. (La regla
  // ANULADA desapareció con la migración a PG puro: toda fila viene del TMS.)
  const claseChipEstado = (estado: string) =>
    estado.toUpperCase() === 'ENTREGADO' ? 'DC-guiaChipEntregada' : 'DC-guiaChipProceso';

  // '2026-08-14' → '14-08-2026' (día primero, como lo lee el usuario). Solo
  // reformattea si calza exacto con ISO; fecha_cita puede traer basura y se
  // muestra tal cual.
  const formatearFecha = (v: string | null): string => {
    if (!v) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
  };

  // Fila de guía → objeto plano para Excel (compartido por el export del
  // informe y el del gráfico On Time). Fechas ya en DD-MM-AAAA. «F. Conteo OT»
  // = el criterio EXACTO con el que bucketa el gráfico On Time (fecha de
  // ENTREGA; fallback emisión si aún no hay entrega) — filtrando el Excel por
  // esta columna se replica la altura de las barras.
  const filaGuiaAExport = (f: FilaGuia) => ({
    'Guía': f.guia,
    'Planilla': f.planilla ?? '',
    'Destino': f.ciudad_destino ?? '',
    'Destinatario': f.destinatario ?? '',
    'Servicio': f.servicio ?? '',
    'Piezas': f.piezas ?? '',
    'Kilos': f.kilos ?? '',
    'Estado': f.estado ?? '',
    'Novedad TMS': f.novedad_tms ?? '',
    'Estado Crudo': f.estado_crudo && !f.estado ? f.estado_crudo : '',
    'F. Conteo OT': formatearFecha(f.fecha_entrega || f.fecha_emision),
    'F. Emisión': f.fecha_emision ? formatearFecha(f.fecha_emision) : '',
    'F. Entrega': f.fecha_entrega ? formatearFecha(f.fecha_entrega) : '',
    'F. Promesa': f.fecha_promesa ? formatearFecha(f.fecha_promesa) : '',
    'Origen Promesa': f.origen_promesa ?? '',
    'Días Hábiles': f.dias_habiles ?? '',
    'OT': f.ot ?? '',
    'F. Digitalización': f.fecha_digitalizacion ? formatearFecha(f.fecha_digitalizacion) : '',
    'F. Cita': f.fecha_cita ? formatearFecha(f.fecha_cita) : '',
    'Causal (justificada)': f.novedad?.causal ?? '',
    'Justificación': f.novedad?.justificacion ?? '',
    'Registrada por': f.novedad ? (f.novedad.nombre || f.novedad.usuario || '') : '',
  });

  // Export Excel (.xlsx) del informe — SheetJS, mismo patrón que el Export de
  // Tarifas. Exporta el RANGO COMPLETO del alcance visible (período o
  // trazabilidad activa), no solo las filas cargadas en pantalla: un único
  // fetch a /guias/filas con limite=30000 (un año Kabi ≈ 29k). Fechas ya en
  // DD-MM-AAAA (formatearFecha) para que Excel-ES las lea.
  const exportarGuiasExcel = async () => {
    setCargandoMasGuias(true);
    try {
      const extra = new URLSearchParams({ pagina: '1', limite: '30000' });
      if (trazaActiva) extra.set('q', trazaActiva);
      const { filas } = await obtenerFilasGuias(extra);
      const datos = filas.map(filaGuiaAExport);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datos);
      ws['!cols'] = [
        { wch: 13 }, { wch: 10 }, { wch: 18 }, { wch: 26 }, { wch: 12 },
        { wch: 8 }, { wch: 9 }, { wch: 16 }, { wch: 24 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 12 },
        { wch: 20 }, { wch: 40 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Guías TMS');
      XLSX.writeFile(wb, `guias_tms_${clienteId}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      setErrorGuias(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setCargandoMasGuias(false);
    }
  };

  // Segmento OT de una fila de guía — ESPEJO del _serie_ot del backend (mismo
  // orden de prioridad: novedad > ot > estado) para filtrar el Excel del OT
  // por el filtro de leyenda activo y para el detalle del día.
  const segmentoDeFila = (f: FilaGuia): string => {
    if (f.novedad) return 'justificadas';
    if (f.ot === 1) return 'cumplieron';
    if (f.ot === 0) return 'noCumplieron';
    switch (f.estado) {
      case 'CON NOVEDAD': return 'con_novedad';
      case 'En distribucion': return 'en_distribucion';
      case 'Transito Nacional': return 'transito';
      case 'PENDIENTE': return 'pendiente';
      default: return 'sin_info';
    }
  };

  // ── Detalle del día (2026-10-30) ──
  // Clic en una barra-segmento del gráfico de día → tabla con las guías de
  // ese día + segmento (para leerlas) + export Excel. La base del día se
  // consulta UNA vez por día (cache `diaCacheOT`: fetch del período completo
  // y recorte client-side por fecha_emisión) y el recorte por segmento es
  // local. Clic en la barra activa cierra el detalle.
  const [detalleSegOT, setDetalleSegOT] = useState<string | null>(null);
  const [filasDiaOT, setFilasDiaOT] = useState<FilaGuia[]>([]);
  const [diaCacheOT, setDiaCacheOT] = useState<string | null>(null);
  const [cargandoDetalleOT, setCargandoDetalleOT] = useState(false);

  const filasDetalleDia = useMemo(
    () => (detalleSegOT ? filasDiaOT.filter(f => segmentoDeFila(f) === detalleSegOT) : []),
    [detalleSegOT, filasDiaOT]
  );

  const abrirDetalleSegmento = async (etiqueta: string) => {
    const seg = SEGMENTOS_OT.find(s => s.etiqueta === etiqueta);
    if (!seg || !diaOT) return;
    const clave = seg.clave as string;
    setDetalleSegOT(prev => (prev === clave ? null : clave)); // toggle al clicar la activa
    if (diaCacheOT === diaOT) return;
    setCargandoDetalleOT(true);
    try {
      const { filas } = await obtenerFilasGuias(new URLSearchParams({ pagina: '1', limite: '30000' }));
      setFilasDiaOT(filas.filter(f => (f.fecha_emision || '').startsWith(diaOT)));
      setDiaCacheOT(diaOT);
    } catch (err) {
      setErrorGuias(err instanceof Error ? err.message : 'Error al cargar el detalle del día');
      setDetalleSegOT(null);
    } finally {
      setCargandoDetalleOT(false);
    }
  };

  const exportarDetalleDia = () => {
    const seg = SEGMENTOS_OT.find(s => s.clave === detalleSegOT);
    if (!seg || !filasDetalleDia.length) return;
    const datos = filasDetalleDia.map(filaGuiaAExport);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    ws['!cols'] = [
      { wch: 13 }, { wch: 10 }, { wch: 18 }, { wch: 26 }, { wch: 12 },
      { wch: 8 }, { wch: 9 }, { wch: 16 }, { wch: 24 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 12 },
      { wch: 20 }, { wch: 40 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
    XLSX.writeFile(wb, `detalle_ot_${clienteId}_${diaOT}_${seg.etiqueta.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Cambiar de día / salir del zoom o re-filtrar cierra el detalle y anula la
  // cache (la base consultada corresponde al filtro vigente). El detalle vive
  // en un MODAL: Escape también lo cierra.
  useEffect(() => {
    if (!detalleSegOT) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetalleSegOT(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [detalleSegOT]);
  useEffect(() => { setDetalleSegOT(null); }, [diaOT]);
  useEffect(() => { setDetalleSegOT(null); setDiaCacheOT(null); setFilasDiaOT([]); }, [filtrosAplicados, grupoAplicado]);

  // Export Excel (.xlsx) del gráfico «On Time por período»: 2 hojas —
  // ① «On Time»: la serie de la VISTA ACTIVA con el % OT por período;
  // ② «Guías»: la base del ALCANCE VISIBLE. (2026-10-30) El export respeta
  // TODO lo filtrado en pantalla: año/mes/grupo (viajan en el fetch), el ZOOM
  // DE DÍA (si hay un día en el breadcrumb, solo ese día) y el FILTRO DE
  // LEYENDA (solo los segmentos seleccionados — columnas de la hoja ① y filas
  // de la ②). Sin trazabilidad: el gráfico siempre es del período.
  const exportarOTExcel = async () => {
    if (exportandoOT) return;
    setExportandoOT(true);
    try {
      const diaZoom = diaOT && bucketDiaOT ? diaOT : null;
      const filtrandoSeg = segSelOT.size > 0;

      // Conteo de un bucket RESTRINGIDO a la selección de leyenda (sin
      // selección = valores completos) — misma regla de % OT del tooltip.
      const resumenSel = (b: BucketOT) => {
        const sel = (clave: string) =>
          !filtrandoSeg || segSelOT.has(clave) ? (b[clave as keyof BucketOT] as number) : 0;
        const c = sel('cumplieron'), n = sel('noCumplieron'), j = sel('justificadas');
        const evaluables = c + n + j;
        return {
          sel,
          evaluables,
          total: SEGMENTOS_OT.reduce((a, s) => a + sel(s.clave as string), 0),
          pct: c + n > 0 ? Math.round(((c + j) / evaluables) * 1000) / 10 : null,
        };
      };

      // ① Hoja «On Time»: filas de la vista activa (día en zoom → UNA fila).
      const bucketsHoja: BucketOT[] = diaOT && bucketDiaOT ? [bucketDiaOT] : dataOT;
      const hojaOT = bucketsHoja.map(b => {
        const r = resumenSel(b);
        const fila: Record<string, string | number> = { 'Período': b.periodo };
        for (const s of segActivosOT) fila[s.etiqueta] = r.sel(s.clave as string);
        fila['Evaluables'] = r.evaluables;
        fila['Total'] = r.total;
        fila['% OT'] = r.pct ?? '';
        return fila;
      });

      // ② Hoja «Guías»: base del filtro vigente, recortada al día del zoom y
      // a los segmentos de la leyenda (client-side: la API no conoce día ni
      // segmentos).
      const { filas } = await obtenerFilasGuias(new URLSearchParams({ pagina: '1', limite: '30000' }));
      let filasHoja = filas;
      if (diaZoom) filasHoja = filasHoja.filter(f => (f.fecha_emision || '').startsWith(diaZoom));
      if (filtrandoSeg) filasHoja = filasHoja.filter(f => segSelOT.has(segmentoDeFila(f)));
      const hojaGuias = filasHoja.map(filaGuiaAExport);

      const wb = XLSX.utils.book_new();
      const wsOT = XLSX.utils.json_to_sheet(hojaOT);
      wsOT['!cols'] = [{ wch: 12 }, ...segActivosOT.map(() => ({ wch: 13 })), { wch: 11 }, { wch: 8 }, { wch: 7 }];
      XLSX.utils.book_append_sheet(wb, wsOT, 'On Time');
      const wsGuias = XLSX.utils.json_to_sheet(hojaGuias);
      wsGuias['!cols'] = [
        { wch: 13 }, { wch: 10 }, { wch: 18 }, { wch: 26 }, { wch: 12 },
        { wch: 8 }, { wch: 9 }, { wch: 16 }, { wch: 24 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 12 },
        { wch: 20 }, { wch: 40 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsGuias, 'Guías');
      XLSX.writeFile(wb, `on_time_${clienteId}${diaZoom ? `_${diaZoom}` : ''}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      setErrorGuias(err instanceof Error ? err.message : 'Error al exportar el On Time');
    } finally {
      setExportandoOT(false);
    }
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

  // (2026-10-30) Portal externo: título de la pestaña «TMS <cliente>».
  useEffect(() => {
    if (cliente) document.title = modoExterno ? `TMS ${cliente.nombre}` : cliente.nombre;
  }, [cliente, modoExterno]);

  return (
    // modoExterno (portal Mis Indicadores): tema OSCURO + ancho completo.
    <div className={modoExterno ? 'DC-container DC-portalOscuro' : 'DC-container'}>
      {/* Header */}
      <header className="DC-header">
        <div className="DC-headerInner">
          <button className="DC-brand" onClick={() => router.push(rutaPanel)} title={modoExterno ? 'Mis indicadores' : 'Panel de clientes'}>
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="DC-brandName">Integr<span className="DC-brandAccent">App</span></span>
          </button>

          <div className="DC-logoCliente">
            <span className="DC-nombreCliente">{modoExterno ? `TMS ${cliente.nombre}` : cliente.nombre}</span>
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
                <button className="DC-dropItem" onClick={() => { setMenuAbierto(false); router.push(rutaPanel); }}>
                  <FaChartBar /> {modoExterno ? 'Mis indicadores' : 'Panel de clientes'}
                </button>
                {!modoExterno && (
                  <button className="DC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/indicadores'); }}>
                    <FaChartBar /> Menú de indicadores
                  </button>
                )}
                <div className="DC-dropDivider" />
                <button className="DC-dropItem DC-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Filtros + breadcrumb de período (rediseño UX 2026-10-30):
          - Escritorio: UNA fila (Año · Mes · Cliente · Filtrar a la derecha).
          - Móvil: panel plegable compacto (Año/Mes en 2 columnas, Cliente y
            Filtrar a ancho completo); contraído muestra un resumen discreto.
          - Debajo, SIEMPRE visible, el breadcrumb de navegación «Histórico ›
            2026 › Septiembre › día»: niveles anteriores clicables para
            volver, último = ubicación actual. Cliente/trazabilidad siguen
            como chips (filtros, no navegación). */}
      <div className="DC-filtrosSection">
        <button
          className="DC-filtrosToggle"
          onClick={() => {
            setFiltrosAbiertos(a => !a);
            setDropdownAnioAbierto(false);
            setDropdownMesAbierto(false);
            setDropdownGrupoAbierto(false);
          }}
          aria-expanded={filtrosAbiertos}
          aria-controls="dc-filtros-panel"
        >
          <span aria-hidden="true">⚙</span>
          <span>Filtros</span>
          {!filtrosAbiertos && <span className="DC-filtrosResumen">{resumenFiltros}</span>}
          <span className="DC-filtrosToggleFlecha" style={{ transform: filtrosAbiertos ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
        <div id="dc-filtros-panel" className={`DC-filtrosPanel ${filtrosAbiertos ? '' : 'DC-filtrosOcultos'}`}>
          {/* Año */}
          <div className="DC-filtroGrupo DC-filtroAnio">
            <label>Año:</label>
            <div className="DC-dropdownFiltro">
              <button className="DC-dropdownFiltroBtn" onClick={() => { setDropdownAnioAbierto(!dropdownAnioAbierto); setDropdownMesAbierto(false); setDropdownGrupoAbierto(false); }}>
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
          <div className="DC-filtroGrupo DC-filtroMes">
            <label>Mes:</label>
            <div className="DC-dropdownFiltro">
              <button className="DC-dropdownFiltroBtn" onClick={() => { setDropdownMesAbierto(!dropdownMesAbierto); setDropdownAnioAbierto(false); setDropdownGrupoAbierto(false); }}>
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

          {/* Cliente (sub-grupo): SOLO para el informe de guías — filtra por el
              nombre con que el TMS registra cada parte del grupo (llega del
              backend en /guias). Oculto si el cliente no tiene sub-grupos. */}
          {gruposCliente.length > 1 && (
            <div className="DC-filtroGrupo DC-filtroCliente">
              <label title="Sub-grupo del cliente en el TMS (Fresenius Kabi / FK Servicio Técnico)">Cliente interno:</label>
              <div className="DC-dropdownFiltro">
                <button className="DC-dropdownFiltroBtn" onClick={() => { setDropdownGrupoAbierto(!dropdownGrupoAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); }}>
                  <span className="DC-dropdownFiltroTexto">{grupoSeleccionado ?? 'Todos'}</span>
                  <span className="DC-dropdownFiltroFlecha">▾</span>
                </button>
                {dropdownGrupoAbierto && (
                  <div className="DC-dropdownFiltroLista">
                    <label className={`DC-dropdownFiltroItem ${grupoSeleccionado === null ? 'seleccionado' : ''}`}>
                      <input type="radio" checked={grupoSeleccionado === null} onChange={() => setGrupoSeleccionado(null)} />
                      Todos
                    </label>
                    {gruposCliente.map(g => (
                      <label key={g} className={`DC-dropdownFiltroItem ${grupoSeleccionado === g ? 'seleccionado' : ''}`}>
                        <input type="radio" checked={grupoSeleccionado === g} onChange={() => setGrupoSeleccionado(g)} />
                        {g}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* (2026-10-30) Cliente final = destinatario del TMS: autocomplete
              desde la 5ª letra + multi-selección; se aplica con Filtrar. */}
          <div className="DC-filtroGrupo DC-filtroDestFinal">
            <label title="Destinatario de la guía en el TMS">Cliente final:</label>
            <div className="DC-dropdownFiltro">
              <button
                className="DC-dropdownFiltroBtn"
                onClick={() => {
                  setDestDropdownAbierto(o => !o);
                  setDropdownAnioAbierto(false);
                  setDropdownMesAbierto(false);
                  setDropdownGrupoAbierto(false);
                }}
              >
                <span className="DC-dropdownFiltroTexto">
                  {destSel.length === 0
                    ? 'Todos'
                    : destSel.length === 1
                      ? (destSel[0].length > 18 ? `${destSel[0].slice(0, 17)}…` : destSel[0])
                      : `${destSel.length} seleccionados`}
                </span>
                <span className="DC-dropdownFiltroFlecha">▾</span>
              </button>
              {destDropdownAbierto && (
                <div className="DC-dropdownFiltroLista DC-destLista">
                  <InputDestinatario onEstable={setBusquedaDest} />
                  {cargandoDest && <div className="DC-destEstado">Buscando…</div>}
                  {busquedaDest.trim().length < 5 && !cargandoDest && (
                    <div className="DC-destEstado">Escribe al menos 5 letras para ver los destinatarios</div>
                  )}
                  {opcionesDest.map(op => (
                    <label key={op} className={`DC-dropdownFiltroItem ${destSel.includes(op) ? 'seleccionado' : ''}`}>
                      <input
                        type="checkbox"
                        checked={destSel.includes(op)}
                        onChange={() => {
                          setDestSel(prev => prev.includes(op) ? prev.filter(x => x !== op) : [...prev, op]);
                        }}
                      />
                      {op}
                    </label>
                  ))}
                  {busquedaDest.trim().length >= 5 && !cargandoDest && opcionesDest.length === 0 && (
                    <div className="DC-clienteOpcion">Sin resultados para «{busquedaDest.trim()}»</div>
                  )}
                  {destSel.length > 0 && (
                    <button type="button" className="DC-destLimpiar" onClick={() => setDestSel([])}>
                      ✕ Limpiar selección ({destSel.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <button className="DC-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownGrupoAbierto(false); setDestDropdownAbierto(false); }}>
            Filtrar
          </button>
        </div>

        {/* Breadcrumb de período — SIEMPRE visible (ubicación actual clara):
            raíz «Histórico» › años › meses › día en zoom. Los niveles
            anteriores son clicables (volver); el último va resaltado y sin
            acción. Los filtros NO-período (cliente, trazabilidad) van después
            del divisor como chips removibles. */}
        <nav className="DC-breadcrumb" aria-label="Período activo">
          <ol className="DC-bcRuta">
            {(filtrosAplicados.anios.length > 0 || filtrosAplicados.meses.length > 0 || (diaOT && bucketDiaOT)) ? (
              <li>
                <button type="button" className="DC-bcLink" onClick={irAHistorico} title="Volver a todo el histórico">
                  Histórico
                </button>
                <span className="DC-bcSep" aria-hidden="true">›</span>
              </li>
            ) : (
              <li><span className="DC-bcActual" aria-current="page">Todo el histórico</span></li>
            )}
            {filtrosAplicados.anios.length > 0 && (
              <li>
                {(filtrosAplicados.meses.length > 0 || (diaOT && bucketDiaOT)) ? (
                  <>
                    <button type="button" className="DC-bcLink" onClick={irAlAnio} title="Volver a todos los meses de este año">
                      {lblAnios}
                    </button>
                    <span className="DC-bcSep" aria-hidden="true">›</span>
                  </>
                ) : (
                  <span className="DC-bcActual" aria-current="page">{lblAnios}</span>
                )}
              </li>
            )}
            {filtrosAplicados.meses.length > 0 && (
              <li>
                {diaOT && bucketDiaOT ? (
                  <>
                    <button type="button" className="DC-bcLink" onClick={irAlMes} title="Volver a la vista diaria del mes">
                      {lblMeses}
                    </button>
                    <span className="DC-bcSep" aria-hidden="true">›</span>
                  </>
                ) : (
                  <span className="DC-bcActual" aria-current="page">{lblMeses}</span>
                )}
              </li>
            )}
            {diaOT && bucketDiaOT && (
              <li>
                <span className="DC-bcActual" aria-current="page">
                  <span aria-hidden="true">📅</span> {format(parseISO(diaOT), "d 'de' MMMM", { locale: es })}
                </span>
              </li>
            )}
          </ol>
          {(grupoAplicado || trazaActiva || destAplicado.length > 0) && (
            <div className="DC-bcChips">
              {grupoAplicado && (
                <button type="button" className="DC-miga" onClick={quitarGrupoMiga} title="Quitar el filtro de cliente interno">
                  👥 {grupoAplicado} <span className="DC-migaX">✕</span>
                </button>
              )}
              {destAplicado.length > 0 && (
                <button type="button" className="DC-miga" onClick={quitarDestMiga} title="Quitar el filtro de cliente final">
                  🎭 {destAplicado.length === 1 ? (destAplicado[0].length > 22 ? `${destAplicado[0].slice(0, 21)}…` : destAplicado[0]) : `${destAplicado.length} clientes finales`} <span className="DC-migaX">✕</span>
                </button>
              )}
              {trazaActiva && (
                <button type="button" className="DC-miga" onClick={limpiarTraza} title="Quitar la trazabilidad">
                  🔎 {trazaActiva} <span className="DC-migaX">✕</span>
                </button>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Contenido */}
      <main className="DC-main">
        {!modoExterno && cargando ? (
          <>
            <SkeletonGrafico />
            <SkeletonGrafico bajo />
          </>
        ) : !modoExterno && error ? (
          <div className="DC-error">
            <p>{error}</p>
            <button className="DC-reintentar" onClick={obtenerDatos}>Reintentar</button>
          </div>
        ) : (
          <>
            {/* (2026-10-30) Pestañas del portal: «Gerenciales» (gráficos)
                y «Operación» (consulta de guía en Siscore). */}
            {modoExterno && (
              <div className="DC-pestanas" role="tablist" aria-label="Secciones del portal">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pestanaPortal === 'gerenciales'}
                  className={`DC-pestanaBtn ${pestanaPortal === 'gerenciales' ? 'DC-pestanaBtnActiva' : ''}`}
                  onClick={() => setPestanaPortal('gerenciales')}
                >
                  📊 Gerenciales
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pestanaPortal === 'operacion'}
                  className={`DC-pestanaBtn ${pestanaPortal === 'operacion' ? 'DC-pestanaBtnActiva' : ''}`}
                  onClick={() => setPestanaPortal('operacion')}
                >
                  🚛 Operación
                </button>
              </div>
            )}

            {/* (2026-10-30) Vista OPERACIÓN: consulta de guía en Siscore por
                SOAP — mismo servicio del bot de WhatsApp. */}
            {modoExterno && pestanaPortal === 'operacion' && (
              <div className="IG-graficoContainer DC-opCard">
                <div className="IG-graficoHeader">
                  <div className="IG-graficoTituloWrap">
                    <h2 className="IG-graficoTitulo">🔎 Consulta de guía</h2>
                  </div>
                </div>
                <p className="IG-graficoSub">Toda la información y el estado actual de tus guías</p>
                <div className="DC-opBusqueda">
                  <input
                    className="DC-opInput"
                    type="text"
                    inputMode="numeric"
                    placeholder="Número de guía (ej: 7220123268)"
                    value={inputGuiaOp}
                    onChange={e => setInputGuiaOp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && consultarGuiaSiscore()}
                    disabled={consultandoGuiaOp}
                  />
                  <button type="button" className="DC-opBtn" onClick={() => consultarGuiaSiscore()} disabled={consultandoGuiaOp || !inputGuiaOp.trim()}>
                    {consultandoGuiaOp ? 'Consultando…' : 'Consultar'}
                  </button>
                </div>
                {consultandoGuiaOp && <p className="DC-opCargando">Buscando la guía…</p>}
                {errorGuiaOp && <p className="DC-opError">❗ {errorGuiaOp}</p>}
                {resultadoGuiaOp && !resultadoGuiaOp.exists && (
                  <div className="IG-sinDatos"><p>La guía <b>{resultadoGuiaOp.guia}</b> no fue encontrada. Verifica el número e intenta de nuevo</p></div>
                )}
                {resultadoGuiaOp?.exists && resultadoGuiaOp.data && (() => {
                  const d = resultadoGuiaOp.data;
                  const movimientos: { FecMov?: string; DetalleMov?: string; Tipo_Movimiento?: string }[] = d.Movimientos || [];
                  const campo = (titulo: string, valor: string | number | null | undefined) => (
                    <div className="DC-opCampo">
                      <span className="DC-opCampoTitulo">{titulo}</span>
                      <span className="DC-opCampoValor">{valor != null && String(valor).trim() !== '' ? String(valor) : '—'}</span>
                    </div>
                  );
                  const ciudad = d.CiuDes || resultadoGuiaOp.ciudad_destino_tms;
                  const esEntregada = String(d.Estado || '').toUpperCase().includes('ENTREGA');
                  return (
                    <div className="DC-opResultado">
                      {/* RESUMEN: destino (principal) + ESTADO ACTUAL en badge
                          (lo primero que el cliente quiere saber). */}
                      <div className="DC-opResumen">
                        <div className="DC-opResumenDestino">
                          <span className="DC-opDestacadoTitulo">📥 Destino</span>
                          <span className="DC-opDestacadoNombre">{d.NomDes || '—'}</span>
                          <div className="DC-opDestacadoChips">
                            {ciudad && <span className="DC-opChip DC-opChipCiudad">📍 {ciudad}</span>}
                            {resultadoGuiaOp.placa && <span className="DC-opChip DC-opChipPlaca" title="Vehículo que transportó la guía (TMS)">🚛 {resultadoGuiaOp.placa}</span>}
                            {d.quienrecibe && <span className="DC-opChip">Recibió: {d.quienrecibe}</span>}
                          </div>
                        </div>
                        <div className="DC-opEstadoActual">
                          <span className="DC-opEstadoLabel">Estado actual</span>
                          <span className={`DC-opEstadoChip ${esEntregada ? 'DC-opEstadoChipOk' : 'DC-opEstadoChipCurso'}`}>
                            {d.Estado || '—'}
                          </span>
                          {d.FecEst && (
                            <span className="DC-opEstadoFecha">
                              {formatearFecha(String(d.FecEst).slice(0, 10)).replaceAll('-', '/')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* (2026-10-30) Novedad JUSTIFICADA de la guía (Mongo,
                          /NovedadesOT): panel morado con causal, justificación
                          y quién la registró. */}
                      {resultadoGuiaOp.justificada && (
                        <div className="DC-opJustificada">
                          <span className="DC-opJustificadaTitulo">
                            🚧 {resultadoGuiaOp.justificada.causal}
                          </span>
                          {resultadoGuiaOp.justificada.justificacion && (
                            <p className="DC-opJustificadaTexto">{resultadoGuiaOp.justificada.justificacion}</p>
                          )}
                          {(resultadoGuiaOp.justificada.nombre || resultadoGuiaOp.justificada.fecha) && (
                            <span className="DC-opJustificadaPor">
                              Registró: {resultadoGuiaOp.justificada.nombre || '—'}
                              {resultadoGuiaOp.justificada.fecha ? ` · ${formatearFecha(String(resultadoGuiaOp.justificada.fecha).slice(0, 10))}` : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Línea de tiempo: la PROTAGONISTA del resultado */}
                      <h3 className="DC-opMovTitulo">🧭 Trayectoria de la guía</h3>
                      {movimientos.length > 0 ? (
                        esMovil ? (
                          /* MÓVIL: timeline VERTICAL — sin scroll horizontal:
                             puntos (cajas) a la izquierda, nombre + fecha a la
                             derecha, línea vertical continua; el último
                             (estado actual) destacado en verde. */
                          <ul className="DC-opTlVert">
                            {movimientos.map((m, i) => (
                              <li
                                key={i}
                                className={`DC-opTlV ${i === movimientos.length - 1 ? 'DC-opTlVActual' : ''}`}
                              >
                                <span className="DC-opTlVMarca" aria-hidden="true">
                                  <span className="DC-opTlCaja">📦</span>
                                </span>
                                <span className="DC-opTlVCuerpo">
                                  <span className="DC-opTlVTitulo">
                                    {m.DetalleMov || m.Tipo_Movimiento || 'Movimiento'}
                                  </span>
                                  <span className="DC-opTlVFecha">{fechaMov(m.FecMov)}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          /* ESCRITORIO: tracking HORIZONTAL uniforme con scroll
                             interno si hay muchos eventos; último destacado. */
                          <>
                          <div className="DC-opTimeline" ref={tlRef}>
                            {movimientos.map((m, i) => (
                              <div
                                key={i}
                                className="DC-opTlPaso"
                                title={m.DetalleMov || m.Tipo_Movimiento || ''}
                              >
                                <span className="DC-opTlTitulo">
                                  {m.DetalleMov || m.Tipo_Movimiento || 'Movimiento'}
                                </span>
                                {/* La CAJA avanza sobre la línea: es el marcador
                                    del recorrido; la última es el estado actual. */}
                                <span className="DC-opTlMarca" aria-hidden="true">
                                  <span className="DC-opTlCaja">📦</span>
                                </span>
                                <span className="DC-opTlFecha">{fechaMov(m.FecMov)}</span>
                              </div>
                            ))}
                          </div>
                          {tlHayMas && (
                            <p className="DC-opTlHint" aria-hidden="true">← Desliza para ver el recorrido completo</p>
                          )}
                          </>
                        )
                      ) : (
                        <p className="DC-opSinMov">Sin movimientos registrados</p>
                      )}

                      <h3 className="DC-opMovTitulo">📄 Datos de la guía</h3>
                      <div className="DC-opGrid">
                        {campo('Guía', resultadoGuiaOp.guia)}
                        {campo('Cliente', d.Nombre_cliente)}
                        {campo('Servicio', d.Servicio)}
                        {campo('📦 Piezas', d.NumPie)}
                        {campo('Fecha envío', d.FecEnv ? formatearFecha(String(d.FecEnv).slice(0, 10)) : null)}
                        {campo('Origen', [d.NomRem, d.CiuRem].filter(Boolean).join(' · '))}
                      </div>
                      {/* Otras guías del mismo vehículo emitidas el mismo
                          día (remesa compañera, solo visible en el TMS).
                          Tocar una la consulta. */}
                      {resultadoGuiaOp.placa && resultadoGuiaOp.misma_placa?.length > 0 && (
                        <div className="DC-opCompaneras">
                          <h3 className="DC-opMovTitulo">🚛 Otras guías del vehículo {resultadoGuiaOp.placa}</h3>
                          <p className="DC-opCompanerasSub">Emitidas el mismo día — viajaron en la misma remesa</p>
                          <div className="DC-opCompanerasLista">
                            {resultadoGuiaOp.misma_placa.map((cp: { guia: string; destinatario?: string; ciudad_destino?: string; estado?: string | null }) => (
                              <button
                                type="button"
                                key={cp.guia}
                                className="DC-opCompanera"
                                onClick={() => { setInputGuiaOp(cp.guia); consultarGuiaSiscore(cp.guia); }}
                                title="Consultar esta guía"
                              >
                                <span className="DC-opCompaneraGuia">{cp.guia}</span>
                                <span className="DC-opCompaneraDest">
                                  {cp.destinatario || '—'}{cp.ciudad_destino ? ` · ${cp.ciudad_destino}` : ''}
                                </span>
                                {cp.estado
                                  ? <span className={`DC-guiaChip ${claseChipEstado(cp.estado)}`}>{cp.estado}</span>
                                  : <span className="DC-opCompaneraDest">—</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {resultadoGuiaOp.tracking_url && (
                        <a className="DC-opTracking" href={resultadoGuiaOp.tracking_url} target="_blank" rel="noopener noreferrer">
                          🔗 Seguimiento en línea
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* (2026-10-30) Gauge tipo velocímetro del OT — lo PRIMERO del
                portal de clientes: % de cumplimiento del alcance visible (el
                día en zoom si lo hay; si no, el período filtrado). Arco con
                color por umbral (≥90 verde / ≥75 ámbar / <75 rojo) y cifra
                central con el detalle cumplidas/evaluables. */}
            {modoExterno && pestanaPortal === 'gerenciales' && (cargandoGuias ? (
              <div className="DC-portalGrid">
                <SkeletonTacometro />
                <SkeletonGrafico bajo />
              </div>
            ) : (
              <div className="DC-portalGrid">
              <div className="IG-graficoContainer DC-gaugeCard">
                <div className="IG-graficoHeader">
                  <div className="IG-graficoTituloWrap">
                    <h2 className="IG-graficoTitulo">
                      🎯 On Time
                      <span className="IG-graficoBadge DC-badgeRango">{gaugeOT.alcance}</span>
                    </h2>
                  </div>
                </div>
                <div className="DC-gaugeWrap">
                  <TacometroOT pct={gaugeOT.pct} />
                  <p className="DC-gaugeSub">
                    {gaugeOT.evaluables
                      ? `${formatearEntero(gaugeOT.cumplidas ?? 0)} de ${formatearEntero(gaugeOT.evaluables)} guías cumplidas`
                      : 'sin guías evaluables'}
                  </p>
                </div>
            </div>
              {graficoOTMeta()}
              </div>
            ))}

            {/* Cantidad de cajas — misma lógica/look que el gráfico de cajas por
                etapa de Costo de Operación, pero acotado a este cliente y a la
                media milla (pedidos_completados). Toggle Mensual/Diario propio.
                Oculto en modoExterno (portal de clientes). */}
            {!modoExterno && (
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
            )}

            {/* 🎯 On Time por período — mismo chrome/toggle que el gráfico de
                cajas. Carga junto con la data (mismo fetch del informe de
                guías); mientras consulta muestra su skeleton. Barras apiladas
                por FECHA DE EMISIÓN con la división real de estados del TMS
                (SEGMENTOS_OT): ENTREGADO partido en cumplieron/no cumplieron
                + En distribución / Tránsito / Pendiente / Con novedad / Sin
                info. */}
            {(!modoExterno || pestanaPortal === 'gerenciales') && (cargandoGuias ? (
              <SkeletonGrafico bajo />
            ) : (
              <div className="IG-graficoContainer">
                {dataOT.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader">
                      <div className="IG-graficoTituloWrap">
                        <h2 className="IG-graficoTitulo">
                          🎯 On Time por período
                          <span className="IG-graficoBadge">{diaOT && bucketDiaOT ? 'Día' : vistaOT === 'diaria' ? 'Diario' : 'Mensual'}</span>
                          <span className="IG-graficoBadge DC-badgeRango">{rangoFiltros}</span>
                        </h2>
                      </div>
                      <div className="IG-graficoAcciones">
                        <button
                          className="DC-botonExcelOT"
                          onClick={exportarOTExcel}
                          disabled={exportandoOT}
                          title="Descarga Excel: resumen On Time de la vista activa + base de guías del filtro vigente (año/mes/cliente)"
                        >
                          <span className="DC-iconoExcel" aria-hidden="true">X</span>
                          {exportandoOT ? 'Generando…' : 'Excel'}
                        </button>
                        <div className="IG-toggleGrupo" role="group" aria-label="Vista On Time">
                          <button className={`IG-toggleBtn ${vistaOT === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => alternarVistaOT('mensual')}>Mensual</button>
                          <button className={`IG-toggleBtn ${vistaOT === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => alternarVistaOT('diaria')}>Diario</button>
                        </div>
                      </div>
                    </div>
                    {/* Leyenda interactiva (rediseño UX 2026-10-30): estados
                        como chips compactos — tap para filtrar (multi). Chip
                        activo = tinte de su color; inactivo = atenuado. En
                        móvil colapsable con resumen; en desktop siempre
                        visible. Instrucciones SEPARADAS: esta franja solo
                        resume el filtro (izq.) y la acción de barra (der.);
                        «por fecha de emisión» pasó al header (DC-otCtx). */}
                    <div className="DC-otLeyenda">
                      <button
                        type="button"
                        className="DC-otLeyendaToggle"
                        onClick={() => setLeyendaOTAbierta(a => !a)}
                        aria-expanded={leyendaOTAbierta}
                        aria-controls="dc-ot-leyenda"
                      >
                        <span aria-hidden="true">▤</span> Estados
                        <span className="DC-otLeyendaResumen">
                          {segSelOT.size > 0 ? `${segActivosOT.length} de ${SEGMENTOS_OT.length} visibles` : `${SEGMENTOS_OT.length} en total`}
                        </span>
                        <span className="DC-otLeyendaFlecha" style={{ transform: leyendaOTAbierta ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </button>
                      <div id="dc-ot-leyenda" className={`DC-otLeyendaChips ${leyendaOTAbierta ? '' : 'DC-otLeyendaOcultos'}`}>
                        {SEGMENTOS_OT.map(s => {
                          const activo = segSelOT.size === 0 || segSelOT.has(s.clave as string);
                          const sel = segSelOT.size > 0 && activo;
                          return (
                            <button
                              key={s.clave}
                              type="button"
                              className={`DC-otChip ${!activo ? 'DC-otChipOff' : ''}`}
                              style={sel ? { borderColor: `${s.color}80`, background: `${s.color}14` } : undefined}
                              onClick={() => alternarSegmentoOT(s.clave as string)}
                              title={`${s.explica}
${sel ? 'Quitar de la selección' : 'Ver solo este estado (toca varios para combinar)'}`}
                            >
                              <span className="DC-otChipPunto" style={{ background: s.color }} aria-hidden="true" />
                              {s.etiqueta}
                            </button>
                          );
                        })}
                      </div>
                      <div className="DC-otLeyendaInfo">
                        {segSelOT.size > 0 ? (
                          <button type="button" className="DC-otLeyendaTodo" onClick={() => setSegSelOT(new Set())} title="Volver a ver todos los estados">
                            ↺ Ver todos
                          </button>
                        ) : (
                          <span>Toca un estado para filtrar</span>
                        )}
                        <span className="DC-otLeyendaBarra">
                          {diaOT && bucketDiaOT
                            ? 'Toca una barra para ver sus guías'
                            : vistaOT === 'mensual'
                              ? 'Toca una barra para ver sus días'
                              : 'Toca un día para ver su detalle'}
                        </span>
                      </div>
                    </div>
                    {/* key por vista/filtros aplicados (incluido el sub-grupo y
                        el zoom de día): al cambiar (vista, clic en barra, migas)
                        se re-monta y entra con la animación DC-swapOT
                        (fade+slide) + barras creciendo. */}
                    <div className="DC-scrollOT">
                    <div
                      key={`${vistaOT}-${diaOT ?? ''}-${[...segSelOT].sort().join(',')}|${filtrosAplicados.anios.join(',')}|${filtrosAplicados.meses.join(',')}|${grupoAplicado ?? ''}`}
                      className="DC-swapOT"
                      style={{ width: '100%', height: 320, minWidth: diaOT ? undefined : anchoMinOT(dataOTVis.length) }}
                    >
                      {diaOT && bucketDiaOT ? (
                        /* Zoom de día: barras HORIZONTALES, una por segmento
                           >0 del día (mismo orden y color de la pila). Clic en
                           una barra → tabla de detalle con las guías de ese
                           día+segmento (clic en la activa la cierra). */
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart
                            data={segmentosDiaOT}
                            layout="vertical"
                            margin={{ top: 16, right: 48, left: 16, bottom: 8 }}
                            style={{ cursor: 'pointer' }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              type="number"
                              allowDecimals={false}
                              tickFormatter={(v: number) => formatearEntero(v)}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              type="category"
                              dataKey="etiqueta"
                              width={130}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                              content={(props: any) => {
                                if (!props.active || !props.payload?.length) return null;
                                const s = props.payload[0].payload as { etiqueta: string; cantidad: number };
                                const pctDia = bucketDiaOT.total > 0 ? Math.round((s.cantidad / bucketDiaOT.total) * 100) : null;
                                const pct = pctOT(bucketDiaOT);
                                return (
                                  <div className="IG-tooltipSerie">
                                    <p className="IG-tooltipSerieFecha">
                                      {format(parseISO(diaOT), "d 'de' MMMM yyyy", { locale: es })} <span style={{ color: '#8aa0b8' }}>(emisión)</span>
                                    </p>
                                    <p><b>{s.etiqueta}</b>: {formatearEntero(s.cantidad)}{pctDia != null ? ` (${pctDia}% del día)` : ''}</p>
                                    <p className="IG-tooltipSerieSub">
                                      Guías del día: {formatearEntero(bucketDiaOT.total)} · % OT: {pct ?? '—'}
                                    </p>
                                  </div>
                                );
                              }}
                              cursor={{ fill: 'rgba(15, 25, 40, 0.06)' }}
                            />
                            <Bar
                              dataKey="cantidad"
                              name="Guías"
                              radius={[0, 4, 4, 0]}
                              onClick={(data: any) => abrirDetalleSegmento(String(data?.payload?.etiqueta ?? ''))}
                              isAnimationActive={ANIM_BARRAS.isAnimationActive}
                              animationDuration={ANIM_BARRAS.animationDuration}
                              animationEasing={ANIM_BARRAS.animationEasing}
                            >
                              {segmentosDiaOT.map(s => (
                                <Cell key={s.etiqueta} fill={s.color} />
                              ))}
                              <LabelList
                                dataKey="cantidad"
                                position="right"
                                offset={8}
                                formatter={(v: number) => (v > 0 ? `${v}` : '')}
                                style={{ fill: '#0f1928', fontSize: 11, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart
                            data={dataOTVis}
                            margin={{ top: 24, right: 20, left: 20, bottom: 10 }}
                            onClick={clicBarraOT}
                            style={{ cursor: 'pointer' }}
                          >
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
                          {segActivosOT.map((s, i) => (
                            <Bar
                              key={s.clave}
                              dataKey={s.clave as string}
                              name={s.etiqueta}
                              stackId="ot"
                              fill={s.color}
                              isAnimationActive={ANIM_BARRAS.isAnimationActive}
                              animationDuration={ANIM_BARRAS.animationDuration}
                              animationEasing={ANIM_BARRAS.animationEasing}
                            >
                              {i === segActivosOT.length - 1 && (
                                <LabelList
                                  dataKey="totalSel"
                                  position="top"
                                  offset={10}
                                  formatter={(v: number) => (v > 0 ? `${v}` : '')}
                                  style={{ fill: '#0f1928', fontSize: 10, fontWeight: 700 }}
                                />
                              )}
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                      )}
                    </div>
                    </div>

                    {/* Detalle del día (2026-10-30): tabla con las guías del
                        día + segmento cuya barra se clicó — misma info que el
                        informe (chips de estado/OT/novedad) + export Excel de
                        SOLO esas filas. Clic en la barra activa o ✕ la cierra. */}
                    {diaOT && bucketDiaOT && detalleSegOT && (() => {
                      const seg = SEGMENTOS_OT.find(s => s.clave === detalleSegOT)!;
                      return (
                        /* Modal del detalle del día: overlay + tarjeta centrada
                           (cierre con ✕, clic en el fondo o Escape). */
                        <div className="DC-modalFondo" onClick={() => setDetalleSegOT(null)}>
                        <div
                          className="DC-modalCard DC-detalleDia"
                          role="dialog"
                          aria-modal="true"
                          aria-label={`Detalle del día: ${seg.etiqueta}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="DC-detalleDiaHeader">
                            <h3 className="DC-detalleDiaTitulo">
                              <span className="IG-tooltipEtapa" style={{ background: seg.color }} />
                              {seg.etiqueta} · {format(parseISO(diaOT), "d 'de' MMMM yyyy", { locale: es })}
                              <span className="DC-detalleDiaN">
                                {cargandoDetalleOT ? 'cargando…' : `${formatearEntero(filasDetalleDia.length)} guías`}
                              </span>
                            </h3>
                            <div className="DC-detalleDiaAcciones">
                              <button
                                className="DC-botonExcelOT"
                                onClick={exportarDetalleDia}
                                disabled={!filasDetalleDia.length}
                                title="Descargar estas guías en Excel (mismas columnas que el informe)"
                              >
                                <span className="DC-iconoExcel" aria-hidden="true">X</span> Excel
                              </button>
                              <button className="DC-detalleDiaCerrar" onClick={() => setDetalleSegOT(null)} title="Cerrar el detalle">
                                ✕
                              </button>
                            </div>
                          </div>
                          {!cargandoDetalleOT && (
                            filasDetalleDia.length === 0 ? (
                              <div className="IG-sinDatos"><p>No hay guías en este segmento para el día</p></div>
                            ) : (
                              <div className="DC-detalleDiaTabla">
                                <table className="IG-tabla">
                                  <thead>
                                    <tr>
                                      <th>Guía</th>
                                      <th>Destino</th>
                                      <th>Destinatario</th>
                                      <th>F. Emisión</th>
                                      <th>Estado</th>
                                      <th>F. Entrega</th>
                                      <th title="Fecha límite: la de CITA si es válida; si no, emisión + promesa del destino (días hábiles)">F. Promesa</th>
                                      <th title="Días hábiles transcurridos (sin sáb/dom/festivos)">Días háb.</th>
                                      <th title="1 = entregada dentro de la fecha promesa; 0 = tarde; — = no evaluable">OT</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filasDetalleDia.map(f => (
                                      <tr key={f.guia}>
                                        <td className="DC-guiaCeldaNum">{f.guia}</td>
                                        <td className="DC-guiaCeldaDest">{f.ciudad_destino || '—'}</td>
                                        <td className="DC-guiaCeldaDest">{f.destinatario ?? '—'}</td>
                                        <td>{formatearFecha(f.fecha_emision).replaceAll('-', '/')}</td>
                                        <td>
                                          {f.novedad ? (
                                            <span
                                              className="DC-guiaChip DC-guiaChipJustificada"
                                              title={`Novedad reportada — causal: ${f.novedad.causal}. ${f.novedad.justificacion}${f.novedad.nombre || f.novedad.usuario ? ` (registró: ${f.novedad.nombre || f.novedad.usuario})` : ''}`}
                                            >
                                              💬 {f.novedad.causal}
                                            </span>
                                          ) : f.estado ? (
                                            <span className={`DC-guiaChip ${claseChipEstado(f.estado)}`}>{f.estado}</span>
                                          ) : (
                                            <span title={`Estado original del TMS: ${f.estado_crudo || '(vacío)'}`}>—</span>
                                          )}
                                        </td>
                                        <td>{formatearFecha(f.fecha_entrega).replaceAll('-', '/')}</td>
                                        <td>
                                          {f.fecha_promesa
                                            ? <span title={f.origen_promesa === 'CITA' ? 'Promesa: fecha de cita' : 'Promesa: emisión + días del destino (hábiles)'}>
                                                {formatearFecha(f.fecha_promesa).replaceAll('-', '/')}
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
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          )}
                        </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="IG-sinDatos">
                    <p>No hay guías evaluables On Time para el período seleccionado</p>
                  </div>
                )}
              </div>
            ))}

            {/* (2026-10-30) OT desagregado por campo del TMS — barras
                horizontales del período filtrado: ciudad_destino y
                destinatario (top 12 por guías evaluables; % como longitud,
                color por umbral). Solo en el portal de clientes. */}
            {/* Lado a lado en pantallas grandes (grid 2 columnas ≥1200px,
                apilados abajo de ese ancho). */}
            {modoExterno && pestanaPortal === 'gerenciales' && (cargandoGuias ? (
              <div className="DC-portalGrid">
                <SkeletonGrafico bajo />
                <SkeletonGrafico bajo />
              </div>
            ) : (
              <div className="DC-portalGrid">
                {graficoOTCampo('🗺 On Time por ciudad de destino', otPorCiudad, 'ciudad')}
                {graficoOTCampo('🏥 On Time por destinatario', otPorDestinatario, 'dest')}
              </div>
            ))}

            {/* 🚛 Uso de vehículos solicitados — drill-down: promedio % de uso
                por tipo solicitado → evolución por período → destino → tabla
                casi a nivel de consecutivo. % de uso = kg reales / tope de la
                categoría del tipo solicitado (TRACTOMULA: 34.000 kg de
                referencia). Todo se agrupa en el frontend con las filas de
                /uso-vehiculos (una por consecutivo_vehiculo).
                Oculto en modoExterno (portal de clientes). */}
            {!modoExterno && (
            cargandoUso ? (
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
            ))}

            {/* Informe de guías TMS — SOLO dashboard interno (2026-10-30: en el
                portal de clientes se quitó; su fetch sigue siendo el que
                alimenta las series del gráfico OT). Colapsable.
                planilla_siscore (Mongo, media milla) == guia (PostgreSQL
                informe_guias_tms); puede traer varias guías por coma → una
                fila por guía. Fetch perezoso al abrir. */}
            {!modoExterno && (
            <section className="DC-guiaSeccion">
              {/* Trazabilidad: guía, planilla o destinatario (parcial) → el
                  backend busca en TODO el histórico (ignora año/mes) y
                  reemplaza la tabla; el gráfico OT sigue con el período. */}
              <div className="DC-trazaBarra">
                <input
                  className="DC-trazaInput"
                  type="text"
                  placeholder="Trazabilidad: n° de guía, planilla o destinatario…"
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
                  🔎 Trazabilidad por <strong>{trazaActiva}</strong> — buscando en todo el histórico (los filtros de Año/Mes no aplican a esta tabla; el gráfico OT sigue con el período).
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
                    <div className="DC-guiaTile" title="Planillas distintas del TMS en el período (las que tienen n° asignado)">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.total_planillas)}</span>
                      <span className="DC-guiaTileLabel">Planillas</span>
                    </div>
                    <div className="DC-guiaTile DC-guiaTileExito">
                      <span className="DC-guiaTileValor">{formatearEntero(resumenGuias.entregadas)}</span>
                      <span className="DC-guiaTileLabel">Entregadas</span>
                    </div>
                    <div
                      className="DC-guiaTile DC-guiaTileOT"
                      title={`On Time: ${resumenGuias.ot_cumplen + resumenGuias.ot_justificadas}/${resumenGuias.ot_cumplen + resumenGuias.ot_no_cumplen + resumenGuias.ot_justificadas} guías cumplidas (dentro de la fecha promesa en días hábiles + justificadas)`}
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
                    <div className="DC-guiaTile DC-guiaTileMuta" title="Guías cuyo estado en el TMS no es reconocido (viene vacío o con basura)">
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
                      <div className="DC-guiaTablaWrapper">
                        <table className="IG-tabla">
                          <thead>
                            <tr>
                              <th>Guía</th>
                              <th title="N° de planilla del TMS (agrupa las guías del mismo viaje)">Planilla</th>
                              <th>Destino</th>
                              <th>Destinatario</th>
                              <th>F. Emisión</th>
                              <th>Piezas</th>
                              <th>Kilos</th>
                              <th>Estado</th>
                              <th>F. Entrega</th>
                              <th title="Fecha límite: la de CITA si es válida; si no, emisión + promesa del destino (días hábiles)">F. Promesa</th>
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
                                <td className="DC-guiaCeldaNum">{f.planilla ?? '—'}</td>
                                <td className="DC-guiaCeldaDest">{f.ciudad_destino || '—'}</td>
                                <td className="DC-guiaCeldaDest">{f.destinatario ?? '—'}</td>
                                <td>{formatearFecha(f.fecha_emision)}</td>
                                <td className="DC-guiaCeldaNum">{f.piezas != null ? formatearEntero(f.piezas) : '—'}</td>
                                <td className="DC-guiaCeldaNum">{f.kilos != null ? formatearEntero(f.kilos) : '—'}</td>
                                <td>
                                  {f.novedad ? (
                                    <span
                                      className="DC-guiaChip DC-guiaChipJustificada"
                                      title={`Novedad reportada — causal: ${f.novedad.causal}. ${f.novedad.justificacion}${f.novedad.nombre || f.novedad.usuario ? ` (registró: ${f.novedad.nombre || f.novedad.usuario})` : ''}`}
                                    >
                                      💬 {f.novedad.causal}
                                    </span>
                                  ) : f.estado ? (
                                    <span className={`DC-guiaChip ${claseChipEstado(f.estado)}`}>{f.estado}</span>
                                  ) : (
                                    <span title={`Estado original del TMS: ${f.estado_crudo || '(vacío)'}`}>—</span>
                                  )}
                                </td>
                                <td>{formatearFecha(f.fecha_entrega)}</td>
                                <td>
                                  {f.fecha_promesa
                                    ? <span title={f.origen_promesa === 'CITA' ? 'Promesa: fecha de cita' : 'Promesa: emisión + días del destino (hábiles)'}>
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
                      {paginacionGuias && paginacionGuias.total > 0 && (
                        <div className="DC-guiaPaginacion">
                          <span className="DC-guiaPagInfo">
                            Mostrando {formatearEntero(filasGuias.length)} de {formatearEntero(paginacionGuias.total)} guías
                          </span>
                          {paginacionGuias.hay_mas && (
                            <button className="DC-guiaBotonExportar" onClick={cargarMasGuias} disabled={cargandoMasGuias}>
                              {cargandoMasGuias ? 'Cargando…' : `＋ Cargar más (${paginacionGuias.limite})`}
                            </button>
                          )}
                        </div>
                      )}
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
            )}
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
