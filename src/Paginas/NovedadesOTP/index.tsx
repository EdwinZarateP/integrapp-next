/**
 * Novedades Justificadas OT — gestión (2026-10-29).
 *
 * Sube un Excel (GUIA / CAUSAL / JUSTIFICACION — plantilla descargable) cuyas
 * guías justificadas pasan al segmento «Justificadas» del gráfico On Time del
 * dashboard de clientes y quedan excluidas del % OT (fue excusada). Causales
 * SOLO del catálogo `causales_ot` (reagenda cita, siniestro, derrumbe...).
 *
 * Todo queda con trazabilidad: quién registró/actualizó cada justificación y
 * bitácora de auditoría (carga/actualización/borrado) en el backend.
 *
 * Perfiles: ADMIN, COORDINADOR, CONTROL, OPERATIVO (el backend también lo
 * exige; aquí solo se oculta la UI).
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const PERFILES_AUTORIZADOS = ['ADMIN', 'COORDINADOR', 'CONTROL', 'OPERATIVO'];

type Novedad = {
  id: string;
  guia: string;
  causal: string;
  justificacion: string;
  creado_por?: { usuario?: string; nombre?: string; fecha?: string };
  actualizado_por?: { usuario?: string; nombre?: string; fecha?: string };
  updated_at?: string;
};

type ResultadoCarga = {
  mensaje: string;
  procesadas: { fila: number; guia: string; accion: string }[];
  errores: { fila: number; guia: string; detalle: string }[];
};

const fmtFecha = (iso?: string) => {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(`${iso.slice(0, 23)}Z`);
  if (isNaN(d.getTime())) return `${m[3]}-${m[2]}-${m[1]}`;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

export default function NovedadesOTP() {
  const router = useRouter();
  const [perfil, setPerfil] = useState('');
  const [usuario, setUsuario] = useState('');
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  const [causales, setCausales] = useState<string[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [error, setError] = useState('');
  const inputArchivo = useRef<HTMLInputElement>(null);
  const LIMITE = 50;

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
      const r = await fetch(`${API}/novedades-ot/?${params.toString()}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al consultar las novedades');
      setNovedades(data.novedades || []);
      setTotal(data.total || 0);
      setPagina(pag);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consultar');
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (autorizado && usuario) {
      fetch(`${API}/novedades-ot/causales?usuario=${encodeURIComponent(usuario)}`)
        .then(r => r.json())
        .then(d => setCausales(d.causales || []))
        .catch(() => setCausales([]));
      consultar(1);
    }
  }, [autorizado, usuario, consultar]);

  const subirExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const r = await fetch(`${API}/novedades-ot/importar-excel?usuario=${encodeURIComponent(usuario)}`, {
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

  const borrar = async (nov: Novedad) => {
    if (!confirm(`¿Eliminar la justificación de la guía ${nov.guia}?\n(Queda registrada en auditoría quién la borró.)`)) return;
    try {
      const r = await fetch(
        `${API}/novedades-ot/eliminar?usuario=${encodeURIComponent(usuario)}&id=${encodeURIComponent(nov.id)}`,
        { method: 'DELETE' }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al eliminar');
      consultar(pagina, q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (autorizado === null) return <div className="NV-pagina"><p className="NV-cargando">Cargando…</p></div>;

  if (!autorizado) {
    return (
      <div className="NV-pagina">
        <NavMedicalCare paginaActual="novedadesot" />
        <div className="NV-container">
          <div className="NV-sinAcceso">
            <h1>Novedades Justificadas OT</h1>
            <p>Tu perfil <b>{perfil || '—'}</b> no tiene acceso a este módulo.</p>
            <p className="NV-hint">Perfiles autorizados: {PERFILES_AUTORIZADOS.join(', ')}.</p>
          </div>
        </div>
      </div>
    );
  }

  const hayMas = pagina * LIMITE < total;

  return (
    <div className="NV-pagina">
      <NavMedicalCare paginaActual="novedadesot" />
      <div className="NV-container">
      <header className="NV-header">
        <div>
          <h1>🧾 Novedades Justificadas OT</h1>
          <p className="NV-sub">
            Las guías justificadas pasan al segmento «Justificadas» del gráfico On Time
            del dashboard de clientes (excluidas del % OT). Todo queda con trazabilidad
            de quién lo registró.
          </p>
        </div>
      </header>

      <section className="NV-card">
        <h2 className="NV-cardTitulo">Cargar Excel</h2>
        <p className="NV-cardSub">
          Columnas: <b>GUIA · CAUSAL · JUSTIFICACION</b> — el causal debe ser uno del
          catálogo: {causales.length ? causales.map(c => <span key={c} className="NV-chip">{c}</span>) : 'cargando…'}
        </p>
        <div className="NV-acciones">
          <label className={`NV-boton NV-botonPrimario ${subiendo ? 'NV-deshabilitado' : ''}`}>
            {subiendo ? 'Subiendo…' : '⬆ Subir Excel'}
            <input ref={inputArchivo} type="file" accept=".xlsx" onChange={subirExcel} disabled={subiendo} hidden />
          </label>
          <a
            className="NV-boton"
            href={`${API}/novedades-ot/plantilla`}
            title="Excel de ejemplo con las columnas esperadas"
          >
            ⬇ Plantilla
          </a>
        </div>

        {resultado && (() => {
          const rechazada = resultado.procesadas.length === 0 && resultado.errores.length > 0;
          return (
            <div className="NV-resultado">
              <p className={rechazada ? 'NV-resultadoError' : 'NV-resultadoOk'}>
                {rechazada ? '⛔' : '✅'} {resultado.mensaje}
              </p>
              {resultado.errores.length > 0 && (
                <details className="NV-errores" open={rechazada}>
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
        {error && <p className="NV-error">❌ {error}</p>}
      </section>

      <section className="NV-card">
        <div className="NV-listaHeader">
          <h2 className="NV-cardTitulo">Justificaciones activas <span className="NV-badge">{total}</span></h2>
          <div className="NV-buscador">
            <input
              type="search"
              placeholder="Buscar guía, causal o justificación…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') consultar(1, q); }}
            />
            <button className="NV-boton" onClick={() => consultar(1, q)}>Buscar</button>
          </div>
        </div>

        {cargando ? (
          <p className="NV-cargando">Consultando…</p>
        ) : novedades.length === 0 ? (
          <p className="NV-vacio">Sin justificaciones registradas{q ? ' para esa búsqueda' : ''}.</p>
        ) : (
          <>
            <div className="NV-tablaWrap">
              <table className="NV-tabla">
                <thead>
                  <tr>
                    <th>Guía</th>
                    <th>Causal</th>
                    <th>Justificación</th>
                    <th>Registrada por</th>
                    <th>Actualizada</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {novedades.map(n => {
                    const reg = n.creado_por || {};
                    const act = n.actualizado_por || {};
                    return (
                      <tr key={n.id}>
                        <td className="NV-guia">{n.guia}</td>
                        <td><span className="NV-chip">{n.causal}</span></td>
                        <td className="NV-just">{n.justificacion}</td>
                        <td>
                          <span className="NV-quien">{reg.nombre || reg.usuario || '—'}</span>
                          {act.usuario && reg.usuario !== act.usuario && (
                            <span className="NV-quienSub"> · últ. {act.nombre || act.usuario}</span>
                          )}
                        </td>
                        <td className="NV-fecha">{fmtFecha(n.updated_at)}</td>
                        <td>
                          <button className="NV-borrar" onClick={() => borrar(n)} title="Eliminar (queda en auditoría)">🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="NV-paginacion">
              <span>Mostrando {novedades.length} de {total}</span>
              <div>
                <button className="NV-boton" disabled={pagina <= 1 || cargando} onClick={() => consultar(pagina - 1, q)}>← Anterior</button>{' '}
                <button className="NV-boton" disabled={!hayMas || cargando} onClick={() => consultar(pagina + 1, q)}>Siguiente →</button>
              </div>
            </div>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
