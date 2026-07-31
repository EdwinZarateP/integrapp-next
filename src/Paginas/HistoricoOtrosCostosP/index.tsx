'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaSearch, FaFileExcel, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import Swal from 'sweetalert2';
import {
  listarHistorico, obtenerDetalleHistorico, exportarExcel,
  type OtroCosto,
} from '@/Funciones/ApiPedidos/otrosCostos';
import '../OtrosCostosP/estilos.css';

const PERFILES_PERMITIDOS = ['ADMIN', 'CONTROL', 'COORDINADOR', 'FINANCIERO', 'OPERATIVO', 'ANALISTA'];

const hoyCol = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const inicioMes = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const formatFecha = (val: any): string => {
  if (!val) return '-';
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else { s = String(val).trim(); if (s && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(val);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
};

const formatMoney = (v: any) => `$${Number(v || 0).toLocaleString('es-CO')}`;

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    borrador: 'OC-est-borrador', pendiente_aprobacion: 'OC-est-pendiente', devuelto: 'OC-est-devuelto',
    rechazado: 'OC-est-rechazado', aprobado: 'OC-est-aprobado', pagado: 'OC-est-pagado', anulado: 'OC-est-anulado',
  };
  const label: Record<string, string> = {
    borrador: 'Borrador', pendiente_aprobacion: 'Pendiente', devuelto: 'Devuelto',
    rechazado: 'Rechazado', aprobado: 'Aprobado', pagado: 'Pagado', anulado: 'Anulado',
  };
  return <span className={`OC-estadoBadge ${map[estado] || 'OC-est-borrador'}`}>{label[estado] || estado}</span>;
};

const Campo = ({ label, v }: { label: string; v: any }) => (
  <div className="OC-modalField">
    <span className="OC-modalLabel">{label}</span>
    <span className="OC-modalValue">{v === undefined || v === null || v === '' ? '-' : v}</span>
  </div>
);

const HistoricoOtrosCostosP: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [cargando, setCargando] = useState(true);
  const [items, setItems] = useState<OtroCosto[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 25;

  const [fFechaIni, setFFechaIni] = useState(inicioMes());
  const [fFechaFin, setFFechaFin] = useState(hoyCol());
  const [fPedido, setFPedido] = useState('');
  const [fPlaca, setFPlaca] = useState('');
  const [fManifiesto, setFManifiesto] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [detalle, setDetalle] = useState<OtroCosto | null>(null);
  const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = useState(false);

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (!PERFILES_PERMITIDOS.includes(p)) { router.replace('/MedicalCare'); return; }
    setUsuario(u);
    setPerfil(p);
    cargar(u, p);
  }, [router]);

  const cargar = useCallback(async (u?: string, p?: string) => {
    const usr = u ?? usuario;
    if (!usr) return;
    setCargando(true);
    try {
      const data = await listarHistorico({
        usuario: usr,
        fecha_inicio: fFechaIni || undefined,
        fecha_fin: fFechaFin || undefined,
        pedido: fPedido || undefined,
        placa: fPlaca || undefined,
        manifiesto: fManifiesto || undefined,
        cliente: fCliente || undefined,
        skip,
        limit,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      Swal.fire('Error', e?.detail || 'No se pudo cargar el histórico', 'error');
    } finally {
      setCargando(false);
    }
  }, [usuario, fFechaIni, fFechaFin, fPedido, fPlaca, fManifiesto, fCliente, skip]);

  const abrirDetalle = async (it: OtroCosto) => {
    try {
      const d = await obtenerDetalleHistorico(it.consecutivo!, usuario);
      setDetalle(d);
    } catch (e: any) {
      Swal.fire('Error', e?.detail || 'No se pudo cargar el detalle', 'error');
    }
  };

  const onExportExcel = async () => {
    Swal.fire({ title: 'Generando Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const blob = await exportarExcel({
        usuario, estado: undefined,
        fecha_inicio: fFechaIni || undefined, fecha_fin: fFechaFin || undefined,
        pedido: fPedido || undefined, placa: fPlaca || undefined,
        manifiesto: fManifiesto || undefined, cliente: fCliente || undefined,
        origen: 'historico',
      });
      const url = window.URL.createObjectURL(blob as unknown as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `historico_otros_costos_${hoyCol()}.xlsx`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      Swal.fire('✅ Listo', 'Excel generado', 'success');
    } catch {
      Swal.fire('Error', 'No se pudo generar el Excel', 'error');
    }
  };

  const paginas = Math.ceil(total / limit) || 1;
  const paginaActual = Math.floor(skip / limit) + 1;

  return (
    <div className="OC-layout">
      <NavMedicalCare paginaActual={'historicooc' as any} />

      <main className="OC-main">
        <div className="OC-header">
          <div>
            <h1 className="OC-title">Histórico de Otros Costos</h1>
            <span className="OC-subtitle">{total} registro{total !== 1 ? 's' : ''} pagado{total !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="OC-filtros">
          <div className="OC-filtroGroup">
            <FaCalendarAlt className="OC-filtroIcon" />
            <label>Desde</label>
            <input type="date" className="OC-dateInput" style={{ width: 'auto' }} value={fFechaIni} onChange={(e) => setFFechaIni(e.target.value)} />
            <label>Hasta</label>
            <input type="date" className="OC-dateInput" style={{ width: 'auto' }} value={fFechaFin} onChange={(e) => setFFechaFin(e.target.value)} />
            <button className="OC-btn OC-btnPrimary" onClick={() => { setSkip(0); cargar(); }}><FaSearch /> Buscar</button>
          </div>
          <div className="OC-filtroGroup">
            <input className="OC-input" style={{ maxWidth: '160px' }} placeholder="Pedido" value={fPedido} onChange={(e) => setFPedido(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '120px' }} placeholder="Placa" value={fPlaca} onChange={(e) => setFPlaca(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '140px' }} placeholder="Manifiesto" value={fManifiesto} onChange={(e) => setFManifiesto(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '180px' }} placeholder="Cliente" value={fCliente} onChange={(e) => setFCliente(e.target.value)} />
            <button className="OC-btn OC-btnExcel" onClick={onExportExcel}><FaFileExcel /> Excel</button>
          </div>
        </div>

        {cargando ? (
          <div className="OC-loading"><div className="OC-spinner" /><span>Cargando histórico...</span></div>
        ) : (
          <div className="OC-tableContainer">
            <table className="OC-table">
              <thead>
                <tr>
                  <th>Consecutivo</th><th>Creación</th><th>Pedido Vulcano</th><th>Cliente</th>
                  <th>Placa</th><th>Manifiesto</th><th>Tipo Costo</th><th>Valor Total</th>
                  <th>Creado por</th><th>Aprobado por</th><th>Pagado por</th><th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={12} className="OC-empty">No hay registros en el histórico</td></tr>
                ) : items.map((it) => (
                  <tr key={it._id}>
                    <td className="OC-cellMono"><button className="OC-consecutivoLink" onClick={() => abrirDetalle(it)}>{it.consecutivo}</button></td>
                    <td style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatFecha(it.created_at)}</td>
                    <td className="OC-truncate" style={{ color: '#2563eb', fontWeight: 600 }} title={it.pedido_vulcano_original}>{it.pedido_vulcano_original || '-'}</td>
                    <td className="OC-truncate" title={it.datos_servicio?.cliente}>{it.datos_servicio?.cliente || '-'}</td>
                    <td>{it.datos_servicio?.placa || '-'}</td>
                    <td>{it.manifiesto || '-'}</td>
                    <td className="OC-truncate">{(it.costos || []).map((c) => c.tipo_costo).join(', ') || '-'}</td>
                    <td style={{ fontWeight: 700, color: '#005f56' }}>{formatMoney(it.valor_total)}</td>
                    <td>{it.creado_por?.usuario || it.usuario_registro || '-'}</td>
                    <td>{it.aprobacion?.usuario || '-'}</td>
                    <td>{it.pago?.usuario || '-'}</td>
                    <td style={{ fontSize: '0.78rem', color: '#1d4ed8' }}>{it.pago?.fecha_pago ? formatFecha(it.pago.fecha_pago) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="OC-pagination">
              <span className="OC-paginationInfo">Página {paginaActual} de {paginas} · {total} registro{total !== 1 ? 's' : ''}</span>
              <div className="OC-filtroGroup">
                <button className="OC-btn OC-btnGhost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>Anterior</button>
                <button className="OC-btn OC-btnGhost" disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)}>Siguiente</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="OC-footer">
        <div className="OC-footerInner">
          <div className="OC-footerBrand"><Image src={logo} alt="Integra" height={28} /><span>Integra Cadena de Servicios S.A.S.</span></div>
          <span className="OC-footerCopy">© {new Date().getFullYear()} Integra</span>
        </div>
      </footer>

      {detalle && (
        <div className="OC-modalOverlay"
          onMouseDown={(e) => setMouseDownOnBackdrop(e.target === e.currentTarget)}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop) setDetalle(null); }}
        >
          <div className="OC-modalBox" onClick={(e) => e.stopPropagation()}>
            <div className="OC-modalHeader">
              <div>
                <h2 className="OC-modalTitle">{detalle.consecutivo}</h2>
                <div className="OC-modalSubtitle">{detalle.pedido_vulcano_original} · {formatMoney(detalle.valor_total)} · {estadoBadge(detalle.estado)}</div>
              </div>
              <button className="OC-modalClose" onClick={() => setDetalle(null)}><FaTimes /></button>
            </div>

            <div className="OC-modalSection">Información del pedido y servicio</div>
            <div className="OC-modalGrid">
              <Campo label="Pedido Vulcano" v={detalle.pedido_vulcano_original} />
              <Campo label="Cliente" v={detalle.datos_servicio?.cliente} />
              <Campo label="Centro distribución" v={detalle.datos_servicio?.centro_distribucion} />
              <Campo label="Placa" v={detalle.datos_servicio?.placa} />
              <Campo label="Manifiesto" v={detalle.manifiesto || detalle.datos_servicio?.manifiesto} />
              <Campo label="Municipio destino" v={detalle.datos_servicio?.municipio_destino} />
              <Campo label="Piezas" v={detalle.datos_servicio?.piezas} />
              <Campo label="Peso real" v={Number(detalle.datos_servicio?.peso_real || 0).toLocaleString('es-CO')} />
            </div>

            <div className="OC-modalSection">Conceptos del costo</div>
            <div className="OC-tableContainer" style={{ boxShadow: 'none' }}>
              <table className="OC-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Tipo</th><th>Concepto</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {(detalle.costos || []).map((c, i) => (
                    <tr key={i}><td>{c.tipo_costo}</td><td>{c.concepto}</td><td>{c.descripcion}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(c.valor)}</td></tr>
                  ))}
                  <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 800, color: '#005f56' }}>{formatMoney(detalle.valor_total)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="OC-modalSection">Bancario y pago</div>
            <div className="OC-modalGrid">
              <Campo label="Banco" v={detalle.datos_bancarios?.banco} />
              <Campo label="Número cuenta" v={detalle.datos_bancarios?.numero_cuenta} />
              <Campo label="Titular" v={detalle.datos_bancarios?.nombre_titular} />
              <Campo label="Conductor" v={detalle.conductor?.nombre} />
              <Campo label="Aprobado por" v={`${detalle.aprobacion?.usuario || '-'} (${detalle.aprobacion?.rol || ''})`} />
              <Campo label="Pagado por" v={detalle.pago?.usuario} />
              <Campo label="Referencia pago" v={detalle.pago?.referencia} />
              <Campo label="Trámite Vulcano" v={detalle.tramite_vulcano === 'ok' ? 'OK' : (detalle.tramite_vulcano === 'pendiente' ? 'Pendiente' : '-')} />
            </div>

            <div className="OC-modalSection">Trazabilidad</div>
            <div className="OC-timeline">
              {(detalle.historial_movimientos || []).slice().reverse().map((m, i) => (
                <div className="OC-timelineItem" key={i}>
                  <span className="OC-timelineDot" />
                  <div>
                    <span className="OC-timelineAccion">{m.accion.replace(/_/g, ' ')}</span>
                    {m.estado_nuevo ? ` → ${m.estado_nuevo}` : ''}
                    <div className="OC-timelineMeta">{m.nombre_usuario || m.usuario} ({m.rol}) · {formatFecha(m.fecha)} {m.ip ? `· IP ${m.ip}` : ''}</div>
                    {m.observacion && <div className="OC-timelineMeta">“{m.observacion}”</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoOtrosCostosP;
