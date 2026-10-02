'use client';
import React from "react";
import { Vehiculo } from "../tipos";

/* Fechas del backend: ISO naive UTC → hora Colombia. */
const fechaLegible = (iso?: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
      .toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
};

/**
 * Pestaña de histórico del panel de detalle: diff de ediciones sobre un
 * aprobado (re-revisión), timeline de inactivaciones/reactivaciones y la
 * BITÁCORA DE AUDITORÍA (quién hizo cada mutación y por qué canal).
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
};

const ETIQUETAS_VIA: Record<string, { texto: string; clase: string }> = {
  conductor: { texto: 'Conductor', clase: 'rev-aud-via--conductor' },
  impersonacion: { texto: 'Seguridad (como el conductor)', clase: 'rev-aud-via--impersonacion' },
  seguridad: { texto: 'Seguridad', clase: 'rev-aud-via--seguridad' },
};

const PestanaCambios: React.FC<{ veh: Vehiculo }> = ({ veh }) => {
  const cambios = veh.historialCambios || [];
  const inactivaciones = veh.historialInactivacion || [];
  const auditoria = [...(veh.auditoriaVehiculo || [])].reverse(); // lo más reciente primero
  const vacio = cambios.length === 0 && inactivaciones.length === 0 && auditoria.length === 0;

  return (
    <div className="rev-detalle-scroll">
      {veh.estadoIntegra === 'inactivo' && inactivaciones.length > 0 && (
        <div className="rev-inactivo-vigente">
          <strong>⛔ Inactivo desde {fechaLegible(inactivaciones[inactivaciones.length - 1].fecha)}</strong>
          <span>Motivo: {inactivaciones[inactivaciones.length - 1].motivo}</span>
        </div>
      )}

      {inactivaciones.length > 0 && (
        <>
          <h4 className="titulo-seccion">⛔ Historial de inactivación</h4>
          <div className="rev-timeline">
            {inactivaciones.map((h, i) => (
              <div key={i} className={`rev-timeline-item rev-timeline-item--${h.accion}`}>
                <span className="rev-timeline-punto" />
                <div>
                  <strong>{h.accion === 'inactivo' ? 'Inactivado' : 'Reactivado'}</strong>
                  <span className="rev-timeline-meta"> · {fechaLegible(h.fecha)} · por {h.usuario}</span>
                  <div className="rev-timeline-motivo">{h.motivo}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h4 className="titulo-seccion">🔄 Cambios desde la última aprobación</h4>
      {cambios.length === 0 ? (
        <p className="rev-vacio">Sin ediciones registradas sobre este vehículo.</p>
      ) : (
        <div
          style={{
            margin: '10px 0', padding: '12px 14px', borderRadius: '8px',
            backgroundColor: '#eef6ff', border: '1px solid #cfe4ff',
          }}
        >
          {cambios.map((cambio, i) => (
            <div key={i} style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
              <span style={{ color: '#555' }}>
                {fechaLegible(cambio.fecha)} · {cambio.seccion} · por {cambio.usuario}
              </span>
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {cambio.campos.map((c, j) => {
                  const esDoc = typeof c.antes === 'string' && (c.antes.startsWith('http') || c.antes === '(ninguno)' || c.antes === '(eliminado)');
                  return (
                    <li key={j}>
                      <strong>{c.campo}</strong>:{" "}
                      {esDoc ? '📄 documento actualizado' : (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#a33' }}>{String(c.antes ?? '—')}</span>
                          {" → "}
                          <span style={{ color: '#2a7a2a', fontWeight: 600 }}>{String(c.despues ?? '—')}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h4 className="titulo-seccion">🕵 Auditoría del vehículo</h4>
      <p className="rev-aud-nota">
        Registro inmutable de cada acción: quién la hizo realmente (el conductor con su
        cuenta, o Seguridad trabajando como él), cuándo y por qué canal.
      </p>
      {auditoria.length === 0 ? (
        <p className="rev-vacio">Sin movimientos registrados todavía.</p>
      ) : (
        <div className="rev-aud-lista">
          {auditoria.map((a, i) => {
            const via = ETIQUETAS_VIA[a.via] || { texto: a.via, clase: '' };
            return (
              <div key={i} className="rev-aud-item">
                <span className={`rev-aud-via ${via.clase}`}>{via.texto}</span>
                <div className="rev-aud-cuerpo">
                  <strong>{ETIQUETAS_ACCION[a.accion] || a.accion}</strong>
                  {a.detalle && <span className="rev-aud-detalle"> · {a.detalle}</span>}
                  <div className="rev-aud-meta">
                    {fechaLegible(a.fecha)}
                    {a.actor ? <> · por <strong>{a.actor}</strong></> : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vacio && <p className="rev-vacio">Este vehículo no tiene historial de cambios.</p>}
    </div>
  );
};

export default PestanaCambios;
