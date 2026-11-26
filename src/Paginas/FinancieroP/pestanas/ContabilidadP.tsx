'use client';

/**
 * Contabilidad · Facturas DIAN: bandejas del puerto de paridad (Pendientes /
 * Tramitadas / Legalización caja menor / Drive Contable / Indicadores / Cargar)
 * con vista previa de carga, validación por área, rechazo con catálogo, cruce
 * NC↔factura, trámite enriquecido, novedades con glosas y cuenta de cobro.
 * Puerto React de views-facturas.js + views-contabilidad.js + dian.js.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  FaCloudUploadAlt, FaEye, FaPaperPlane, FaStamp, FaBalanceScale, FaCommentDots, FaBan,
  FaCheck, FaTimes, FaExchangeAlt, FaWallet, FaCog, FaFileExcel, FaFileArchive,
} from 'react-icons/fa';
import {
  AREAS_APROBACION, CATEGORIAS_CUENTA_COBRO, CATEGORIAS_GASTO, CONCEPTOS_SUGERIDOS_CC,
  FacturaDian, GLOSAS_CONTABILIDAD, MOTIVOS_RECHAZO_FACTURA, PreviewCarga, SedeCajaFin,
  UsuarioFin, archivarPendientesTransportador, cargarFacturasDian, correoNotificar,
  cruzarFacturas, cruceCandidatos, deshacerCruce, descargarZipSoportes, eliminarTransportador,
  enviarCajaMenor, listarFacturas, listarMovimientos, listarSedesCajas, listarTransportadores,
  listarUploadsDian, previsualizarCargaDian, radicarCuentaCobro, reabrirContabilizacion,
  reactivarFactura, rechazarFactura, registrarNovedad, subirAdjuntoFin,
  transicionFactura, validarFactura,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../nucleo/componentes';
import { confirmar, pedirTexto, pedirTextoOpcional } from '../nucleo/dialogos';
import { AdjuntosFin } from './adjuntosFin';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';
const ES_CONTA = (u: UsuarioFin) => ['contabilidad', 'tesoreria', 'compras'].includes(u.rol) || ES_ADMIN(u);
const SOLO_CONTA = (u: UsuarioFin) => u.rol === 'contabilidad' || ES_ADMIN(u);

const ETIQUETA: Record<string, string> = {
  PENDIENTE: 'Pendiente', TRAMITADA: 'Tramitada', LEGALIZACION: 'Legalización caja menor',
  RADICADA: 'Radicada', CAUSADA: 'Causada', GLOSADA: 'Glosada', RECHAZADA: 'Rechazada', ANULADA: 'Anulada',
};
const BADGE: Record<string, string> = {
  PENDIENTE: 'fin-badgeAmb', TRAMITADA: 'fin-badgeInfo', LEGALIZACION: 'fin-badgeInfo',
  RADICADA: 'fin-badgeInfo', CAUSADA: 'fin-badgeOk', GLOSADA: 'fin-badgeMal',
  RECHAZADA: 'fin-badgeMal', ANULADA: 'fin-badgeMal',
};

type Tab = 'pendientes' | 'tramitadas' | 'legalizacion' | 'drive' | 'indicadores' | 'cargar';

export default function ContabilidadP({ usuario }: { usuario: UsuarioFin }) {
  const [tab, setTab] = useState<Tab>('pendientes');
  const [detalle, setDetalle] = useState<FacturaDian | null>(null);
  const [modal, setModal] = useState<'validar' | 'rechazar' | 'cruce' | 'tramitar' | 'novedad' | 'cajaMenor' | 'cuentaCobro' | 'correo' | null>(null);
  const [detalleModal, setDetalleModal] = useState<FacturaDian | null>(null);

  const abrirModal = (m: NonNullable<typeof modal>, f?: FacturaDian) => {
    setDetalleModal(f ?? null);
    setModal(m);
  };

  const { datos: facturas, cargando, error, recargar } = useFinDatos<FacturaDian[]>(
    () => listarFacturas(), []);
  const { datos: sedes } = useFinDatos<SedeCajaFin[]>(() => listarSedesCajas(), []);

  const pendientes = (facturas ?? []).filter((f) => f.estado === 'PENDIENTE');
  const tramitadas = (facturas ?? []).filter((f) => f.estado === 'TRAMITADA' || f.estado === 'RADICADA');
  const legalizacion = (facturas ?? []).filter((f) => f.estado === 'LEGALIZACION');

  const actuar = async (f: FacturaDian, accion: string, datosAdicionales?: Record<string, unknown>) => {
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
  };

  const diasContab = (f: FacturaDian) => {
    const desde = f.fecha_envio_contab ?? f.fecha_emision;
    const hasta = f.fecha_contabilizacion ?? new Date().toISOString();
    if (!desde) return 0;
    return Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000));
  };

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Facturas DIAN</h2>
        <div className="fin-filtros">
          {ES_CONTA(usuario) && (
            <button className="fin-btn fin-btnSecundario" onClick={() => setModal('cuentaCobro')}>
              <FaWallet /> Cuenta de cobro
            </button>
          )}
          {ES_CONTA(usuario) && (
            <button className="fin-btn fin-btnSecundario" onClick={() => setModal('correo')}>
              ✉️ Notificar
            </button>
          )}
          {SOLO_CONTA(usuario) && (
            <button className="fin-btn fin-btnSecundario" onClick={() => void descargarZipSoportes().catch((e) => toastFin(String(e), 'mal'))}>
              <FaFileArchive /> ZIP soportes
            </button>
          )}
        </div>
      </div>

      <div className="fin-tabs">
        {([
          ['pendientes', `Pendientes (${pendientes.length})`],
          ['tramitadas', `Tramitadas (${tramitadas.length})`],
          ['legalizacion', `Legalización (${legalizacion.length})`],
          ['drive', 'Drive Contable'],
          ['indicadores', 'Indicadores'],
          ['cargar', 'Cargar DIAN'],
        ] as [Tab, string][]).map(([t, l]) => (
          <button key={t} className={`fin-tab ${tab === t ? 'fin-tabActivo' : ''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {cargando && !facturas && <div className="fin-vacio">Cargando facturas…</div>}
      {error && <div className="fin-error">{error}</div>}

      {tab === 'pendientes' && (
        <TablaFacturas
          titulo="Pendientes de trámite"
          facturas={pendientes}
          usuario={usuario}
          onDetalle={setDetalle}
          acciones={(f) => (
            <>
              <button className="fin-btnIcono fin-icoAzul" title="Validar (esperar aprobación de área)" onClick={() => abrirModal('validar', f)}><FaCheck /></button>
              <button className="fin-btnIcono fin-icoOk" title="Tramitar y enviar a Contabilidad" onClick={() => abrirModal('tramitar', f)}><FaPaperPlane /></button>
              <button className="fin-btnIcono fin-icoInfo" title="Enviar a caja menor" onClick={() => void actuar(f, 'ENVIAR_LEGALIZACION')}><FaWallet /></button>
              <button className="fin-btnIcono fin-icoMal" title="Rechazar" onClick={() => abrirModal('rechazar', f)}><FaTimes /></button>
            </>
          )}
        />
      )}

      {tab === 'tramitadas' && (
        <TablaFacturas
          titulo="Tramitadas / radicadas"
          facturas={tramitadas}
          usuario={usuario}
          onDetalle={setDetalle}
          acciones={(f) => (
            <>
              {f.estado === 'TRAMITADA' && ES_CONTA(usuario) && (
                <button className="fin-btnIcono fin-icoOk" title="Radicar (con OC)"
                        onClick={async () => {
                          const oc = await pedirTextoOpcional(`Radicar ${f.numero_factura}`, 'OC a vincular (opcional)');
                          if (oc === null) return;
                          void actuar(f, 'RADICAR', oc ? { oc } : undefined);
                        }}><FaStamp /></button>
              )}
              {f.estado === 'RADICADA' && SOLO_CONTA(usuario) && (
                <button className="fin-btnIcono fin-icoOk" title="Causar / Contabilizar"
                        onClick={() => abrirModal('novedad', f)}><FaBalanceScale /></button>
              )}
              <button className="fin-btnIcono fin-icoAzul" title="Cruce (NC / refacturación)" onClick={() => abrirModal('cruce', f)}><FaExchangeAlt /></button>
              <button className="fin-btnIcono fin-icoMal" title="Glosar" onClick={() => void actuar(f, 'GLOSAR')}><FaCommentDots /></button>
            </>
          )}
        />
      )}

      {tab === 'legalizacion' && (
        <TablaFacturas
          titulo="En camino a caja menor"
          facturas={legalizacion}
          usuario={usuario}
          onDetalle={setDetalle}
          acciones={(f) => (
            <button className="fin-btn fin-btnSecundario" onClick={() => abrirModal('cajaMenor', f)}>
              👛 Legalizar en caja
            </button>
          )}
        />
      )}

      {tab === 'drive' && <DriveContable facturas={facturas ?? []} usuario={usuario} diasContab={diasContab} onDetalle={setDetalle} onNovedad={(f) => abrirModal('novedad', f)} />}
      {tab === 'indicadores' && <Indicadores facturas={facturas ?? []} usuario={usuario} diasContab={diasContab} />}
      {tab === 'cargar' && <CargarDian recargar={recargar} />}

      {detalle && (
        <ModalFacturaDetalle factura={detalle} usuario={usuario}
                             onCerrar={() => setDetalle(null)}
                             onCambio={() => { recargar(); setDetalle(null); }}
                             onAccion={actuar} />
      )}

      {modal === 'validar' && <ModalValidar factura={detalleModal} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'rechazar' && detalleModal && <ModalRechazar factura={detalleModal} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'cruce' && detalleModal && <ModalCruce factura={detalleModal} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'tramitar' && detalleModal && <ModalTramitar factura={detalleModal} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'novedad' && detalleModal && <ModalNovedad factura={detalleModal} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'cajaMenor' && detalleModal && <ModalLegalizarCaja factura={detalleModal} sedes={sedes ?? []} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'cuentaCobro' && <ModalCuentaCobro sedes={sedes ?? []} onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />}
      {modal === 'correo' && <ModalCorreo facturas={pendientes} onCerrar={() => setModal(null)} />}
    </div>
  );
}

// ── Tabla genérica con chips de paridad ────────────────────────────────────

function TablaFacturas({ titulo, facturas, usuario, onDetalle, acciones, extraCols }: {
  titulo: string; facturas: FacturaDian[]; usuario: UsuarioFin;
  onDetalle: (f: FacturaDian) => void; acciones?: (f: FacturaDian) => React.ReactNode;
  extraCols?: boolean;
}) {
  return (
    <div>
      <h4 className="fin-subtitulo">{titulo} · {facturas.length} · {pesos(facturas.reduce((s, f) => s + Number(f.total), 0))}</h4>
      <div className="fin-tablaWrap">
        <table className="fin-tabla">
          <thead>
            <tr>
              <th>Número</th><th>Proveedor</th><th>Fecha</th><th className="fin-num">IVA</th>
              <th className="fin-num">Total</th><th>Estado</th>
              {extraCols && <><th>Categoría</th><th>OC</th><th>Obs. recepción</th></>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => (
              <tr key={f.id}>
                <td>
                  <button className="fin-link" onClick={() => onDetalle(f)}>{f.numero_factura}</button>
                  {f.es_cuenta_cobro && <span className="fin-badge fin-badgeInfo" style={{ marginLeft: 4 }}>C. Cobro</span>}
                  {f.caja_menor_sede && <span className="fin-badge fin-badgeInfo" style={{ marginLeft: 4 }} title={f.caja_menor_sede}>👛</span>}
                  {f.reemplaza_factura && <span className="fin-badge fin-badgeAmb" style={{ marginLeft: 4 }}>↔ {f.reemplaza_factura}</span>}
                </td>
                <td title={f.nit_proveedor}>
                  {f.proveedor}
                  {f.validada && f.estado === 'PENDIENTE' && (
                    <span className="fin-badge fin-badgeInfo" style={{ marginLeft: 4 }} title={`Esperando aprobación de ${f.area_aprobacion ?? 'Aprobación'}`}>
                      Esp. {f.area_aprobacion ?? 'Aprobación'}
                    </span>
                  )}
                  {f.motivo_rechazo && <div className="fin-textoMal" style={{ fontSize: 10 }}>{f.motivo_rechazo}</div>}
                </td>
                <td>{(f.fecha_emision ?? '').slice(0, 10)}</td>
                <td className="fin-num">{pesos(f.iva)}</td>
                <td className="fin-num">{pesos(f.total)}</td>
                <td><span className={`fin-badge ${BADGE[f.estado]}`}>{ETIQUETA[f.estado]}</span></td>
                {extraCols && <><td>{f.categoria_contable ?? '—'}</td><td>{f.num_orden_compra ?? '—'}</td>
                                 <td className="fin-suave" style={{ background: '#fff7e0' }}>{f.observacion_recepcion ?? ''}</td></>}
                <td className="fin-acciones">
                  {acciones?.(f)}
                  <button className="fin-btnIcono fin-icoAzul" title="Detalle" onClick={() => onDetalle(f)}><FaEye /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Cargar DIAN con vista previa ───────────────────────────────────────────

function CargarDian({ recargar }: { recargar: () => void }) {
  const [preview, setPreview] = useState<PreviewCarga | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [archivoPend, setArchivoPend] = useState<File | null>(null);

  const previsualizar = async (files: FileList | null) => {
    const archivo = files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const r = await previsualizarCargaDian(archivo);
      setPreview(r);
      setArchivoPend(archivo);
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    } finally { setSubiendo(false); }
  };

  const confirmar = async () => {
    if (!archivoPend) return;
    setSubiendo(true);
    try {
      const r = await cargarFacturasDian(archivoPend);
      toastFin(`${r.nuevas} cargadas · ${r.duplicadas} duplicadas · ${r.omitidas} omitidas`);
      setPreview(null);
      setArchivoPend(null);
      recargar();
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error', 'mal');
    } finally { setSubiendo(false); }
  };

  const { datos: transportadores, recargar: recargarTransp } = useFinDatos(() => listarTransportadores(), []);
  const { datos: uploads } = useFinDatos(() => listarUploadsDian(), []);

  return (
    <div>
      <h4 className="fin-subtitulo">Cargar archivo del portal DIAN</h4>
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Excel del portal (.xlsx) o ZIP con XMLs (+PDFs). Se muestra una vista previa por categoría antes de confirmar.
        Consulta pública: <a className="fin-link" href="https://catalogo-vpfe.dian.gov.co/User/SearchDocument"
        target="_blank" rel="noopener noreferrer">catalogo-vpfe.dian.gov.co</a>.
      </p>
      <label className="fin-btn fin-btnPrimario" style={{ cursor: 'pointer' }}>
        <FaCloudUploadAlt /> {subiendo ? 'Procesando…' : 'Elegir archivo y previsualizar'}
        <input type="file" hidden accept=".xlsx,.xls,.zip,.xml" multiple
               onChange={(e) => void previsualizar(e.target.files)} />
      </label>

      {preview && (
        <div className="fin-pasoCard">
          <b>{preview.archivo}</b>
          <div className="fin-cards" style={{ marginTop: 8 }}>
            <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{preview.conteos.nuevas}</span><span className="fin-cardTitulo">Nuevas → Pendientes</span></div></div>
            <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{preview.conteos.propias}</span><span className="fin-cardTitulo">Emitidas propias omitidas</span></div></div>
            <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{preview.conteos.transportadores}</span><span className="fin-cardTitulo">Transportadores omitidos</span></div></div>
            <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{preview.conteos.duplicadas}</span><span className="fin-cardTitulo">Duplicadas omitidas</span></div></div>
            <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{preview.conteos.otros}</span><span className="fin-cardTitulo">Acuses / otros</span></div></div>
          </div>
          <div className="fin-filaAcciones" style={{ marginTop: 8 }}>
            <button className="fin-btn fin-btnSecundario" onClick={() => { setPreview(null); setArchivoPend(null); }}>Cancelar</button>
            <button className="fin-btn fin-btnPrimario" disabled={subiendo || !preview.conteos.nuevas} onClick={() => void confirmar()}>
              Cargar {preview.conteos.nuevas} nuevas
            </button>
          </div>
        </div>
      )}

      <h4 className="fin-subtitulo">Transportadores omitidos</h4>
      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>NIT</th><th>Nombre</th><th>Notas</th><th></th></tr></thead>
          <tbody>
            {(transportadores ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.nit}</td><td>{t.nombre}</td><td className="fin-suave">{t.notas}</td>
                <td className="fin-acciones">
                  <button className="fin-btnIcono fin-icoOk" title="Archivar facturas pendientes de este transportador"
                          onClick={() => void archivarPendientesTransportador(t.id).then((r) => { toastFin(`${r.archivadas} archivadas`); recargar(); })}><FaCheck /></button>
                  <button className="fin-btnIcono fin-icoMal" title="Eliminar"
                          onClick={() => void eliminarTransportador(t.id).then(() => recargarTransp())}><FaTimes /></button>
                </td>
              </tr>
            ))}
            {!(transportadores ?? []).length && <tr><td colSpan={4} className="fin-suave" style={{ textAlign: 'center' }}>Sin transportadores registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      {!!(uploads ?? []).length && (
        <>
          <h4 className="fin-subtitulo">Historial de cargas</h4>
          <div className="fin-tablaWrap">
            <table className="fin-tabla fin-tablaCompacta">
              <thead><tr><th>Archivo</th><th>Usuario</th><th>Fecha</th><th>Nuevas</th><th>Duplicadas</th><th>Propias</th></tr></thead>
              <tbody>
                {(uploads ?? []).map((u) => (
                  <tr key={u.id}>
                    <td>{u.archivo}</td><td>{u.usuario}</td><td>{fechaCorta(u.fecha ?? '')}</td>
                    <td>+{u.conteos.nuevas}</td><td>{u.conteos.duplicadas}</td><td>{u.conteos.propias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Drive Contable ─────────────────────────────────────────────────────────

function DriveContable({ facturas, usuario, diasContab, onDetalle, onNovedad }: {
  facturas: FacturaDian[]; usuario: UsuarioFin;
  diasContab: (f: FacturaDian) => number;
  onDetalle: (f: FacturaDian) => void; onNovedad: (f: FacturaDian) => void;
}) {
  const [segmento, setSegmento] = useState('todos');
  const drive = facturas.filter((f) => f.estado === 'TRAMITADA' || f.estado === 'RADICADA' || f.estado === 'CAUSADA' || f.estado_contable);
  const obs = (f: FacturaDian) => String(f.detalles?.observacion_contab ?? '');

  const filtradas = drive.filter((f) => {
    if (segmento === 'pendientes') return !f.estado_contable || f.estado_contable === 'Pendiente';
    if (segmento === 'validacion') return obs(f).includes('REVISI');
    if (segmento === 'novedades') return f.estado_contable === 'Con Novedad';
    if (segmento === 'criticas') return (!f.estado_contable || f.estado_contable !== 'Contabilizado') && diasContab(f) > 3;
    if (segmento === 'contabilizados') return f.estado_contable === 'Contabilizado';
    return true;
  });

  const cont = drive.filter((f) => f.estado_contable === 'Contabilizado').length;
  const nov = drive.filter((f) => f.estado_contable === 'Con Novedad').length;
  const pct = (n: number) => (drive.length ? Math.round((n / drive.length) * 100) : 0);

  return (
    <div>
      <div className="fin-cards">
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{drive.length}</span><span className="fin-cardTitulo">Total radicadas</span></div></div>
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{drive.length - cont - nov}</span><span className="fin-cardTitulo">Pendientes por causar</span></div></div>
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{nov}</span><span className="fin-cardTitulo">Glosas y novedades</span></div></div>
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{cont} ({pct(cont)}%)</span><span className="fin-cardTitulo">Contabilizadas</span></div></div>
      </div>
      {/* Termómetro */}
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 10 }}>
        <div style={{ width: `${pct(cont)}%`, background: '#16a34a' }} title={`Contabilizadas ${pct(cont)}%`} />
        <div style={{ width: `${pct(nov)}%`, background: '#dc2626' }} title={`Con novedad ${pct(nov)}%`} />
        <div style={{ flex: 1, background: '#f59e0b' }} title="Pendientes" />
      </div>

      <div className="fin-tabs">
        {(['todos', 'pendientes', 'validacion', 'novedades', 'criticas', 'contabilizados'] as const).map((s) => (
          <button key={s} className={`fin-tab ${segmento === s ? 'fin-tabActivo' : ''}`} onClick={() => setSegmento(s)}>
            {{ todos: 'Todos', pendientes: 'Pendientes', validacion: 'En revisión', novedades: 'Novedades', criticas: '🚨 +3d Críticas', contabilizados: 'Contabilizadas' }[s]}
          </button>
        ))}
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead>
            <tr>
              <th>Emisión</th><th>Envío Contab</th><th>Nº factura</th><th>Proveedor</th><th>Categoría</th>
              <th className="fin-num">Valor</th><th>Obs. Recepción</th><th>Estado contable</th><th>Días</th>
              <th>Fecha contab</th><th>Nº causación</th><th>Soportes</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((f) => {
              const dias = diasContab(f);
              return (
                <tr key={f.id}>
                  <td>{(f.fecha_emision ?? '').slice(0, 10)}</td>
                  <td>{(f.fecha_envio_contab ?? '').slice(0, 10)}</td>
                  <td><button className="fin-link" onClick={() => onDetalle(f)}>{f.numero_factura}</button>
                      {f.caja_menor_sede && <div className="fin-suave" style={{ fontSize: 10 }}>{f.caja_menor_sede}</div>}</td>
                  <td title={f.nit_proveedor}>{f.proveedor}</td>
                  <td>{f.categoria_contable ?? 'OPERACIÓN'}</td>
                  <td className="fin-num">{pesos(f.total)}</td>
                  <td style={{ background: '#fff7e0' }}>{f.observacion_recepcion}</td>
                  <td>
                    {f.estado_contable === 'Contabilizado' ? <span className="fin-badge fin-badgeOk">✓ Contabilizado y Aprobado</span>
                      : f.estado_contable === 'Con Novedad' ? <span className="fin-badge fin-badgeMal" title={obs(f)}>⚠️ Con Novedad</span>
                      : <span className="fin-badge fin-badgeAmb">Pendiente</span>}
                    {obs(f).includes('REVISI') && <div className="fin-suave" style={{ fontSize: 10 }}>{obs(f)}</div>}
                  </td>
                  <td><span className={`fin-badge ${dias > 3 ? 'fin-badgeMal' : dias > 1 ? 'fin-badgeAmb' : 'fin-badgeGris'}`}>{dias}</span></td>
                  <td>{(f.fecha_contabilizacion ?? '').slice(0, 10) || '—'}</td>
                  <td className="fin-suave">{f.num_causacion ?? obs(f)}</td>
                  <td className="fin-suave">{f.num_orden_compra ? `OC: ${f.num_orden_compra}` : ''}</td>
                  <td className="fin-acciones">
                    {SOLO_CONTA(usuario) && (
                      <>
                        <button className="fin-btnIcono fin-icoOk" title="Contabilizar / Novedad" onClick={() => onNovedad(f)}><FaBalanceScale /></button>
                        {f.estado === 'CAUSADA' && (
                          <button className="fin-btnIcono fin-icoAzul" title="Reabrir contabilización"
                                  onClick={() => void reabrirContabilizacion(f.id).then(() => toastFin('Reabierta')).catch((e) => toastFin(String(e), 'mal'))}>
                            <FaCog />
                          </button>
                        )}
                      </>
                    )}
                    <button className="fin-btnIcono fin-icoAzul" title="Copiar CUFE"
                            onClick={() => { void navigator.clipboard?.writeText(f.cufe ?? ''); toastFin('CUFE copiado'); }}>
                      <FaFileExcel size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Indicadores (puerto simplificado del tablero) ──────────────────────────

function Indicadores({ facturas, diasContab }: {
  facturas: FacturaDian[]; usuario: UsuarioFin; diasContab: (f: FacturaDian) => number;
}) {
  const cont = facturas.filter((f) => f.estado_contable === 'Contabilizado');
  const tiempoProm = cont.length
    ? (cont.reduce((s, f) => s + diasContab(f), 0) / cont.length).toFixed(1) : '—';

  const porProveedor = useMemo(() => {
    const mapa = new Map<string, { total: number; n: number }>();
    facturas.forEach((f) => {
      const k = f.proveedor;
      const v = mapa.get(k) ?? { total: 0, n: 0 };
      mapa.set(k, { total: v.total + Number(f.total), n: v.n + 1 });
    });
    return [...mapa.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [facturas]);
  const maxProv = porProveedor[0]?.[1].total ?? 1;

  const meses = useMemo(() => {
    const mapa = new Map<string, number>();
    facturas.forEach((f) => {
      const k = (f.fecha_emision ?? '').slice(0, 7);
      if (k) mapa.set(k, (mapa.get(k) ?? 0) + Number(f.total));
    });
    return [...mapa.entries()].sort().slice(-6);
  }, [facturas]);
  const maxMes = Math.max(1, ...meses.map(([, v]) => v));

  return (
    <div>
      <div className="fin-cards">
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{facturas.length}</span><span className="fin-cardTitulo">Total facturas DIAN</span></div></div>
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{cont.length} ({facturas.length ? Math.round((cont.length / facturas.length) * 100) : 0}%)</span><span className="fin-cardTitulo">Contabilizadas / causadas</span></div></div>
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{facturas.length - cont.length}</span><span className="fin-cardTitulo">Pendientes por causar</span></div></div>
        <div className="fin-cardInd"><div className="fin-cardInfo"><span className="fin-cardValor">{tiempoProm} días</span><span className="fin-cardTitulo">Tiempo promedio de causación</span></div></div>
      </div>

      <div className="fin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="fin-pasoCard">
          <b>Top 8 proveedores por monto</b>
          {porProveedor.map(([nombre, v]) => (
            <div key={nombre} style={{ margin: '6px 0' }}>
              <div style={{ fontSize: 12 }}>{nombre} · {v.n} doc(s) · <b>{pesos(v.total)}</b></div>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                <div style={{ width: `${(v.total / maxProv) * 100}%`, height: 6, background: '#349F4A', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="fin-pasoCard">
          <b>Facturación mensual (últimos 6 meses)</b>
          {meses.map(([mes, v]) => (
            <div key={mes} style={{ margin: '6px 0' }}>
              <div style={{ fontSize: 12 }}>{mes} · <b>{pesos(v)}</b></div>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                <div style={{ width: `${(v / maxMes) * 100}%`, height: 6, background: '#2563eb', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modales de paridad ─────────────────────────────────────────────────────

function ModalValidar({ factura, onCerrar, onListo }: { factura: FacturaDian | null; onCerrar: () => void; onListo: () => void }) {
  const [area, setArea] = useState('Compras');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Validar ${factura?.numero_factura ?? ''} · Esperando Aprobación`} onCerrar={onCerrar} ancho={560}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        {factura?.proveedor} · {factura && pesos(factura.total)} — la factura queda marcada «Esp. área» y sigue en Pendientes.
      </p>
      <div className="fin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {AREAS_APROBACION.map((a) => (
          <button key={a} className={`fin-btn ${area === a ? 'fin-btnPrimario' : 'fin-btnSecundario'}`} onClick={() => setArea(a)}>
            {a}
          </button>
        ))}
      </div>
      <Campo etiqueta="Nota (correo enviado solicitando visto bueno…)">
        <textarea className="fin-input" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando || !factura} onClick={() => {
          setGuardando(true);
          validarFactura(factura!.id, { area, nota: nota || null })
            .then(() => { toastFin('Factura en espera de aprobación'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Guardar validación</button>
      </div>
    </ModalFin>
  );
}

function ModalRechazar({ factura, onCerrar, onListo }: { factura: FacturaDian; onCerrar: () => void; onListo: () => void }) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS_RECHAZO_FACTURA[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Rechazar ${factura.numero_factura}`} onCerrar={onCerrar} ancho={560}>
      {error && <div className="fin-error">{error}</div>}
      <Campo etiqueta="Motivo del rechazo *">
        <select className="fin-input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS_RECHAZO_FACTURA.map((m) => <option key={m}>{m}</option>)}
        </select>
      </Campo>
      <p className="fin-suave" style={{ fontSize: 11 }}>
        Una factura rechazada se puede REACTIVAR o cruzar con la nota crédito / refacturación que la reemplace.
      </p>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnMal" disabled={guardando} onClick={() => {
          setGuardando(true);
          rechazarFactura(factura.id, motivo)
            .then(() => { toastFin(`${factura.numero_factura} rechazada`); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Rechazar</button>
      </div>
    </ModalFin>
  );
}

function ModalCruce({ factura, onCerrar, onListo }: { factura: FacturaDian; onCerrar: () => void; onListo: () => void }) {
  const [candidatas, setCandidatas] = useState<(FacturaDian & { diferencia: number })[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [motivo, setMotivo] = useState(
    factura.estado === 'RECHAZADA' ? 'Factura reemplazada por nueva emisión formal' : 'Factura rechazada por refacturación / ajuste de valor');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cruceCandidatos(factura.id).then((cs) => {
      setCandidatas(cs);
      const igual = cs.find((c) => Math.abs(c.diferencia) < 1) ?? cs[0];
      if (igual) setSel(igual.id);
    }).catch(() => setCandidatas([]));
  }, [factura.id]);

  return (
    <ModalFin titulo={`Cruce · ${factura.numero_factura}`} onCerrar={onCerrar} ancho={720}>
      {error && <div className="fin-error">{error}</div>}
      {!candidatas && <div className="fin-vacio">Buscando candidatas por NIT/proveedor…</div>}
      {candidatas && candidatas.length === 0 && (
        <div className="fin-vacio">No hay candidatas del mismo proveedor para cruzar.</div>
      )}
      {!!candidatas?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla fin-tablaCompacta">
            <thead><tr><th></th><th>Nº factura</th><th>Estado</th><th className="fin-num">Total</th><th className="fin-num">Diferencia</th></tr></thead>
            <tbody>
              {candidatas.map((c) => (
                <tr key={c.id} style={sel === c.id ? { background: '#f0fdf4' } : undefined}>
                  <td><input type="radio" checked={sel === c.id} onChange={() => setSel(c.id)} /></td>
                  <td>{c.numero_factura}</td>
                  <td><span className={`fin-badge ${BADGE[c.estado]}`}>{ETIQUETA[c.estado]}</span></td>
                  <td className="fin-num">{pesos(c.total)}</td>
                  <td className="fin-num">{Math.abs(c.diferencia) < 1 ? 'Igual valor' : `Dif: ${pesos(c.diferencia)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Campo etiqueta="Motivo del cruce">
        <input className="fin-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      {factura.cruzada_id && (
        <button className="fin-btn fin-btnSecundario" onClick={() =>
          void deshacerCruce(factura.id).then(() => { toastFin('Cruce deshecho'); onListo(); }).catch((e) => setError(String(e)))
        }>Deshacer cruce actual</button>
      )}
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando || !sel} onClick={() => {
          setGuardando(true);
          cruzarFacturas(factura.id, { cruzada_id: sel, motivo })
            .then(() => { toastFin('Facturas cruzadas'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Confirmar cruce</button>
      </div>
    </ModalFin>
  );
}

function ModalTramitar({ factura, onCerrar, onListo }: { factura: FacturaDian; onCerrar: () => void; onListo: () => void }) {
  const [form, setForm] = useState({
    fecha_envio: new Date().toISOString().slice(0, 10),
    categoria: 'OPERACIÓN' as string,
    oc: '',
    obs: '',
  });
  const [pdf, setPdf] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Tramitar ${factura.numero_factura} · enviar a Contabilidad`} onCerrar={onCerrar} ancho={640}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Fecha de envío a Contabilidad">
          <input type="date" className="fin-input" value={form.fecha_envio}
                 onChange={(e) => setForm({ ...form, fecha_envio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Categoría de gasto">
          <select className="fin-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Nº Orden de Compra">
          <input className="fin-input" value={form.oc} placeholder="ej. 2026-380 (o N/A)"
                 onChange={(e) => setForm({ ...form, oc: e.target.value.toUpperCase() })} />
        </Campo>
        <Campo etiqueta="PDF de la Orden de Compra">
          <input type="file" className="fin-input" accept=".pdf,image/*" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
        </Campo>
      </div>
      <Campo etiqueta="Observación de recepción (aparece a Contabilidad para priorizar la causación)">
        <input className="fin-input" value={form.obs} placeholder="Ej. URG. ANTES 03/11, Prioridad despachos"
               onChange={(e) => setForm({ ...form, obs: e.target.value.toUpperCase() })} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          setGuardando(true);
          transicionFactura(factura.id, {
            accion: 'TRAMITAR', version: factura.version,
            datos_adicionales: {
              fecha_envio_contab: `${form.fecha_envio}T12:00:00`,
              categoria_contable: form.categoria,
              num_orden_compra: form.oc || 'N/A',
              observacion_recepcion: form.obs || null,
            },
          }).then(async () => {
            if (pdf) {
              try { await subirAdjuntoFin(pdf, 'factura', factura.id, 'orden_compra'); } catch { /* best-effort */ }
            }
            toastFin(`${factura.numero_factura} tramitada`);
            onListo();
          }).catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Tramitar</button>
      </div>
    </ModalFin>
  );
}

function ModalNovedad({ factura, onCerrar, onListo }: { factura: FacturaDian; onCerrar: () => void; onListo: () => void }) {
  const [estado, setEstado] = useState('Contabilizado');
  const [glosa, setGlosa] = useState('');
  const [otra, setOtra] = useState('');
  const [numCausacion, setNumCausacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Novedad contable · ${factura.numero_factura}`} onCerrar={onCerrar} ancho={620}>
      {error && <div className="fin-error">{error}</div>}
      <Campo etiqueta="Estado contable">
        <select className="fin-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="Pendiente">Pendiente</option>
          <option value="Pendiente+Revision">Pendiente · PENDIENTE DE REVISIÓN (Filtro 1)</option>
          <option value="Con Novedad">Con Novedad (glosa)</option>
          <option value="Contabilizado">Contabilizado y Aprobado</option>
        </select>
      </Campo>
      {estado === 'Con Novedad' && (
        <Campo etiqueta="Glosa del catálogo">
          <select className="fin-input" value={glosa} onChange={(e) => setGlosa(e.target.value)}>
            <option value="">— Selecciona —</option>
            {GLOSAS_CONTABILIDAD.map((g) => <option key={g}>{g}</option>)}
            <option value="OTRA">OTRA (escribir)</option>
          </select>
        </Campo>
      )}
      {estado === 'Con Novedad' && glosa === 'OTRA' && (
        <Campo etiqueta="Describe la otra novedad *">
          <input className="fin-input" value={otra} onChange={(e) => setOtra(e.target.value.toUpperCase())} />
        </Campo>
      )}
      {estado === 'Contabilizado' && (
        <Campo etiqueta="Nº de Causación / Comprobante contable *">
          <input className="fin-input" value={numCausacion} onChange={(e) => setNumCausacion(e.target.value)} />
        </Campo>
      )}
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          setGuardando(true);
          registrarNovedad(factura.id, {
            estado_contable: estado === 'Pendiente+Revision' ? 'Pendiente' : estado,
            glosa: estado === 'Pendiente+Revision' ? 'PENDIENTE DE REVISIÓN' : glosa || null,
            otra_glosa: otra || null,
            num_causacion: numCausacion || null,
          }).then(() => { toastFin('Novedad registrada'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Guardar</button>
      </div>
    </ModalFin>
  );
}

function ModalCuentaCobro({ sedes, onCerrar, onListo }: { sedes: SedeCajaFin[]; onCerrar: () => void; onListo: () => void }) {
  const [form, setForm] = useState({
    beneficiario: '', nit: '', numero: '', valor: 0, iva: 0,
    fecha_doc: new Date().toISOString().slice(0, 10), fecha_envio: new Date().toISOString().slice(0, 10),
    categoria: 'OPERACIÓN' as string, origen: 'Directo', concepto: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo="Radicar Cuenta de Cobro" onCerrar={onCerrar} ancho={700}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        <Campo etiqueta="Beneficiario / Prestador *">
          <input className="fin-input" value={form.beneficiario} onChange={(e) => setForm({ ...form, beneficiario: e.target.value })} />
        </Campo>
        <Campo etiqueta="Cédula (C.C) o NIT *">
          <input className="fin-input" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
        </Campo>
        <Campo etiqueta="Nº Cuenta de Cobro / Documento">
          <input className="fin-input" value={form.numero} placeholder="autogenerado si queda vacío"
                 onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        </Campo>
        <Campo etiqueta="Valor total a pagar *">
          <input className="fin-input fin-num" type="number" min={0} value={form.valor || ''}
                 onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
        </Campo>
        <Campo etiqueta="Fecha de la cuenta de cobro">
          <input type="date" className="fin-input" value={form.fecha_doc}
                 onChange={(e) => setForm({ ...form, fecha_doc: e.target.value })} />
        </Campo>
        <Campo etiqueta="Fecha envío a Contabilidad">
          <input type="date" className="fin-input" value={form.fecha_envio}
                 onChange={(e) => setForm({ ...form, fecha_envio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Categoría de gasto">
          <select className="fin-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATEGORIAS_CUENTA_COBRO.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Origen / Proceso">
          <select className="fin-input" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
            <option value="Directo">Directo — Pago directo proveedor/contratista</option>
            {sedes.map((s) => <option key={s.id} value={`Caja Menor: ${s.nombre}`}>Caja Menor: {s.etiqueta ?? s.nombre}</option>)}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Concepto / Obs. Recepción">
        <input className="fin-input" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value.toUpperCase() })} />
      </Campo>
      <div className="fin-filaAcciones" style={{ flexWrap: 'wrap' }}>
        {CONCEPTOS_SUGERIDOS_CC.map((c) => (
          <button key={c} className="fin-btn fin-btnSecundario" style={{ fontSize: 11 }} onClick={() => setForm({ ...form, concepto: c })}>{c}</button>
        ))}
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          if (!form.beneficiario.trim() || !form.nit.trim() || !(form.valor > 0)) {
            setError('Beneficiario, NIT y valor son obligatorios.');
            return;
          }
          setGuardando(true);
          radicarCuentaCobro({
            beneficiario: form.beneficiario, nit: form.nit, numero_documento: form.numero || undefined,
            valor: form.valor, iva: form.iva, fecha_documento: `${form.fecha_doc}T12:00:00`,
            fecha_envio: `${form.fecha_envio}T12:00:00`, categoria: form.categoria,
            origen: form.origen, concepto: form.concepto || undefined,
          }).then(() => { toastFin('Cuenta de cobro radicada'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Radicar</button>
      </div>
    </ModalFin>
  );
}

function ModalLegalizarCaja({ factura, sedes, onCerrar, onListo }: {
  factura: FacturaDian; sedes: SedeCajaFin[]; onCerrar: () => void; onListo: () => void;
}) {
  const [sede, setSede] = useState(sedes[0]?.nombre ?? '');
  const [comprobante, setComprobante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Legalizar en caja menor · ${factura.numero_factura}`} onCerrar={onCerrar} ancho={560}>
      {error && <div className="fin-error">{error}</div>}
      <Campo etiqueta="Caja menor / sede *">
        <select className="fin-input" value={sede} onChange={(e) => setSede(e.target.value)}>
          {sedes.map((s) => <option key={s.id} value={s.nombre}>{s.etiqueta ?? s.nombre}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Nº comprobante / reembolso">
        <input className="fin-input" value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando || !sede} onClick={() => {
          setGuardando(true);
          enviarCajaMenor(factura.id, { sede, comprobante: comprobante || undefined })
            .then(() => { toastFin('Factura legalizada en caja menor'); onListo(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Legalizar</button>
      </div>
    </ModalFin>
  );
}

function ModalCorreo({ facturas, onCerrar }: { facturas: FacturaDian[]; onCerrar: () => void }) {
  const [para, setPara] = useState('cindy.velandia@integralogistica.com');
  const [asunto, setAsunto] = useState(`Facturas pendientes para validación | ${facturas.length} registros`);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const lineas = facturas.slice(0, 30).map((f) =>
    `${f.numero_factura} · ${f.proveedor} · NIT ${f.nit_proveedor} · ${pesos(f.total)}`);
  return (
    <ModalFin titulo="Notificar por correo" onCerrar={onCerrar} ancho={680}>
      {error && <div className="fin-error">{error}</div>}
      <Campo etiqueta="Para (correos separados por coma)">
        <input className="fin-input" value={para} onChange={(e) => setPara(e.target.value)} />
      </Campo>
      <Campo etiqueta="Asunto">
        <input className="fin-input" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
      </Campo>
      <div className="fin-pasoCard">
        <b>Vista previa ({facturas.length} registros)</b>
        {lineas.map((l, i) => <div key={i} style={{ fontSize: 11 }}>{l}</div>)}
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() => {
          setGuardando(true);
          correoNotificar({
            destinatarios: para.split(',').map((s) => s.trim()).filter(Boolean),
            asunto,
            lineas: [`${facturas.length} factura(s) pendientes de validación.`, ...lineas],
          }).then(() => { toastFin('Correo enviado'); onCerrar(); })
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setGuardando(false));
        }}>Enviar por Resend</button>
      </div>
    </ModalFin>
  );
}

// ── Detalle (base del puerto anterior + campos nuevos) ─────────────────────

function ModalFacturaDetalle({ factura, usuario, onCerrar, onCambio, onAccion }: {
  factura: FacturaDian; usuario: UsuarioFin; onCerrar: () => void; onCambio: () => void;
  onAccion: (f: FacturaDian, accion: string, datosAdicionales?: Record<string, unknown>) => Promise<void>;
}) {
  const f = factura;
  const [movimientos, setMovimientos] = useState<null | { total_debito: number; total_credito: number; cuadra: boolean }>(null);
  if (movimientos === null && f.estado === 'CAUSADA') {
    listarMovimientos().then((r) => setMovimientos({ total_debito: r.total_debito, total_credito: r.total_credito, cuadra: r.cuadra })).catch(() => setMovimientos(null));
  }

  return (
    <ModalFin titulo={`Factura ${f.numero_factura} · ${f.proveedor}`} onCerrar={onCerrar} ancho={860}>
      <div className="fin-grid">
        <Campo etiqueta="Estado"><span className={`fin-badge ${BADGE[f.estado]}`}>{ETIQUETA[f.estado]}</span></Campo>
        <Campo etiqueta="NIT">{f.nit_proveedor}</Campo>
        <Campo etiqueta="Fecha emisión">{(f.fecha_emision ?? '').slice(0, 10)}</Campo>
        <Campo etiqueta="Tipo">{f.tipo_documento} ({f.origen})</Campo>
        <Campo etiqueta="IVA / Total">{pesos(f.iva)} / {pesos(f.total)}</Campo>
        <Campo etiqueta="OC">{f.num_orden_compra ?? f.oc_vinculada ?? '—'}</Campo>
        <Campo etiqueta="Categoría">{f.categoria_contable ?? '—'}</Campo>
        <Campo etiqueta="Estado contable">{f.estado_contable ?? '—'}{f.num_causacion ? ` · ${f.num_causacion}` : ''}</Campo>
        {f.area_aprobacion && <Campo etiqueta="Validación">Esp. {f.area_aprobacion}{f.nota_validacion ? ` · ${f.nota_validacion}` : ''}</Campo>}
        {f.motivo_rechazo && <Campo etiqueta="Rechazo"><span className="fin-textoMal">{f.motivo_rechazo} · {f.rechazado_por}</span></Campo>}
        {f.reemplaza_factura && <Campo etiqueta="Cruce">↔ {f.reemplaza_factura} · {f.cruzado_por}</Campo>}
        {f.fecha_radicacion && <Campo etiqueta="Radicada">{fechaCorta(f.fecha_radicacion)}</Campo>}
        {f.fecha_causacion && <Campo etiqueta="Causada">{fechaCorta(f.fecha_causacion)}</Campo>}
        <Campo etiqueta="CUFE"><span className="fin-suave" style={{ wordBreak: 'break-all' }}>{f.cufe ?? '—'}</span></Campo>
      </div>

      {f.estado === 'RECHAZADA' && (
        <button className="fin-btn fin-btnSecundario" onClick={() =>
          void reactivarFactura(f.id).then(() => { toastFin('Factura reactivada'); onCambio(); }).catch((e) => toastFin(String(e), 'mal'))
        }>↩️ Reactivar factura</button>
      )}

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
