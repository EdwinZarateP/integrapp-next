'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaTruck, FaEye, FaTimes, FaHistory, FaCheckCircle, FaMapMarkerAlt } from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import Swal from 'sweetalert2';
import {
  listarEstadoFlota, consultarDetalleFlota,
  type VehiculoEstado, type DetalleVehiculoEstado,
} from '@/Funciones/ApiPedidos/estadoFlota';
import './estilos.css';

// Perfiles con acceso (el backend re-valida contra baseusuarios).
const PERFILES_PERMITIDOS = ['ADMIN', 'OPERATIVO', 'CONTROL', 'COORDINADOR'];

const ESTADOS = [
  { id: 'registro_incompleto', label: 'Pendiente conductor' },
  { id: 'completado_revision', label: 'En revisión' },
  { id: 'aprobado', label: 'Aprobado' },
  { id: 'devuelto', label: 'Devuelto' },
  { id: 'en_actualizacion', label: 'En actualización' },
  { id: 'inactivo', label: 'Inactivo' },
  { id: 'rechazado', label: 'Rechazado' },
];

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
  const [montado, setMontado] = useState(false);

  // Filtros (los procesa el backend)
  const [fPlaca, setFPlaca] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [skip, setSkip] = useState(0);
  const limit = 50;

  const [items, setItems] = useState<VehiculoEstado[]>([]);
  const [total, setTotal] = useState(0);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(false);

  // Detalle por placa (modal)
  const [detalle, setDetalle] = useState<DetalleVehiculoEstado | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (!PERFILES_PERMITIDOS.includes(p)) { router.replace('/MedicalCare'); return; }
    setUsuario(u);
    setPerfil(p);
    setMontado(true);
  }, [router]);

  const cargar = useCallback(async (u: string, placa: string, estado: string, sk: number) => {
    if (!u) return;
    setCargando(true);
    try {
      const data = await listarEstadoFlota({ usuario: u, placa: placa || undefined, estado: estado || undefined, skip: sk, limit });
      setItems(data.vehiculos);
      setTotal(data.total);
      setConteos(data.conteos || {});
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo consultar el estado de la flota'), 'error');
    } finally {
      setCargando(false);
    }
  }, [limit]);

  useEffect(() => {
    if (usuario) cargar(usuario, fPlaca, fEstado, skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, skip]);

  const buscar = () => {
    setSkip(0);
    cargar(usuario, fPlaca, fEstado, 0);
  };

  // Borrar el filtro de placa y recargar sin él.
  const limpiarFiltro = () => {
    setFPlaca('');
    setSkip(0);
    cargar(usuario, '', fEstado, 0);
  };

  const cambiarEstado = (estado: string) => {
    setFEstado(estado);
    setSkip(0);
    cargar(usuario, fPlaca, estado, 0);
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
              Consulta de solo lectura del estado de cada vehículo en el flujo En Ruta.
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

        {/* Chips de estado con conteo (calculado en el backend) */}
        <div className="EV-chips">
          <button
            className={`EV-chip ${fEstado === '' ? 'EV-chipActivo' : ''}`}
            onClick={() => cambiarEstado('')}
          >
            Todos {montado && <span className="EV-chipCount">{Object.values(conteos).reduce((s, n) => s + n, 0)}</span>}
          </button>
          {ESTADOS.map(est => (
            <button
              key={est.id}
              className={`EV-chip EV-chip--${est.id} ${fEstado === est.id ? 'EV-chipActivo' : ''}`}
              onClick={() => cambiarEstado(fEstado === est.id ? '' : est.id)}
              title={est.label}
            >
              {est.label} {montado && <span className="EV-chipCount">{conteos[est.id] ?? 0}</span>}
            </button>
          ))}
        </div>

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
                  <th>Estado</th>
                  <th>Conductor</th>
                  <th>Cédula</th>
                  <th>Celular</th>
                  <th>Vehículo</th>
                  <th>En estado desde</th>
                  <th>Observaciones</th>
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
                    <td>
                      <span className={`EV-estado EV-estado--${v.estado}`}>{v.estado_legible}</span>
                    </td>
                    <td>{v.conductor || '-'}</td>
                    <td>{v.cedula || '-'}</td>
                    <td>{v.celular || '-'}</td>
                    <td>{[v.marca, v.linea, v.modelo].filter(Boolean).join(' ') || '-'}</td>
                    <td className="EV-fecha">{formatFecha(v.fecha_estado)}</td>
                    <td className="EV-obs" title={v.observaciones || ''}>{v.observaciones || '-'}</td>
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
              <strong>{fEstado ? (conteos[fEstado] ?? total) : total}</strong> vehículo(s)
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
                disabled={skip + limit >= (fEstado ? (conteos[fEstado] ?? total) : total)}
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
                    <span className={`EV-estado EV-estado--${detalle.estado}`}>{detalle.estado_legible}</span>
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
