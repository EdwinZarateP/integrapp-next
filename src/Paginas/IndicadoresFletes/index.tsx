'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaDownload, FaCoins } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
// Chrome compartido con Transporte + extras propios de Fletes
import '../IndicadoresTransporte/estilos.css';
import './estilos.css';

type SerieMes = { mes: string; cobrado: number; teorico: number; despachos: number };
type SerieDia = { fecha: string; cobrado: number; teorico: number; despachos: number };
type SerieCosto = { fecha?: string; mes?: string; cobrado: number; piezas: number; costo: number };
type ItemFleteSerie = { fecha: string; cobrado: number; teorico: number; base: number; sobrecosto: number; ahorro: number; despachos: number };
type CausalSobrecosto = { causal: string; cantidad: number; sobrecosto: number };
type ItemFlete = { cliente?: string; ruta?: string; tipo_vehiculo?: string; regional?: string; flete: number; sobrecosto?: number; despachos: number; toneladas?: number };
type ItemRutaSobrecosto = { ruta: string; sobrecosto: number; despachos: number };
type ItemRegionalSobrecosto = { regional: string; sobrecosto: number; despachos: number };

type ApiResponse = {
  success: boolean;
  data?: {
    serieMensual: SerieMes[];
    serieDiaria: SerieDia[];
    costoPorCajaMensual: SerieCosto[];
    costoPorCajaDiaria: SerieCosto[];
    costoPorCajaYTD: number;
    anioYTD: number;
    porCliente: ItemFlete[];
    porRuta: ItemRutaSobrecosto[];
    porTipoVeh: ItemFlete[];
    sobrecostoPorRegional: ItemRegionalSobrecosto[];
    causalesSobrecosto: CausalSobrecosto[];
    anios: number[];
    clientes: string[];
  };
  error?: string;
};

const MESES = [
  { valor: 1, nombre: 'Enero' }, { valor: 2, nombre: 'Febrero' },
  { valor: 3, nombre: 'Marzo' }, { valor: 4, nombre: 'Abril' },
  { valor: 5, nombre: 'Mayo' }, { valor: 6, nombre: 'Junio' },
  { valor: 7, nombre: 'Julio' }, { valor: 8, nombre: 'Agosto' },
  { valor: 9, nombre: 'Septiembre' }, { valor: 10, nombre: 'Octubre' },
  { valor: 11, nombre: 'Noviembre' }, { valor: 12, nombre: 'Diciembre' },
];

// Opciones del filtro Regional (bodega de origen). Coincide con REGIONES de SolicitudVehiculos.
const REGIONES = ['GALAPA', 'YUMBO', 'BUCARAMANGA', 'FUNZA', 'GIRARDOTA'];

const COLORES_PIE = ['#0f1928', '#1e3a5f', '#2d4f7a', '#3b82f6', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7'];

const IndicadoresFletes: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const clienteFiltroRef = useRef<HTMLDivElement>(null);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serieMensual, setSerieMensual] = useState<SerieMes[]>([]);
  const [serieDiaria, setSerieDiaria] = useState<SerieDia[]>([]);

  // Vista del gráfico "Flete facturado": diario (default) o mensual
  const [vistaSerie, setVistaSerie] = useState<'diaria' | 'mensual'>('diaria');
  // Vista del gráfico "Costo por caja": diario (default) o mensual
  const [vistaCosto, setVistaCosto] = useState<'diaria' | 'mensual'>('diaria');
  const [costoPorCajaDiaria, setCostoPorCajaDiaria] = useState<SerieCosto[]>([]);
  const [costoPorCajaMensual, setCostoPorCajaMensual] = useState<SerieCosto[]>([]);
  const [costoYTD, setCostoYTD] = useState(0);
  const [anioYTD, setAnioYTD] = useState(new Date().getFullYear());
  const [porCliente, setPorCliente] = useState<ItemFlete[]>([]);
  const [porRuta, setPorRuta] = useState<ItemRutaSobrecosto[]>([]);
  const [porTipoVeh, setPorTipoVeh] = useState<ItemFlete[]>([]);
  const [sobrecostoPorRegional, setSobrecostoPorRegional] = useState<ItemRegionalSobrecosto[]>([]);
  const [causalesSobrecosto, setCausalesSobrecosto] = useState<CausalSobrecosto[]>([]);

  // Filtros en pantalla (no disparan fetch hasta "Filtrar")
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [aniosSeleccionados, setAniosSeleccionados] = useState<number[]>([new Date().getFullYear()]);
  const [mesesSeleccionados, setMesesSeleccionados] = useState<number[]>([]);
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([]);
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>([]);
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [regionalSeleccionada, setRegionalSeleccionada] = useState<string>('');
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [dropdownAnioAbierto, setDropdownAnioAbierto] = useState(false);
  const [dropdownMesAbierto, setDropdownMesAbierto] = useState(false);
  const [dropdownDiaAbierto, setDropdownDiaAbierto] = useState(false);
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false);
  const [dropdownRegionalAbierto, setDropdownRegionalAbierto] = useState(false);

  // Filtros aplicados (los que realmente se consultan)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    anios: [new Date().getFullYear()] as number[],
    meses: [] as number[],
    dias: [] as number[],
    clientes: [] as string[],
    regional: '',
  });

  // Días ofrecidos en el dropdown: si hay un solo mes seleccionado, hasta el último
  // día de ese mes (considerando año bisiesto si hay un solo año); si no, 1..31.
  const diasDisponibles = useMemo(() => {
    if (mesesSeleccionados.length === 1) {
      const mes = mesesSeleccionados[0];
      const anioBase = aniosSeleccionados.length === 1 ? aniosSeleccionados[0] : new Date().getFullYear();
      const ultimo = new Date(anioBase, mes, 0).getDate();
      return Array.from({ length: ultimo }, (_, i) => i + 1);
    }
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }, [mesesSeleccionados, aniosSeleccionados]);

  // Si al cambiar el mes/año algún día seleccionado queda fuera de rango, se quita.
  useEffect(() => {
    setDiasSeleccionados(prev => prev.filter(d => diasDisponibles.includes(d)));
  }, [diasDisponibles]);

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
  const formatearNumero = (num: number): string => new Intl.NumberFormat('es-CO').format(num || 0);

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
      filtrosAplicados.dias.forEach(d => params.append('dia', String(d)));
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      if (filtrosAplicados.regional) params.append('regional', filtrosAplicados.regional);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-fletes/resumen?${params.toString()}`);
      if (!response.ok) throw new Error('Error al obtener datos');
      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setSerieMensual(data.data.serieMensual || []);
        setSerieDiaria(data.data.serieDiaria || []);
        setCostoPorCajaMensual(data.data.costoPorCajaMensual || []);
        setCostoPorCajaDiaria(data.data.costoPorCajaDiaria || []);
        setCostoYTD(data.data.costoPorCajaYTD || 0);
        setAnioYTD(data.data.anioYTD || new Date().getFullYear());
        setPorCliente(data.data.porCliente || []);
        setPorRuta(data.data.porRuta || []);
        setPorTipoVeh(data.data.porTipoVeh || []);
        setSobrecostoPorRegional(data.data.sobrecostoPorRegional || []);
        setCausalesSobrecosto(data.data.causalesSobrecosto || []);
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
      dias: diasSeleccionados,
      clientes: clientesSeleccionados,
      regional: regionalSeleccionada,
    });
  };

  useEffect(() => { obtenerDatos(); /* eslint-disable-next-line */ }, [filtrosAplicados]);

  // Causales de sobrecosto para el pie: tamaño de porción = $ sobrecosto por causal
  const causalesData = useMemo(() =>
    (causalesSobrecosto || [])
      .map(c => ({ name: c.causal, value: Math.round(c.sobrecosto || 0), cantidad: c.cantidad || 0 }))
      .filter(r => r.value > 0),
    [causalesSobrecosto]);

  // Totales para el subtítulo de la torta de causales
  const causalesTotales = useMemo(() => {
    const sobrecosto = causalesData.reduce((s, c) => s + c.value, 0);
    const envios = causalesData.reduce((s, c) => s + (c.cantidad || 0), 0);
    return { sobrecosto, envios };
  }, [causalesData]);

  // Datos del gráfico "Flete facturado" según la vista (diaria/mensual). Cada item lleva
  // base (gris = min(cobrado,teórico)), sobrecosto (rojo) y ahorro (verde).
  const dataChart = useMemo<ItemFleteSerie[]>(() => {
    const origen: SerieDia[] | SerieMes[] = vistaSerie === 'diaria' ? serieDiaria : serieMensual;
    return origen.map((d) => {
      const cobrado = d.cobrado || 0;
      const teorico = d.teorico || 0;
      const fecha = ('fecha' in d ? d.fecha : d.mes) as string;
      return {
        fecha,
        cobrado,
        teorico,
        base: Math.min(cobrado, teorico),
        sobrecosto: Math.max(cobrado - teorico, 0),
        ahorro: Math.max(teorico - cobrado, 0),
        despachos: d.despachos || 0,
      };
    });
  }, [vistaSerie, serieDiaria, serieMensual]);

  // Datos del gráfico "Costo por caja" según la vista (diaria/mensual). costo = flete
  // cobrado / piezas (promedio ponderado por bucket, viene calculado del backend).
  const dataCosto = useMemo(() => {
    const origen: SerieCosto[] = vistaCosto === 'diaria' ? costoPorCajaDiaria : costoPorCajaMensual;
    return origen.map((d) => ({
      fecha: (d.fecha ?? d.mes) as string,
      costo: d.costo || 0,
      cobrado: d.cobrado || 0,
      piezas: d.piezas || 0,
    }));
  }, [vistaCosto, costoPorCajaDiaria, costoPorCajaMensual]);

  // Clientes filtrados por búsqueda en el dropdown (limitado para no colgar el render)
  const clientesFiltradosDropdown = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    const res = q ? clientesDisponibles.filter(c => c.toLowerCase().includes(q)) : clientesDisponibles;
    return res.slice(0, 80);
  }, [clientesDisponibles, busquedaCliente]);

  const hasFiltrosActivos =
    filtrosAplicados.clientes.length > 0 ||
    filtrosAplicados.meses.length > 0 ||
    filtrosAplicados.dias.length > 0 ||
    !!filtrosAplicados.regional ||
    JSON.stringify([...filtrosAplicados.anios].sort()) !== JSON.stringify([new Date().getFullYear()]);

  // Exportar la serie visible (diaria o mensual, según la vista) a CSV (Excel-ES)
  const exportarSerie = () => {
    const origen: SerieDia[] | SerieMes[] = vistaSerie === 'diaria' ? serieDiaria : serieMensual;
    if (!origen.length) return;
    const colFecha = vistaSerie === 'diaria' ? 'Día' : 'Mes';
    const fmtFecha = (f: string) =>
      vistaSerie === 'diaria'
        ? format(parseISO(f), 'dd/MM/yyyy')
        : format(parseISO(f + '-01'), 'MM/yyyy');
    const cabeceras = [colFecha, 'Flete teórico', 'Flete cobrado', 'Diferencia', 'Despachos'];
    const filas = origen.map((d) => {
      const fecha = ('fecha' in d ? d.fecha : d.mes) as string;
      const cobrado = d.cobrado || 0;
      const teorico = d.teorico || 0;
      return [fmtFecha(fecha), Math.round(teorico), Math.round(cobrado), Math.round(cobrado - teorico), d.despachos || 0];
    });
    const csv = [cabeceras, ...filas].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fletes_${vistaSerie === 'diaria' ? 'diario' : 'mensual'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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

  // Etiqueta del eje X del gráfico "Flete facturado" según la vista
  const formatoEjeSerie = (val: string) => {
    try {
      if (vistaSerie === 'diaria') return format(parseISO(val), 'd MMM', { locale: es });
      return format(parseISO(val + '-01'), 'MMM yy', { locale: es });
    } catch { return val; }
  };

  // Tooltip personalizado del gráfico "Flete facturado"
  const tooltipSerie = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as ItemFleteSerie;
    const dif = d.cobrado - d.teorico;
    const fechaTxt = vistaSerie === 'diaria'
      ? format(parseISO(d.fecha), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.fecha + '-01'), 'MMMM yyyy', { locale: es });
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p>Flete cobrado: <b>{formatearMoneda(d.cobrado)}</b></p>
        <p>Flete teórico: <b>{formatearMoneda(d.teorico)}</b></p>
        <p>Diferencia:{' '}
          <b className={dif > 0 ? 'IG-difPos' : dif < 0 ? 'IG-difNeg' : 'IG-difCero'}>
            {dif > 0 ? '+' : ''}{formatearMoneda(dif)}
          </b>
        </p>
        <p className="IG-tooltipSerieSub">{formatearNumero(d.despachos)} despachos</p>
      </div>
    );
  };

  // Etiqueta del eje X del gráfico "Costo por caja" según la vista
  const formatoEjeCosto = (val: string) => {
    try {
      if (vistaCosto === 'diaria') return format(parseISO(val), 'd MMM', { locale: es });
      return format(parseISO(val + '-01'), 'MMM yy', { locale: es });
    } catch { return val; }
  };

  // Tooltip del gráfico "Costo por caja": costo/caja, flete cobrado, piezas y comparación
  // contra el promedio YTD del año en curso (rojo si queda por encima, verde si debajo).
  const tooltipCosto = (props: any) => {
    if (!props.active || !props.payload || !props.payload.length) return null;
    const d = props.payload[0].payload as { fecha: string; costo: number; cobrado: number; piezas: number };
    const diff = d.costo - costoYTD;
    const fechaTxt = vistaCosto === 'diaria'
      ? format(parseISO(d.fecha), "d 'de' MMMM yyyy", { locale: es })
      : format(parseISO(d.fecha + '-01'), 'MMMM yyyy', { locale: es });
    return (
      <div className="IG-tooltipSerie">
        <p className="IG-tooltipSerieFecha">{fechaTxt}</p>
        <p>Costo por caja: <b>{formatearMoneda(d.costo)}</b></p>
        <p className="IG-tooltipSerieSub">Flete cobrado: {formatearMoneda(d.cobrado)} · {formatearNumero(d.piezas)} cajas</p>
        <p>vs. promedio {anioYTD}:{' '}
          <b className={diff > 0 ? 'IG-difPos' : diff < 0 ? 'IG-difNeg' : 'IG-difCero'}>
            {diff > 0 ? '+' : ''}{formatearMoneda(diff)}
          </b>
        </p>
      </div>
    );
  };

  // Intervalo del eje X para no amontonar etiquetas cuando hay muchos días
  const intervalSerie = dataChart.length > 1 ? Math.max(0, Math.ceil(dataChart.length / 12) - 1) : 0;
  // Mismo cálculo para el eje X del gráfico "Costo por caja"
  const intervalCosto = dataCosto.length > 1 ? Math.max(0, Math.ceil(dataCosto.length / 12) - 1) : 0;

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
            <span className="IG-tituloDesktop">Indicadores de Fletes</span>
            <span className="IG-tituloMobile">Fletes</span>
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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownAnioAbierto(!dropdownAnioAbierto); setDropdownMesAbierto(false); setDropdownDiaAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); }}>
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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownMesAbierto(!dropdownMesAbierto); setDropdownAnioAbierto(false); setDropdownDiaAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); }}>
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

          {/* Día */}
          <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
            <label>Día:</label>
            <div className="IG-dropdownFiltro">
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownDiaAbierto(!dropdownDiaAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); }}>
                <span className="IG-dropdownFiltroTexto">
                  {diasSeleccionados.length === 0 ? 'Todos' : diasSeleccionados.length === 1 ? String(diasSeleccionados[0]) : `${diasSeleccionados.length} días`}
                </span>
                <span className="IG-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownDiaAbierto && (
                <div className="IG-dropdownFiltroLista IG-dropdownDiaLista">
                  <label className={`IG-dropdownFiltroItem ${diasSeleccionados.length === 0 ? 'seleccionado' : ''}`}>
                    <input type="checkbox" checked={diasSeleccionados.length === 0} onChange={() => setDiasSeleccionados([])} />
                    Todos
                  </label>
                  {diasDisponibles.map(d => (
                    <label key={d} className={`IG-dropdownFiltroItem ${diasSeleccionados.includes(d) ? 'seleccionado' : ''}`}>
                      <input type="checkbox" checked={diasSeleccionados.includes(d)} onChange={() => setDiasSeleccionados(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))} />
                      {d}
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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownClienteAbierto(!dropdownClienteAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownDiaAbierto(false); setDropdownRegionalAbierto(false); }}>
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

          {/* Regional */}
          <div className="IG-filtroGrupo" style={{ position: 'relative' }}>
            <label>Regional:</label>
            <div className="IG-dropdownFiltro">
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownRegionalAbierto(!dropdownRegionalAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownDiaAbierto(false); setDropdownClienteAbierto(false); }}>
                <span className="IG-dropdownFiltroTexto">{regionalSeleccionada || 'Todas'}</span>
                <span className="IG-dropdownFiltroFlecha">▾</span>
              </button>
              {dropdownRegionalAbierto && (
                <div className="IG-dropdownFiltroLista">
                  <label className={`IG-dropdownFiltroItem ${!regionalSeleccionada ? 'seleccionado' : ''}`}>
                    <input type="checkbox" checked={!regionalSeleccionada} onChange={() => setRegionalSeleccionada('')} />
                    Todas
                  </label>
                  {REGIONES.map(r => (
                    <label key={r} className={`IG-dropdownFiltroItem ${regionalSeleccionada === r ? 'seleccionado' : ''}`}>
                      <input type="checkbox" checked={regionalSeleccionada === r} onChange={() => setRegionalSeleccionada(r)} />
                      {r}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="IG-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownDiaAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); setBusquedaCliente(''); }}>
            <FaCoins /> Filtrar
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
          {filtrosAplicados.dias.length > 0 && (
            <button className="IG-filtroChip" onClick={() => { setDiasSeleccionados([]); setFiltrosAplicados(f => ({ ...f, dias: [] })); }}>
              Días: {filtrosAplicados.dias.join(', ')} ✕
            </button>
          )}
          {filtrosAplicados.clientes.length > 0 && filtrosAplicados.clientes.map(c => (
            <button key={c} className="IG-filtroChip" onClick={() => { const n = clientesSeleccionados.filter(x => x !== c); setClientesSeleccionados(n); setFiltrosAplicados(f => ({ ...f, clientes: n })); }}>
              {c} ✕
            </button>
          ))}
          {filtrosAplicados.regional && (
            <button className="IG-filtroChip" onClick={() => { setRegionalSeleccionada(''); setFiltrosAplicados(f => ({ ...f, regional: '' })); }}>
              Regional: {filtrosAplicados.regional} ✕
            </button>
          )}
          <button className="IG-filtroLimpiar" onClick={() => { const def = [new Date().getFullYear()]; setAniosSeleccionados(def); setMesesSeleccionados([]); setDiasSeleccionados([]); setClientesSeleccionados([]); setRegionalSeleccionada(''); setFiltrosAplicados({ anios: def, meses: [], dias: [], clientes: [], regional: '' }); }}>
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
            <p>Cargando indicadores de fletes...</p>
          </div>
        ) : error ? (
          <div className="IG-error">
            <p>{error}</p>
            <button className="IG-reintentar" onClick={obtenerDatos}>Reintentar</button>
          </div>
        ) : (
          <>
            {/* Flete facturado: diario/mensual con sobrecosto (rojo) y ahorro (verde) */}
            <div className="IG-graficoContainer">
              {dataChart.length > 0 ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">
                        📈 Flete facturado
                        <span className="IG-graficoBadge">{vistaSerie === 'diaria' ? 'Diario' : 'Mensual'}</span>
                      </h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                        <button className={`IG-toggleBtn ${vistaSerie === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaSerie('diaria')}>Diario</button>
                        <button className={`IG-toggleBtn ${vistaSerie === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaSerie('mensual')}>Mensual</button>
                      </div>
                      <button className="IG-botonExportar" onClick={exportarSerie} title="Exportar serie a Excel">
                        <FaDownload /> Exportar
                      </button>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={dataChart} margin={{ top: 36, right: 20, left: 20, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="fecha"
                          tickFormatter={formatoEjeSerie}
                          interval={intervalSerie}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                        <Tooltip content={tooltipSerie} cursor={{ fill: 'rgba(15,25,40,0.05)' }} />
                        <Legend />
                        <Bar dataKey="base" stackId="a" fill="#9ca3af" name="Flete (común)" isAnimationActive={false} />
                        <Bar dataKey="sobrecosto" stackId="a" fill="#dc2626" name="Sobrecosto" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                        {/* Bar "ahorro" = último del stack: su cima SIEMPRE coincide con la cima total
                            de la pila (aunque su segmento valga 0), por lo que un LabelList con
                            position="top" aquí cae en la cima real. Patrón igual a "Pedidos diarios"
                            de Transporte. dataKey="cobrado" muestra el flete solicitado. */}
                        <Bar dataKey="ahorro" stackId="a" fill="#16a34a" name="Ahorro" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          <LabelList
                            dataKey="cobrado"
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
                <div className="IG-sinDatos"><p>No hay datos de fletes para el período seleccionado</p></div>
              )}
            </div>

            {/* Fila: Sobrecosto por regional + Causales de sobrecosto */}
            <div className="IG-graficosFila">
              <div className="IG-graficoContainer">
                {sobrecostoPorRegional.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">📍 Sobrecosto por regional</h2></div>
                    <div className="IG-barrasHorizontales">
                      {(() => {
                        const total = sobrecostoPorRegional.reduce((s, c) => s + (c.sobrecosto || 0), 0) || 1;
                        const max = Math.max(...sobrecostoPorRegional.map(c => c.sobrecosto || 0)) || 1;
                        return sobrecostoPorRegional.map((c, i) => (
                          <div key={i} className="IG-barraHItem">
                            <div className="IG-barraHLabel" title={c.regional || 'SIN REGIONAL'}>
                              <span className="IG-barraHPunto" style={{ background: '#dc2626' }}></span>
                              <span className="IG-barraHNombre">{c.regional || 'SIN REGIONAL'}</span>
                            </div>
                            <div className="IG-barraHTrack">
                              <div className="IG-barraHFill" style={{ width: `${(((c.sobrecosto || 0) / max) * 100).toFixed(1)}%`, background: '#dc2626' }}>
                                <span className="IG-barraHValor">{formatearMonedaCorta(c.sobrecosto || 0)}</span>
                              </div>
                            </div>
                            <span className="IG-barraHPorcentaje">{(((c.sobrecosto || 0) / total) * 100).toFixed(1)}%</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : <div className="IG-sinDatos"><p>No hay sobrecostos por regional en el período seleccionado</p></div>}
              </div>

              <div className="IG-graficoContainer">
                {causalesData.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader">
                      <div className="IG-graficoTituloWrap">
                        <h2 className="IG-graficoTitulo">Causales de sobrecosto</h2>
                      </div>
                    </div>
                    <p className="IG-graficoSub">
                      Sobrecosto total <b>{formatearMoneda(causalesTotales.sobrecosto)}</b>
                      {' · '}{formatearNumero(causalesTotales.envios)} envíos con causal
                    </p>
                    <div className="IG-barrasHorizontales">
                      {(() => {
                        const total = causalesTotales.sobrecosto || 1;
                        const max = Math.max(...causalesData.map(c => c.value || 0)) || 1;
                        return causalesData.map((c, i) => (
                          <div key={i} className="IG-barraHItem">
                            <div className="IG-barraHLabel" title={c.name}>
                              <span className="IG-barraHPunto" style={{ background: '#dc2626' }}></span>
                              <span className="IG-barraHNombre">{c.name}</span>
                            </div>
                            <div className="IG-barraHTrack">
                              <div className="IG-barraHFill" style={{ width: `${((c.value / max) * 100).toFixed(1)}%`, background: '#dc2626' }}>
                                <span className="IG-barraHValor">{formatearMonedaCorta(c.value)}</span>
                              </div>
                            </div>
                            <span className="IG-barraHPorcentaje">{((c.value / total) * 100).toFixed(1)}%</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="IG-sinDatos"><p>No hay envíos con causal de sobrecosto en el período seleccionado</p></div>
                )}
              </div>
            </div>

            {/* Fila: Top rutas con sobrecosto + Costo por caja */}
            <div className="IG-graficosFila">
              {/* Top rutas con sobrecosto (solo rutas con diferencia > 0) */}
              <div className="IG-graficoContainer">
                {porRuta.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">🛣️ Top rutas con sobrecosto</h2></div>
                    <div className="IG-barrasHorizontales">
                      {(() => {
                        const total = porRuta.reduce((s, c) => s + (c.sobrecosto || 0), 0) || 1;
                        const max = Math.max(...porRuta.map(c => c.sobrecosto || 0)) || 1;
                        return porRuta.map((c, i) => (
                          <div key={i} className="IG-barraHItem">
                            <div className="IG-barraHLabel" title={c.ruta || 'Sin ruta'}>
                              <span className="IG-barraHPunto" style={{ background: '#dc2626' }}></span>
                              <span className="IG-barraHNombre">{c.ruta || 'Sin ruta'}</span>
                            </div>
                            <div className="IG-barraHTrack">
                              <div className="IG-barraHFill" style={{ width: `${(((c.sobrecosto || 0) / max) * 100).toFixed(1)}%`, background: '#dc2626' }}>
                                <span className="IG-barraHValor">{formatearMonedaCorta(c.sobrecosto || 0)}</span>
                              </div>
                            </div>
                            <span className="IG-barraHPorcentaje">{(((c.sobrecosto || 0) / total) * 100).toFixed(1)}%</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : <div className="IG-sinDatos"><p>No hay rutas con sobrecosto en el período seleccionado</p></div>}
              </div>

              {/* Costo por caja: total_solicitado / piezas, con promedio YTD del año en curso como referencia.
                  Rojo = por encima del promedio, verde = por debajo. */}
              <div className="IG-graficoContainer">
                {dataCosto.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader">
                      <div className="IG-graficoTituloWrap">
                        <h2 className="IG-graficoTitulo">
                          📦 Costo por caja
                          <span className="IG-graficoBadge">{vistaCosto === 'diaria' ? 'Diario' : 'Mensual'}</span>
                        </h2>
                      </div>
                      <div className="IG-graficoAcciones">
                        <div className="IG-toggleGrupo" role="group" aria-label="Vista del gráfico">
                          <button className={`IG-toggleBtn ${vistaCosto === 'diaria' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCosto('diaria')}>Diario</button>
                          <button className={`IG-toggleBtn ${vistaCosto === 'mensual' ? 'IG-toggleBtnActivo' : ''}`} onClick={() => setVistaCosto('mensual')}>Mensual</button>
                        </div>
                      </div>
                    </div>
                    <p className="IG-graficoSub">
                      Promedio {anioYTD} (YTD): <b>{formatearMoneda(costoYTD)}</b>
                      {' · '}<span style={{ color: '#dc2626' }}>●</span> sobre promedio
                      {' · '}<span style={{ color: '#16a34a' }}>●</span> bajo promedio
                    </p>
                    <div style={{ width: '100%', height: 380 }}>
                      <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={dataCosto} margin={{ top: 28, right: 20, left: 20, bottom: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="fecha" tickFormatter={formatoEjeCosto} interval={intervalCosto} tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                          <Tooltip content={tooltipCosto} cursor={{ fill: 'rgba(15,25,40,0.05)' }} />
                          <ReferenceLine y={costoYTD} stroke="#e8a000" strokeDasharray="5 5"
                            label={{ value: `Prom. ${anioYTD}`, position: 'insideTopRight', fill: '#0f1928', fontSize: 11 }} />
                          <Bar dataKey="costo" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                            {dataCosto.map((d, i) => (
                              <Cell key={i} fill={d.costo > costoYTD ? '#dc2626' : '#16a34a'} />
                            ))}
                            <LabelList
                              dataKey="costo"
                              position="top"
                              offset={6}
                              formatter={(value: number) => (value > 0 ? formatearMonedaCorta(value) : '')}
                              style={{ fill: '#0f1928', fontWeight: 700, fontSize: 11 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : <div className="IG-sinDatos"><p>No hay datos de costo por caja para el período seleccionado</p></div>}
              </div>
            </div>

            {/* Fila: Flete por cliente + Flete por tipo de vehículo */}
            <div className="IG-graficosFila">
              <div className="IG-graficoContainer">
                {(() => {
                  const datos = porCliente.filter(c => (c.sobrecosto || 0) > 0);
                  return datos.length > 0 ? (
                    <>
                      <div className="IG-graficoHeader">
                        <div className="IG-graficoTituloWrap">
                          <h2 className="IG-graficoTitulo">Sobrecosto por cliente</h2>
                        </div>
                      </div>
                      <p className="IG-graficoSub">
                        Sobrecosto total <b>{formatearMoneda(datos.reduce((s, c) => s + (c.sobrecosto || 0), 0))}</b>
                        {' · '}en fusionadas se reparte por cajas
                      </p>
                      <div className="IG-barrasHorizontales">
                        {(() => {
                          const total = datos.reduce((s, c) => s + (c.sobrecosto || 0), 0) || 1;
                          const max = Math.max(...datos.map(c => c.sobrecosto || 0)) || 1;
                          return datos.slice(0, 8).map((c, i) => {
                            const nombre = c.cliente || 'Sin cliente';
                            const sob = c.sobrecosto || 0;
                            return (
                              <div key={i} className="IG-barraHItem">
                                <div className="IG-barraHLabel" title={nombre}>
                                  <span className="IG-barraHPunto" style={{ background: '#dc2626' }}></span>
                                  <span className="IG-barraHNombre">{nombre}</span>
                                </div>
                                <div className="IG-barraHTrack">
                                  <div className="IG-barraHFill" style={{ width: `${((sob / max) * 100).toFixed(1)}%`, background: '#dc2626' }}>
                                    <span className="IG-barraHValor">{formatearMonedaCorta(sob)}</span>
                                  </div>
                                </div>
                                <span className="IG-barraHPorcentaje">{((sob / total) * 100).toFixed(1)}%</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </>
                  ) : <div className="IG-sinDatos"><p>No hay sobrecosto por cliente en el período seleccionado</p></div>;
                })()}
              </div>

              <div className="IG-graficoContainer">
                {porTipoVeh.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">Flete por tipo de vehículo</h2></div>
                    <div className="IG-barrasHorizontales">
                      {(() => {
                        const total = porTipoVeh.reduce((s, c) => s + (c.flete || 0), 0) || 1;
                        const max = Math.max(...porTipoVeh.map(c => c.flete || 0)) || 1;
                        return porTipoVeh.map((c, i) => (
                          <div key={i} className="IG-barraHItem">
                            <div className="IG-barraHLabel">
                              <span className="IG-barraHPunto" style={{ background: '#3b82f6' }}></span>
                              <span className="IG-barraHNombre">{c.tipo_vehiculo || 'N/A'}</span>
                            </div>
                            <div className="IG-barraHTrack">
                              <div className="IG-barraHFill" style={{ width: `${((c.flete / max) * 100).toFixed(1)}%`, background: '#3b82f6' }}>
                                <span className="IG-barraHValor">{formatearMonedaCorta(c.flete)}</span>
                              </div>
                            </div>
                            <span className="IG-barraHPorcentaje">{((c.flete / total) * 100).toFixed(1)}%</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : <div className="IG-sinDatos"><p>No hay datos disponibles</p></div>}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="IG-footer">
        <p>© {new Date().getFullYear()} Integra — Indicadores de Fletes</p>
      </footer>
    </div>
  );
};

export default IndicadoresFletes;
