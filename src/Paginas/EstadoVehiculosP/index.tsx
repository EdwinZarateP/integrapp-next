'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaTruck, FaEye, FaTimes, FaHistory, FaCheckCircle, FaMapMarkerAlt, FaFilePdf, FaFileInvoiceDollar, FaSpinner } from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import Swal from 'sweetalert2';
import {
  listarEstadoFlota, consultarDetalleFlota,
  type VehiculoEstado, type DetalleVehiculoEstado,
} from '@/Funciones/ApiPedidos/estadoFlota';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

// Perfiles con acceso (el backend re-valida contra baseusuarios).
// (2026-10-16) FINANCIERO entra a ver los APROBADOS y descargar la
// información financiera de cada vehículo.
const PERFILES_PERMITIDOS = ['ADMIN', 'OPERATIVO', 'CONTROL', 'COORDINADOR', 'FINANCIERO'];

const sanitizarPlaca = (v: string) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

// dd/mm/aaaa (formato pedido para TODAS las fechas del módulo).
const formatFecha = (val: any): string => {
  if (!val) return '-';
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else { s = String(val).trim(); if (s && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
};

// dd/mm/aaaa hh:mm (para la línea de tiempo del detalle).
const formatFechaHora = (val: any): string => {
  if (!val) return '-';
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else { s = String(val).trim(); if (s && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d).replace(',', ' ·');
};

const extraerErrorApi = (e: any, fallback = 'Ocurrió un error'): string => {
  const d = e?.response?.data?.detail ?? e?.detail;
  if (!d) return e?.message || fallback;
  if (typeof d === 'string') return d;
  return String(d);
};

const EstadoVehiculosP: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');

  // Filtros (los procesa el backend). (2026-10-16) La página muestra SOLO
  // los APROBADOS (flota en operación) — el resto de estados vive en /revision.
  const [fPlaca, setFPlaca] = useState('');
  const [skip, setSkip] = useState(0);
  const limit = 50;

  const [items, setItems] = useState<VehiculoEstado[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);

  // Detalle por placa (modal)
  const [detalle, setDetalle] = useState<DetalleVehiculoEstado | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  // Descargables por fila (2026-10-16, fuera del modal — pedido del usuario):
  // placa cuya HV / informe financiero se está generando.
  const [generando, setGenerando] = useState<{ hv: string | null; fin: string | null }>({ hv: null, fin: null });

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (!PERFILES_PERMITIDOS.includes(p)) { router.replace('/MedicalCare'); return; }
    setUsuario(u);
    setPerfil(p);
  }, [router]);

  const cargar = useCallback(async (u: string, placa: string, sk: number) => {
    if (!u) return;
    setCargando(true);
    try {
      const data = await listarEstadoFlota({ usuario: u, placa: placa || undefined, estado: 'aprobado', skip: sk, limit });
      setItems(data.vehiculos);
      setTotal(data.total);
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo consultar el estado de la flota'), 'error');
    } finally {
      setCargando(false);
    }
  }, [limit]);

  useEffect(() => {
    if (usuario) cargar(usuario, fPlaca, skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, skip]);

  const buscar = () => {
    setSkip(0);
    cargar(usuario, fPlaca, 0);
  };

  // Borrar el filtro de placa y recargar sin él.
  const limpiarFiltro = () => {
    setFPlaca('');
    setSkip(0);
    cargar(usuario, '', 0);
  };

  const abrirDetalle = async (placa: string) => {
    setCargandoDetalle(true);
    setDetalle(null);
    try {
      const d = await consultarDetalleFlota(usuario, placa);
      setDetalle(d);
    } catch (e: any) {
      setCargandoDetalle(false);
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo consultar el detalle del vehículo'), 'error');
      return;
    }
    setCargandoDetalle(false);
  };

  const cerrarDetalle = () => setDetalle(null);

  // HV por fila (2026-10-16): descarga directa SIN abrir el modal — se
  // consulta la ficha completa (con URLs firmadas) y se genera el PDF.
  // El módulo de la HV (con @react-pdf/renderer) se importa DINÁMICO al
  // hacer clic: esta página se pre-renderiza estáticamente y react-pdf en
  // el bundle del servidor rompía el prerender («Element type is invalid»).
  const descargarHV = async (placa: string) => {
    if (generando.hv) return;
    setGenerando(g => ({ ...g, hv: placa }));
    try {
      const { descargarHvPdf } = await import('@/Componentes/HvVehiculos');
      const r = await fetch(`${API_BASE}/vehiculos/obtener-vehiculo/${placa}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.data) throw new Error('No se pudo consultar la ficha del vehículo.');
      await descargarHvPdf(j.data);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo generar la hoja de vida.', 'error');
    } finally {
      setGenerando(g => ({ ...g, hv: null }));
    }
  };

  // (2026-10-16) FINANCIERO y ADMIN: PDF con toda la información financiera
  // del vehículo — bancos de las figuras + links a los certificados guardados.
  const descargarFinanciero = async (placa: string) => {
    if (generando.fin) return;
    setGenerando(g => ({ ...g, fin: placa }));
    try {
      const resp = await fetch(`${API_BASE}/vehiculos/financiero/${placa}?usuario=${encodeURIComponent(usuario)}`);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.detail || 'No se pudo generar el informe financiero.');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Financiero_${placa}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo generar el informe financiero.', 'error');
    } finally {
      setGenerando(g => ({ ...g, fin: null }));
    }
  };

  const pagina = Math.floor(skip / limit) + 1;
  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="EV-layout">
      <NavMedicalCare paginaActual="estadovehiculos" />

      <main className="EV-main">
        <div className="EV-header">
          <div className="EV-titulo">
            <h1><FaTruck /> Estado de Vehículos</h1>
            <p>
              Consulta de solo lectura de los vehículos APROBADOS (flota en operación).
              <span className="EV-soloLectura"><FaEye /> Solo visualización</span>
            </p>
          </div>

          {/* Buscador — el filtro lo procesa el backend; ✕ lo borra */}
          <div className="EV-buscador">
            <div className="EV-inputWrap">
              <input
                type="text"
                className="EV-inputPlaca"
                placeholder="Buscar por placa…"
                value={fPlaca}
                maxLength={10}
                onChange={e => setFPlaca(sanitizarPlaca(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
              />
              {fPlaca && (
                <button
                  className="EV-btnLimpiar"
                  onClick={limpiarFiltro}
                  title="Borrar el filtro de placa"
                >
                  <FaTimes />
                </button>
              )}
            </div>
            <button className="EV-btnBuscar" onClick={buscar} disabled={cargando || !usuario}>
              <FaSearch /> Buscar
            </button>
          </div>
        </div>

        {/* (2026-10-16) Los chips de estado se retiraron: la página muestra
            SOLO los vehículos APROBADOS (flota en operación). */}

        {/* Tabla */}
        <div className="EV-tablaWrap">
          {cargando ? (
            <div className="EV-loading">
              <div className="EV-spinner" />
              <p>Consultando vehículos…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="EV-vacio">
              <FaTruck className="EV-vacioIcono" />
              <p>No hay vehículos que coincidan con la búsqueda</p>
            </div>
          ) : (
            <table className="EV-tabla">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Conductor</th>
                  <th>Cédula</th>
                  <th>Celular</th>
                  <th>Aprobado desde</th>
                  <th>Descargas</th>
                </tr>
              </thead>
              <tbody>
                {items.map(v => (
                  <tr key={v.id}>
                    <td>
                      <button
                        className="EV-placa EV-placaBtn"
                        onClick={() => abrirDetalle(v.placa)}
                        title="Ver el detalle y la historia del vehículo"
                      >
                        {v.placa}
                      </button>
                    </td>
                    <td>{v.conductor || '-'}</td>
                    <td>{v.cedula || '-'}</td>
                    <td>{v.celular || '-'}</td>
                    <td className="EV-fecha">{formatFecha(v.fecha_estado)}</td>
                    <td className="EV-acciones">
                      <button
                        className="EV-btnAccion"
                        onClick={() => descargarHV(v.placa)}
                        disabled={generando.hv === v.placa}
                        title="Descargar la hoja de vida del vehículo en PDF"
                      >
                        {generando.hv === v.placa ? <FaSpinner className="spin" /> : <FaFilePdf />}
                        HV
                      </button>
                      {['FINANCIERO', 'ADMIN'].includes(perfil) && (
                        <button
                          className="EV-btnAccion EV-btnAccion--fin"
                          onClick={() => descargarFinanciero(v.placa)}
                          disabled={generando.fin === v.placa}
                          title="Información financiera (bancos + certificados)"
                        >
                          {generando.fin === v.placa ? <FaSpinner className="spin" /> : <FaFileInvoiceDollar />}
                          Financiera
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {!cargando && items.length > 0 && (
          <div className="EV-paginacion">
            <span className="EV-pagInfo">
              Mostrando <strong>{skip + 1}–{Math.min(skip + limit, total)}</strong> de{' '}
              <strong>{total}</strong> vehículo(s) aprobado(s)
              {fPlaca && <> · placa «{fPlaca}»</>}
            </span>
            <div className="EV-pagBotones">
              <button
                className="EV-pagBtn"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - limit))}
              >
                ← Anterior
              </button>
              <span className="EV-pagNum">Página {pagina} de {totalPaginas}</span>
              <button
                className="EV-pagBtn"
                disabled={skip + limit >= total}
                onClick={() => setSkip(skip + limit)}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL: detalle e historia del vehículo ── */}
      {(detalle || cargandoDetalle) && (
        <div className="EV-modalOverlay" onClick={cerrarDetalle}>
          <div className="EV-modal" onClick={e => e.stopPropagation()}>
            {cargandoDetalle || !detalle ? (
              <div className="EV-loading">
                <div className="EV-spinner" />
                <p>Consultando la historia del vehículo…</p>
              </div>
            ) : (
              <>
                <div className="EV-modalHeader">
                  <div className="EV-modalTitulo">
                    <span className="EV-placa">{detalle.placa}</span>
                    {detalle.disponible_hoy && (
                      <span className="EV-disponibleHoy">
                        <FaCheckCircle /> Disponible hoy en la bolsa
                        {detalle.disponibilidad_origen && <> · <FaMapMarkerAlt /> {detalle.disponibilidad_origen}</>}
                      </span>
                    )}
                  </div>
                  <button className="EV-modalClose" onClick={cerrarDetalle} title="Cerrar"><FaTimes /></button>
                </div>

                <div className="EV-modalBody">
                  {/* Qué significa el estado actual */}
                  {detalle.explicacion && (
                    <div className={`EV-explicacion EV-explicacion--${detalle.estado}`}>
                      {detalle.explicacion}
                      {detalle.fecha_estado && <> (desde el {formatFecha(detalle.fecha_estado)})</>}
                    </div>
                  )}

                  {/* Comentario / motivo de Seguridad (aprobar y devolver guardan comentario) */}
                  {detalle.observaciones && (
                    <div className="EV-observacion">
                      <strong>
                        {['devuelto', 'rechazado', 'inactivo', 'en_actualizacion'].includes(detalle.estado)
                          ? 'Motivo de Seguridad:'
                          : 'Comentario de Seguridad:'}
                      </strong>{' '}
                      {detalle.observaciones}
                    </div>
                  )}

                  {/* Datos del vehículo */}
                  <div className="EV-datosGrid">
                    <div><span>Conductor</span><strong>{detalle.conductor || '-'}</strong></div>
                    <div><span>Cédula</span><strong>{detalle.cedula || '-'}</strong></div>
                    <div><span>Celular</span><strong>{detalle.celular || '-'}</strong></div>
                    <div><span>Correo</span><strong>{detalle.correo || '-'}</strong></div>
                    <div><span>Tenedor</span><strong>{detalle.tenedor || '-'}</strong></div>
                    <div>
                      <span>Vehículo</span>
                      <strong>{[detalle.marca, detalle.linea, detalle.modelo].filter(Boolean).join(' ') || '-'}</strong>
                    </div>
                  </div>

                  {/* Timeline */}
                  <h3 className="EV-timelineTitulo"><FaHistory /> Historia del vehículo</h3>
                  {detalle.timeline.length === 0 ? (
                    <p className="EV-timelineVacia">No hay eventos registrados.</p>
                  ) : (
                    <div className="EV-timeline">
                      {detalle.timeline.map((t, i) => (
                        <div key={i} className={`EV-tlItem EV-tlItem--${t.tipo}`}>
                          <div className="EV-tlPunto" />
                          <div className="EV-tlContenido">
                            <div className="EV-tlFila1">
                              <strong>{t.accion_legible}</strong>
                              <span className="EV-tlFecha">{formatFechaHora(t.fecha)}</span>
                            </div>
                            {(t.detalle || t.extra) && (
                              <div className="EV-tlDetalle">{[t.extra, t.detalle].filter(Boolean).join(' — ')}</div>
                            )}
                            <div className="EV-tlActor">
                              {t.actor ? t.actor : 'El titular'}
                              {t.via_legible && <span className={`EV-tlVia EV-tlVia--${t.via}`}>{t.via_legible}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EstadoVehiculosP;
