'use client';

/**
 * Contabilidad · Facturas DIAN: carga del Excel del portal o ZIP con XMLs
 * (+PDFs), bandeja por estado y flujo tramitar → radicar (con OC) → causar
 * (genera movimientos) con glosas.
 * Puerto React funcional de views-facturas.js + views-contabilidad.js del
 * módulo externo (la lógica de estado ahora vive en el backend).
 */
import { useState } from 'react';
import {
  FaCloudUploadAlt, FaEye, FaPaperPlane, FaStamp, FaBalanceScale, FaCommentDots, FaBan, FaFileExcel,
} from 'react-icons/fa';
import {
  FacturaDian, UsuarioFin, cargarFacturasDian, listarFacturas, listarMovimientos, transicionFactura,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto, pedirTextoOpcional } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_CONTA = (u: UsuarioFin) => ['contabilidad', 'tesoreria', 'compras'].includes(u.rol) || ES_ADMIN(u);
const SOLO_CONTA = (u: UsuarioFin) => u.rol === 'contabilidad' || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = {
  PENDIENTE: 'Pendiente', TRAMITADA: 'Tramitada', RADICADA: 'Radicada',
  CAUSADA: 'Causada', GLOSADA: 'Glosada', ANULADA: 'Anulada',
};
const BADGE: Record<string, string> = {
  PENDIENTE: 'fin-badgeAmb', TRAMITADA: 'fin-badgeInfo', RADICADA: 'fin-badgeInfo',
  CAUSADA: 'fin-badgeOk', GLOSADA: 'fin-badgeMal', ANULADA: 'fin-badgeMal',
};
const ESTADOS = ['', ...Object.keys(ETIQUETA)];

export default function ContabilidadP({ usuario }: { usuario: UsuarioFin }) {
  const [estado, setEstado] = useState('');
  const [proveedor, setProveedor] = useState('');
  const { datos, cargando, error, recargar } = useFinDatos<FacturaDian[]>(
    () => listarFacturas({ estado: estado || undefined, proveedor: proveedor || undefined }),
    [estado, proveedor],
  );
  const [subiendo, setSubiendo] = useState(false);
  const [detalle, setDetalle] = useState<FacturaDian | null>(null);

  const cargar = async (files: FileList | null) => {
    const archivo = files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const r = await cargarFacturasDian(archivo);
      toastFin(
        `${r.nuevas} nueva(s) · ${r.duplicadas} duplicada(s) · ${r.omitidas} omitida(s) · ${r.propias} propia(s)`,
        r.nuevas > 0 ? 'ok' : 'mal',
      );
      if (r.errores.length) console.warn('[FIN DIAN] errores de carga:', r.errores);
      recargar();
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error cargando', 'mal');
    } finally { setSubiendo(false); }
  };

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Facturas DIAN</h2>
        <div className="fin-filtros">
          <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e ? ETIQUETA[e] : 'Todos los estados'}</option>)}
          </select>
          <input className="fin-input" placeholder="Proveedor…" value={proveedor}
                 onChange={(e) => setProveedor(e.target.value)} />
          {ES_CONTA(usuario) && (
            <label className="fin-btn fin-btnPrimario">
              <FaCloudUploadAlt /> {subiendo ? 'Procesando…' : 'Cargar Excel / ZIP'}
              <input type="file" hidden accept=".xlsx,.zip" onChange={(e) => cargar(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      <p className="fin-suave">
        Carga el reporte del portal DIAN (Excel) o el ZIP del proveedor (XML+PDF).
        La plataforma pública de consulta sigue siendo{' '}
        <a className="fin-link" href="https://catalogo-vpfe.dian.gov.co/User/SearchDocument"
           target="_blank" rel="noopener noreferrer">catalogo-vpfe.dian.gov.co</a>.
      </p>

      {cargando && !datos && <div className="fin-vacio">Cargando facturas…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && datos.length === 0 && !cargando && (
        <div className="fin-vacio">No hay facturas en este filtro. Carga el Excel del portal DIAN para empezar.</div>
      )}

      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Número</th><th>Proveedor</th><th>Fecha</th><th>Tipo</th>
                <th className="fin-num">IVA</th><th className="fin-num">Total</th><th>Estado</th><th>OC</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((f) => (
                <tr key={f.id}>
                  <td><button className="fin-link" onClick={() => setDetalle(f)}>{f.numero_factura}</button></td>
                  <td title={f.nit_proveedor}>{f.proveedor}</td>
                  <td>{(f.fecha_emision || '').slice(0, 10)}</td>
                  <td className="fin-suave">{f.tipo_documento}</td>
                  <td className="fin-num">{pesos(f.iva)}</td>
                  <td className="fin-num">{pesos(f.total)}</td>
                  <td><span className={`fin-badge ${BADGE[f.estado]}`}>{ETIQUETA[f.estado]}</span></td>
                  <td>{f.oc_vinculada ?? '—'}</td>
                  <td className="fin-acciones">
                    {f.estado === 'PENDIENTE' && ES_CONTA(usuario) && (
                      <button className="fin-btnIcono fin-icoAzul" title="Enviar a trámite"
                              onClick={() => actuar(f, 'TRAMITAR', recargar)}><FaPaperPlane /></button>
                    )}
                    {f.estado === 'TRAMITADA' && ES_CONTA(usuario) && (
                      <button className="fin-btnIcono fin-icoOk" title="Radicar"
                              onClick={() => radicar(f, recargar)}><FaStamp /></button>
                    )}
                    {f.estado === 'RADICADA' && SOLO_CONTA(usuario) && (
                      <button className="fin-btnIcono fin-icoOk" title="Causar (contabilizar)"
                              onClick={() => actuar(f, 'CAUSAR', recargar)}><FaBalanceScale /></button>
                    )}
                    {['PENDIENTE', 'TRAMITADA', 'RADICADA'].includes(f.estado) && ES_CONTA(usuario) && (
                      <button className="fin-btnIcono fin-icoMal" title="Glosar"
                              onClick={() => actuar(f, 'GLOSAR', recargar)}><FaCommentDots /></button>
                    )}
                    {ES_ADMIN(usuario) && f.estado !== 'ANULADA' && (
                      <button className="fin-btnIcono fin-icoGris" title="Anular"
                              onClick={() => actuar(f, 'ANULAR', recargar)}><FaBan /></button>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => setDetalle(f)}><FaEye /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <ModalFacturaDetalle factura={detalle} usuario={usuario}
                             onCerrar={() => setDetalle(null)}
                             onCambio={() => { recargar(); setDetalle(null); }} />
      )}
    </div>
  );
}

async function actuar(f: FacturaDian, accion: string, recargar: () => void, datosAdicionales?: Record<string, unknown>) {
  let observacion = '';
  if (accion === 'GLOSAR') {
    const motivo = await pedirTexto(`Glosar ${f.numero_factura}`, `${f.proveedor} · Motivo de la glosa (obligatorio)`);
    if (motivo === null) return;
    observacion = motivo;
  } else if (accion !== 'TRAMITAR' && !(await confirmar(`${accion} · factura ${f.numero_factura}`, f.proveedor))) {
    return;
  }
  try {
    const r = await transicionFactura(f.id, { accion, observacion, version: f.version, datos_adicionales: datosAdicionales });
    toastFin(`${f.numero_factura}: ${ETIQUETA[r.estado]}`);
    recargar();
  } catch (e) {
    toastFin(e instanceof Error ? e.message : 'Error', 'mal');
  }
}

async function radicar(f: FacturaDian, recargar: () => void) {
  const oc = await pedirTextoOpcional(`Radicar ${f.numero_factura}`, 'OC a vincular (opcional)');
  if (oc === null) return;
  actuar(f, 'RADICAR', recargar, oc ? { oc } : undefined);
}

function ModalFacturaDetalle({ factura, usuario, onCerrar, onCambio }: {
  factura: FacturaDian; usuario: UsuarioFin; onCerrar: () => void; onCambio: () => void;
}) {
  const f = factura;
  const [movimientos, setMovimientos] = useState<null | { total_debito: number; total_credito: number; cuadra: boolean }>(null);

  const verMovimientos = async () => {
    try {
      const r = await listarMovimientos();
      setMovimientos({ total_debito: r.total_debito, total_credito: r.total_credito, cuadra: r.cuadra });
    } catch { setMovimientos(null); }
  };
  if (movimientos === null && f.estado === 'CAUSADA') void verMovimientos();

  return (
    <ModalFin titulo={`Factura ${f.numero_factura} · ${f.proveedor}`} onCerrar={onCerrar} ancho={820}>
      <div className="fin-grid">
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[f.estado]}`}>{ETIQUETA[f.estado]}</span></Campo>
        <Campo etiqueta="NIT">{f.nit_proveedor}</Campo>
        <Campo etiqueta="Fecha emisión">{(f.fecha_emision || '').slice(0, 10)}</Campo>
        <Campo etiqueta="Tipo">{f.tipo_documento} ({f.origen})</Campo>
        <Campo etiqueta="IVA">{pesos(f.iva)}</Campo>
        <Campo etiqueta="Total">{pesos(f.total)}</Campo>
        <Campo etiqueta="OC vinculada">{f.oc_vinculada ?? '—'}</Campo>
        {f.fecha_radicacion && <Campo etiqueta="Radicada">{fechaCorta(f.fecha_radicacion)}</Campo>}
        {f.fecha_causacion && <Campo etiqueta="Causada">{fechaCorta(f.fecha_causacion)}</Campo>}
        <Campo etiqueta="CUFE"><span className="fin-suave" style={{ wordBreak: 'break-all' }}>{f.cufe ?? '—'}</span></Campo>
      </div>

      {!!f.glosas?.length && (
        <div className="fin-pasoCard">
          <b>Glosas</b>
          {f.glosas.map((g, i) => (
            <p key={i} className="fin-suave">• {g.motivo} — <b>{g.por}</b> · {fechaCorta(g.at)}</p>
          ))}
        </div>
      )}

      {movimientos && (
        <div className="fin-pasoCard">
          <b>Movimientos contables del período</b>{' '}
          <span className={`fin-badge ${movimientos.cuadra ? 'fin-badgeOk' : 'fin-badgeMal'}`}>
            {movimientos.cuadra ? 'cuadran' : 'no cuadran'}
          </span>
          <span className="fin-suave"> Débitos {pesos(movimientos.total_debito)} · Créditos {pesos(movimientos.total_credito)}</span>
        </div>
      )}

      <AdjuntosFin modulo="factura" referencia={f.id} />

      <h4 className="fin-subtitulo">Historial ({f.historial_cambios.length})</h4>
      <div className="fin-historial">
        {f.historial_cambios.map((h, i) => (
          <div key={i} className="fin-evento">
            <span className="fin-eventoFecha">{fechaCorta(h.fecha)}</span>
            <span className="fin-eventoAccion">{h.accion}</span>
            <span><b>{h.usuario}</b>{h.observacion ? ` — ${h.observacion}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </ModalFin>
  );
}
