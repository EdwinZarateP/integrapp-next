'use client';
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { FaFileExcel } from "react-icons/fa";
import { Vehiculo } from "../tipos";
import TarjetaHabeasData from "./TarjetaHabeasData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Fechas del backend: ISO naive UTC → hora Colombia. */
const fechaLegible = (iso?: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
      .toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
};

/* ── ✍️ Firma electrónica: sello de evidencia + verificación de integridad ──
   Consulta GET /vehiculos/verificar-firma/{placa} (recalcula el hash de los
   datos actuales y lo compara con el sellado): el DETALLE del acto de firma
   (quién, cuándo, IP, navegador, hashes) que antes solo vivía en el endpoint. */
const TarjetaFirmaElectronica: React.FC<{ veh: Vehiculo }> = ({ veh }) => {
  const [estado, setEstado] = useState<'cargando' | 'sin_firma' | 'lista' | 'error'>('cargando');
  const [evidencia, setEvidencia] = useState<any>(null);
  const [coincide, setCoincide] = useState<boolean>(false);
  const [verImagen, setVerImagen] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/vehiculos/verificar-firma/${veh.placa}`);
        if (!vivo) return;
        if (resp.status === 404) { setEstado('sin_firma'); return; }
        if (!resp.ok) throw new Error('firma');
        const data = await resp.json();
        setEvidencia(data.evidencia || {});
        setCoincide(!!data.coincide);
        setEstado('lista');
      } catch {
        if (vivo) setEstado('error');
      }
    })();
    return () => { vivo = false; };
  }, [veh.placa]);

  if (estado === 'cargando') return <p className="rev-vacio">Consultando la firma…</p>;
  if (estado === 'sin_firma') return <p className="rev-vacio">Este vehículo no tiene firma electrónica registrada.</p>;
  if (estado === 'error') return <p className="rev-vacio">No se pudo consultar la firma (inténtalo de nuevo).</p>;

  const hashCorto = (h?: string) => (h ? `${h.slice(0, 16)}…` : '—');
  return (
    <div className="rev-firma-caja">
      <div className={`rev-firma-estado ${coincide ? 'rev-firma-estado--ok' : 'rev-firma-estado--alerta'}`}>
        {coincide
          ? '✅ Válida — los datos del vehículo NO cambiaron después de firmada'
          : '⚠️ Los datos cambiaron después de firmada — revisa el diff en «Cambios desde la última aprobación»'}
      </div>
      <div className="rev-tabla-wrap">
        <table className="rev-est-tabla">
          <tbody>
            <tr><th>Firmante</th><td>{evidencia.nombre || '—'} · CC {evidencia.cedula || '—'}</td></tr>
            <tr><th>Correo</th><td>{evidencia.correo || '—'}</td></tr>
            <tr><th>Firmada</th><td>{fechaLegible(evidencia.firmado_en)} (hora Colombia) · versión {evidencia.version ?? 1}</td></tr>
            <tr><th>Hash de los datos (SHA-256)</th><td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{hashCorto(evidencia.hash_datos)}</td></tr>
            <tr><th>Hash de la imagen (SHA-256)</th><td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{hashCorto(evidencia.hash_firma)}</td></tr>
            <tr><th>IP de origen</th><td>{evidencia.ip || '—'}</td></tr>
            <tr><th>Navegador (user-agent)</th><td style={{ fontSize: '0.75rem', color: '#6b7684' }}>{evidencia.user_agent || '—'}</td></tr>
          </tbody>
        </table>
      </div>
      {evidencia.firma_url && (
        <>
          <button className="rev-est-btn-tabla" onClick={() => setVerImagen(v => !v)}>
            {verImagen ? 'Ocultar la imagen de la firma' : '✍️ Ver la imagen de la firma'}
          </button>
          {verImagen && (
            <div className="rev-firma-imagen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={evidencia.firma_url} alt={`Firma electrónica de ${evidencia.nombre || veh.placa}`} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Pestaña de histórico del panel de detalle: diff de ediciones sobre un
 * aprobado (re-revisión), timeline de inactivaciones/reactivaciones y la
 * BITÁCORA DE AUDITORÍA (quién hizo cada mutación y por qué canal).
 * Las tres secciones se muestran como TABLAS y todo se puede EXPORTAR a
 * Excel (pedido del usuario 2026-10-06: una hoja por sección).
 */
const ETIQUETAS_ACCION: Record<string, string> = {
  vehiculo_creado: '🚚 Vehículo creado',
  datos_actualizados: '✏️ Datos actualizados',
  documento_subido: '📄 Documento subido',
  documento_reutilizado: '♻️ Documento reutilizado',
  documento_eliminado: '🗑️ Documento eliminado',
  fotos_subidas: '📷 Fotos subidas',
  foto_eliminada: '🗑️ Foto eliminada',
  firma_subida: '✍️ Firma subida',
  firma_sellada: '✍️ Firma electrónica sellada',
  estudio_seguridad_cargado: '🛡️ Estudio de seguridad cargado',
  foto_seguridad_cargada: '🛡️ Foto de conductor cargada',
  estado_rechazado: '🚫 Vehículo RECHAZADO',
  responsable_asignado: '🔗 Responsable asignado',
};

const ETIQUETAS_VIA: Record<string, { texto: string, clase: string }> = {
  conductor: { texto: 'Conductor', clase: 'rev-aud-via--conductor' },
  impersonacion: { texto: 'Seguridad (como el conductor)', clase: 'rev-aud-via--impersonacion' },
  seguridad: { texto: 'Seguridad', clase: 'rev-aud-via--seguridad' },
};

/** true si el valor parece una URL/ruta de documento (para el diff legible). */
const esDoc = (v: any) => typeof v === 'string' && (v.startsWith('http') || v === '(ninguno)' || v === '(eliminado)');

const PestanaCambios: React.FC<{ veh: Vehiculo }> = ({ veh }) => {
  const cambios = veh.historialCambios || [];
  const inactivaciones = veh.historialInactivacion || [];
  const auditoria = [...(veh.auditoriaVehiculo || [])].reverse(); // lo más reciente primero
  const vacio = cambios.length === 0 && inactivaciones.length === 0 && auditoria.length === 0;

  /** Exporta las tres secciones a un Excel (una hoja por sección, solo las
   *  que tienen filas). Mismo patrón SheetJS de TarifasP/Indicadores. */
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    if (auditoria.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        auditoria.map(a => ({
          'Fecha': fechaLegible(a.fecha),
          'Vía': (ETIQUETAS_VIA[a.via] || { texto: a.via }).texto,
          'Actor': a.actor || 'El titular (conductor)',
          'Acción': (ETIQUETAS_ACCION[a.accion] || a.accion).replace(/^[^\s]+\s/, ''),
          'Detalle': a.detalle || '',
        }))
      ), 'Auditoría');
    }
    if (cambios.length > 0) {
      const filas: Record<string, string>[] = [];
      cambios.forEach(c => c.campos.forEach(cam => filas.push({
        'Fecha': fechaLegible(c.fecha),
        'Usuario': c.usuario,
        'Sección': c.seccion,
        'Campo': cam.campo,
        'Antes': esDoc(cam.antes) ? '📄 documento' : String(cam.antes ?? '—'),
        'Después': esDoc(cam.despues) ? '📄 documento' : String(cam.despues ?? '—'),
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Cambios de edición');
    }
    if (inactivaciones.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        inactivaciones.map(h => ({
          'Fecha': fechaLegible(h.fecha),
          'Acción': h.accion === 'inactivo' ? 'Inactivado' : h.accion === 'rechazado' ? 'Rechazado' : 'Reactivado',
          'Usuario': h.usuario,
          'Motivo': h.motivo,
        }))
      ), 'Inactivaciones');
    }
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `auditoria_${veh.placa}_${fecha}.xlsx`);
  };

  return (
    <div className="rev-detalle-scroll">
      {veh.estadoIntegra === 'inactivo' && inactivaciones.length > 0 && (
        <div className="rev-inactivo-vigente">
          <strong>⛔ Inactivo desde {fechaLegible(inactivaciones[inactivaciones.length - 1].fecha)}</strong>
          <span>Motivo: {inactivaciones[inactivaciones.length - 1].motivo}</span>
        </div>
      )}

      {/* Rechazo definitivo (2026-10-05): candado visible con su motivo. */}
      {veh.estadoIntegra === 'rechazado' && inactivaciones.length > 0 && (
        <div className="rev-inactivo-vigente" style={{ borderLeft: '4px solid #90222b', background: '#fbe9ea' }}>
          <strong style={{ color: '#90222b' }}>🚫 Rechazado — no editable</strong>
          <span>Motivo: {inactivaciones[inactivaciones.length - 1].motivo}</span>
        </div>
      )}

      {/* Encabezado con la exportación de TODAS las secciones. */}
      {!vacio && (
        <div className="rev-cambios-toolbar">
          <button className="rev-est-btn-tabla" onClick={exportarExcel}>
            <FaFileExcel /> Exportar a Excel
          </button>
        </div>
      )}

      {inactivaciones.length > 0 && (
        <>
          <h4 className="titulo-seccion">⛔ Historial de inactivación</h4>
          <div className="rev-tabla-wrap">
            <table className="rev-est-tabla">
              <thead>
                <tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {inactivaciones.map((h, i) => (
                  <tr key={i}>
                    <td className="rev-est-tabla-fecha">{fechaLegible(h.fecha)}</td>
                    <td style={{ fontWeight: 600,
                        color: h.accion === 'reactivado' ? '#1e8449' : h.accion === 'rechazado' ? '#90222b' : '#7d3c98' }}>
                      {h.accion === 'inactivo' ? 'Inactivado' : h.accion === 'rechazado' ? 'Rechazado' : 'Reactivado'}
                    </td>
                    <td>{h.usuario}</td>
                    <td>{h.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4 className="titulo-seccion">🔄 Cambios desde la última aprobación</h4>
      {cambios.length === 0 ? (
        <p className="rev-vacio">Sin ediciones registradas sobre este vehículo.</p>
      ) : (
        <div className="rev-tabla-wrap">
          <table className="rev-est-tabla">
            <thead>
              <tr><th>Fecha</th><th>Usuario</th><th>Sección</th><th>Campo</th><th>Antes → Después</th></tr>
            </thead>
            <tbody>
              {cambios.map((cambio, i) => cambio.campos.map((c, j) => (
                <tr key={`${i}-${j}`}>
                  {j === 0 ? (
                    <td className="rev-est-tabla-fecha" rowSpan={cambio.campos.length}>{fechaLegible(cambio.fecha)}</td>
                  ) : null}
                  {j === 0 ? <td rowSpan={cambio.campos.length}>{cambio.usuario}</td> : null}
                  {j === 0 ? <td rowSpan={cambio.campos.length}>{cambio.seccion}</td> : null}
                  <td style={{ fontWeight: 600 }}>{c.campo}</td>
                  <td>
                    {esDoc(c.antes) || esDoc(c.despues) ? (
                      '📄 documento actualizado'
                    ) : (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#a33' }}>{String(c.antes ?? '—')}</span>
                        {" → "}
                        <span style={{ color: '#2a7a2a', fontWeight: 600 }}>{String(c.despues ?? '—')}</span>
                      </>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}

      {/* ✍️ Detalle del acto de FIRMA ELECTRÓNICA (sello + verificación). */}
      <h4 className="titulo-seccion">✍️ Firma electrónica del conductor</h4>
      <TarjetaFirmaElectronica veh={veh} />

      {/* ⚖️ AUTORIZACIONES DE DATOS de todos los actores PERSONA del vehículo
          (misma tarjeta de habeas data de la pestaña Estudios: primera/última
          aceptación, canal, versión, IP/navegador + acciones de Seguridad). */}
      <h4 className="titulo-seccion">⚖️ Autorizaciones de datos (habeas data)</h4>
      {(() => {
        const esNit = (v?: string) => String(v || '').toUpperCase().includes('NIT');
        const cedulas = [
          veh.condCedulaCiudadania,
          !esNit(veh.propTipoDocumento) && veh.propDocumento,
          !esNit(veh.tenedTipoDocumento) && veh.tenedDocumento,
          !esNit(veh.RemolDuenoTipoDocumento) && veh.RemolDuenoDocumento,
        ].filter(Boolean).map(String);
        if (cedulas.length === 0) {
          return <p className="rev-vacio">El vehículo no tiene actores persona registrados.</p>;
        }
        return <TarjetaHabeasData cedulas={cedulas} veh={veh} />;
      })()}

      {/* 🕵 Auditoría al FINAL (pedido 2026-10-07): es el registro más largo y
          no debe empujar firma/autorizaciones hacia abajo. */}
      <h4 className="titulo-seccion">🕵 Auditoría del vehículo</h4>
      <p className="rev-aud-nota">
        Registro inmutable de cada acción: quién la hizo realmente (el conductor con su
        cuenta, o Seguridad trabajando como él), cuándo y por qué canal.
      </p>
      {auditoria.length === 0 ? (
        <p className="rev-vacio">Sin movimientos registrados todavía.</p>
      ) : (
        <div className="rev-tabla-wrap">
          <table className="rev-est-tabla">
            <thead>
              <tr><th>Fecha</th><th>Vía</th><th>Actor</th><th>Acción</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {auditoria.map((a, i) => {
                const via = ETIQUETAS_VIA[a.via] || { texto: a.via, clase: '' };
                return (
                  <tr key={i}>
                    <td className="rev-est-tabla-fecha">{fechaLegible(a.fecha)}</td>
                    <td><span className={`rev-aud-via ${via.clase}`}>{via.texto}</span></td>
                    <td>{a.actor ? <strong>{a.actor}</strong> : <span className="rev-est-tabla-id">El titular</span>}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{ETIQUETAS_ACCION[a.accion] || a.accion}</td>
                    <td>{a.detalle}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {vacio && <p className="rev-vacio">Este vehículo no tiene historial de cambios.</p>}
    </div>
  );
};

export default PestanaCambios;
