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
 * aprobado (re-revisión) y timeline de inactivaciones/reactivaciones.
 */
const PestanaCambios: React.FC<{ veh: Vehiculo }> = ({ veh }) => {
  const cambios = veh.historialCambios || [];
  const inactivaciones = veh.historialInactivacion || [];
  const vacio = cambios.length === 0 && inactivaciones.length === 0;

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

      {vacio && <p className="rev-vacio">Este vehículo no tiene historial de cambios.</p>}
    </div>
  );
};

export default PestanaCambios;
