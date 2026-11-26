'use client';

/**
 * Bandeja «Prov. nuevos» (terceros de Compras): el proveedor nuevo creado
 * desde una requisición (RUT + certificación bancaria + cámara de comercio)
 * pasa por aquí — Compras aprueba/rechaza y Contabilidad marca la creación
 * en el software contable (Vulcano). Puerto de renderProveedoresNuevos del
 * módulo externo.
 */
import { useMemo, useState } from 'react';
import {
  FaCheck, FaTimes, FaTrash, FaEye,
} from 'react-icons/fa';
import {
  AdjuntoFin, TerceroCompras, UsuarioFin, aprobarTercero, eliminarTercero,
  listarAdjuntosFin, listarTerceros, marcarTerceroSoftware, rechazarTercero,
  urlDescargaAdjunto,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto } from '../nucleo/dialogos';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_COMPRAS = (u: UsuarioFin) => u.rol === 'compras' || ES_ADMIN(u);
const ES_CONTABILIDAD = (u: UsuarioFin) => u.rol === 'contabilidad' || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = {
  pendiente_compras: 'Pendiente Compras',
  aprobado: 'Aprobado',
  rechazado_compras: 'Rechazado',
};
const BADGE: Record<string, string> = {
  pendiente_compras: 'fin-badgeAmb', aprobado: 'fin-badgeOk', rechazado_compras: 'fin-badgeMal',
};

type Filtro = 'todos' | 'por_aprobar' | 'pendientes' | 'cargados';

export default function ProveedoresNuevosP({ usuario }: { usuario: UsuarioFin }) {
  const { datos, cargando, error, recargar } = useFinDatos<TerceroCompras[]>(() => listarTerceros());
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<TerceroCompras | null>(null);

  const filtrados = useMemo(() => {
    let base = datos ?? [];
    if (filtro === 'por_aprobar') base = base.filter((t) => t.estado_compras === 'pendiente_compras');
    else if (filtro === 'pendientes') base = base.filter((t) => t.estado_compras === 'aprobado' && !t.creado_en_software);
    else if (filtro === 'cargados') base = base.filter((t) => t.creado_en_software);
    const q = busqueda.trim().toLowerCase();
    if (q) base = base.filter((t) => `${t.razon_social} ${t.nit}`.toLowerCase().includes(q));
    return base;
  }, [datos, filtro, busqueda]);

  const kpis = useMemo(() => ({
    total: (datos ?? []).length,
    porAprobar: (datos ?? []).filter((t) => t.estado_compras === 'pendiente_compras').length,
    pendientes: (datos ?? []).filter((t) => t.estado_compras === 'aprobado' && !t.creado_en_software).length,
    cargados: (datos ?? []).filter((t) => t.creado_en_software).length,
  }), [datos]);

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    try {
      await fn();
      toastFin(mensaje);
      recargar();
      setDetalle(null);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  const onAprobar = async (t: TerceroCompras) => {
    if (!await confirmar(`Aprobar proveedor ${t.razon_social}`, 'Se remite a Contabilidad para crearlo en el software contable (Vulcano).')) return;
    await accion(() => aprobarTercero(t.id), `${t.razon_social} aprobado · remitido a Contabilidad`);
  };

  const onRechazar = async (t: TerceroCompras) => {
    const motivo = await pedirTexto(`Rechazar ${t.razon_social}`, 'Motivo del rechazo (obligatorio)');
    if (!motivo) return;
    await accion(() => rechazarTercero(t.id, motivo), `${t.razon_social} rechazado`);
  };

  const onToggleSoftware = async (t: TerceroCompras) => {
    const marcar = !t.creado_en_software;
    if (marcar && !await confirmar(`¿Marcar ${t.razon_social} como creado en el software contable?`, 'Confirma que ya existe en Vulcano.')) return;
    await accion(() => marcarTerceroSoftware(t.id, marcar), marcar ? `${t.razon_social} marcado como creado` : 'Marca retirada');
  };

  const onEliminar = async (t: TerceroCompras) => {
    if (!await confirmar(`Eliminar ${t.razon_social}`, 'Acción irreversible de administrador: borra el tercero y sus documentos.')) return;
    await accion(() => eliminarTercero(t.id), `${t.razon_social} eliminado`);
  };

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Prov. nuevos</h2>
        <div className="fin-filtros">
          <input className="fin-input" placeholder="Buscar razón social o NIT…"
                 value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="fin-tabs">
        {([
          ['todos', 'Todos', kpis.total],
          ['por_aprobar', 'Por aprobar Compras', kpis.porAprobar],
          ['pendientes', 'Pendientes de crear', kpis.pendientes],
          ['cargados', 'Cargados en software', kpis.cargados],
        ] as [Filtro, string, number][]).map(([f, etiqueta, n]) => (
          <button key={f} className={`fin-tab ${filtro === f ? 'fin-tabActivo' : ''}`} onClick={() => setFiltro(f)}>
            {etiqueta} <span className="fin-badge fin-badgeGris">{n}</span>
          </button>
        ))}
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando proveedores…</div>}
      {error && <div className="fin-error">{error}</div>}
      {datos && filtrados.length === 0 && !cargando && <div className="fin-vacio">No hay proveedores nuevos en este filtro.</div>}

      {!!filtrados.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Proveedor</th><th>NIT</th><th>Cuenta bancaria</th><th>Origen</th>
                <th>1. Aprobación Compras</th><th>2. Carga software</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.razon_social}</b><div className="fin-suave">{t.creado_por_nombre} · {fechaCorta(t.created_at)}</div></td>
                  <td>{t.nit}{t.nit_pago && t.nit_pago !== t.nit ? <div className="fin-suave">paga con {t.nit_pago}</div> : null}</td>
                  <td className="fin-suave">{t.banco ?? '—'}<div>{t.tipo_cuenta ?? ''} {t.no_cuenta ?? ''}</div></td>
                  <td>{t.origen_requisicion
                    ? (t.consecutivo_req ?? 'requisición')
                    : <span className="fin-badge fin-badgeGris">manual</span>}</td>
                  <td>
                    <span className={`fin-badge ${BADGE[t.estado_compras]}`}>{ETIQUETA[t.estado_compras]}</span>
                    {t.motivo_rechazo_compras && <div className="fin-suave" style={{ fontSize: 11 }}>{t.motivo_rechazo_compras}</div>}
                  </td>
                  <td>
                    {t.creado_en_software
                      ? <span className="fin-badge fin-badgeOk">✓ {t.creado_en_software_por}</span>
                      : <span className="fin-suave">—</span>}
                  </td>
                  <td className="fin-acciones">
                    {t.estado_compras === 'pendiente_compras' && ES_COMPRAS(usuario) && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Aprobar y remitir a Contabilidad"
                                onClick={() => void onAprobar(t)}><FaCheck /></button>
                        <button className="fin-btnIcono fin-icoMal" title="Rechazar"
                                onClick={() => void onRechazar(t)}><FaTimes /></button>
                      </>
                    )}
                    {t.estado_compras !== 'pendiente_compras' && ES_CONTABILIDAD(usuario) && (
                      <button className="fin-btnIcono fin-icoAzul"
                              title={t.creado_en_software ? 'Quitar marca de creado en software' : 'Marcar como creado en el software contable'}
                              onClick={() => void onToggleSoftware(t)}>
                        {t.creado_en_software ? <FaTimes /> : <FaCheck />}
                      </button>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Documentos" onClick={() => setDetalle(t)}><FaEye /></button>
                    {ES_ADMIN(usuario) && (
                      <button className="fin-btnIcono fin-icoMal" title="Eliminar (admin)"
                              onClick={() => void onEliminar(t)}><FaTrash /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <ModalTercero tercero={detalle} onCerrar={() => setDetalle(null)} recargar={recargar} />
      )}
    </div>
  );
}

/** Detalle del tercero con sus 3 documentos (RUT, cert. bancaria, cámara). */
function ModalTercero({ tercero, onCerrar, recargar }: {
  tercero: TerceroCompras; onCerrar: () => void; recargar: () => void;
}) {
  const t = tercero;
  const { datos: adjuntos } = useFinDatos<AdjuntoFin[]>(() => listarAdjuntosFin('tercero', t.id), [t.id]);
  const docsPorTipo = (tipo: string) => (adjuntos ?? []).filter((a) => a.tipo_documento === tipo);

  const abrir = async (id: string) => {
    try {
      const url = await urlDescargaAdjunto(id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    }
  };

  return (
    <ModalFin titulo={`Proveedor nuevo · ${t.razon_social}`} onCerrar={onCerrar} ancho={860}>
      <div className="fin-grid">
        <Campo etiqueta="NIT">{t.nit}{t.nit_pago && t.nit_pago !== t.nit ? ` · paga con ${t.nit_pago}` : ''}</Campo>
        <Campo etiqueta="Cuenta">{t.banco ?? '—'} · {t.tipo_cuenta ?? '—'} · Nº {t.no_cuenta ?? '—'}</Campo>
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[t.estado_compras]}`}>{ETIQUETA[t.estado_compras]}</span></Campo>
        <Campo etiqueta="Cargado en software">{t.creado_en_software ? `✓ ${t.creado_en_software_por} · ${fechaCorta(t.fecha_creado_en_software)}` : '—'}</Campo>
        {t.consecutivo_req && <Campo etiqueta="Requisición de origen">{t.consecutivo_req}</Campo>}
        {t.area && <Campo etiqueta="Área">{t.area}</Campo>}
      </div>

      <h4 className="fin-subtitulo">Documentos</h4>
      {[
        ['rut', '📄 RUT'],
        ['cert_bancaria', '🏦 Certificación Bancaria'],
        ['camara_comercio', '🏛️ Cámara de Comercio'],
      ].map(([tipo, etiqueta]) => {
        const lista = docsPorTipo(tipo);
        return (
          <div key={tipo} className="fin-pasoCard" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>{etiqueta}</b>
            {lista.length
              ? lista.map((a) => (
                <button key={a.id} className="fin-btn fin-btnSecundario" style={{ marginLeft: 10 }}
                        onClick={() => void abrir(a.id)}>{a.nombre_archivo}</button>
              ))
              : <span className="fin-suave" style={{ marginLeft: 10 }}>sin documento adjunto</span>}
          </div>
        );
      })}

      <h4 className="fin-subtitulo">Historial ({t.historial_cambios.length})</h4>
      <div className="fin-historial">
        {t.historial_cambios.map((h, i) => (
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
