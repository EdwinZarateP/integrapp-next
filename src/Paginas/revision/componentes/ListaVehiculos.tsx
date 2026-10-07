'use client';
import React from "react";
import { Vehiculo } from "../tipos";
import { avanceDocumentosVehiculo } from "@/Funciones/avanceDocumentosVehiculo";

/* Fecha del último cambio de estado; fallback: timestamp del ObjectId (_id). */
export const obtenerFechaEstado = (veh: Vehiculo): Date | null => {
  if (veh.fechaEstado) {
    try {
      return new Date(veh.fechaEstado.endsWith('Z') ? veh.fechaEstado : `${veh.fechaEstado}Z`);
    } catch { /* sigue al fallback */ }
  }
  try {
    const ts = parseInt(String(veh._id || '').substring(0, 8), 16);
    if (!isNaN(ts) && ts > 0) return new Date(ts * 1000);
  } catch { /* nada */ }
  return null;
};

export const tiempoEsperando = (veh: Vehiculo): string => {
  const fecha = obtenerFechaEstado(veh);
  if (!fecha) return '';
  const mins = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
};

interface ListaVehiculosProps {
  vehiculos: Vehiculo[];
  seleccionadoId?: string | null;
  onSeleccionar: (veh: Vehiculo) => void;
  vacioTexto?: string;
}

/** Lista compacta de la bandeja: placa · conductor · tiempo esperando. */
const ListaVehiculos: React.FC<ListaVehiculosProps> = ({ vehiculos, seleccionadoId, onSeleccionar, vacioTexto }) => {
  if (vehiculos.length === 0) {
    return <p className="rev-vacio">{vacioTexto || 'No hay vehículos en esta bandeja.'}</p>;
  }

  return (
    <div className="rev-lista">
      {vehiculos.map(veh => {
        const reRevison = (veh.historialCambios?.length ?? 0) > 0;
        // Avance de documentación (misma semántica del gate del backend).
        const pct = avanceDocumentosVehiculo(veh);
        const clasePct = pct >= 90 ? 'rev-avance--alto' : pct >= 70 ? 'rev-avance--medio' : 'rev-avance--bajo';
        return (
          <button
            key={veh._id}
            className={`rev-fila ${seleccionadoId === veh._id ? 'rev-fila--activa' : ''}`}
            onClick={() => onSeleccionar(veh)}
            title={`Documentación: ${pct}%`}
          >
            <span className="rev-fila-placa">{veh.placa}</span>
            <span className="rev-fila-conductor">
              {veh.condNombres || 'SIN NOMBRE'} {veh.condPrimerApellido || ''}
              {reRevison && <span className="rev-chip rev-chip--rerevision rev-chip--mini">🔄</span>}
            </span>
            <span className="rev-fila-avance">
              <span className={`rev-avance ${clasePct}`}>{pct}%</span>
            </span>
            <span className="rev-fila-tiempo">{tiempoEsperando(veh)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ListaVehiculos;
