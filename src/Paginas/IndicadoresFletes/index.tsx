'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaMoneyBillWave, FaTruck, FaWeight, FaBoxOpen, FaDownload, FaCoins } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
// Chrome compartido con Transporte + extras propios de Fletes
import '../IndicadoresTransporte/estilos.css';
import './estilos.css';

type KPIs = {
  flete_cobrado: number;
  flete_teorico: number;
  diferencia: number;
  toneladas: number;
  piezas: number;
  despachos: number;
  con_diferencia_positiva: number;
  pct_sobre_teorico: number;
  pct_con_diferencia_positiva: number;
  ticket_promedio: number;
};

type SerieMes = { mes: string; cobrado: number; teorico: number; despachos: number };
type ItemFlete = { cliente?: string; ruta?: string; tipo_vehiculo?: string; regional?: string; flete: number; despachos: number; toneladas?: number };

type ApiResponse = {
  success: boolean;
  data?: {
    kpis: KPIs;
    recargos: Record<string, number>;
    serieMensual: SerieMes[];
    porCliente: ItemFlete[];
    porRuta: ItemFlete[];
    porTipoVeh: ItemFlete[];
    porRegional: ItemFlete[];
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
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [recargos, setRecargos] = useState<Record<string, number>>({});
  const [serieMensual, setSerieMensual] = useState<SerieMes[]>([]);
  const [porCliente, setPorCliente] = useState<ItemFlete[]>([]);
  const [porRuta, setPorRuta] = useState<ItemFlete[]>([]);
  const [porTipoVeh, setPorTipoVeh] = useState<ItemFlete[]>([]);
  const [porRegional, setPorRegional] = useState<ItemFlete[]>([]);

  // Filtros en pantalla (no disparan fetch hasta "Filtrar")
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [aniosSeleccionados, setAniosSeleccionados] = useState<number[]>([new Date().getFullYear()]);
  const [mesesSeleccionados, setMesesSeleccionados] = useState<number[]>([]);
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>([]);
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [regionalSeleccionada, setRegionalSeleccionada] = useState<string>('');
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [dropdownAnioAbierto, setDropdownAnioAbierto] = useState(false);
  const [dropdownMesAbierto, setDropdownMesAbierto] = useState(false);
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false);
  const [dropdownRegionalAbierto, setDropdownRegionalAbierto] = useState(false);

  // Filtros aplicados (los que realmente se consultan)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    anios: [new Date().getFullYear()] as number[],
    meses: [] as number[],
    clientes: [] as string[],
    regional: '',
  });

  // Modal de detalle por mes
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalMes, setModalMes] = useState('');
  const [modalRegistros, setModalRegistros] = useState<any[]>([]);
  const [modalCargando, setModalCargando] = useState(false);

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
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      if (filtrosAplicados.regional) params.append('regional', filtrosAplicados.regional);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-fletes/resumen?${params.toString()}`);
      if (!response.ok) throw new Error('Error al obtener datos');
      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setKpis(data.data.kpis);
        setRecargos(data.data.recargos || {});
        setSerieMensual(data.data.serieMensual || []);
        setPorCliente(data.data.porCliente || []);
        setPorRuta(data.data.porRuta || []);
        setPorTipoVeh(data.data.porTipoVeh || []);
        setPorRegional(data.data.porRegional || []);
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
      regional: regionalSeleccionada,
    });
  };

  useEffect(() => { obtenerDatos(); /* eslint-disable-next-line */ }, [filtrosAplicados]);

  // Comparativo del último mes vs el anterior (sobre la serie mensual)
  const comparativoMesAnterior = useMemo(() => {
    if (!serieMensual || serieMensual.length < 2) return null;
    const actual = serieMensual[serieMensual.length - 1];
    const anterior = serieMensual[serieMensual.length - 2];
    if (!anterior.cobrado) return null;
    const pct = Math.round(((actual.cobrado - anterior.cobrado) / anterior.cobrado) * 100);
    const nombreMes = (ym: string) => {
      const [y, m] = ym.split('-').map(Number);
      return `${MESES[m - 1].nombre} ${y}`;
    };
    return { actual: actual.cobrado, anterior: anterior.cobrado, pct, mesActual: nombreMes(actual.mes), mesAnterior: nombreMes(anterior.mes) };
  }, [serieMensual]);

  // Datos de recargos para el pie (solo no nulos)
  const recargosData = useMemo(() =>
    Object.entries(recargos)
      .map(([name, value]) => ({ name, value: Math.round(value || 0) }))
      .filter(r => r.value > 0),
    [recargos]);

  // Clientes filtrados por búsqueda en el dropdown (limitado para no colgar el render)
  const clientesFiltradosDropdown = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    const res = q ? clientesDisponibles.filter(c => c.toLowerCase().includes(q)) : clientesDisponibles;
    return res.slice(0, 80);
  }, [clientesDisponibles, busquedaCliente]);

  const hasFiltrosActivos =
    filtrosAplicados.clientes.length > 0 ||
    filtrosAplicados.meses.length > 0 ||
    !!filtrosAplicados.regional ||
    JSON.stringify([...filtrosAplicados.anios].sort()) !== JSON.stringify([new Date().getFullYear()]);

  // Gauge: % flete cobrado sobre teórico (capado a 100% en el anillo)
  const pctSobreTeorico = kpis?.pct_sobre_teorico ?? 0;
  const capGauge = Math.min(pctSobreTeorico, 100);
  const colorGauge = pctSobreTeorico >= 100 ? '#16a34a' : pctSobreTeorico >= 90 ? '#e8a000' : '#dc2626';

  const diferenciaPositiva = (kpis?.diferencia ?? 0) >= 0;

  const abrirDetalleMes = async (ym: string) => {
    if (!ym || ym.length !== 7) return;
    const [anioStr, mesStr] = ym.split('-');
    setModalMes(ym);
    setModalAbierto(true);
    setModalCargando(true);
    setModalRegistros([]);
    try {
      const params = new URLSearchParams();
      params.append('anio', anioStr);
      params.append('mes', mesStr);
      filtrosAplicados.clientes.forEach(c => params.append('cliente', c));
      if (filtrosAplicados.regional) params.append('regional', filtrosAplicados.regional);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-fletes/detalle?${params.toString()}`);
      const data = await res.json();
      if (data.success) setModalRegistros(data.data || []);
    } catch (err) {
      console.error('Error al cargar detalle:', err);
    } finally {
      setModalCargando(false);
    }
  };

  // Exportar la serie visible (teórico vs cobrado) a CSV (Excel-ES)
  const exportarSerie = () => {
    if (!serieMensual.length) return;
    const cabeceras = ['Mes', 'Flete teórico', 'Flete cobrado', 'Diferencia', 'Despachos'];
    const filas = serieMensual.map(s => [
      format(parseISO(s.mes + '-01'), 'MM/yyyy'),
      Math.round(s.teorico || 0),
      Math.round(s.cobrado || 0),
      Math.round((s.cobrado || 0) - (s.teorico || 0)),
      s.despachos || 0,
    ]);
    const csv = [cabeceras, ...filas].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fletes_mensual_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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

  // Etiqueta de mes para los ejes: "MMM yy" (ej. jul 26)
  const formatoEjeMes = (ym: string) => {
    try { return format(parseISO(ym + '-01'), 'MMM yy', { locale: es }); }
    catch { return ym; }
  };

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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownAnioAbierto(!dropdownAnioAbierto); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); }}>
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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownMesAbierto(!dropdownMesAbierto); setDropdownAnioAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); }}>
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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownClienteAbierto(!dropdownClienteAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownRegionalAbierto(false); }}>
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
              <button className="IG-dropdownFiltroBtn" onClick={() => { setDropdownRegionalAbierto(!dropdownRegionalAbierto); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); }}>
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

          <button className="IG-botonActualizar" onClick={() => { aplicarFiltros(); setDropdownAnioAbierto(false); setDropdownMesAbierto(false); setDropdownClienteAbierto(false); setDropdownRegionalAbierto(false); setBusquedaCliente(''); }}>
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
          <button className="IG-filtroLimpiar" onClick={() => { const def = [new Date().getFullYear()]; setAniosSeleccionados(def); setMesesSeleccionados([]); setClientesSeleccionados([]); setRegionalSeleccionada(''); setFiltrosAplicados({ anios: def, meses: [], clientes: [], regional: '' }); }}>
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
            {/* KPIs */}
            {kpis && (
              <div className="IG-kpisContainer">
                {/* Hero: flete facturado + gauge % sobre teórico */}
                <div className="IG-kpiHero">
                  <div className="IG-kpiHeroInfo">
                    <p className="IG-kpiHeroLabel">Flete facturado</p>
                    <div className="IG-kpiHeroDetalle">
                      <FaMoneyBillWave className="IG-kpiHeroIcon" style={{ color: colorGauge }} />
                      <span className="IG-fleteHeroValor">{formatearMoneda(kpis.flete_cobrado)}</span>
                    </div>
                    <p className="IG-fleteHeroTeorico">
                      Teórico {formatearMoneda(kpis.flete_teorico)} · Diferencia{' '}
                      <span className={diferenciaPositiva ? 'IG-fleteHeroDifPos' : 'IG-fleteHeroDifNeg'}>
                        {diferenciaPositiva ? '+' : ''}{formatearMoneda(kpis.diferencia)}
                      </span>
                    </p>
                    <p className="IG-kpiHeroSub">
                      {formatearNumero(kpis.despachos)} despachos · {Math.round(kpis.toneladas)} toneladas
                    </p>
                    {comparativoMesAnterior && (
                      <span className={`IG-kpiHeroTrend ${comparativoMesAnterior.pct < 0 ? 'IG-kpiHeroTrendDown' : ''}`}
                        title={`${comparativoMesAnterior.mesActual}: ${formatearMoneda(comparativoMesAnterior.actual)} · ${comparativoMesAnterior.mesAnterior}: ${formatearMoneda(comparativoMesAnterior.anterior)}`}>
                        {comparativoMesAnterior.pct >= 0 ? '▲' : '▼'} {Math.abs(comparativoMesAnterior.pct)}% vs {comparativoMesAnterior.mesAnterior}
                      </span>
                    )}
                  </div>
                  <div className="IG-gaugeWrap">
                    <svg viewBox="0 0 100 100" className="IG-gaugeSvg">
                      <circle cx="50" cy="50" r="42" className="IG-gaugeTrack" />
                      <circle cx="50" cy="50" r="42" className="IG-gaugeFill" stroke={colorGauge}
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 * (1 - capGauge / 100)} />
                    </svg>
                    <div className="IG-gaugeCentro">
                      <span className="IG-gaugeNum" style={{ color: colorGauge }}>{Math.round(pctSobreTeorico)}%</span>
                      <span className="IG-gaugeCaption">sobre teórico</span>
                    </div>
                  </div>
                </div>

                {/* Tile: Diferencia */}
                <div className={`IG-kpiTile ${diferenciaPositiva ? 'IG-kpiTileDif' : 'IG-kpiTileNovedad'}`}>
                  <div className="IG-kpiTileTop"><span className="IG-kpiTileIcon"><FaCoins /></span></div>
                  <p className="IG-kpiTileLabel">Diferencia total</p>
                  <p className="IG-kpiTileValor IG-valorMoneda">{diferenciaPositiva ? '+' : ''}{formatearMoneda(kpis.diferencia)}</p>
                  <p className="IG-kpiTileSub">{kpis.pct_con_diferencia_positiva}% despachos con recargo</p>
                </div>

                {/* Tile: Toneladas */}
                <div className="IG-kpiTile IG-kpiTileTon">
                  <div className="IG-kpiTileTop"><span className="IG-kpiTileIcon"><FaWeight /></span></div>
                  <p className="IG-kpiTileLabel">Toneladas</p>
                  <p className="IG-kpiTileValor">{Math.round(kpis.toneladas).toLocaleString('es-CO')}</p>
                </div>

                {/* Tile: Despachos */}
                <div className="IG-kpiTile IG-kpiTileTotal">
                  <div className="IG-kpiTileTop"><span className="IG-kpiTileIcon"><FaTruck /></span></div>
                  <p className="IG-kpiTileLabel">Despachos</p>
                  <p className="IG-kpiTileValor">{formatearNumero(kpis.despachos)}</p>
                </div>

                {/* Tile: Ticket promedio */}
                <div className="IG-kpiTile IG-kpiTileCajas">
                  <div className="IG-kpiTileTop"><span className="IG-kpiTileIcon"><FaBoxOpen /></span></div>
                  <p className="IG-kpiTileLabel">Ticket promedio</p>
                  <p className="IG-kpiTileValor IG-valorMoneda">{formatearMoneda(kpis.ticket_promedio)}</p>
                  <p className="IG-kpiTileSub">flete por despacho</p>
                </div>
              </div>
            )}

            {/* Tendencia mensual del flete */}
            <div className="IG-graficoContainer">
              {serieMensual.length > 0 ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">📈 Flete facturado mensual</h2>
                    </div>
                    <div className="IG-graficoAcciones">
                      <button className="IG-botonExportar" onClick={exportarSerie} title="Exportar serie a Excel">
                        <FaDownload /> Exportar
                      </button>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <LineChart data={serieMensual} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tickFormatter={formatoEjeMes} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                        <Tooltip
                          labelFormatter={(ym) => format(parseISO(ym + '-01'), 'MMMM yyyy', { locale: es })}
                          formatter={(value: number) => [formatearMoneda(value), 'Flete']}
                          contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                          labelStyle={{ color: '#ffffff', fontWeight: '700', marginBottom: '4px' }}
                          itemStyle={{ color: '#ffffff' }}
                        />
                        <Line type="monotone" dataKey="cobrado" stroke="#e8a000" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Flete">
                          <LabelList dataKey="cobrado" position="top" offset={8} formatter={(value: number) => value > 0 ? formatearMonedaCorta(value) : ''} style={{ fill: '#0f1928', fontWeight: '700', fontSize: '10px' }} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos de fletes para el período seleccionado</p></div>
              )}
            </div>

            {/* Teórico vs Cobrado (clic en mes = detalle) */}
            <div className="IG-graficoContainer">
              {serieMensual.length > 0 ? (
                <>
                  <div className="IG-graficoHeader">
                    <div className="IG-graficoTituloWrap">
                      <h2 className="IG-graficoTitulo">⚖️ Flete teórico vs cobrado</h2>
                      <span className="IG-graficoHint">💡 Haz clic en un mes para ver el detalle de planillas</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={serieMensual} margin={{ top: 30, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tickFormatter={formatoEjeMes} className="IG-ejeClickeable"
                          tick={({ x, y, payload }) => (
                            <g transform={`translate(${x},${y})`}>
                              <text textAnchor="middle" fontSize={11} fill="#b87d00" fontWeight={700} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => abrirDetalleMes(payload.value)}>
                                <title>Ver detalle de {format(parseISO(payload.value + '-01'), 'MMMM yyyy', { locale: es })}</title>
                                {formatoEjeMes(payload.value)}
                              </text>
                            </g>
                          )}
                        />
                        <YAxis tickFormatter={(v) => formatearMonedaCorta(v)} width={70} />
                        <Tooltip
                          labelFormatter={(ym) => format(parseISO(ym + '-01'), 'MMMM yyyy', { locale: es })}
                          formatter={(value: number, name: string) => [formatearMoneda(value), name]}
                          contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                          labelStyle={{ color: '#ffffff', fontWeight: '700', marginBottom: '4px' }}
                          itemStyle={{ color: '#ffffff' }}
                        />
                        <Legend />
                        <Bar dataKey="teorico" fill="#3b82f6" name="Teórico" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="cobrado" fill="#e8a000" name="Cobrado" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="cobrado" position="top" offset={6} formatter={(value: number) => value > 0 ? formatearMonedaCorta(value) : ''} style={{ fill: '#0f1928', fontWeight: '700', fontSize: '10px' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="IG-sinDatos"><p>No hay datos disponibles</p></div>
              )}
            </div>

            {/* Fila: Flete por cliente + Composición de recargos */}
            <div className="IG-graficosFila">
              <div className="IG-graficoContainer">
                {porCliente.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">Flete por cliente</h2></div>
                    <div className="IG-barrasHorizontales">
                      {(() => {
                        const total = porCliente.reduce((s, c) => s + (c.flete || 0), 0) || 1;
                        const max = Math.max(...porCliente.map(c => c.flete || 0)) || 1;
                        return porCliente.slice(0, 8).map((c, i) => {
                          const nombre = c.cliente || 'Sin cliente';
                          return (
                            <div key={i} className="IG-barraHItem">
                              <div className="IG-barraHLabel">
                                <span className="IG-barraHPunto" style={{ background: COLORES_PIE[i % COLORES_PIE.length] }}></span>
                                <span className="IG-barraHNombre">{nombre}</span>
                              </div>
                              <div className="IG-barraHTrack">
                                <div className="IG-barraHFill" style={{ width: `${((c.flete / max) * 100).toFixed(1)}%`, background: COLORES_PIE[i % COLORES_PIE.length] }}>
                                  <span className="IG-barraHValor">{formatearMonedaCorta(c.flete)}</span>
                                </div>
                              </div>
                              <span className="IG-barraHPorcentaje">{((c.flete / total) * 100).toFixed(1)}%</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : <div className="IG-sinDatos"><p>No hay datos disponibles</p></div>}
              </div>

              <div className="IG-graficoContainer">
                {recargosData.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">Composición de recargos</h2></div>
                    <div className="IG-graficoPieWrap">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={recargosData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                            label={({ name, percent }) => `${name}: ${(percent ? percent * 100 : 0).toFixed(0)}%`} labelLine={false}>
                            {recargosData.map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} stroke="#fff" strokeWidth={2} />)}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string) => [formatearMoneda(value), name]}
                            contentStyle={{ backgroundColor: '#0f1928', border: 'none', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : <div className="IG-sinDatos"><p>Sin recargos en el período</p></div>}
              </div>
            </div>

            {/* Fila: Flete por tipo de vehículo + Flete por regional */}
            <div className="IG-graficosFila">
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

              <div className="IG-graficoContainer">
                {porRegional.length > 0 ? (
                  <>
                    <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">Flete por regional</h2></div>
                    <div className="IG-barrasHorizontales">
                      {(() => {
                        const total = porRegional.reduce((s, c) => s + (c.flete || 0), 0) || 1;
                        const max = Math.max(...porRegional.map(c => c.flete || 0)) || 1;
                        return porRegional.map((c, i) => (
                          <div key={i} className="IG-barraHItem">
                            <div className="IG-barraHLabel">
                              <span className="IG-barraHPunto" style={{ background: '#16a34a' }}></span>
                              <span className="IG-barraHNombre">{c.regional || 'SIN REGIONAL'}</span>
                            </div>
                            <div className="IG-barraHTrack">
                              <div className="IG-barraHFill" style={{ width: `${((c.flete / max) * 100).toFixed(1)}%`, background: '#16a34a' }}>
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

            {/* Top rutas por flete */}
            <div className="IG-graficoContainer">
              {porRuta.length > 0 ? (
                <>
                  <div className="IG-graficoHeader"><h2 className="IG-graficoTitulo">🛣️ Top rutas por flete</h2></div>
                  <div className="IG-barrasHorizontales">
                    {(() => {
                      const total = porRuta.reduce((s, c) => s + (c.flete || 0), 0) || 1;
                      const max = Math.max(...porRuta.map(c => c.flete || 0)) || 1;
                      return porRuta.map((c, i) => (
                        <div key={i} className="IG-barraHItem">
                          <div className="IG-barraHLabel">
                            <span className="IG-barraHPunto" style={{ background: '#e8a000' }}></span>
                            <span className="IG-barraHNombre">{c.ruta || 'Sin ruta'}</span>
                          </div>
                          <div className="IG-barraHTrack">
                            <div className="IG-barraHFill" style={{ width: `${((c.flete / max) * 100).toFixed(1)}%`, background: '#e8a000' }}>
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
          </>
        )}
      </main>

      {/* Modal de detalle por mes */}
      {modalAbierto && (
        <div className="IG-modalOverlay" onClick={() => setModalAbierto(false)}>
          <div className="IG-modalContenido" onClick={(e) => e.stopPropagation()}>
            <div className="IG-modalHeader">
              <h2 className="IG-modalTitulo">
                {modalMes ? <>Detalle de {format(parseISO(modalMes + '-01'), 'MMMM yyyy', { locale: es })}</> : ''}
              </h2>
              <span className="IG-modalTotal">{modalRegistros.length} planillas</span>
              <button className="IG-modalCerrar" onClick={() => setModalAbierto(false)}>✕</button>
            </div>
            {modalCargando ? (
              <div className="IG-modalCargando"><div className="IG-spinner"></div><p>Cargando planillas...</p></div>
            ) : modalRegistros.length === 0 ? (
              <div className="IG-modalVacio">No se encontraron planillas</div>
            ) : (
              <div className="IG-modalTablaWrap">
                <table className="IG-modalTabla">
                  <thead>
                    <tr>
                      <th>Consecutivo</th><th>Cliente</th><th>Ruta</th><th>Regional</th><th>Destino</th>
                      <th>Tipo Veh</th><th className="IG-num">Peso</th><th className="IG-num">Teórico</th>
                      <th className="IG-num">Cobrado</th><th className="IG-num">Diferencia</th><th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRegistros.map((r, i) => {
                      const dif = (r.total_solicitado || 0) - (r.tarifa_calculada || 0);
                      return (
                        <tr key={i}>
                          <td>{r.consecutivo || r.planilla || '-'}</td>
                          <td className="IG-trunc">{r.cliente_origen || '-'}</td>
                          <td className="IG-trunc">{r.ruta || '-'}</td>
                          <td>{r.regional || '-'}</td>
                          <td className="IG-trunc">{r.municipio_destino || '-'}</td>
                          <td>{r.tipo_veh_sicetac || 'N/A'}</td>
                          <td className="IG-num">{Math.round(r.peso_real || 0).toLocaleString('es-CO')}</td>
                          <td className="IG-num">{formatearMonedaCorta(r.tarifa_calculada || 0)}</td>
                          <td className="IG-num">{formatearMonedaCorta(r.total_solicitado || 0)}</td>
                          <td className={`IG-num ${dif > 0 ? 'IG-difPos' : dif < 0 ? 'IG-difNeg' : 'IG-difCero'}`}>{dif > 0 ? '+' : ''}{formatearMonedaCorta(dif)}</td>
                          <td>{r.fecha || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="IG-footer">
        <p>© {new Date().getFullYear()} Integra — Indicadores de Fletes</p>
      </footer>
    </div>
  );
};

export default IndicadoresFletes;
