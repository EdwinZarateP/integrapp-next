/**
 * Uso de la App (telemetría general) — 2026-11-25.
 *
 * Mide el uso de TODA la aplicación (todos los módulos del hub /Modulos y los
 * portales): quién usa qué módulo, con qué frecuencia, en qué horas se
 * concentra el trabajo y qué acciones se ejecutan. Complementa a
 * /indicadores/uso-kabi (adopción del portal de clientes, que se muestra al
 * cliente): esta página mezcla los eventos internos de toda la app.
 *
 * Datos: GET /telemetria/resumen (solo ADMIN) con el filtro `modulo` y las
 * agregaciones `por_modulo` / `por_hora` (hora Colombia 0-23, computada en el
 * backend). Captura: TelemetriaGlobal (pageviews por ruta) + trackAccion
 * (exports, consultas, creaciones/aprobaciones) + los beacons del portal Kabi.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaFileExcel, FaSearch, FaUsers, FaCalendarDay, FaMousePointer, FaBolt, FaClock } from 'react-icons/fa';
import HeaderModulo from '@/Componentes/HeaderModulo';
import '../UsoPortalKP/estilos.css';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const PERFILES_AUTORIZADOS = ['ADMIN'];
// (2026-11-27) La tabla de Usuarios no es eterna: filas por página.
const TAM_PAG_USU = 15;

// Etiquetas amables de los módulos (telemetriaApp.ts + portal Kabi legacy).
const ETIQUETAS_MODULO: Record<string, string> = {
  kabi_pedidos: 'Pedidos Kabi',
  medical_care: 'Medical Care',
  solicitud_vehiculos: 'Solicitud de Vehículos',
  otros_costos: 'Otros Costos',
  historico_pedidos: 'Histórico de Pedidos',
  pedidos_anulados: 'Pedidos Anulados',
  estado_vehiculos: 'Estado de Vehículos',
  cuentas_placa: 'Cuentas por Placa',
  novedades_ot: 'Novedades OT',
  citas_entrega: 'Citas de Entrega',
  tarifas: 'Tarifas',
  divipolas: 'Divipolas',
  usuarios: 'Gestión de Usuarios',
  financiero: 'Módulo Financiero',
  indicadores: 'Indicadores',
  indicadores_admin: 'Indicadores (admin)',
  seguridad: 'Portal Seguridad',
  modulos: 'Torre de Control (/Modulos)',
  flota: 'Flota / Disponibilidad',
  conductores: 'Portal Conductores',
  login: 'Login',
  otros: 'Otros',
};
const etiquetaModulo = (m: string): string => {
  if (ETIQUETAS_MODULO[m]) return ETIQUETAS_MODULO[m];
  if (m.startsWith('portal_')) return `Portal ${m.slice('portal_'.length)}`;
  return m;
};

const ETIQUETAS_EVENTO: Record<string, string> = {
  pageview: 'Navegación (páginas)',
  pestana: 'Cambios de pestaña',
  consulta_guia: 'Consultas de guía',
  pendientes: 'Tablas de pendientes',
  export_excel: 'Exports a Excel',
  accion: 'Acciones',
  login: 'Inicios de sesión',
};

type PorDia = { fecha: string; eventos: number; usuarios: number; por_modulo?: Record<string, number> };
type PorUsuario = {
  usuario: string;
  nombre?: string | null;
  perfil?: string | null;
  eventos: number;
  dias_activos: number;
  ultima_conexion?: string | null;
  por_evento: Record<string, number>;
};
type ResumenTlm = {
  kpi: { eventos_total: number; usuarios_unicos: number; sesiones_unicas: number; dias_activos: number };
  por_dia: PorDia[];
  por_usuario: PorUsuario[];
  por_evento: { evento: string; total: number }[];
  por_pestana: { pestana: string; total: number }[];
  por_cliente: { cliente_id: string; eventos: number; usuarios: number }[];
  por_modulo: { modulo: string; eventos: number; usuarios: number }[];
  por_hora: { hora: number; eventos: number; usuarios: number; por_modulo?: Record<string, number> }[];
  /** (2026-11-27) Usuarios ÚNICOS por día, desglosados por perfil. */
  por_dia_perfil?: { fecha: string; por_perfil: Record<string, number> }[];
};

/** Popup de detalle: torta con segmentos {etiqueta, valor, color}. */
type Torta = { titulo: string; subtitulo: string; segmentos: { etiqueta: string; valor: number; color: string }[] };

// (9.ª tanda) Paleta categórica para las barras apiladas por módulo (mismo
// orden de la tabla por módulo: de mayor a menor uso; cicla si hay más
// módulos que colores; gris reservado para «otros»/sin clasificar).
const PALETA_MODULOS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
  '#4a3aa7', '#e34948', '#14b8a6', '#8d6e63', '#0ea5e9', '#9333ea',
];
const COLOR_GRIS = '#94a3b8';
// (2026-11-27) Color por PERFIL (distinto del de módulos para no confundir):
// se asigna por orden de uso (el perfil con más eventos toma el primer
// color, estable dentro de la consulta) y lo comparten el ranking de
// usuarios y el gráfico «Actividad por perfil».
const PALETA_PERFILES = [
  '#7c3aed', '#0ea5e9', '#f97316', '#0d9488', '#dc2626', '#65a30d',
  '#c026d3', '#475569', '#d97706', '#2563eb', '#be185d', '#15803d',
];

const hoyStr = () => {
  const d = new Date(Date.now() - 5 * 3600 * 1000); // hora Colombia (UTC−5)
  return d.toISOString().slice(0, 10);
};
const menosDias = (dias: number) => {
  const d = new Date(Date.now() - 5 * 3600 * 1000 - dias * 86400 * 1000);
  return d.toISOString().slice(0, 10);
};
const fmtFecha = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}` : '—';
};
const fmtFechaLarga = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '—';
};
const fmtHora = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 23)}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};
const num = (n: number) => n.toLocaleString('es-CO');
const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function UsoAppP() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [desde, setDesde] = useState(menosDias(29));
  const [hasta, setHasta] = useState(hoyStr());
  const [modulo, setModulo] = useState('');
  const [usuFoco, setUsuFoco] = useState<{ usuario: string; nombre: string } | null>(null);
  const [buscaUsu, setBuscaUsu] = useState('');
  const [sugerAbiertas, setSugerAbiertas] = useState(false);
  const [datos, setDatos] = useState<ResumenTlm | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  // (2026-11-27, a pedido) Sin tooltips hover: al hacer CLIC en una barra
  // (hora, día o usuario) se abre un popup con la torta del detalle.
  const [torta, setTorta] = useState<Torta | null>(null);
  // (2026-11-27) La tabla de Usuarios no es eterna: paginada de a 15 filas
  // (se reinicia a la página 1 con cada consulta nueva).
  const [pagUsu, setPagUsu] = useState(1);
  useEffect(() => {
    if (!torta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTorta(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [torta]);
  useEffect(() => { setPagUsu(1); }, [datos]);

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '').toUpperCase();
    setUsuario(u);
    setPerfil(p);
    setAutorizado(PERFILES_AUTORIZADOS.includes(p));
  }, []);

  const consultar = useCallback(
    async (overrides?: { foco?: { usuario: string; nombre: string } | null; modulo?: string }) => {
      if (!usuario) return;
      setCargando(true);
      setError('');
      try {
        const mod = overrides?.modulo !== undefined ? overrides.modulo : modulo;
        const foco = overrides && 'foco' in overrides ? overrides.foco ?? null : usuFoco;
        const params = new URLSearchParams({ usuario, desde, hasta });
        if (mod) params.set('modulo', mod);
        if (foco) params.set('usuario_filtro', foco.usuario);
        const r = await fetch(`${API}/telemetria/resumen?${params.toString()}`);
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.detail || 'Error al consultar la telemetría');
        setDatos(j.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al consultar');
      } finally {
        setCargando(false);
      }
    },
    [usuario, desde, hasta, modulo, usuFoco],
  );

  const enfocarUsuario = (u: { usuario: string; nombre?: string | null }) => {
    const foco = { usuario: u.usuario, nombre: u.nombre || u.usuario };
    setUsuFoco(foco);
    setBuscaUsu('');
    setSugerAbiertas(false);
    consultar({ foco });
  };
  const quitarFoco = () => { setUsuFoco(null); consultar({ foco: null }); };
  const quitarModulo = () => { setModulo(''); consultar({ modulo: '' }); };

  useEffect(() => {
    if (autorizado && usuario) consultar();
  }, [autorizado, usuario, consultar]);

  const exportarExcel = async () => {
    if (!datos) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const hojaModulos = datos.por_modulo.map(m => ({
      'Módulo': etiquetaModulo(m.modulo),
      'Eventos': m.eventos,
      'Usuarios': m.usuarios,
    }));
    const hojaUsuarios = datos.por_usuario.map(u => ({
      'Usuario': u.usuario,
      'Nombre': u.nombre || '',
      'Perfil': u.perfil || '',
      'Eventos': u.eventos,
      'Días activos': u.dias_activos,
      'Última conexión': fmtHora(u.ultima_conexion),
      ...Object.fromEntries(Object.entries(u.por_evento || {}).map(([k, v]) => [ETIQUETAS_EVENTO[k] || k, v])),
    }));
    // (9.ª tanda) Hojas de día/hora con desglose por módulo (columnas
    // dinámicas, mismo orden que la tabla por módulo).
    const colsMod = (datos?.por_modulo ?? []).map(m => m.modulo);
    const conDesglose = (pm?: Record<string, number>) =>
      Object.fromEntries(colsMod.map(m => [etiquetaModulo(m), pm?.[m] ?? 0]));
    const hojaDia = datos.por_dia.map(d => ({
      'Fecha': fmtFechaLarga(d.fecha), 'Eventos': d.eventos, 'Usuarios': d.usuarios,
      ...conDesglose(d.por_modulo),
    }));
    const hojaHoras = Array.from({ length: 24 }, (_, h) => {
      const d = datos.por_hora.find(x => x.hora === h);
      return {
        'Hora (Colombia)': `${String(h).padStart(2, '0')}:00`,
        'Eventos': d?.eventos ?? 0, 'Usuarios': d?.usuarios ?? 0,
        ...conDesglose(d?.por_modulo),
      };
    });
    const hojaEventos = datos.por_evento.map(e => ({ 'Métrica': ETIQUETAS_EVENTO[e.evento] || e.evento, 'Total': e.total }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaModulos), 'Por módulo');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaHoras), 'Por hora');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaUsuarios), 'Usuarios');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaDia), 'Por día');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaEventos), 'Eventos');
    XLSX.writeFile(wb, `uso_app_${desde}_${hasta}${modulo ? `_${modulo}` : ''}.xlsx`);
  };

  if (autorizado === null) return <div className="UP-container"><p className="UP-cargando">Cargando…</p></div>;
  if (!autorizado) {
    return (
      <div className="UP-container">
        <div className="UP-sinAcceso">
          <h2>Acceso restringido</h2>
          <p>La telemetría de uso de la app está disponible solo para el perfil ADMIN.</p>
          <button onClick={() => (window.location.href = '/integrapp/indicadores')}>Volver a Indicadores</button>
        </div>
      </div>
    );
  }

  const maxDia = Math.max(1, ...(datos?.por_dia.map(d => d.eventos) ?? [1]));
  const maxHora = Math.max(1, ...(datos?.por_hora.map(h => h.eventos) ?? [1]));

  // (9.ª tanda) Color estable por módulo: orden = total de eventos desc (el
  // mismo de la tabla por módulo) → el módulo más usado siempre tiene el
  // primer color, en AMBOS gráficos.
  const modulosOrdenados = (datos?.por_modulo ?? []).map(m => m.modulo);
  const colorDe = (modulo: string): string => {
    if (modulo === 'otros' || modulo === 'sin_clasificar' || modulo.startsWith('portal_')) return COLOR_GRIS;
    const i = modulosOrdenados.indexOf(modulo);
    return i >= 0 ? PALETA_MODULOS[i % PALETA_MODULOS.length] : COLOR_GRIS;
  };
  /** Segmentos de una cubeta ordenados por tamaño desc (la pila se lee mejor). */
  const segmentosDe = (pm?: Record<string, number>): [string, number][] =>
    Object.entries(pm || {}).sort((a, b) => b[1] - a[1]);
  /** Torta de una cubeta de hora/día: desglose por módulo (mismos colores de
   *  los gráficos). Devuelve null si no hay nada que mostrar. */
  const tortaDeModulos = (
    titulo: string,
    eventos: number,
    usuarios: number,
    pm?: Record<string, number>,
  ): Torta | null => {
    const segmentos = segmentosDe(pm)
      .filter(([, n]) => n > 0)
      .map(([m, n]) => ({ etiqueta: etiquetaModulo(m), valor: n, color: colorDe(m) }));
    if (segmentos.length === 0) return null;
    return {
      titulo,
      subtitulo: `${num(eventos)} eventos · ${num(usuarios)} ${usuarios === 1 ? 'usuario' : 'usuarios'}`,
      segmentos,
    };
  };
  /** Torta de un usuario: desglose por TIPO de evento. */
  const tortaDeUsuario = (u: PorUsuario): Torta => ({
    titulo: u.nombre || u.usuario,
    subtitulo: `Perfil ${u.perfil || '—'} · ${num(u.eventos)} eventos en ${num(u.dias_activos)} ${u.dias_activos === 1 ? 'día' : 'días'}`,
    segmentos: Object.entries(u.por_evento || {})
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([ev, n], i) => ({
        etiqueta: ETIQUETAS_EVENTO[ev] || ev,
        valor: n,
        color: PALETA_MODULOS[i % PALETA_MODULOS.length],
      })),
  });
  /** Torta de un PERFIL: comportamiento agregado (tipos de evento de todos
   *  sus usuarios) — el gráfico de «Actividad por perfil». */
  const tortaDePerfil = (p: { perfil: string; eventos: number; usuarios: number; por_evento: Record<string, number> }): Torta => ({
    titulo: `Perfil ${p.perfil}`,
    subtitulo: `${num(p.usuarios)} ${p.usuarios === 1 ? 'usuario' : 'usuarios'} · ${num(p.eventos)} eventos`,
    segmentos: Object.entries(p.por_evento || {})
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([ev, n], i) => ({
        etiqueta: ETIQUETAS_EVENTO[ev] || ev,
        valor: n,
        color: PALETA_MODULOS[i % PALETA_MODULOS.length],
      })),
  });
  const totalModulo = Math.max(1, datos?.por_modulo.reduce((s, m) => s + m.eventos, 0) ?? 1);
  const usuariosRecientes = [...(datos?.por_usuario ?? [])].sort(
    (a, b) => (b.ultima_conexion ? new Date(b.ultima_conexion).getTime() : 0)
            - (a.ultima_conexion ? new Date(a.ultima_conexion).getTime() : 0),
  );
  // (2026-11-27) Paginación de la tabla: página actual acotada al rango real
  // (por si un filtro reduce las filas estando en la página 5).
  const totalPagsUsu = Math.max(1, Math.ceil(usuariosRecientes.length / TAM_PAG_USU));
  const pagUsuEfectiva = Math.min(pagUsu, totalPagsUsu);
  const usuPagina = usuariosRecientes.slice(
    (pagUsuEfectiva - 1) * TAM_PAG_USU,
    pagUsuEfectiva * TAM_PAG_USU,
  );
  // Opciones del filtro módulo: las que existen en el rango consultado.
  const modulosDisponibles = (datos?.por_modulo ?? []).map(m => m.modulo);
  // (2026-11-27) Ranking de usuarios por eventos, de mayor a menor.
  const usuariosPorEventos = [...(datos?.por_usuario ?? [])].sort((a, b) => b.eventos - a.eventos);
  const maxUsuEvt = Math.max(1, ...(datos?.por_usuario ?? []).map(u => u.eventos));
  // (2026-11-27) Comportamiento POR PERFIL: se agrega desde por_usuario
  // (eventos totales, cuántos usuarios y suma de sus tipos de evento) —
  // de mayor a menor uso de la aplicación general.
  const perfilesOrdenados = (() => {
    const mapa = new Map<string, { perfil: string; eventos: number; usuarios: number; por_evento: Record<string, number> }>();
    (datos?.por_usuario ?? []).forEach(u => {
      const clave = (u.perfil || 'SIN PERFIL').toUpperCase();
      const acc = mapa.get(clave) || { perfil: clave, eventos: 0, usuarios: 0, por_evento: {} };
      acc.eventos += u.eventos;
      acc.usuarios += 1;
      Object.entries(u.por_evento || {}).forEach(([ev, n]) => {
        acc.por_evento[ev] = (acc.por_evento[ev] || 0) + n;
      });
      mapa.set(clave, acc);
    });
    return [...mapa.values()].sort((a, b) => b.eventos - a.eventos);
  })();
  const maxPerfil = Math.max(1, ...perfilesOrdenados.map(p => p.eventos));
  // (2026-11-27) Usuarios únicos por día (por perfil): total del día = suma
  // de los usuarios únicos de cada perfil (el backend ya contó distintos).
  const porDiaPerfil = datos?.por_dia_perfil ?? [];
  const totalUsuDia = (dd: { por_perfil: Record<string, number> }) =>
    Object.values(dd.por_perfil || {}).reduce((s, n) => s + n, 0);
  const maxUsuDia = Math.max(1, ...porDiaPerfil.map(totalUsuDia));
  /** Color estable por perfil (mismo mapa en el ranking de usuarios y en el
   *  gráfico por perfil): orden = perfilesOrdenados (uso desc). */
  const colorDePerfil = (perfil?: string | null): string => {
    const clave = (perfil || 'SIN PERFIL').toUpperCase();
    const i = perfilesOrdenados.findIndex(p => p.perfil === clave);
    return i >= 0 ? PALETA_PERFILES[i % PALETA_PERFILES.length] : COLOR_GRIS;
  };

  return (
    <div className="UP-container">
      {/* (2026-11-25, 10.ª tanda) Header UNIFICADO de la app (HeaderModulo):
          el header propio UP-* fue eliminado. */}
      <HeaderModulo
        titulo="Uso de la App"
        subtitulo="Telemetría general — módulos, usuarios y horas pico"
      />

      <main className="UP-main">
        {/* Filtros */}
        <div className="UP-filtros">
          <label>
            Desde
            <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} />
          </label>
          <label>
            Módulo
            <select value={modulo} onChange={e => setModulo(e.target.value)}>
              <option value="">Todos los módulos</option>
              {modulosDisponibles.map(m => (
                <option key={m} value={m}>{etiquetaModulo(m)}</option>
              ))}
            </select>
          </label>
          <label className="UP-buscadorUsu">
            Usuario
            <div className="UP-buscadorWrap">
              <input
                type="text"
                placeholder="Buscar por nombre…"
                value={buscaUsu}
                disabled={!!usuFoco}
                onChange={e => { setBuscaUsu(e.target.value); setSugerAbiertas(true); }}
                onFocus={() => setSugerAbiertas(true)}
                onBlur={() => setTimeout(() => setSugerAbiertas(false), 150)}
              />
              {sugerAbiertas && buscaUsu.trim().length >= 2 && (
                <ul className="UP-sugerencias">
                  {(() => {
                    const q = sinAcentos(buscaUsu.trim());
                    const matches = (datos?.por_usuario ?? []).filter(u =>
                      sinAcentos(`${u.nombre || ''} ${u.usuario}`).includes(q));
                    if (matches.length === 0)
                      return <li className="UP-sugerVacia">Sin coincidencias en el rango consultado.</li>;
                    return matches.slice(0, 8).map(u => (
                      <li key={u.usuario}>
                        <button type="button" onMouseDown={e => { e.preventDefault(); enfocarUsuario(u); }}>
                          <strong>{u.nombre || u.usuario}</strong>
                          <span className="UP-sugerMeta">{u.nombre ? `${u.usuario} · ` : ''}{u.perfil || '—'}</span>
                        </button>
                      </li>
                    ));
                  })()}
                </ul>
              )}
            </div>
          </label>
          <button className="UP-btnBuscar" onClick={() => consultar()} disabled={cargando}>
            <FaSearch /> {cargando ? 'Consultando…' : 'Consultar'}
          </button>
          <button className="UP-btnExcel" onClick={exportarExcel} disabled={!datos || !datos.por_usuario.length}>
            <FaFileExcel /> Excel
          </button>
        </div>

        {/* Migas de filtros aplicados */}
        <div className="UP-migas" aria-label="Filtros aplicados">
          <span className="UP-migaFija" title="Rango de fechas consultado">
            📅 {fmtFechaLarga(desde)} → {fmtFechaLarga(hasta)}
          </span>
          {modulo && (
            <button type="button" className="UP-miga" onClick={quitarModulo} title="Quitar filtro de módulo">
              🧩 {etiquetaModulo(modulo)} ✕
            </button>
          )}
          {usuFoco && (
            <button type="button" className="UP-miga UP-migaFoco" onClick={quitarFoco} title="Volver a todos los usuarios">
              👤 {usuFoco.nombre} ✕
            </button>
          )}
        </div>

        {error && <p className="UP-error">{error}</p>}

        {datos && (
          <>
            <div className="UP-kpis">
              <div className="UP-kpi">
                <span className="UP-kpiIcon"><FaMousePointer /></span>
                <div>
                  <span className="UP-kpiValor">{num(datos.kpi.eventos_total)}</span>
                  <span className="UP-kpiLabel">Eventos</span>
                </div>
              </div>
              <div className="UP-kpi">
                <span className="UP-kpiIcon"><FaUsers /></span>
                <div>
                  <span className="UP-kpiValor">{num(datos.kpi.usuarios_unicos)}</span>
                  <span className="UP-kpiLabel">Usuarios únicos</span>
                </div>
              </div>
              <div className="UP-kpi">
                <span className="UP-kpiIcon"><FaBolt /></span>
                <div>
                  <span className="UP-kpiValor">{num(datos.kpi.sesiones_unicas)}</span>
                  <span className="UP-kpiLabel">Sesiones</span>
                </div>
              </div>
              <div className="UP-kpi">
                <span className="UP-kpiIcon"><FaCalendarDay /></span>
                <div>
                  <span className="UP-kpiValor">{num(datos.kpi.dias_activos)}</span>
                  <span className="UP-kpiLabel">Días con actividad</span>
                </div>
              </div>
            </div>

            {/* Leyenda de módulos — compartida por los dos gráficos apilados.
                Mismo orden/color que la tabla por módulo. */}
            <section className="UP-card UA-leyendaCard">
              <h2 className="UP-cardTitulo">Módulos (colores de los gráficos)</h2>
              <div className="UA-leyenda">
                {modulosOrdenados.map(m => (
                  <span key={m} className="UA-leyendaItem">
                    <span className="UA-leyendaPunto" style={{ background: colorDe(m) }} aria-hidden="true" />
                    {etiquetaModulo(m)}
                  </span>
                ))}
              </div>
            </section>

            {/* Horas pico: histograma 0-23 apilado por módulo (hora Colombia,
                computada en el backend). Cada segmento = un módulo. */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo"><FaClock style={{ marginRight: 6 }} />Actividad por hora del día (Colombia)</h2>
              {datos.por_hora.length === 0 ? (
                <p className="UP-vacio">Sin eventos con hora registrada en el rango (los eventos del portal Kabi previos a nov-25 no la traen).</p>
              ) : (
                <div className="UA-horas" role="img" aria-label="Eventos por hora del día, apilados por módulo">
                  {Array.from({ length: 24 }, (_, h) => {
                    const d = datos.por_hora.find(x => x.hora === h);
                    const alto = d ? Math.max(3, (d.eventos / maxHora) * 100) : 2;
                    return (
                      <div
                        key={h}
                        className="UA-horaCol"
                        tabIndex={0}
                        title={d ? `Clic: detalle de la franja ${String(h).padStart(2, '0')}:00` : undefined}
                        onClick={() =>
                          setTorta(tortaDeModulos(
                            `${String(h).padStart(2, '0')}:00 – ${String(h).padStart(2, '0')}:59`,
                            d?.eventos ?? 0, d?.usuarios ?? 0, d?.por_modulo,
                          ))
                        }
                      >
                        <span className="UP-barraValor">{d ? num(d.eventos) : ''}</span>
                        <div className="UA-horaPila" style={{ height: `${alto}%` }} aria-hidden="true">
                          {segmentosDe(d?.por_modulo).map(([m, n]) => (
                            <div key={m} className="UA-seg" style={{ flexGrow: n, background: colorDe(m) }} />
                          ))}
                        </div>
                        <span className="UA-horaEtiqueta">{String(h).padStart(2, '0')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* (2026-11-27) «Actividad por día» y «Usuarios únicos por día»
                lado a lado en pantallas grandes (mismo UA-parGraficos del par
                de abajo), apilados en pequeñas. */}
            <div className="UA-parGraficos">

            {/* Actividad por día — apilado por módulo (mismos colores/orden). */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Actividad por día</h2>
              {datos.por_dia.length === 0 ? (
                <p className="UP-vacio">Sin eventos en el rango seleccionado.</p>
              ) : (
                <div className="UP-barras" role="img" aria-label={`Eventos por día entre ${fmtFechaLarga(desde)} y ${fmtFechaLarga(hasta)}, apilados por módulo`}>
                  {datos.por_dia.map(d => (
                    <div
                      key={d.fecha}
                      className="UP-barraCol"
                      tabIndex={0}
                      title={`Clic: detalle del ${fmtFechaLarga(d.fecha)}`}
                      onClick={() => setTorta(tortaDeModulos(fmtFechaLarga(d.fecha), d.eventos, d.usuarios, d.por_modulo))}
                    >
                      <span className="UP-barraValor">{num(d.eventos)}</span>
                      <div className="UA-horaPila UA-diaPila" style={{ height: `${Math.max(3, (d.eventos / maxDia) * 100)}%` }} aria-hidden="true">
                        {segmentosDe(d.por_modulo).map(([m, n]) => (
                          <div key={m} className="UA-seg" style={{ flexGrow: n, background: colorDe(m) }} />
                        ))}
                      </div>
                      <span className="UP-barraFecha">{fmtFecha(d.fecha)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* (2026-11-27) Usuarios ÚNICOS por día, apilado por PERFIL (mismos
                colores de perfil): cuánta gente de cada perfil entra a la app a
                hacer algo cada día. Clic en un día → torta del desglose. */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Usuarios únicos por día</h2>
              {porDiaPerfil.length === 0 ? (
                <p className="UP-vacio">Sin eventos en el rango seleccionado.</p>
              ) : (
                <div className="UP-barras" role="img" aria-label="Usuarios únicos por día, apilados por perfil">
                  {porDiaPerfil.map(dd => {
                    const totalDia = totalUsuDia(dd);
                    const segs = Object.entries(dd.por_perfil || {})
                      .filter(([, n]) => n > 0)
                      .sort((a, b) => b[1] - a[1]);
                    return (
                      <div
                        key={dd.fecha}
                        className="UP-barraCol"
                        tabIndex={0}
                        title={`Clic: detalle del ${fmtFechaLarga(dd.fecha)}`}
                        onClick={() =>
                          setTorta({
                            titulo: fmtFechaLarga(dd.fecha),
                            subtitulo: `${num(totalDia)} usuarios únicos`,
                            segmentos: segs.map(([p, n]) => ({
                              etiqueta: p,
                              valor: n,
                              color: colorDePerfil(p),
                            })),
                          })
                        }
                      >
                        <span className="UP-barraValor">{num(totalDia)}</span>
                        <div className="UA-horaPila UA-diaPila" style={{ height: `${Math.max(3, (totalDia / maxUsuDia) * 100)}%` }} aria-hidden="true">
                          {segs.map(([p, n]) => (
                            <div key={p} className="UA-seg" style={{ flexGrow: n, background: colorDePerfil(p) }} />
                          ))}
                        </div>
                        <span className="UP-barraFecha">{fmtFecha(dd.fecha)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            </div>{/* /.UA-parGraficos (día + usuarios únicos por día) */}

            {/* (2026-11-27) Los dos gráficos nuevos JUNTOS: uno al lado del
                otro en pantallas grandes (≥1024px), apilados en pequeñas,
                debajo de los gráficos principales de actividad. */}
            <div className="UA-parGraficos">

            {/* (2026-11-27) Usuarios con más eventos, de mayor a menor. Cada
                PERFIL tiene su propio color (mismo mapa del gráfico «Actividad
                por perfil»). Clic en un usuario → torta de sus tipos de evento. */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Usuarios con más eventos</h2>
              {usuariosPorEventos.length === 0 ? (
                <p className="UP-vacio">Sin usuarios en el rango.</p>
              ) : (
                <>
                  <div className="UA-usuarios">
                    {usuariosPorEventos.map(u => (
                      <button
                        key={u.usuario}
                        type="button"
                        className="UA-usuarioFila"
                        onClick={() => setTorta(tortaDeUsuario(u))}
                        title={u.nombre ? 'Clic: detalle por tipo de evento' : `${u.usuario} — usuario sin registro en baseusuarios (identidad cruda del beacon)`}
                      >
                        <span className="UA-usuarioNombre">
                          {u.nombre || u.usuario}
                          <small style={{ color: colorDePerfil(u.perfil) }}>
                            {u.perfil || 'SIN PERFIL'}
                          </small>
                        </span>
                        <span className="UA-usuarioPista">
                          <span
                            className="UA-usuarioBarra"
                            style={{
                              width: `${Math.max(2, (u.eventos / maxUsuEvt) * 100)}%`,
                              background: colorDePerfil(u.perfil),
                            }}
                          />
                        </span>
                        <span className="UA-usuarioValor">{num(u.eventos)}</span>
                      </button>
                    ))}
                  </div>
                  <p className="UA-usuariosLeyenda">
                    {perfilesOrdenados.map(p => (
                      <span key={p.perfil} className="UA-leyendaItem">
                        <span className="UA-leyendaPunto" style={{ background: colorDePerfil(p.perfil) }} />
                        {p.perfil}
                      </span>
                    ))}
                  </p>
                </>
              )}
            </section>

            {/* (2026-11-27) Actividad POR PERFIL: comportamiento de cada perfil
                en el uso de la aplicación general (eventos agregados de todos
                sus usuarios, de mayor a menor, con cuántos usuarios lo usan).
                Clic → torta con los tipos de evento que lo componen. */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Actividad por perfil</h2>
              {perfilesOrdenados.length === 0 ? (
                <p className="UP-vacio">Sin perfiles en el rango.</p>
              ) : (
                <div className="UA-usuarios">
                  {perfilesOrdenados.map(p => (
                    <button
                      key={p.perfil}
                      type="button"
                      className="UA-usuarioFila"
                      onClick={() => setTorta(tortaDePerfil(p))}
                      title="Clic: comportamiento por tipo de evento"
                    >
                      <span className="UA-usuarioNombre">
                        {p.perfil}
                        <small>{num(p.usuarios)} {p.usuarios === 1 ? 'usuario' : 'usuarios'}</small>
                      </span>
                      <span className="UA-usuarioPista">
                        <span
                          className="UA-usuarioBarra"
                          style={{
                            width: `${Math.max(2, (p.eventos / maxPerfil) * 100)}%`,
                            background: colorDePerfil(p.perfil),
                          }}
                        />
                      </span>
                      <span className="UA-usuarioValor">{num(p.eventos)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            </div>{/* /.UA-parGraficos */}

            {/* Módulos: dónde se concentra el trabajo */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Uso por módulo</h2>
              {datos.por_modulo.length === 0 ? (
                <p className="UP-vacio">Sin eventos en el rango seleccionado.</p>
              ) : (
                <div className="UP-tablaWrap">
                  <table className="UP-tabla">
                    <thead>
                      <tr>
                        <th>Módulo</th>
                        <th className="UP-num">Eventos</th>
                        <th className="UP-num">Usuarios</th>
                        <th className="UP-num">% del total</th>
                        <th>Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.por_modulo.map(m => {
                        const pct = (m.eventos / totalModulo) * 100;
                        return (
                          <tr
                            key={m.modulo}
                            className="UP-filaUsu"
                            title={modulo ? '' : 'Clic: filtrar este módulo'}
                            onClick={() => { if (!modulo) { setModulo(m.modulo); consultar({ modulo: m.modulo }); } }}
                          >
                            <td>{etiquetaModulo(m.modulo)}</td>
                            <td className="UP-num">{num(m.eventos)}</td>
                            <td className="UP-num">{num(m.usuarios)}</td>
                            <td className="UP-num">{pct.toFixed(1).replace('.', ',')}%</td>
                            <td>
                              <div className="UA-barraModuloPista" aria-hidden="true">
                                <div className="UA-barraModulo" style={{ width: `${Math.max(2, pct)}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Usuarios */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Usuarios ({datos.por_usuario.length})</h2>
              {datos.por_usuario.length === 0 ? (
                <p className="UP-vacio">Sin usuarios en el rango.</p>
              ) : (
                <div className="UP-tablaWrap">
                  <table className="UP-tabla">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Perfil</th>
                        <th className="UP-num">Días activos</th>
                        <th className="UP-num">Eventos</th>
                        <th>Detalle</th>
                        <th>Última conexión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuPagina.map(u => (
                        <tr key={u.usuario} className="UP-filaUsu" onClick={() => enfocarUsuario(u)} title="Clic: ver solo este usuario">
                          <td>{u.nombre || '—'}</td>
                          <td><span className={`UP-badge UP-badge--${(u.perfil || 'desconocido').toLowerCase()}`}>{u.perfil || '—'}</span></td>
                          <td className="UP-num">{num(u.dias_activos)}</td>
                          <td className="UP-num">{num(u.eventos)}</td>
                          <td className="UP-detalleEventos">
                            {Object.entries(u.por_evento || {}).map(([ev, n]) => (
                              <span key={ev} className="UP-chip">{ETIQUETAS_EVENTO[ev] || ev}: {num(n)}</span>
                            ))}
                          </td>
                          <td>{fmtHora(u.ultima_conexion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {usuariosRecientes.length > TAM_PAG_USU && (
                    <div className="UP-paginacion">
                      <button
                        type="button"
                        className="UP-pagBtn"
                        onClick={() => setPagUsu(p => Math.max(1, p - 1))}
                        disabled={pagUsuEfectiva <= 1}
                      >
                        ‹ Anterior
                      </button>
                      <span>
                        Página {pagUsuEfectiva} de {totalPagsUsu} · {num(usuariosRecientes.length)} usuarios
                      </span>
                      <button
                        type="button"
                        className="UP-pagBtn"
                        onClick={() => setPagUsu(p => Math.min(totalPagsUsu, p + 1))}
                        disabled={pagUsuEfectiva >= totalPagsUsu}
                      >
                        Siguiente ›
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Mini tablas */}
            <div className="UP-miniTablas">
              <section className="UP-card">
                <h2 className="UP-cardTitulo">Acciones</h2>
                <ul className="UP-lista">
                  {datos.por_evento.length === 0 && <li className="UP-vacio">Sin datos.</li>}
                  {datos.por_evento.map(e => (
                    <li key={e.evento}>
                      <span>{ETIQUETAS_EVENTO[e.evento] || e.evento}</span>
                      <strong>{num(e.total)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="UP-card">
                <h2 className="UP-cardTitulo">Pestañas del portal de clientes</h2>
                <ul className="UP-lista">
                  {datos.por_pestana.length === 0 && <li className="UP-vacio">Sin datos.</li>}
                  {datos.por_pestana.map(p => (
                    <li key={p.pestana}>
                      <span>{p.pestana}</span>
                      <strong>{num(p.total)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="UP-card">
                <h2 className="UP-cardTitulo">Portal de clientes</h2>
                <ul className="UP-lista">
                  {datos.por_cliente.length === 0 && <li className="UP-vacio">Sin datos.</li>}
                  {datos.por_cliente.map(c => (
                    <li key={c.cliente_id}>
                      <span>{c.cliente_id}</span>
                      <strong>{num(c.eventos)} · {num(c.usuarios)} usr</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <p className="UP-nota">
              La telemetría general se activó el 25-nov-2025: la navegación y acciones anteriores a esa fecha
              solo existen para el portal de clientes (sin hora del día). Los eventos se conservan 180 días.
            </p>
          </>
        )}

        {/* (2026-11-27) Popup de detalle: torta SVG (anillo) del elemento al
            que se le dio clic — barra de hora/día (desglose por módulo, mismos
            colores de los gráficos) o usuario (desglose por tipo de evento).
            Cierra con ✕, clic en el fondo o Escape. */}
        {torta && (() => {
          const total = torta.segmentos.reduce((s, x) => s + x.valor, 0) || 1;
          const RADIO = 70;
          const CIRC = 2 * Math.PI * RADIO;
          let acumulado = 0;
          return (
            <div className="UA-modalFondo" onClick={() => setTorta(null)} role="dialog" aria-modal="true" aria-label={torta.titulo}>
              <div className="UA-modal" onClick={e => e.stopPropagation()}>
                <div className="UA-modalCab">
                  <div>
                    <h3 className="UA-modalTitulo">{torta.titulo}</h3>
                    <p className="UA-modalSub">{torta.subtitulo}</p>
                  </div>
                  <button className="UA-modalCerrar" onClick={() => setTorta(null)} aria-label="Cerrar detalle">✕</button>
                </div>
                <div className="UA-tortaWrap">
                  <svg viewBox="0 0 200 200" className="UA-tortaSvg" role="img" aria-label={`Distribución: ${torta.segmentos.map(s => `${s.etiqueta} ${s.valor}`).join(', ')}`}>
                    {torta.segmentos.map(s => {
                      const largo = (s.valor / total) * CIRC;
                      const arco = (
                        <circle
                          key={s.etiqueta}
                          cx="100" cy="100" r={RADIO}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="26"
                          strokeDasharray={`${largo} ${CIRC - largo}`}
                          strokeDashoffset={-acumulado}
                          transform="rotate(-90 100 100)"
                        />
                      );
                      acumulado += largo;
                      return arco;
                    })}
                    <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" className="UA-tortaCentro">
                      {num(total)}
                    </text>
                  </svg>
                  <div className="UA-tortaLeyenda">
                    {torta.segmentos.map(s => (
                      <div key={s.etiqueta} className="UA-tortaLeyendaItem">
                        <span className="UA-leyendaPunto" style={{ background: s.color }} aria-hidden="true" />
                        <span className="UA-tortaEtiqueta">{s.etiqueta}</span>
                        <span className="UA-tortaCifra">
                          {num(s.valor)} · {((s.valor / total) * 100).toFixed(1).replace('.', ',')}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
