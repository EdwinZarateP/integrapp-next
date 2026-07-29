'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaCalendarAlt, FaBan, FaTimes } from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import Swal from 'sweetalert2';
// Reutiliza los estilos del Histórico (clases HP-*): ambas vistas son auditoría del mismo dominio.
import '@/Paginas/HistoricoPedidosP/estilos.css';

interface AnuladoDoc {
  _id: string;
  planilla: string;
  consecutivo: string;
  pedido_vulcano: string;
  regional: string;
  ruta: string;
  tipo_vehiculo: string;
  total_solicitado: number;
  tarifa_calculada: number;
  diferencia: number;
  estado: string;
  observaciones: string;
  causal_anulacion: string;
  anulado_por: string;
  fecha_anulacion: string;
  [key: string]: any;
}

const PedidosAnuladosP: React.FC = () => {
  const router = useRouter();
  const [perfil, setPerfil] = useState('');
  const [centroDistribucion, setCentroDistribucion] = useState('');
  const [anulados, setAnulados] = useState<AnuladoDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [regionalSeleccionada, setRegionalSeleccionada] = useState('');
  // Filtros de fecha opcionales: vacíos = traer todos los anulados (acumulan en el tiempo).
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [modalDoc, setModalDoc] = useState<AnuladoDoc | null>(null);

  // Cerrar el modal con Escape.
  useEffect(() => {
    if (!modalDoc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalDoc(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalDoc]);

  useEffect(() => {
    const perfilCookie = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    const regionalCookie = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/)?.[2] || '';

    // Solo ADMIN puede ver los pedidos anulados.
    if (perfilCookie !== 'ADMIN') {
      router.replace(perfilCookie ? '/MedicalCare' : '/LoginUsuario');
      return;
    }

    setPerfil(perfilCookie);

    const CEDI_MAP: Record<string, string> = { 'CO04': 'BARRANQUILLA', 'CO05': 'CALI', 'CO06': 'BUCARAMANGA', 'CO07': 'FUNZA', 'CO09': 'MEDELLIN' };
    const centro = regionalCookie.startsWith('CO') ? CEDI_MAP[regionalCookie] || regionalCookie : regionalCookie;
    setCentroDistribucion(centro);

    cargarAnulados('', '', perfilCookie, centro);
  }, [router]);

  const cargarAnulados = async (fInicio: string, fFin: string, perfilVal?: string, centroVal?: string, regionalVal?: string) => {
    setCargando(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const params = new URLSearchParams();
      if (fInicio) params.set('fecha_inicio', fInicio);
      if (fFin) params.set('fecha_fin', fFin);
      if (perfilVal) params.set('perfil', perfilVal);
      if (centroVal) params.set('centro_distribucion', centroVal);
      if (regionalVal) params.set('regional', regionalVal);

      const response = await fetch(`${API}/siscore/anulados${params.toString() ? `?${params}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setAnulados(data.planillas || []);
      }
    } catch (error) {
      console.error('Error al cargar anulados:', error);
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = () => {
    cargarAnulados(fechaInicio, fechaFin, perfil, centroDistribucion, regionalSeleccionada);
  };

  const handleLimpiarFechas = () => {
    setFechaInicio('');
    setFechaFin('');
    cargarAnulados('', '', perfil, centroDistribucion, regionalSeleccionada);
  };

  const formatDate = (val: any) => {
    if (!val) return '-';
    // El backend guarda fechas como UTC naive; se marcan como UTC y se formatean a Colombia.
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

  const moneda = (val: any) => `$${fmtVal(val).toLocaleString('es-CO')}`;

  const planillasFiltradas = anulados.filter(p =>
    (p.consecutivo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.planilla || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.pedido_vulcano || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.ruta || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.causal_anulacion || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.anulado_por || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const Campo = (label: string, valor: any) => (
    <div className="HP-modalField">
      <span className="HP-modalLabel">{label}</span>
      <span className="HP-modalValue">{valor === undefined || valor === null || valor === '' ? '-' : valor}</span>
    </div>
  );

  return (
    <div className="HP-layout">
      <NavMedicalCare paginaActual="pedidosanulados" />

      <main className="HP-main">
        <div className="HP-header">
          <h1 className="HP-title">Pedidos Anulados</h1>
          <span className="HP-subtitle">{anulados.length} registro{anulados.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Filtros */}
        <div className="HP-filtros">
          <div className="HP-filtroGroup">
            <FaCalendarAlt className="HP-filtroIcon" />
            <label>Desde</label>
            <input type="date" className="HP-dateInput" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            <label>Hasta</label>
            <input type="date" className="HP-dateInput" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            <select
              className="HP-dateInput"
              style={{ minWidth: '150px' }}
              value={regionalSeleccionada}
              onChange={e => setRegionalSeleccionada(e.target.value)}
            >
              <option value="">Todas las regionales</option>
              {['JUAN MINA', 'YUMBO', 'BUCARAMANGA', 'FUNZA', 'GIRARDOTA'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button className="HP-btn HP-btnPrimary" onClick={handleBuscar}>
              <FaSearch /> Buscar
            </button>
            {(fechaInicio || fechaFin) && (
              <button className="HP-btn" style={{ background: '#6b7280' }} onClick={handleLimpiarFechas} title="Quitar filtro de fechas (ver todos)">
                <FaTimes /> Todos
              </button>
            )}
          </div>
          <div className="HP-filtroGroup">
            <div className="HP-searchBox">
              <FaSearch className="HP-searchIcon" />
              <input
                type="text"
                className="HP-searchInput"
                placeholder="Buscar consecutivo, planilla, causal, usuario..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        {cargando ? (
          <div className="HP-loading">
            <div className="HP-spinner" />
            <span>Cargando anulados...</span>
          </div>
        ) : (
          <div className="HP-tableContainer">
            <table className="HP-table">
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Planilla</th>
                  <th>Pedido Vulcano</th>
                  <th>Regional</th>
                  <th>Ruta</th>
                  <th>Tipo Veh.</th>
                  <th style={{ textAlign: 'right' }}>Total Solicitado</th>
                  <th style={{ textAlign: 'right' }}>Diferencia</th>
                  <th>Causal Anulación</th>
                  <th>Anulado por</th>
                  <th>Fecha Anulación</th>
                </tr>
              </thead>
              <tbody>
                {planillasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="HP-empty">No se encontraron registros</td>
                  </tr>
                ) : (
                  planillasFiltradas.map(p => {
                    const totalSolicitado = fmtVal(p.total_solicitado);
                    const fleteTeorico = fmtVal(p.tarifa_calculada);
                    const diferencia = p.diferencia !== undefined && p.diferencia !== null
                      ? fmtVal(p.diferencia)
                      : totalSolicitado - fleteTeorico;
                    return (
                      <tr key={p._id}>
                        <td>
                          <button
                            className="HP-consecutivoLink"
                            onClick={() => p.consecutivo && setModalDoc(p)}
                            title="Ver detalle"
                            disabled={!p.consecutivo}
                          >
                            {p.consecutivo || '-'}
                          </button>
                        </td>
                        <td>{p.planilla || '-'}</td>
                        <td>{p.pedido_vulcano || '-'}</td>
                        <td>{p.regional || '-'}</td>
                        <td className="HP-truncate" title={p.ruta}>{p.ruta || '-'}</td>
                        <td>{p.tipo_vehiculo || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{moneda(totalSolicitado)}</td>
                        <td style={{ textAlign: 'right', color: diferencia < 0 ? '#dc2626' : '#005f56' }}>{moneda(diferencia)}</td>
                        <td className="HP-truncate" title={p.causal_anulacion} style={{ maxWidth: '200px', fontSize: '0.85rem' }}>{p.causal_anulacion || '-'}</td>
                        <td>{p.anulado_por || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatDate(p.fecha_anulacion)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal de detalle */}
      {modalDoc && (
        <div className="HP-modalOverlay" onClick={() => setModalDoc(null)}>
          <div className="HP-modalBox" onClick={e => e.stopPropagation()}>
            <div className="HP-modalHeader">
              <div>
                <div className="HP-modalTitle">{modalDoc.consecutivo || modalDoc.planilla}</div>
                <div className="HP-modalSubtitle">Planilla {modalDoc.planilla} · Pedido Vulcano {modalDoc.pedido_vulcano || '-'}</div>
              </div>
              <button className="HP-modalClose" onClick={() => setModalDoc(null)} title="Cerrar"><FaTimes /></button>
            </div>

            <div className="HP-modalSection">
              <h3>Datos de la planilla</h3>
              <div className="HP-modalGrid">
                {Campo('Consecutivo', modalDoc.consecutivo)}
                {Campo('Planilla', modalDoc.planilla)}
                {Campo('Pedido Vulcano', modalDoc.pedido_vulcano)}
                {Campo('Regional', modalDoc.regional)}
                {Campo('Ruta', modalDoc.ruta)}
                {Campo('Municipio destino', modalDoc.municipio_destino)}
                {Campo('Cliente origen', modalDoc.cliente_origen)}
                {Campo('Tipo vehículo', modalDoc.tipo_vehiculo)}
                {Campo('Vehículo SICETAC', modalDoc.tipo_veh_sicetac)}
                {Campo('Placa', modalDoc.placa)}
                {Campo('Piezas', modalDoc.piezas)}
                {Campo('Peso real', modalDoc.peso_real)}
                {Campo('Estado', modalDoc.estado)}
              </div>
            </div>

            <div className="HP-modalSection">
              <h3>Fletes y recargos</h3>
              <div className="HP-modalGrid">
                {Campo('Flete teórico', moneda(modalDoc.tarifa_calculada))}
                {Campo('Flete solicitado', moneda(modalDoc.tarifa_base))}
                {Campo('Total solicitado', moneda(modalDoc.total_solicitado))}
                {Campo('Diferencia', moneda(modalDoc.diferencia))}
                {Campo('Descargue', moneda(modalDoc.valor_descargue))}
                {Campo('Punto adicional', moneda(modalDoc.valor_punto_adicional))}
                {Campo('Desvío', moneda(modalDoc.valor_desvio))}
              </div>
            </div>

            <div className="HP-modalSection" style={{ borderLeft: '4px solid #dc2626', paddingLeft: '12px' }}>
              <h3 style={{ color: '#dc2626' }}>Anulación</h3>
              <div className="HP-modalGrid">
                {Campo('Causal', modalDoc.causal_anulacion)}
                {Campo('Anulado por', modalDoc.anulado_por)}
                {Campo('Fecha anulación', formatDate(modalDoc.fecha_anulacion))}
              </div>
              {modalDoc.observaciones ? Campo('Observaciones', modalDoc.observaciones) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosAnuladosP;
