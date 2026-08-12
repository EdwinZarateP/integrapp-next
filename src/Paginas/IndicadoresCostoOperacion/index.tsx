'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaDownload, FaFilter } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
// Chrome compartido con Transporte + extras propios
import '../IndicadoresTransporte/estilos.css';
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
  // Etiquetas vigentes de las etapas (vienen del backend; fallback por si faltan).
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>(ETIQUETAS_DEFAULT);
  const lbl = useMemo(() => ({ ...ETIQUETAS_DEFAULT, ...etiquetas }), [etiquetas]);

  // Vista de cada gráfico (toggle independiente): mensual (default) o diaria.
  const [vista, setVista] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaDif, setVistaDif] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaCajas, setVistaCajas] = useState<'mensual' | 'diaria'>('mensual');
  const [vistaCaja, setVistaCaja] = useState<'mensual' | 'diaria'>('mensual');

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

  useEffect(() => { obtenerDatos(); obtenerCostoCaja(); /* eslint-disable-next-line */ }, [filtrosAplicados]);

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

  // Clientes filtrados por búsqueda en el dropdown.
  const clientesFiltradosDropdown = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    const res = q ? clientesDisponibles.filter(c => c.toLowerCase().includes(q)) : clientesDisponibles;
    return res.slice(0, 80);
  }, [clientesDisponibles, busquedaCliente]);

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
