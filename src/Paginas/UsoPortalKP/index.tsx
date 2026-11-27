/**
 * Uso del Portal (telemetría) — 2026-11-19.
 *
 * Indicadores de adopción del portal de clientes (fresenius-kabi y demás):
 * quiénes lo usan (de cualquier perfil), con qué frecuencia diaria, qué
 * pestañas y qué acciones (consulta de guía, tablas de pendientes, exports).
 * Alimenta la conversación con el cliente: «estos N usuarios entraron M días».
 *
 * Datos: GET /telemetria/resumen (solo ADMIN; el backend resuelve perfil real
 * en baseusuarios). Eventos capturados por los beacons de DashboardCliente
 * (colección eventos_portal, TTL 180 días).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { FaFileExcel, FaSearch, FaUsers, FaCalendarDay, FaMousePointer, FaBolt } from 'react-icons/fa';
import HeaderModulo from '@/Componentes/HeaderModulo';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const PERFILES_AUTORIZADOS = ['ADMIN'];

const CLIENTES = [
  { id: '', nombre: 'Todos los portales' },
  { id: 'fresenius-kabi', nombre: 'Fresenius Kabi' },
  { id: 'fresenius-medical-care', nombre: 'Fresenius Medical Care' },
];

type PorDia = { fecha: string; eventos: number; usuarios: number };
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
};

const ETIQUETAS_EVENTO: Record<string, string> = {
  pageview: 'Entradas al portal',
  pestana: 'Cambios de pestaña',
  consulta_guia: 'Consultas de guía',
  pendientes: 'Tablas de pendientes',
  export_excel: 'Exports a Excel',
};
const ETIQUETAS_PESTANA: Record<string, string> = {
  gerenciales: 'Gerenciales',
  operacion: 'Operación',
  trazabilidad: 'Trazabilidad',
};

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

const AUDIENCIAS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'clientes', nombre: 'Clientes (externos)' },
  { id: 'internos', nombre: 'Usuarios internos' },
] as const;

export default function UsoPortalKP() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [desde, setDesde] = useState(menosDias(29));
  const [hasta, setHasta] = useState(hoyStr());
  const [cliente, setCliente] = useState('');
  const [audiencia, setAudiencia] = useState<'todos' | 'clientes' | 'internos'>('todos');
  // Foco en un usuario (2026-11-20): {usuario, nombre} del row elegido o null.
  const [usuFoco, setUsuFoco] = useState<{ usuario: string; nombre: string } | null>(null);
  const [buscaUsu, setBuscaUsu] = useState('');
  const [sugerAbiertas, setSugerAbiertas] = useState(false);
  const [datos, setDatos] = useState<ResumenTlm | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '').toUpperCase();
    setUsuario(u);
    setPerfil(p);
    setAutorizado(PERFILES_AUTORIZADOS.includes(p));
  }, []);

  // `overrides` permite aplicar de inmediato un cambio de foco/audiencia/portal
  // sin esperar el re-render del estado (patrón de los filtros que auto-aplican).
  const consultar = useCallback(
    async (overrides?: {
      foco?: { usuario: string; nombre: string } | null;
      audiencia?: typeof audiencia;
      cliente?: string;
    }) => {
      if (!usuario) return;
      setCargando(true);
      setError('');
      try {
        const aud = overrides?.audiencia !== undefined ? overrides.audiencia : audiencia;
        const cli = overrides?.cliente !== undefined ? overrides.cliente : cliente;
        const foco = overrides && 'foco' in overrides ? overrides.foco ?? null : usuFoco;
        const params = new URLSearchParams({ usuario, desde, hasta, audiencia: aud });
        if (cli) params.set('cliente_id', cli);
        if (foco) params.set('usuario_filtro', foco.usuario);
        // (2026-11-27) Esta página mide la adopción del PORTAL de clientes:
        // excluir la telemetría general de la app (pageviews/acciones de
        // todos los módulos) que comparte la colección eventos_portal con
        // cliente_id null. Un backend viejo ignora el parámetro — inofensivo.
        params.set('solo_portales', 'true');
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
    [usuario, desde, hasta, cliente, audiencia, usuFoco],
  );

  const enfocarUsuario = (u: { usuario: string; nombre?: string | null }) => {
    const foco = { usuario: u.usuario, nombre: u.nombre || u.usuario };
    setUsuFoco(foco);
    setBuscaUsu('');
    setSugerAbiertas(false);
    consultar({ foco });
  };
  const quitarFoco = () => {
    setUsuFoco(null);
    consultar({ foco: null });
  };
  const quitarPortal = () => {
    setCliente('');
    consultar({ cliente: '' });
  };
  const quitarAudiencia = () => {
    setAudiencia('todos');
    consultar({ audiencia: 'todos' });
  };

  useEffect(() => {
    if (autorizado && usuario) consultar();
  }, [autorizado, usuario, consultar]);

  const exportarExcel = async () => {
    if (!datos) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const hojaUsuarios = datos.por_usuario.map(u => ({
      'Usuario': u.usuario,
      'Nombre': u.nombre || '',
      'Perfil': u.perfil || '',
      'Eventos': u.eventos,
      'Días activos': u.dias_activos,
      'Última conexión': fmtHora(u.ultima_conexion),
      ...Object.fromEntries(Object.entries(u.por_evento || {}).map(([k, v]) => [ETIQUETAS_EVENTO[k] || k, v])),
    }));
    const hojaDia = datos.por_dia.map(d => ({
      'Fecha': fmtFechaLarga(d.fecha),
      'Eventos': d.eventos,
      'Usuarios': d.usuarios,
    }));
    const hojaEventos = [
      ...datos.por_evento.map(e => ({ 'Métrica': ETIQUETAS_EVENTO[e.evento] || e.evento, 'Total': e.total })),
      ...datos.por_pestana.map(p => ({ 'Métrica': `Pestaña: ${ETIQUETAS_PESTANA[p.pestana] || p.pestana}`, 'Total': p.total })),
      ...datos.por_cliente.map(c => ({ 'Métrica': `Portal: ${c.cliente_id}`, 'Total': c.eventos })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaUsuarios), 'Usuarios');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaDia), 'Por día');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaEventos), 'Eventos');
    XLSX.writeFile(wb, `uso_portal_${desde}_${hasta}${cliente ? `_${cliente}` : ''}.xlsx`);
  };

  if (autorizado === null) return <div className="UP-container"><p className="UP-cargando">Cargando…</p></div>;
  if (!autorizado) {
    return (
      <div className="UP-container">
        <div className="UP-sinAcceso">
          <h2>Acceso restringido</h2>
          <p>La telemetría de uso del portal está disponible solo para el perfil ADMIN.</p>
          <button onClick={() => (window.location.href = '/integrapp/indicadores')}>Volver a Indicadores</button>
        </div>
      </div>
    );
  }

  const maxDia = Math.max(1, ...(datos?.por_dia.map(d => d.eventos) ?? [1]));

  // Tabla de usuarios: de la última conexión MÁS RECIENTE a la más antigua
  // (el backend la trae por eventos; el orden de actividad es el que interesa
  // para ver quién está entrando ahora).
  const usuariosRecientes = [...(datos?.por_usuario ?? [])].sort(
    (a, b) => (b.ultima_conexion ? new Date(b.ultima_conexion).getTime() : 0)
            - (a.ultima_conexion ? new Date(a.ultima_conexion).getTime() : 0),
  );

  return (
    <div className="UP-container">
      {/* (2026-11-25, 10.ª tanda) Header UNIFICADO de la app (HeaderModulo):
          el header propio UP-* fue eliminado. */}
      <HeaderModulo
        titulo="Uso del Portal"
        subtitulo="Telemetría de adopción — portales de clientes"
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
            Portal
            <select value={cliente} onChange={e => setCliente(e.target.value)}>
              {CLIENTES.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>
            Audiencia
            <select
              value={audiencia}
              onChange={e => {
                const v = e.target.value as typeof audiencia;
                setAudiencia(v);
                consultar({ audiencia: v });
              }}
            >
              {AUDIENCIAS.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
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

        {/* Migas de filtros aplicados — removibles al clic (patrón DC-miga) */}
        <div className="UP-migas" aria-label="Filtros aplicados">
          <span className="UP-migaFija" title="Rango de fechas consultado">
            📅 {fmtFechaLarga(desde)} → {fmtFechaLarga(hasta)}
          </span>
          {cliente && (
            <button type="button" className="UP-miga" onClick={quitarPortal} title="Quitar filtro de portal">
              🏢 {CLIENTES.find(c => c.id === cliente)?.nombre || cliente} ✕
            </button>
          )}
          {audiencia !== 'todos' && (
            <button type="button" className="UP-miga" onClick={quitarAudiencia} title="Quitar filtro de audiencia">
              👥 {AUDIENCIAS.find(a => a.id === audiencia)?.nombre || audiencia} ✕
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
            {/* KPIs */}
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

            {/* Actividad por día — una sola serie (columnas), sin leyenda */}
            <section className="UP-card">
              <h2 className="UP-cardTitulo">Actividad por día</h2>
              {datos.por_dia.length === 0 ? (
                <p className="UP-vacio">Sin eventos en el rango seleccionado.</p>
              ) : (
                <div className="UP-barras" role="img" aria-label={`Eventos por día entre ${fmtFechaLarga(desde)} y ${fmtFechaLarga(hasta)}`}>
                  {datos.por_dia.map(d => (
                    <div key={d.fecha} className="UP-barraCol" tabIndex={0}>
                      <span className="UP-barraValor">{num(d.eventos)}</span>
                      <div
                        className="UP-barra"
                        style={{ height: `${Math.max(3, (d.eventos / maxDia) * 100)}%` }}
                        aria-hidden="true"
                      />
                      <span className="UP-barraFecha">{fmtFecha(d.fecha)}</span>
                      <span className="UP-tooltip">
                        <strong>{fmtFechaLarga(d.fecha)}</strong>
                        {num(d.eventos)} eventos · {num(d.usuarios)} {d.usuarios === 1 ? 'usuario' : 'usuarios'}
                      </span>
                    </div>
                  ))}
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
                      {usuariosRecientes.map(u => (
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
                </div>
              )}
            </section>

            {/* Mini tablas */}
            <div className="UP-miniTablas">
              <section className="UP-card">
                <h2 className="UP-cardTitulo">Pestañas más usadas</h2>
                <ul className="UP-lista">
                  {datos.por_pestana.length === 0 && <li className="UP-vacio">Sin datos.</li>}
                  {datos.por_pestana.map(p => (
                    <li key={p.pestana}>
                      <span>{ETIQUETAS_PESTANA[p.pestana] || p.pestana}</span>
                      <strong>{num(p.total)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
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
                <h2 className="UP-cardTitulo">Por portal</h2>
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
              Los eventos se registran al entrar al portal, cambiar de pestaña, consultar una guía,
              abrir las tablas de pendientes y exportar a Excel. Se conservan 180 días.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
