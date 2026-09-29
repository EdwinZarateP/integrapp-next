'use client';
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { FaChevronDown, FaFilePdf, FaRedo, FaShieldAlt, FaSyncAlt, FaUpload } from "react-icons/fa";
import { Vehiculo, EstudioAuto } from "../tipos";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const ETIQUETA_ROL: Record<string, string> = {
  conductor: 'Conductor',
  propietario: 'Propietario',
  tenedor: 'Tenedor',
};

const ERRORES_AMABLES: Record<string, string> = {
  configuracion_faltante:
    'El proveedor de estudios (TusDatos) no está configurado en el servidor. Comuníquese con el administrador.',
  placa_invalida:
    'La placa no es válida para la consulta de vehículo del proveedor (requiere exactamente 6 caracteres).',
  cedula_propietario_faltante:
    'Falta la cédula del propietario para consultar el vehículo.',
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** true mientras queden estudios sin resolver (para el polling). */
const hayEnCurso = (estudios: EstudioAuto[]) =>
  estudios.some(e => e.estado === 'pendiente' || e.estado === 'en_curso');

/* Semáforo del estudio finalizado: categoría del hallazgo de mayor
   severidad que entrega el proveedor (alto|medio|bajo|info|""). */
interface Semanaforo { clase: string; texto: string }

function semaforoEstudio(e: EstudioAuto): Semanaforo {
  if (e.estado === 'error') return { clase: 'rev-est-sem--error', texto: 'Sin resultado' };
  if (e.estado === 'pendiente') return { clase: 'rev-est-sem--espera', texto: 'En cola' };
  if (e.estado === 'en_curso') return { clase: 'rev-est-sem--espera', texto: 'Consultando…' };
  if (e.hallazgo === false) return { clase: 'rev-est-sem--limpio', texto: 'Sin hallazgos' };
  switch ((e.categoria || '').toLowerCase()) {
    case 'alto': return { clase: 'rev-est-sem--alto', texto: 'Hallazgo ALTO' };
    case 'medio': return { clase: 'rev-est-sem--medio', texto: 'Hallazgo MEDIO' };
    case 'bajo': return { clase: 'rev-est-sem--bajo', texto: 'Hallazgo bajo' };
    default: return { clase: 'rev-est-sem--info', texto: 'Con hallazgos' };
  }
}

function tituloEstudio(e: EstudioAuto): string {
  if (e.tipo === 'vehiculo') return `Vehículo · ${e.placa ?? ''}`;
  return (e.roles ?? []).map(r => ETIQUETA_ROL[r] ?? r).join(' · ') || 'Persona';
}

/** Fecha legible en hora Colombia (el backend guarda UTC naive). */
const fechaLegible = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

/** PDF del estudio cargado manualmente por Seguridad (acumulativo). */
interface DocumentoEstudio {
  url: string;
  fecha?: string;
  nombre?: string;
}

interface PestanaEstudiosProps {
  veh: Vehiculo;
}

/**
 * Pestaña "Estudios" del panel de detalle: estudios de seguridad
 * automáticos (TusDatos) disparados cuando el vehículo llegó a revisión —
 * uno por cédula única de conductor/tenedor/propietario (roles combinados
 * cuando son la misma persona) + uno por la placa. Mientras haya estudios
 * en cola/curso sondea el backend cada 5 s (una consulta tarda ~1-3 min).
 * La tabla "Historial de estudios" lista TODO lo abrible ordenado por
 * fecha: los PDF cargados manualmente (acumulan, nunca se reemplazan ni
 * se borran) + los reportes automáticos del proveedor.
 */
const PestanaEstudios: React.FC<PestanaEstudiosProps> = ({ veh }) => {
  const [estudios, setEstudios] = useState<EstudioAuto[]>(veh.estudiosSeguridadAuto ?? []);
  const [historico, setHistorico] = useState<EstudioAuto[]>(
    (veh.historialEstudios ?? []).flatMap(c => c.estudios ?? []));
  const [documentos, setDocumentos] = useState<DocumentoEstudio[]>([]);
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [reintentando, setReintentando] = useState<string | null>(null);
  const vivoRef = useRef(true);
  const sondeandoRef = useRef(false);
  const inputDocRef = useRef<HTMLInputElement>(null);

  const cargar = async (): Promise<EstudioAuto[]> => {
    try {
      const res = await axios.get<{
        estudios: EstudioAuto[]; historico: EstudioAuto[]; documentos: DocumentoEstudio[];
      }>(`${API_BASE}/vehiculos/estudios-seguridad/${veh.placa}`);
      if (vivoRef.current) {
        setEstudios(res.data.estudios || []);
        setHistorico(res.data.historico || []);
        setDocumentos(res.data.documentos || []);
      }
      return res.data.estudios || [];
    } catch {
      return estudios; // sondeo best-effort: se reintenta en el próximo ciclo
    }
  };

  // Polling mientras queden estudios pendiente/en_curso (patrón del portal
  // de estudios: espera → sondea → repite; guard de 10 minutos). Reiniciable
  // (tras disparar manualmente con todo ya resuelto).
  const iniciarSondeo = () => {
    if (sondeandoRef.current) return;
    sondeandoRef.current = true;
    const bucle = async () => {
      const inicio = Date.now();
      while (vivoRef.current && Date.now() - inicio < 10 * 60 * 1000) {
        await esperar(5000);
        if (!vivoRef.current) return;
        const actuales = await cargar();
        if (!hayEnCurso(actuales)) return;
      }
    };
    bucle().finally(() => { sondeandoRef.current = false; });
  };

  useEffect(() => {
    vivoRef.current = true;
    // Carga inmediata (el doc de la bandeja puede venir atrasado) + sondeo
    // mientras haya estudios sin resolver.
    cargar();
    if (hayEnCurso(estudios)) iniciarSondeo();
    return () => { vivoRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veh.placa]);

  /** Re-disparo manual (consume consultas del proveedor). */
  const disparar = async () => {
    const ok = await Swal.fire({
      title: '¿Volver a consultar los estudios?',
      html: `Se relanzan los estudios de seguridad de <b>${veh.placa}</b> (cédulas de conductor, tenedor y propietario deduplicadas + placa).<br><br><small>Consume consultas del proveedor externo (TusDatos) y tarda entre 1 y 3 minutos. Los resultados anteriores quedan en el historial.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, consultar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#00a5b5',
    });
    if (!ok.isConfirmed) return;
    try {
      await axios.post(`${API_BASE}/vehiculos/estudios-seguridad/${veh.placa}/disparar`);
      await cargar();
      iniciarSondeo();
      Swal.fire({ title: 'Estudios en curso', text: 'Los resultados aparecen automáticamente en unos minutos.', icon: 'success', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('No se pudieron disparar', err?.response?.data?.detail || 'Error de conexión con el servidor.', 'error');
    }
  };

  /** Reintenta SOLO las fuentes que quedaron en Error de un estudio
   *  finalizado (el proveedor relanza esas fuentes sobre el mismo reporte). */
  const reintentarFallidas = async (e: EstudioAuto) => {
    setReintentando(e.id);
    try {
      const fd = new FormData();
      fd.append('estudio_id', e.id);
      await axios.post(
        `${API_BASE}/vehiculos/estudios-seguridad/${veh.placa}/reintentar-fuentes`,
        fd, { timeout: 240000 });
      await cargar();
      Swal.fire({ title: 'Fuentes reintentadas', text: 'El resultado se actualizó con las fuentes recuperadas.', icon: 'success', timer: 2200, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('No se pudieron reintentar', err?.response?.data?.detail || 'Error de conexión con el servidor.', 'error');
    } finally {
      setReintentando(null);
    }
  };

  /** Carga de un PDF de estudio: ACUMULA en el historial del vehículo. */
  const subirDocumento = async (archivo: File) => {
    setSubiendoDoc(true);
    try {
      const fd = new FormData();
      fd.append('placa', veh.placa);
      fd.append('archivo', archivo);
      await axios.put(`${API_BASE}/vehiculos/subir-estudio-seguridad`, fd);
      await cargar(); // la tabla gana la nueva fila con su fecha
      Swal.fire({ title: 'Estudio cargado', text: 'El documento quedó en el historial del vehículo.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('No se pudo cargar', err?.response?.data?.detail || 'Error al subir el archivo.', 'error');
    } finally {
      setSubiendoDoc(false);
      if (inputDocRef.current) inputDocRef.current.value = '';
    }
  };

  return (
    <div className="rev-detalle-scroll">
      {/* ── Acciones: re-consultar + cargar PDF (acumulativo) ── */}
      <div className="rev-est-acciones-card">
        <div className="rev-est-titulo">
          <strong>Estudio de seguridad del vehículo</strong>
          <span className="rev-est-id">
            Consulta automática por cédulas de las figuras + placa · los PDF cargados y los reportes quedan en el historial
          </span>
        </div>
        <div className="rev-est-acciones">
          <button className="rev-est-btn-fuentes" onClick={disparar} title="Relanza las consultas al proveedor">
            <FaRedo /> Volver a consultar
          </button>
          <button className="rev-est-btn-pdf" onClick={() => inputDocRef.current?.click()} disabled={subiendoDoc}>
            <FaUpload /> {subiendoDoc ? 'Subiendo…' : 'Cargar estudio (PDF)'}
          </button>
          <input
            ref={inputDocRef}
            type="file"
            accept="application/pdf,image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subirDocumento(f);
            }}
          />
        </div>
      </div>

      {!estudios.length ? (
        <div className="rev-est-vacio">
          <FaShieldAlt className="rev-est-vacio-icono" />
          <p>Este vehículo aún no tiene estudios de seguridad automáticos.</p>
          <small>
            Se disparan solos cuando el conductor envía el vehículo a revisión
            (cédulas de conductor, tenedor y propietario + placa), o manualmente
            con el botón «Volver a consultar».
          </small>
        </div>
      ) : (
        <div className="rev-est-lista">
          {estudios.map(e => {
            const sem = semaforoEstudio(e);
            const abierto = detalleAbierto === e.id;
            const fuentes = Object.entries(e.fuentes ?? {});
            const conHallazgo = fuentes.filter(([, v]) => v === true).length;
            const errores = fuentes.filter(([, v]) => v === 'Error').length;
            return (
              <div key={e.id} className="rev-est-card">
                <div className="rev-est-cab">
                  <div className="rev-est-titulo">
                    <strong>{tituloEstudio(e)}</strong>
                    <span className="rev-est-id">
                      {e.tipo === 'vehiculo'
                        ? `Estudio de vehículo · placa ${e.placa}`
                        : `Cédula ${e.cedula}`}
                    </span>
                  </div>
                  <span className={`rev-est-sem ${sem.clase}`}>
                    {(e.estado === 'pendiente' || e.estado === 'en_curso') && (
                      <span className="rev-est-spinner" aria-hidden="true" />
                    )}
                    {sem.texto}
                  </span>
                </div>

                {e.estado === 'error' && (
                  <p className="rev-est-error">
                    {ERRORES_AMABLES[e.error || ''] || e.error || 'La consulta no pudo completarse.'}
                  </p>
                )}

                {e.estado === 'finalizado' && (
                  <div className="rev-est-resumen">
                    {e.hallazgo === false ? (
                      <span>Ninguna fuente registró hallazgos para este sujeto.</span>
                    ) : (
                      <span>
                        {conHallazgo} fuente{conHallazgo !== 1 ? 's' : ''} con hallazgo
                        {errores > 0 && ` · ${errores} sin respuesta`}
                        {e.categoria && ` · categoría ${e.categoria.toUpperCase()}`}
                      </span>
                    )}
                    <div className="rev-est-acciones">
                      {e.reporte_id && (
                        <button
                          className="rev-est-btn-pdf"
                          onClick={() => window.open(`${API_BASE}/tusdatos/reportes/${e.reporte_id}/pdf`, '_blank')}
                        >
                          <FaFilePdf /> Ver reporte PDF
                        </button>
                      )}
                      {errores > 0 && e.reporte_id && (
                        <button
                          className="rev-est-btn-fuentes"
                          onClick={() => reintentarFallidas(e)}
                          disabled={reintentando === e.id}
                          title="Relanza ante el proveedor solo las fuentes que fallaron (mismo reporte)"
                        >
                          <FaSyncAlt className={reintentando === e.id ? 'rev-est-girando' : ''} />
                          {reintentando === e.id ? 'Reintentando…' : `Reintentar fuentes fallidas (${errores})`}
                        </button>
                      )}
                      {fuentes.length > 0 && (
                        <button
                          className="rev-est-btn-fuentes"
                          onClick={() => setDetalleAbierto(abierto ? null : e.id)}
                        >
                          Fuentes <FaChevronDown className={abierto ? 'rev-est-chevron--abierto' : ''} />
                        </button>
                      )}
                    </div>
                    {abierto && (
                      <ul className="rev-est-fuentes">
                        {fuentes.map(([fuente, valor]) => (
                          <li key={fuente} className={`rev-est-fuente rev-est-fuente--${
                            valor === true ? 'hallazgo' : valor === false ? 'limpia' : 'error'}`}>
                            <span className="rev-est-fuente-marca">
                              {valor === true ? '✔' : valor === false ? '✖' : '⚠'}
                            </span>
                            {fuente}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {(e.estado === 'pendiente' || e.estado === 'en_curso') && (
                  <p className="rev-est-espera">
                    Consultando en el proveedor… una consulta tarda entre 1 y 3 minutos;
                    la pestaña se actualiza sola.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Historial: TODO lo abrible — PDFs cargados manualmente (acumulan)
          + reportes automáticos (corridas anteriores + vigente), del más
          reciente al más antiguo ── */}
      {(() => {
        interface Fila {
          key: string; fecha?: string; sujeto: string; sub?: string;
          semClase: string; semTexto: string; url: string;
        }
        const filas: Fila[] = [];
        documentos.forEach((d, i) => {
          filas.push({
            key: `doc-${d.fecha ?? i}`,
            fecha: d.fecha,
            sujeto: 'Documento del estudio',
            sub: d.nombre || 'PDF cargado manualmente',
            semClase: 'rev-est-sem--info', semTexto: 'Adjunto',
            url: d.url,
          });
        });
        const vigentes = estudios.filter(e => e.estado === 'finalizado' && e.reporte_id);
        [...historico, ...vigentes]
          .filter(e => e.reporte_id)
          .forEach(e => {
            const sem = semaforoEstudio({ ...e, estado: 'finalizado' });
            filas.push({
              key: `${e.id ?? ''}-${e.reporte_id}`,
              fecha: e.finalizado_en || e.iniciado_en,
              sujeto: tituloEstudio(e),
              sub: e.tipo === 'vehiculo' ? `placa ${e.placa}` : `CC ${e.cedula}`,
              semClase: sem.clase, semTexto: sem.texto,
              url: `${API_BASE}/tusdatos/reportes/${e.reporte_id}/pdf`,
            });
          });
        filas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        if (!filas.length) return null;
        return (
          <div className="rev-est-historial">
            <h4>Historial de estudios</h4>
            <table className="rev-est-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Sujeto</th>
                  <th>Resultado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.key}>
                    <td className="rev-est-tabla-fecha">{f.fecha ? fechaLegible(f.fecha) : '—'}</td>
                    <td>
                      {f.sujeto}
                      {f.sub && <span className="rev-est-tabla-id">{f.sub}</span>}
                    </td>
                    <td><span className={`rev-est-sem ${f.semClase}`}>{f.semTexto}</span></td>
                    <td>
                      <button
                        className="rev-est-btn-tabla"
                        onClick={() => window.open(f.url, '_blank')}
                        title="Abrir el documento"
                      >
                        <FaFilePdf /> Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      <div className="rev-est-pie">
        <button className="rev-est-btn-reintentar" onClick={() => { cargar(); }}>
          <FaRedo /> Actualizar
        </button>
        <small>
          Estudios provistos por el proveedor externo (TusDatos). El reporte PDF
          completo se abre en una pestaña nueva.
        </small>
      </div>
    </div>
  );
};

export default PestanaEstudios;
