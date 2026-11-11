/**
 * Citas de Entrega — gestión (2026-11-09).
 *
 * Registro MANUAL de la cita de entrega de una guía: fecha + franja horaria
 * (hora inicio/fin) en la que el cliente puede recibir. La FECHA registrada
 * GANA sobre la cita agendada (citas_agendadas del Excel real) en el cálculo
 * On Time del dashboard de clientes: si el TMS dice 8-nov y acá se registra
 * 9-nov, el OT juzga con el 9-nov. Borrada la cita manual, el OT vuelve a la
 * agendada. La franja horaria es solo informativa (el OT compara fechas).
 *
 * También carga masiva por Excel (GUIA / FECHA / HORA INICIO / HORA FIN —
 * plantilla descargable, validación todo-o-nada) y todo queda con
 * trazabilidad: quién registró/actualizó cada cita y bitácora de auditoría
 * en el backend.
 *
 * Perfiles: ADMIN, ANALISTA, COORDINADOR, CONTROL, OPERATIVO (el backend
 * también lo exige; aquí solo se oculta la UI).
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const PERFILES_AUTORIZADOS = ['ADMIN', 'ANALISTA', 'COORDINADOR', 'CONTROL', 'OPERATIVO'];

type Cita = {
  id: string;
  guia: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  creado_por?: { usuario?: string; nombre?: string; fecha?: string };
  actualizado_por?: { usuario?: string; nombre?: string; fecha?: string };
  updated_at?: string;
  // Re-agendas anteriores (la vigente son los campos de arriba): cada entrada
  // es el CAMBIO completo — de qué fecha/horario → a cuál, quién y cuándo.
  // Las entradas viejas (planas) solo traen el valor anterior.
  historial?: {
    previo?: { fecha?: string; hora_inicio?: string; hora_fin?: string };
    nuevo?: { fecha?: string; hora_inicio?: string; hora_fin?: string };
    fecha?: string;        // legacy plano
    hora_inicio?: string;  // legacy plano
    hora_fin?: string;     // legacy plano
    por?: { usuario?: string; nombre?: string; fecha?: string };
    fecha_cambio?: string;
  }[];
};

type ResultadoCarga = {
  mensaje: string;
  procesadas: { fila: number; guia: string; accion: string }[];
  errores: { fila: number; guia: string; detalle: string }[];
};

// (2026-11-09) Citas eliminadas (auditoría): el documento completo pasa a la
// colección `citas_eliminadas` con quién lo borró y cuándo — ADMIN/CONTROL.
type CitaEliminada = {
  id: string;
  guia: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  eliminada_por?: { usuario?: string; nombre?: string; fecha?: string };
  eliminada_el?: string;
};

const fmtFechaHora = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 23)}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

/** '2026-11-09' → '09-11-2026' (formato de fechas del resto de la app). */
const fmtFecha = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '—';
};

// Franjas de MEDIA HORA en formato 24h (hora militar, sin AM/PM): los
// <input type="time"> muestran AM/PM según la configuración regional del
// navegador y admiten cualquier minuto — un dropdown con estas 48 opciones
// garantiza el formato y el paso de 30 minutos en cualquier equipo.
const OPCIONES_HORA: string[] = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** 'HH:MM' + N minutos → 'HH:MM' (tope 23:30, la última franja del día). */
const sumarMinutos = (hora: string, minutos: number): string => {
  const [h, m] = hora.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutos, 23 * 60 + 30);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export default function CitasEntregaP() {
  const [perfil, setPerfil] = useState('');
  const [usuario, setUsuario] = useState('');
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  const [citas, setCitas] = useState<Cita[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [error, setError] = useState('');
  const inputArchivo = useRef<HTMLInputElement>(null);
  const LIMITE = 50;

  // Modal de registro manual / edición: null = cerrado.
  const [modal, setModal] = useState<{ cita: Cita | null } | null>(null);
  const [mGuia, setMGuia] = useState('');
  const [mFecha, setMFecha] = useState('');
  const [mHi, setMHi] = useState('');
  const [mHf, setMHf] = useState('');
  const [mError, setMError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '').toUpperCase();
    setUsuario(u);
    setPerfil(p);
    setAutorizado(PERFILES_AUTORIZADOS.includes(p));
  }, []);

  const consultar = useCallback(async (pag = 1, busq = '') => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams({ usuario, pagina: String(pag), limite: String(LIMITE) });
      if (busq.trim()) params.set('q', busq.trim());
      const r = await fetch(`${API}/citas-entrega/?${params.toString()}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al consultar las citas');
      setCitas(data.citas || []);
      setTotal(data.total || 0);
      setPagina(pag);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consultar');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (autorizado && usuario) consultar(1);
  }, [autorizado, usuario, consultar]);

  // Búsqueda EN VIVO por guía (debounce 350 ms): filtra mientras se escribe,
  // sin esperar al botón Buscar ni al Enter (los dos siguen funcionando y
  // consultan al instante).
  const primerCambioQ = useRef(true);
  useEffect(() => {
    if (primerCambioQ.current) { primerCambioQ.current = false; return; }
    if (!autorizado) return;
    const t = setTimeout(() => consultar(1, q.trim()), 350);
    return () => clearTimeout(t);
  }, [q, autorizado, consultar]);

  // Citas ELIMINADAS (auditoría, ADMIN/CONTROL): carga perezosa al abrir el
  // desplegable la primera vez.
  const [eliminadas, setEliminadas] = useState<CitaEliminada[]>([]);
  const [elimTotal, setElimTotal] = useState(0);
  const [cargandoElim, setCargandoElim] = useState(false);
  const [elimError, setElimError] = useState('');

  const cargarEliminadas = useCallback(async () => {
    if (cargandoElim) return;
    setCargandoElim(true);
    setElimError('');
    try {
      const r = await fetch(`${API}/citas-entrega/eliminadas?usuario=${encodeURIComponent(usuario)}&limite=50`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al consultar las eliminadas');
      setEliminadas(data.eliminadas || []);
      setElimTotal(data.total || 0);
    } catch (e) {
      setElimError(e instanceof Error ? e.message : 'Error al consultar');
    } finally {
      setCargandoElim(false);
    }
  }, [usuario, cargandoElim]);

  const subirExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const r = await fetch(`${API}/citas-entrega/importar-excel?usuario=${encodeURIComponent(usuario)}`, {
        method: 'POST',
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) {
        // 422 todo-o-nada: detail = {mensaje, errores[]} (rechazo completo).
        if (data.detail && typeof data.detail === 'object') {
          setResultado({ mensaje: data.detail.mensaje, procesadas: [], errores: data.detail.errores || [] });
        } else {
          throw new Error(data.detail || 'Error al cargar el Excel');
        }
      } else {
        setResultado(data);
        consultar(1, q);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el Excel');
    } finally {
      setSubiendo(false);
      if (inputArchivo.current) inputArchivo.current.value = '';
    }
  };

  const borrar = async (cita: Cita) => {
    if (!confirm(`¿Eliminar la cita de la guía ${cita.guia}?\n(Sin cita manual, el On Time vuelve a usar la cita agendada. Queda en auditoría quién la borró.)`)) return;
    try {
      const r = await fetch(
        `${API}/citas-entrega/eliminar?usuario=${encodeURIComponent(usuario)}&id=${encodeURIComponent(cita.id)}`,
        { method: 'DELETE' }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al eliminar');
      consultar(pagina, q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const abrirModal = (cita: Cita | null, guiaPreset?: string) => {
    setModal({ cita });
    setMGuia(cita?.guia || (guiaPreset ? guiaPreset.toUpperCase() : ''));
    setMFecha(cita?.fecha || '');
    setMHi(cita?.hora_inicio || '');
    setMHf(cita?.hora_fin || '');
    setMError('');
  };

  const cerrarModal = () => setModal(null);

  // Escape cierra el modal (mismo patrón de NovedadesOTP).
  useEffect(() => {
    if (!modal) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarModal(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [modal]);

  const guardarManual = async () => {
    if (guardando) return;
    setMError('');
    // Validaciones espejo del backend (guía obligatoria, fecha, franja).
    const guia = mGuia.trim().toUpperCase();
    if (!guia) { setMError('La guía es obligatoria.'); return; }
    if (guia.length > 30) { setMError('La guía es demasiado larga (máx. 30).'); return; }
    if (!mFecha) { setMError('La fecha es obligatoria.'); return; }
    if (!mHi || !mHf) { setMError('La franja horaria (inicio y fin) es obligatoria.'); return; }
    if (mHi > mHf) { setMError('La hora de inicio no puede ser mayor a la de fin.'); return; }
    setGuardando(true);
    try {
      const r = await fetch(`${API}/citas-entrega/guardar?usuario=${encodeURIComponent(usuario)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia, fecha: mFecha, hora_inicio: mHi, hora_fin: mHf }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al guardar');
      cerrarModal();
      // La lista ordena por updated_at desc → la guía queda de primeras.
      consultar(1, q);
    } catch (err) {
      setMError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (autorizado === null) return <div className="CE-pagina"><p className="CE-cargando">Cargando…</p></div>;

  if (!autorizado) {
    return (
      <div className="CE-pagina">
        <NavMedicalCare paginaActual="citasentrega" />
        <div className="CE-container">
          <div className="CE-sinAcceso">
            <h1>Citas de Entrega</h1>
            <p>Tu perfil <b>{perfil || '—'}</b> no tiene acceso a este módulo.</p>
            <p className="CE-hint">Perfiles autorizados: {PERFILES_AUTORIZADOS.join(', ')}.</p>
          </div>
        </div>
      </div>
    );
  }

  const hayMas = pagina * LIMITE < total;

  return (
    <div className="CE-pagina">
      <NavMedicalCare paginaActual="citasentrega" />
      <div className="CE-container">
      <header className="CE-header">
        <div>
          <h1>📅 Citas de Entrega</h1>
          <p className="CE-sub">
            La fecha registrada acá GANA sobre la cita agendada en el cálculo On Time del
            dashboard de clientes (p. ej. agendada 8-nov, registrada 9-nov → el OT juzga con
            el 9-nov). La franja horaria es la ventana en la que el cliente puede recibir.
            Todo queda con trazabilidad de quién lo registró.
          </p>
        </div>
      </header>

      <section className="CE-card">
        <h2 className="CE-cardTitulo">Cargar Excel</h2>
        <p className="CE-cardSub">
          Columnas: <b>GUIA · FECHA (DD/MM/AAAA) · HORA INICIO · HORA FIN</b> — fecha en
          formato dd/mm/aaaa (p. ej. 10/11/2026), horas HH:MM y la franja debe ser
          coherente (inicio ≤ fin).
        </p>
        <div className="CE-acciones">
          <label className={`CE-boton CE-botonPrimario ${subiendo ? 'CE-deshabilitado' : ''}`}>
            {subiendo ? 'Subiendo…' : '⬆ Subir Excel'}
            <input ref={inputArchivo} type="file" accept=".xlsx" onChange={subirExcel} disabled={subiendo} hidden />
          </label>
          <button className="CE-boton" onClick={() => abrirModal(null)} disabled={subiendo}>
            ＋ Nueva cita
          </button>
          <a
            className="CE-boton"
            href={`${API}/citas-entrega/plantilla`}
            title="Excel de ejemplo con las columnas esperadas"
          >
            ⬇ Plantilla
          </a>
          {/* Export de TODA la base (genera el backend con openpyxl): guía,
              fecha, franja + quién registró/actualizó y cuándo. */}
          <a
            className="CE-boton"
            href={`${API}/citas-entrega/exportar?usuario=${encodeURIComponent(usuario)}`}
            title="Descarga TODAS las citas activas en Excel"
          >
            ⬇ Excel
          </a>
        </div>

        {resultado && (() => {
          const rechazada = resultado.procesadas.length === 0 && resultado.errores.length > 0;
          return (
            <div className="CE-resultado">
              <p className={rechazada ? 'CE-resultadoError' : 'CE-resultadoOk'}>
                {rechazada ? '⛔' : '✅'} {resultado.mensaje}
              </p>
              {resultado.errores.length > 0 && (
                <details className="CE-errores" open={rechazada}>
                  <summary>⚠ {resultado.errores.length} fila(s) con error (ver detalle)</summary>
                  <ul>
                    {resultado.errores.slice(0, 50).map((e, i) => (
                      <li key={i}>Fila {e.fila} · guía <b>{e.guia || '—'}</b>: {e.detalle}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })()}
        {error && <p className="CE-error">❌ {error}</p>}
      </section>

      <section className="CE-card">
        <div className="CE-listaHeader">
          <h2 className="CE-cardTitulo">Citas activas <span className="CE-badge">{total}</span></h2>
          <div className="CE-buscador">
            <input
              type="search"
              placeholder="Buscar guía…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') consultar(1, q); }}
            />
            <button className="CE-boton" onClick={() => consultar(1, q)}>Buscar</button>
          </div>
        </div>

        {cargando ? (
          <p className="CE-cargando">Consultando…</p>
        ) : citas.length === 0 ? (
          <div>
            <p className="CE-vacio">Sin citas registradas{q ? ' para esa búsqueda' : ''}.</p>
            {/* Búsqueda sin resultados → crear la cita de esa guía al toque. */}
            {q.trim().length >= 3 && (
              <button className="CE-boton" onClick={() => abrirModal(null, q.trim())}>
                ＋ Crear cita para la guía «{q.trim().toUpperCase()}»
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="CE-tablaWrap">
              <table className="CE-tabla">
                <thead>
                  <tr>
                    <th>Guía</th>
                    <th>Fecha</th>
                    <th>Franja</th>
                    <th>Registrada por</th>
                    <th>Actualizada</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {citas.map(c => {
                    const reg = c.creado_por || {};
                    const act = c.actualizado_por || {};
                    const anteriores = c.historial || [];
                    return (
                      <tr key={c.id}>
                        <td className="CE-guia">{c.guia}</td>
                        <td className="CE-fecha">
                          {fmtFecha(c.fecha)}
                          {anteriores.length > 0 && (
                            <span
                              className="CE-badgeReagenda"
                              title={`Re-agendada ${anteriores.length} vez(ces). Citas anteriores: ${anteriores.map(a => fmtFecha(a.fecha)).join(', ')}`}
                            >
                              🔁 {anteriores.length}
                            </span>
                          )}
                        </td>
                        <td className="CE-franja">
                          <span className="CE-chipFranja">🕒 {c.hora_inicio} – {c.hora_fin}</span>
                        </td>
                        <td>
                          <span className="CE-quien">{reg.nombre || reg.usuario || '—'}</span>
                          {act.usuario && reg.usuario !== act.usuario && (
                            <span className="CE-quienSub"> · últ. {act.nombre || act.usuario}</span>
                          )}
                        </td>
                        <td className="CE-fecha">{fmtFechaHora(c.updated_at)}</td>
                        <td className="CE-accionesFila">
                          <button className="CE-editar" onClick={() => abrirModal(c)} title="Editar cita">✏️</button>
                          <button className="CE-borrar" onClick={() => borrar(c)} title="Eliminar (el OT vuelve a la cita agendada)">🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="CE-paginacion">
              <span>Mostrando {citas.length} de {total}</span>
              <div>
                <button className="CE-boton" disabled={pagina <= 1 || cargando} onClick={() => consultar(pagina - 1, q)}>← Anterior</button>{' '}
                <button className="CE-boton" disabled={!hayMas || cargando} onClick={() => consultar(pagina + 1, q)}>Siguiente →</button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Citas ELIMINADAS (auditoría): quién borró qué y cuándo — solo
          ADMIN/CONTROL; carga al abrir por primera vez. */}
      {['ADMIN', 'CONTROL'].includes(perfil) && (
        <section className="CE-card">
          <details
            className="CE-eliminadas"
            onToggle={e => { if ((e.target as HTMLDetailsElement).open && !elimTotal && !eliminadas.length) cargarEliminadas(); }}
          >
            <summary className="CE-cardTitulo CE-eliminadasSummary">
              🗑 Citas eliminadas {elimTotal > 0 && <span className="CE-badgeElim">{elimTotal}</span>}
              <span className="CE-campoHint"> — auditoría: quién borró qué y cuándo</span>
            </summary>
            {cargandoElim ? (
              <p className="CE-cargando">Consultando…</p>
            ) : elimError ? (
              <p className="CE-error">❌ {elimError}</p>
            ) : eliminadas.length === 0 ? (
              <p className="CE-vacio">No hay citas eliminadas.</p>
            ) : (
              <div className="CE-tablaWrap">
                <table className="CE-tabla">
                  <thead>
                    <tr>
                      <th>Guía</th>
                      <th>Fecha</th>
                      <th>Franja</th>
                      <th>Eliminada por</th>
                      <th>Eliminada el</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eliminadas.map(el => {
                      const por = el.eliminada_por || {};
                      return (
                        <tr key={el.id}>
                          <td className="CE-guia">{el.guia}</td>
                          <td className="CE-fecha">{fmtFecha(el.fecha)}</td>
                          <td className="CE-franja">
                            {el.hora_inicio && el.hora_fin
                              ? <span className="CE-chipFranja">🕒 {el.hora_inicio} – {el.hora_fin}</span>
                              : '—'}
                          </td>
                          <td className="CE-quien">{por.nombre || por.usuario || '—'}</td>
                          <td className="CE-fecha">{fmtFechaHora(el.eliminada_el)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </section>
      )}

      {modal && (
        <div className="CE-modalFondo" onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="CE-modalCard">
            <div className="CE-modalTitulo">
              <h3>{modal.cita ? `Editar cita · ${modal.cita.guia}` : 'Nueva cita de entrega'}</h3>
              <button className="CE-modalCerrar" onClick={cerrarModal} title="Cerrar (Escape)">✕</button>
            </div>
            <label className="CE-campo">
              Guía
              <input
                value={mGuia}
                onChange={e => setMGuia(e.target.value.toUpperCase())}
                placeholder="Número de guía del TMS"
                disabled={!!modal.cita}
                autoFocus={!modal.cita}
                maxLength={30}
              />
              {modal.cita && (
                <span className="CE-campoHint">La guía identifica la cita (upsert) — para cambiarla, elimina y crea una nueva.</span>
              )}
            </label>
            <label className="CE-campo">
              Fecha de la cita
              <input
                type="date"
                value={mFecha}
                onChange={e => setMFecha(e.target.value)}
              />
              <span className="CE-campoHint">Es la fecha con la que se juzga el On Time de la guía.</span>
            </label>
            <div className="CE-franjaCampos">
              <label className="CE-campo">
                Hora inicio
                <select
                  value={mHi}
                  onChange={e => {
                    const nueva = e.target.value;
                    setMHi(nueva);
                    // Al elegir la inicio: el fin sale por defecto DOS horas
                    // después (editable, siempre ≥ inicio). Si el fin ya
                    // elegido queda ANTES de la nueva inicio, se recorre a
                    // inicio + 2h — nunca puede quedar una franja invertida.
                    if (nueva) {
                      if (!mHf || mHf < nueva) setMHf(sumarMinutos(nueva, 120));
                    }
                  }}
                >
                  <option value="">Seleccione…</option>
                  {/* Valor previo fuera de la media hora (cargado por Excel):
                      se muestra como opción extra para no perderlo. */}
                  {mHi && !OPCIONES_HORA.includes(mHi) && <option value={mHi}>{mHi}</option>}
                  {OPCIONES_HORA.filter(h => !mHf || h <= mHf).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
              <label className="CE-campo">
                Hora fin
                <select value={mHf} onChange={e => setMHf(e.target.value)}>
                  <option value="">Seleccione…</option>
                  {/* Solo horas POSTERIORES (o iguales) a la de inicio: no se
                      puede elegir un fin anterior a la inicio. */}
                  {mHf && !OPCIONES_HORA.includes(mHf) && mHf >= (mHi || '00:00') && <option value={mHf}>{mHf}</option>}
                  {OPCIONES_HORA.filter(h => !mHi || h >= mHi).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            </div>
            <span className="CE-campoHint">Franja en la que el cliente puede recibir (solo informativa para el On Time).</span>
            {modal.cita && (modal.cita.historial?.length ?? 0) > 0 && (() => {
              // De la MÁS RECIENTE a la más antigua (el array es append-order).
              const anteriores = [...modal.cita.historial!].reverse();
              const franja = (f?: { fecha?: string; hora_inicio?: string; hora_fin?: string }) =>
                f?.hora_inicio && f?.hora_fin ? `${f.hora_inicio} – ${f.hora_fin}` : '';
              return (
                <div className="CE-historial">
                  <span className="CE-historialTitulo">
                    🕘 Historial de cambios <span className="CE-badgeReagenda">🔁 {anteriores.length}</span>
                    <span className="CE-campoHint"> — de la más reciente a la más antigua</span>
                  </span>
                  <div className="CE-tablaWrap">
                    <table className="CE-tabla CE-histTabla">
                      <thead>
                        <tr>
                          <th>Cambió a</th>
                          <th>Nueva franja</th>
                          <th>Antes</th>
                          <th>Hecho por</th>
                          <th>Cuándo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anteriores.map((a, i) => {
                          // Entradas viejas (planas): solo traen el valor
                          // anterior como fecha/hora del propio registro.
                          const antes = a.previo || { fecha: a.fecha, hora_inicio: a.hora_inicio, hora_fin: a.hora_fin };
                          return (
                            <tr key={i}>
                              <td className="CE-fecha">{a.nuevo?.fecha ? fmtFecha(a.nuevo.fecha) : '—'}</td>
                              <td className="CE-fecha">{franja(a.nuevo) || '—'}</td>
                              <td className="CE-fecha">
                                {antes?.fecha ? fmtFecha(antes.fecha) : '—'}
                                {franja(antes) ? <span className="CE-histFranja"> · {franja(antes)}</span> : null}
                              </td>
                              <td>{a.por?.nombre || a.por?.usuario || '—'}</td>
                              <td className="CE-fecha">{a.fecha_cambio ? fmtFechaHora(a.fecha_cambio) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <span className="CE-campoHint">
                    Cada cambio reemplaza la fecha anterior para el cálculo On Time; la vigente es la de los campos de arriba.
                  </span>
                </div>
              );
            })()}
            {mError && <p className="CE-error">❌ {mError}</p>}
            <div className="CE-modalAcciones">
              <button className="CE-boton" onClick={cerrarModal} disabled={guardando}>Cancelar</button>
              <button
                className="CE-boton CE-botonPrimario"
                onClick={guardarManual}
                disabled={guardando || !mGuia.trim() || !mFecha || !mHi || !mHf}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
