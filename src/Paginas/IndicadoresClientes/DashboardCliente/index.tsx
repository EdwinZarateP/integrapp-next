'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import { obtenerCliente } from '../clientes';
import '@/Componentes/IndicadoresChrome/estilos.css';
import './estilos.css';

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
  estado: string | null;
  fecha_entrega: string | null;
  fecha_digitalizacion: string | null;
};

type ResumenGuias = {
  total_vehiculos: number;
  total_guias: number;
  entregadas: number;
  en_proceso: number;
  sin_info: number;
  por_estado: Record<string, number>;
  truncada: boolean;
};

type InformeGuiasResponse = {
  success: boolean;
  data?: { cliente: string; filas: FilaGuia[]; resumen: ResumenGuias; advertencia?: string | null };
  error?: string;
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
  // Tras abrir el informe una vez, re-consulta junto con /cajas en cada Filtrar.
  const informeYaConsultado = useRef(false);

  // Vista del gráfico de cajas: mensual (default) o diaria.
  const [vistaCajas, setVistaCajas] = useState<'mensual' | 'diaria'>('mensual');

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/${clienteId}/guias?${construirParams().toString()}`);
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

  useEffect(() => {
    if (cliente) obtenerDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, clienteId]);

  // El informe de guías viaja junto con /cajas SOLO si ya se abrió alguna vez
  // (fetch perezoso: la carga inicial de la página no paga el costo Postgres).
  useEffect(() => {
    if (cliente && informeYaConsultado.current) obtenerInformeGuias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, clienteId]);

  const alternarInforme = () => {
    if (!informeAbierto && !informeYaConsultado.current) {
      informeYaConsultado.current = true;
      obtenerInformeGuias();
    }
    setInformeAbierto(o => !o);
  };

  const aplicarFiltros = () => {
    setFiltrosAplicados({ anios: aniosSeleccionados, meses: mesesSeleccionados });
  };

  // Datos visibles según la vista del gráfico.
  const dataCajas = useMemo<SerieCajas[]>(
    () => (vistaCajas === 'diaria' ? serieDiaria : serieMensual),
    [vistaCajas, serieDiaria, serieMensual],
  );
  const intervalCajas = dataCajas.length > 1 ? Math.max(0, Math.ceil(dataCajas.length / 12) - 1) : 0;

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

  const formatearEntero = (num: number): string =>
    new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num || 0);
  const formatearEnteroCorto = (num: number): string => {
    const n = num || 0;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(Math.round(n));
  };

  // Chip de estado del TMS: ENTREGADO (exacto, valor real de la BD) → verde;
  // cualquier otro estado (PENDIENTE, En distribucion, CON NOVEDAD, …) → ámbar.
  const claseChipEstado = (estado: string) =>
    estado.toUpperCase() === 'ENTREGADO' ? 'DC-guiaChipEntregada' : 'DC-guiaChipProceso';

  // Export CSV del informe (separador ; + BOM, patrón de los otros indicadores).
  const exportarGuiasCSV = () => {
    const cabeceras = ['Guía', 'Vehículo', 'Fecha', 'Cajas', 'Estado', 'F. Entrega', 'F. Digitalización'];
    const csvCell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(';') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [
      cabeceras.join(';'),
      ...filasGuias.map(f => [f.guia, f.consecutivo_vehiculo, f.fecha_creacion, f.cajas_vehiculo, f.estado, f.fecha_entrega, f.fecha_digitalizacion].map(csvCell).join(';')),
    ];
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guias_tms_${clienteId}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatoEje = (val: string) => {
    try {
      if (vistaCajas === 'diaria') return format(parseISO(val), 'd MMM', { locale: es });
      return format(parseISO(val + '-01'), 'MMM yy', { locale: es });
    } catch { return val; }
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
            <Image src={cliente.logo} alt={cliente.nombre} width={170} height={52} style={{ objectFit: 'contain' }} unoptimized />
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
          <div className="DC-cargando"><p>Cargando indicadores de {cliente.nombre}...</p></div>
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
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <ComposedChart data={dataCajas} margin={{ top: 20, right: 20, left: 20, bottom: 28 }}>
                        <defs>
                          {/* Gradiente del área: rojo por encima de la media, azul por debajo */}
                          <linearGradient id="gradCajasMedia" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                            <stop offset={`${(mediaDiaria?.corte ?? 0.5) * 100}%`} stopColor="#ef4444" stopOpacity={0.95} />
                            <stop offset={`${(mediaDiaria?.corte ?? 0.5) * 100}%`} stopColor="#3b82f6" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.95} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        {/* padding: el primer/último punto no quedan pegados al eje Y */}
                        <XAxis dataKey="periodo" tickFormatter={formatoEje} interval={intervalCajas} tick={{ fontSize: 11 }} padding={{ left: 30, right: 30 }} />
                        <YAxis tickFormatter={(v) => formatearEntero(v)} width={70} />
                        <Tooltip content={tooltipCajas} cursor={{ stroke: '#0f1928', strokeDasharray: '3 3' }} />
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
                        <Line type="monotone" dataKey="cajas" stroke={COLOR_CAJAS} strokeWidth={2} name="Cajas" dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                          <LabelList dataKey="cajas" position="top" offset={6} formatter={(value: number) => (value > 0 ? formatearEnteroCorto(value) : '')} style={{ fill: COLOR_CAJAS, fontSize: 10, fontWeight: 700 }} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de cajas para el período seleccionado</p></div>
              )}
            </div>

            {/* Informe de guías TMS — colapsable. planilla_siscore (Mongo, media
                milla) == guia (PostgreSQL informe_guias_tms); puede traer varias
                guías por coma → una fila por guía. Fetch perezoso al abrir. */}
            <section className="DC-guiaSeccion">
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
                    <div className="DC-guiaCargando">Cargando informe de guías...</div>
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
                              <th>Fecha</th>
                              <th>Cajas</th>
                              <th>Estado</th>
                              <th>F. Entrega</th>
                              <th>F. Digitalización</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filasGuias.map(f => (
                              <tr key={f.guia}>
                                <td className="DC-guiaCeldaNum">{f.guia}</td>
                                <td className="DC-guiaCeldaVeh">{f.consecutivo_vehiculo}</td>
                                <td>{f.fecha_creacion ?? '—'}</td>
                                <td className="DC-guiaCeldaNum">{formatearEntero(f.cajas_vehiculo)}</td>
                                <td>{f.estado ? <span className={`DC-guiaChip ${claseChipEstado(f.estado)}`}>{f.estado}</span> : '—'}</td>
                                <td>{f.fecha_entrega ?? '—'}</td>
                                <td>{f.fecha_digitalizacion ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="DC-guiaAcciones">
                        <button className="DC-guiaBotonExportar" onClick={exportarGuiasCSV}>⬇ Exportar CSV</button>
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
