'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaSearch, FaFileExcel, FaCalendarAlt, FaUndo,
} from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import Swal from 'sweetalert2';
import './estilos.css';

interface HistoricoDoc {
  _id: string;
  planilla: string;
  consecutivo: string;
  pedido_vulcano: string;
  regional: string;
  piezas: number;
  peso_real: number;
  ruta: string;
  tipo_vehiculo: string;
  municipio_destino: string;
  cliente_origen: string;
  codigo_pedido: string;
  total_solicitado: number;
  tarifa_calculada: number;
  tarifa_base: number;
  diferencia: number;
  estado: string;
  fecha_preaprobado: string;
  fecha_creacion: string;
  fecha_movimiento_historico: string;
  placa: string;
  tipo_veh_sicetac: string;
  peso_sicetac: number;
  requiere_descargue: number;
  punto_adicional: number;
  desvio: number;
  aforo: number;
  cantidad_pedidos: number;
  cantidad_destinos: number;
  causal: string;
  [key: string]: any;
}

const COLS = 27;

const HistoricoPedidosP: React.FC = () => {
  const router = useRouter();
  const [perfil, setPerfil] = useState('');
  const [centroDistribucion, setCentroDistribucion] = useState('');
  const [planillas, setPlanillas] = useState<HistoricoDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [regionalSeleccionada, setRegionalSeleccionada] = useState('');

  // "Hoy" en zona Colombia (America/Bogota). Antes se usaba new Date().toISOString(),
  // que devuelve la fecha UTC: a partir de las 7 pm Colombia (00:00 UTC) saltaba al día
  // siguiente y ocultaba los pedidos de hoy.
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    const perfilCookie = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    const regionalCookie = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/)?.[2] || '';

    if (!perfilCookie) { router.replace('/LoginUsuario'); return; }
    if (!['ADMIN', 'ANALISTA', 'CONTROL', 'COORDINADOR', 'OPERATIVO'].includes(perfilCookie)) {
      router.replace('/MedicalCare');
      return;
    }

    setPerfil(perfilCookie);

    const CEDI_MAP: Record<string, string> = { 'CO04': 'BARRANQUILLA', 'CO05': 'CALI', 'CO06': 'BUCARAMANGA', 'CO07': 'FUNZA', 'CO09': 'MEDELLIN' };
    if (regionalCookie.startsWith('CO')) {
      setCentroDistribucion(CEDI_MAP[regionalCookie] || regionalCookie);
    } else {
      setCentroDistribucion(regionalCookie);
    }

    cargarHistorico(hoy, hoy, perfilCookie, regionalCookie.startsWith('CO') ? CEDI_MAP[regionalCookie] || regionalCookie : regionalCookie);
  }, [router]);

  const cargarHistorico = async (fInicio: string, fFin: string, perfilVal?: string, centroVal?: string, regionalVal?: string) => {
    setCargando(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const params = new URLSearchParams({ fecha_inicio: fInicio, fecha_fin: fFin });
      if (perfilVal) params.set('perfil', perfilVal);
      if (centroVal) params.set('centro_distribucion', centroVal);
      if (regionalVal) params.set('regional', regionalVal);

      const response = await fetch(`${API}/siscore/historico?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPlanillas(data.planillas || []);
      }
    } catch (error) {
      console.error('Error al cargar historico:', error);
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = () => {
    cargarHistorico(fechaInicio, fechaFin, perfil, centroDistribucion, regionalSeleccionada);
  };

  const handleDescargarExcel = async () => {
    if (planillas.length === 0) {
      Swal.fire('Info', 'No hay datos para descargar', 'info');
      return;
    }

    setDescargando(true);
    try {
      Swal.fire({ title: 'Generando Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API}/siscore/historico/exportar-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          perfil,
          centro_distribucion: centroDistribucion,
          regional: regionalSeleccionada || null,
          busqueda: busqueda || null
        })
      });

      if (!response.ok) throw new Error('Error al generar Excel');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historico_${fechaInicio}_${fechaFin}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      Swal.fire('✅ Éxito', 'Excel generado exitosamente', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al generar el Excel', 'error');
    } finally {
      setDescargando(false);
    }
  };

  // Solo ADMIN: devuelve una planilla del histórico a SolicitudVehiculos.
  // Quita el pedido Vulcano y la deja en APROBADO (operación inversa a asignar pedido).
  const handleDevolverASolicitud = async (p: HistoricoDoc) => {
    const result = await Swal.fire({
      title: '¿Devolver a SolicitudVehiculos?',
      html: `<div style="text-align:left;font-size:0.9rem;line-height:1.6">
        <p>Planilla: <b>${p.planilla}</b></p>
        <p>Consecutivo: <b>${p.consecutivo || '-'}</b></p>
        <p>Pedido Vulcano actual: <b>${p.pedido_vulcano || '-'}</b></p>
        <p style="margin-top:10px;color:#b45309">Se quitará el pedido Vulcano y la planilla volverá a
        SolicitudVehiculos en estado <b>APROBADO</b>.</p>
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, devolver',
      cancelButtonText: 'Cancelar',
      input: 'text',
      inputPlaceholder: 'Motivo del retroceso (opcional)',
      inputAttributes: { maxlength: '200' },
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({ title: 'Devolviendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || 'admin';
      const response = await fetch(`${API}/siscore/retroceder-a-solicitud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planilla: p.planilla,
          usuario,
          motivo: (result.value as string) || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPlanillas(prev => prev.filter(x => x._id !== p._id));
        Swal.fire('✅ Devuelta', data.mensaje || `Planilla ${p.planilla} devuelta a SolicitudVehiculos`, 'success');
      } else {
        Swal.fire('Error', data.detail || 'No se pudo devolver la planilla', 'error');
      }
    } catch (error) {
      Swal.fire('Error', 'Error de conexión al devolver la planilla', 'error');
    }
  };

  const planillasFiltradas = planillas.filter(p =>
    (p.consecutivo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.planilla || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.pedido_vulcano || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.ruta || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.municipio_destino || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.regional || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatDate = (val: any) => {
    if (!val) return '-';
    // FastAPI + pymongo (tz_aware=False) devuelven las fechas Mongo como ISO SIN zona hororia
    // (p.ej. '2026-06-25T21:28:43.718000'). El servidor corre en UTC, así que ese valor es UTC.
    // Si no se marca como UTC, new Date() lo interpreta como hora LOCAL del navegador y la
    // conversión a Colombia queda mal (mostraba 21:28 en vez de 16:28). Por eso añadimos 'Z'
    // cuando el string no trae offset, y luego formateamos a America/Bogota (UTC-5).
    let s: string;
    if (val instanceof Date) {
      s = val.toISOString();
    } else {
      s = String(val).trim();
      if (s && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(val);
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const g = (t: string) => partes.find(p => p.type === t)?.value ?? '00';
    return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
  };

  const fmtVal = (val: any): number => {
    if (typeof val === 'number') return val;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const fmtRecargo = (val: any, fallbackIfTrue: number): string => {
    if (typeof val === 'number') return `$${val.toLocaleString('es-CO')}`;
    if (val === true || val === 'SI') return `$${fallbackIfTrue.toLocaleString('es-CO')}`;
    return '$0';
  };

  return (
    <div className="HP-layout">
      <NavMedicalCare paginaActual="historico" />

      <main className="HP-main">
        <div className="HP-header">
          <h1 className="HP-title">Historial de Pedidos</h1>
          <span className="HP-subtitle">{planillas.length} registro{planillas.length !== 1 ? 's' : ''} encontrado{planillas.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Filtros */}
        <div className="HP-filtros">
          <div className="HP-filtroGroup">
            <FaCalendarAlt className="HP-filtroIcon" />
            <label>Desde</label>
            <input type="date" className="HP-dateInput" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            <label>Hasta</label>
            <input type="date" className="HP-dateInput" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            {['ADMIN', 'ANALISTA', 'COORDINADOR', 'CONTROL'].includes(perfil) && (
              <select
                className="HP-dateInput"
                style={{ minWidth: '150px' }}
                value={regionalSeleccionada}
                onChange={e => setRegionalSeleccionada(e.target.value)}
              >
                <option value="">Todas las regionales</option>
                {['GALAPA', 'YUMBO', 'BUCARAMANGA', 'FUNZA', 'GIRARDOTA'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
            <button className="HP-btn HP-btnPrimary" onClick={handleBuscar}>
              <FaSearch /> Buscar
            </button>
          </div>
          <div className="HP-filtroGroup">
            <div className="HP-searchBox">
              <FaSearch className="HP-searchIcon" />
              <input
                type="text"
                className="HP-searchInput"
                placeholder="Buscar consecutivo, planilla, pedido, ruta..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <button className="HP-btn HP-btnExcel" onClick={handleDescargarExcel} disabled={descargando || planillas.length === 0}>
              <FaFileExcel /> {descargando ? 'Descargando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>

        {/* Tabla */}
        {cargando ? (
          <div className="HP-loading">
            <div className="HP-spinner" />
            <span>Cargando historial...</span>
          </div>
        ) : (
          <div className="HP-tableContainer">
            <table className="HP-table">
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Planilla</th>
                  <th>Pedido Vulcano</th>
                  <th>Fecha Preaprobado</th>
                  <th>Estado</th>
                  <th>Total Solicitado</th>
                  <th>Diferencia</th>
                  <th>Regional</th>
                  <th>Placa</th>
                  <th>Piezas</th>
                  <th>Peso Real</th>
                  <th>Peso SICETAC</th>
                  <th>Cant. Pedidos</th>
                  <th>Ruta</th>
                  <th>Tipo Vehículo</th>
                  <th>Vehículo SICETAC</th>
                  <th>Flete Teórico</th>
                  <th>Flete Solicitado</th>
                  <th>Descargue</th>
                  <th>Punto Adic.</th>
                  <th>Desvío</th>
                  <th>Aforo</th>
                  <th>Municipio Principal</th>
                  <th>Cliente Origen</th>
                  <th>Cant. Destinos</th>
                  <th>Código Pedido</th>
                  <th>Observaciones</th>
                  {perfil === 'ADMIN' && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {planillasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={COLS + (perfil === 'ADMIN' ? 1 : 0)} className="HP-empty">No se encontraron registros</td>
                  </tr>
                ) : (
                  planillasFiltradas.map(p => {
                    const totalSolicitado = fmtVal(p.total_solicitado);
                    const fleteTeorico = fmtVal(p.tarifa_calculada);
                    const diferencia = p.diferencia !== undefined && p.diferencia !== null
                      ? fmtVal(p.diferencia)
                      : totalSolicitado - fleteTeorico;
                    const diferenciaColor = diferencia > 0 ? '#b91c1c' : diferencia < 0 ? '#15803d' : '#666';
                    return (
                      <tr key={p._id}>
                        <td className="HP-cellMono" style={{ fontWeight: 700, color: '#004d40' }}>{p.consecutivo || '-'}</td>
                        <td>{p.planilla}</td>
                        <td style={{ fontWeight: 600, color: '#2563eb' }}>{p.pedido_vulcano || '-'}</td>
                        <td style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDate(p.fecha_preaprobado || p.fecha_creacion)}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: p.estado === 'APROBADO' ? '#dcfce7' : p.estado === 'REQUIERE_APROBACION_COORDINADOR' ? '#fef3c7' : p.estado === 'REQUIERE_APROBACION_CONTROL' ? '#fee2e2' : '#e0f2fe',
                            color: p.estado === 'APROBADO' ? '#15803d' : p.estado === 'REQUIERE_APROBACION_COORDINADOR' ? '#b45309' : p.estado === 'REQUIERE_APROBACION_CONTROL' ? '#dc2626' : '#0369a1',
                          }}>
                            {p.estado === 'REQUIERE_APROBACION_COORDINADOR' ? 'COORDINADOR' :
                             p.estado === 'REQUIERE_APROBACION_CONTROL' ? 'CONTROL' :
                             p.estado || 'PREAPROBADO'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#005f56', background: '#dcfce7' }}>${totalSolicitado.toLocaleString('es-CO')}</td>
                        <td style={{ fontWeight: 'bold', color: diferenciaColor }}>
                          {diferencia > 0 ? `+$${diferencia.toLocaleString('es-CO')}` : diferencia < 0 ? `-$${Math.abs(diferencia).toLocaleString('es-CO')}` : '$0'}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{p.regional || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{p.placa || 'NA'}</td>
                        <td>{p.piezas || 0}</td>
                        <td>{fmtVal(p.peso_real).toLocaleString('es-CO')}</td>
                        <td>{fmtVal(p.peso_sicetac ?? p.peso_real).toLocaleString('es-CO')}</td>
                        <td>{p.cantidad_pedidos || '-'}</td>
                        <td>{p.ruta || '-'}</td>
                        <td>{p.tipo_vehiculo || '-'}</td>
                        <td>{p.tipo_veh_sicetac || p.tipo_vehiculo || '-'}</td>
                        <td>${fleteTeorico.toLocaleString('es-CO')}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#005f56' }}>
                            ${fmtVal(p.tarifa_base || p.tarifa_calculada).toLocaleString('es-CO')}
                          </span>
                        </td>
                        <td>{fmtRecargo(p.requiere_descargue, 50000)}</td>
                        <td>{fmtRecargo(p.punto_adicional, 80000)}</td>
                        <td>{fmtRecargo(p.desvio, 100000)}</td>
                        <td style={{ fontWeight: 600 }}>{p.aforo ? `$${fmtVal(p.aforo).toLocaleString('es-CO')}` : '$0'}</td>
                        <td>{p.municipio_destino || '-'}</td>
                        <td className="HP-truncate" title={p.cliente_origen}>{p.cliente_origen || '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#005f56' }}>{p.cantidad_destinos || '-'}</td>
                        <td className="HP-truncate" title={p.codigo_pedido}>{p.codigo_pedido || '-'}</td>
                        <td className="HP-truncate" title={p.causal || ''} style={{ maxWidth: '150px', fontSize: '0.85rem', color: '#666' }}>{p.causal || '-'}</td>
                        {perfil === 'ADMIN' && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="HP-btnAction"
                              title="Devolver a SolicitudVehiculos (quita el pedido Vulcano)"
                              style={{ background: '#d97706' }}
                              onClick={() => handleDevolverASolicitud(p)}
                            >
                              <FaUndo />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="HP-footer">
        <div className="HP-footerInner">
          <div className="HP-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="HP-footerLinks">
            <a href="tel:+573125443396" className="HP-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="HP-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="HP-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="HP-footerCopy">© {new Date().getFullYear()} Integra</span>
        </div>
      </footer>
    </div>
  );
};

export default HistoricoPedidosP;
