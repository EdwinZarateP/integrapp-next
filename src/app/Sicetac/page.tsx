'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2,
  History, RotateCcw, UploadCloud,
} from 'lucide-react';
import HeaderSesion from '@/Componentes/HeaderSesion';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
const JOB_STORAGE_KEY = 'sicetacJobId';

type EstadoJob = 'pendiente' | 'ejecutando' | 'completada' | 'fallida';

interface SicetacJob {
  ejecucion_id: string;
  job_id: string;
  estado: EstadoJob;
  archivo?: string;
  filas_totales: number;
  filas_procesadas: number;
  filas_exitosas: number;
  filas_sin_resultado: number;
  filas_con_error: number;
  resultados_generados: number;
  tamano_lote: number;
  lote_actual: number;
  lotes_totales: number;
  progreso_porcentaje: number;
  creado_por?: string;
  creado_en?: string;
  finalizado_en?: string;
  error?: string;
}

function obtenerToken() {
  return window.localStorage.getItem('baseUsuarioAccessToken') || '';
}

function nombreDescarga(response: Response, fallback: string) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

async function detalleError(response: Response) {
  try {
    const body = await response.json();
    if (typeof body.detail === 'string') return body.detail;
    return JSON.stringify(body.detail || body);
  } catch {
    return `Error HTTP ${response.status}`;
  }
}

export default function SicetacPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [autorizado, setAutorizado] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [job, setJob] = useState<SicetacJob | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [recientes, setRecientes] = useState<SicetacJob[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);
  const [error, setError] = useState('');

  const cerrarSesionInvalida = useCallback(() => {
    window.localStorage.removeItem('baseUsuarioAccessToken');
    window.localStorage.removeItem(JOB_STORAGE_KEY);
    document.cookie = 'usuarioPedidosCookie=; Max-Age=0; path=/';
    document.cookie = 'perfilPedidosCookie=; Max-Age=0; path=/';
    router.replace('/LoginUsuario');
  }, [router]);

  const consultarEstado = useCallback(async (ejecucionId: string, signal?: AbortSignal) => {
    const response = await fetch(`${API}/sicetac/consultas-excel/jobs/${ejecucionId}`, {
      headers: { Authorization: `Bearer ${obtenerToken()}` }, signal, cache: 'no-store',
    });
    if (response.status === 401) {
      cerrarSesionInvalida();
      throw new Error('La sesión venció. Ingresa nuevamente.');
    }
    if (!response.ok) throw new Error(await detalleError(response));
    const data = await response.json() as SicetacJob;
    setJob(data);
    return data;
  }, [cerrarSesionInvalida]);

  const consultarRecientes = useCallback(async () => {
    setCargandoRecientes(true);
    try {
      const response = await fetch(`${API}/sicetac/consultas-excel/jobs?limit=10`, {
        headers: { Authorization: `Bearer ${obtenerToken()}` }, cache: 'no-store',
      });
      if (response.status === 401) { cerrarSesionInvalida(); return; }
      if (!response.ok) throw new Error(await detalleError(response));
      setRecientes(await response.json() as SicetacJob[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las ejecuciones recientes.');
    } finally {
      setCargandoRecientes(false);
    }
  }, [cerrarSesionInvalida]);

  useEffect(() => {
    const perfil = (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '').toUpperCase();
    const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    if (!usuario || !['ADMIN', 'ADMINISTRADOR'].includes(perfil) || !obtenerToken()) {
      router.replace('/LoginUsuario');
      return;
    }
    setAutorizado(true);
    consultarRecientes();
    const guardado = window.localStorage.getItem(JOB_STORAGE_KEY);
    if (guardado) {
      consultarEstado(guardado).catch((err: Error) => {
        setError(err.message);
        if (err.message.includes('no encontrada')) window.localStorage.removeItem(JOB_STORAGE_KEY);
      });
    }
  }, [consultarEstado, consultarRecientes, router]);

  useEffect(() => {
    if (!job || !['pendiente', 'ejecutando'].includes(job.estado)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      consultarEstado(job.ejecucion_id, controller.signal).catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    }, 4000);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [job, consultarEstado]);

  const validarArchivo = (candidate?: File) => {
    setError('');
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith('.xlsx')) {
      setArchivo(null);
      setError('Selecciona un archivo Excel con extensión .xlsx.');
      return;
    }
    if (candidate.size > 20 * 1024 * 1024) {
      setArchivo(null);
      setError('El archivo supera el máximo permitido de 20 MB.');
      return;
    }
    setArchivo(candidate);
  };

  const seleccionarArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    validarArchivo(event.target.files?.[0]);
  };

  const soltarArchivo = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setArrastrando(false);
    validarArchivo(event.dataTransfer.files?.[0]);
  };

  const crearTrabajo = async () => {
    if (!archivo) return;
    setSubiendo(true); setError('');
    try {
      const form = new FormData();
      form.append('archivo', archivo);
      const response = await fetch(`${API}/sicetac/consultas-excel/jobs`, {
        method: 'POST', headers: { Authorization: `Bearer ${obtenerToken()}` }, body: form,
      });
      if (response.status === 401) { cerrarSesionInvalida(); return; }
      if (!response.ok) throw new Error(await detalleError(response));
      const data = await response.json() as SicetacJob;
      window.localStorage.setItem(JOB_STORAGE_KEY, data.ejecucion_id);
      setJob(data); setArchivo(null);
      consultarRecientes();
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la ejecución.');
    } finally {
      setSubiendo(false);
    }
  };

  const abrirEjecucion = async (ejecucionId: string) => {
    setError('');
    window.localStorage.setItem(JOB_STORAGE_KEY, ejecucionId);
    try {
      await consultarEstado(ejecucionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible abrir la ejecución.');
    }
  };

  const fechaLocal = (value?: string) => {
    if (!value) return 'Fecha no disponible';
    const iso = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CO');
  };

  const descargar = async (url: string, fallback: string) => {
    setDescargando(true); setError('');
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${obtenerToken()}` } });
      if (response.status === 401) { cerrarSesionInvalida(); return; }
      if (!response.ok) throw new Error(await detalleError(response));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = nombreDescarga(response, fallback);
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible descargar el archivo.');
    } finally {
      setDescargando(false);
    }
  };

  const nuevoProceso = () => {
    window.localStorage.removeItem(JOB_STORAGE_KEY);
    setJob(null); setArchivo(null); setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  if (!autorizado) return null;
  const activo = job && ['pendiente', 'ejecutando'].includes(job.estado);
  const porcentaje = Math.min(100, Math.max(0, job?.progreso_porcentaje || 0));

  return (
    <div className="ST-page">
      <HeaderSesion modo="personal" />
      <main className="ST-main">
        <section className="ST-hero">
          <div>
            <span className="ST-eyebrow">SICE-TAC · RNDC</span>
            <h1>Consulta masiva de costos eficientes</h1>
            <p>Sube un solo Excel. El sistema procesa las combinaciones en segundo plano y prepara un consolidado descargable.</p>
          </div>
          <button className="ST-btn ST-btnSecondary" disabled={descargando}
            onClick={() => descargar(`${API}/sicetac/plantilla-excel`, 'plantilla_sicetac.xlsx')}>
            <Download size={19} /> Descargar plantilla
          </button>
        </section>

        {!job && (
          <section className="ST-card">
            <div className="ST-cardTitle">
              <FileSpreadsheet size={22} /><div><h2>Cargar consultas</h2><p>Hasta 2.000 filas y 20 MB.</p></div>
            </div>
            <div className={`ST-dropzone ${arrastrando ? 'ST-dropzoneActive' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)} onDrop={soltarArchivo}
              onClick={() => inputRef.current?.click()} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}>
              <input ref={inputRef} type="file" accept=".xlsx" onChange={seleccionarArchivo} hidden />
              <UploadCloud size={42} />
              {archivo ? <><strong>{archivo.name}</strong><span>{(archivo.size / 1024 / 1024).toFixed(2)} MB</span></>
                : <><strong>Arrastra tu Excel aquí</strong><span>o haz clic para seleccionarlo</span></>}
            </div>
            <button className="ST-btn ST-btnPrimary" disabled={!archivo || subiendo} onClick={crearTrabajo}>
              {subiendo ? <><Loader2 className="ST-spin" size={19} /> Subiendo…</> : <><UploadCloud size={19} /> Iniciar procesamiento</>}
            </button>
          </section>
        )}

        {job && (
          <section className="ST-card ST-progressCard">
            <div className="ST-statusHeader">
              <div className={`ST-statusIcon ST-${job.estado}`}>
                {activo ? <Loader2 className="ST-spin" /> : job.estado === 'completada' ? <CheckCircle2 /> : <AlertCircle />}
              </div>
              <div><span className="ST-statusLabel">{job.estado}</span><h2>{job.archivo || 'Consulta SICE-TAC'}</h2>
                <p>Proceso <code>{job.ejecucion_id}</code></p></div>
            </div>

            <div className="ST-progressMeta"><span>{job.filas_procesadas.toLocaleString('es-CO')} de {job.filas_totales.toLocaleString('es-CO')} consultas</span><strong>{porcentaje.toFixed(2)}%</strong></div>
            <div className="ST-progressTrack"><div className="ST-progressFill" style={{ width: `${porcentaje}%` }} /></div>
            <p className="ST-lote">Lote {job.lote_actual || 0} de {job.lotes_totales || 0} · bloques de {job.tamano_lote || 30}</p>

            <div className="ST-stats">
              <article><span>Exitosas</span><strong>{job.filas_exitosas?.toLocaleString('es-CO') || 0}</strong></article>
              <article><span>Sin resultado</span><strong>{job.filas_sin_resultado?.toLocaleString('es-CO') || 0}</strong></article>
              <article><span>Con error</span><strong>{job.filas_con_error?.toLocaleString('es-CO') || 0}</strong></article>
              <article><span>Rutas generadas</span><strong>{job.resultados_generados?.toLocaleString('es-CO') || 0}</strong></article>
            </div>

            {job.estado === 'completada' && <div className="ST-ready"><CheckCircle2 size={20} /><span>El consolidado está listo para descargar.</span></div>}
            {job.estado === 'fallida' && <div className="ST-failed"><AlertCircle size={20} /><span>{job.error || 'La ejecución no pudo completarse.'}</span></div>}

            <div className="ST-actions">
              {job.estado === 'completada' && <button className="ST-btn ST-btnPrimary" disabled={descargando}
                onClick={() => descargar(`${API}/sicetac/consultas-excel/jobs/${job.ejecucion_id}/resultado`, `resultados_sicetac_${job.ejecucion_id}.xlsx`)}>
                {descargando ? <Loader2 className="ST-spin" size={19} /> : <Download size={19} />} Descargar resultado
              </button>}
              {!activo && <button className="ST-btn ST-btnSecondary" onClick={nuevoProceso}><RotateCcw size={18} /> Nueva consulta</button>}
            </div>
          </section>
        )}

        <section className="ST-card ST-historyCard">
          <div className="ST-cardTitle ST-historyTitle">
            <History size={22} />
            <div><h2>Ejecuciones recientes</h2><p>Recupera procesos aunque hayas salido de esta pantalla.</p></div>
            <button className="ST-btn ST-btnSecondary" disabled={cargandoRecientes} onClick={consultarRecientes}>
              {cargandoRecientes ? <Loader2 className="ST-spin" size={17} /> : <RotateCcw size={17} />} Actualizar
            </button>
          </div>
          {recientes.length === 0 ? <p className="ST-historyEmpty">No hay ejecuciones registradas.</p> : (
            <div className="ST-historyList">
              {recientes.map((item) => (
                <button key={item.ejecucion_id} className={`ST-historyItem ${job?.ejecucion_id === item.ejecucion_id ? 'ST-historyItemActive' : ''}`}
                  onClick={() => abrirEjecucion(item.ejecucion_id)}>
                  <span className={`ST-historyState ST-${item.estado}`}>{item.estado}</span>
                  <span className="ST-historyInfo"><strong>{item.archivo || 'Consulta SICE-TAC'}</strong><small>{fechaLocal(item.creado_en)} · {item.creado_por || 'Usuario no registrado'}</small></span>
                  <span className="ST-historyProgress"><strong>{item.progreso_porcentaje?.toFixed(2) || '0.00'}%</strong><small>{item.filas_procesadas || 0} de {item.filas_totales || 0}</small></span>
                </button>
              ))}
            </div>
          )}
        </section>

        {error && <div className="ST-error" role="alert"><AlertCircle size={19} /><span>{error}</span></div>}
      </main>
    </div>
  );
}
