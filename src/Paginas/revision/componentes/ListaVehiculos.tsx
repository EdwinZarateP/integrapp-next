'use client';
import React, { useMemo, useState } from "react";
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

/* Minutos transcurridos desde el último cambio de estado — base del ORDEN
   por tiempo (el texto "hace X" no se puede comparar). */
const minutosEsperando = (veh: Vehiculo): number => {
  const fecha = obtenerFechaEstado(veh);
  return fecha ? Math.floor((Date.now() - fecha.getTime()) / 60000) : -1;
};

const nombreConductor = (veh: Vehiculo): string =>
  `${veh.condNombres || ''} ${veh.condPrimerApellido || ''}`.trim() || 'SIN NOMBRE';

// (2026-10-20, pedido del usuario) Campos ordenables de la tabla.
type CampoOrden = 'placa' | 'conductor' | 'avance' | 'tiempo';
const COLUMNAS: Array<{ campo: CampoOrden; etiqueta: string; titulo: string }> = [
  { campo: 'placa', etiqueta: 'Placa', titulo: 'Ordenar por placa' },
  { campo: 'conductor', etiqueta: 'Conductor', titulo: 'Ordenar por nombre del conductor' },
  { campo: 'avance', etiqueta: 'Avance', titulo: 'Ordenar por avance de documentación' },
  { campo: 'tiempo', etiqueta: 'Tiempo', titulo: 'Ordenar por tiempo en la bandeja (días/horas)' },
];

interface ListaVehiculosProps {
  vehiculos: Vehiculo[];
  /** Mientras carga la bandeja: filas de skeleton en vez del vacío. */
  cargando?: boolean;
  seleccionadoId?: string | null;
  onSeleccionar: (veh: Vehiculo) => void;
  vacioTexto?: string;
  /** (2026-10-15) Id del padrino logueado: marca ★ las placas que adoptó. */
  padrinoId?: string;
}

/** Tabla de la bandeja: Placa · Conductor · Avance · Tiempo, ordenable por
 * columna (clic en el título: ascendente → descendente; sin orden = el orden
 * de la bandeja). (2026-10-20, pedido del usuario — antes era una lista de
 * filas flex sin títulos). */
const ListaVehiculos: React.FC<ListaVehiculosProps> = ({ vehiculos, cargando, seleccionadoId, onSeleccionar, vacioTexto, padrinoId }) => {
  const [campo, setCampo] = useState<CampoOrden | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  const alternarOrden = (c: CampoOrden) => {
    if (campo === c) {
      setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCampo(c);
      setDir('asc');
    }
  };

  const ordenados = useMemo(() => {
    if (!campo) return vehiculos;
    const factor = dir === 'asc' ? 1 : -1;
    const copia = [...vehiculos];
    copia.sort((a, b) => {
      if (campo === 'placa') return factor * String(a.placa || '').localeCompare(String(b.placa || ''));
      if (campo === 'conductor') return factor * nombreConductor(a).localeCompare(nombreConductor(b));
      if (campo === 'avance') return factor * (avanceDocumentosVehiculo(a) - avanceDocumentosVehiculo(b));
      // tiempo: ascendente = el que MÁS tiempo lleva primero (el más antiguo).
      return factor * (minutosEsperando(a) - minutosEsperando(b));
    });
    return copia;
  }, [vehiculos, campo, dir]);

  if (cargando) {
    return (
      <div className="rev-lista" aria-busy="true" aria-label="Cargando vehículos">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rev-fila rev-fila--skeleton">
            <span className="rev-skel rev-skel--placa" />
            <span className="rev-skel rev-skel--conductor" />
            <span className="rev-skel rev-skel--avance" />
            <span className="rev-skel rev-skel--tiempo" />
          </div>
        ))}
      </div>
    );
  }

  if (vehiculos.length === 0) {
    return <p className="rev-vacio">{vacioTexto || 'No hay vehículos en esta bandeja.'}</p>;
  }

  return (
    <div className="rev-tabla-wrap">
      <table className="rev-tabla-bandeja">
        <thead>
          <tr>
            {COLUMNAS.map(col => (
              <th key={col.campo} className="rev-ord" aria-sort={campo === col.campo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="rev-ord-btn" onClick={() => alternarOrden(col.campo)} title={col.titulo}>
                  {col.etiqueta}
                  <span className={`rev-ord-flecha ${campo === col.campo ? 'rev-ord-flecha--activa' : ''}`}>
                    {campo === col.campo ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenados.map(veh => {
            const reRevison = (veh.historialCambios?.length ?? 0) > 0;
            // Avance de documentación (misma semántica del gate del backend).
            const pct = avanceDocumentosVehiculo(veh);
            const clasePct = pct >= 90 ? 'rev-avance--alto' : pct >= 70 ? 'rev-avance--medio' : 'rev-avance--bajo';
            // Placa adoptada por el padrino logueado (2026-10-15).
            const esMia = Boolean(padrinoId) && (Array.isArray(veh.padrinos) ? veh.padrinos : [])
              .some((p: any) => p?.id === padrinoId);
            return (
              <tr
                key={veh._id}
                className={`rev-tfila ${seleccionadoId === veh._id ? 'rev-tfila--activa' : ''}`}
                onClick={() => onSeleccionar(veh)}
                title={esMia ? `Tu placa adoptada · Documentación: ${pct}%` : `Documentación: ${pct}%`}
              >
                <td className="rev-fila-placa">{veh.placa}{esMia && <span className="rev-fila-padrino" title="Placa que adoptaste (recibes sus avisos)">★</span>}</td>
                <td className="rev-fila-conductor">
                  {nombreConductor(veh)}
                  {reRevison && <span className="rev-chip rev-chip--rerevision rev-chip--mini">🔄</span>}
                </td>
                <td className="rev-fila-avance">
                  <span className={`rev-avance ${clasePct}`}>{pct}%</span>
                </td>
                <td className="rev-fila-tiempo">{tiempoEsperando(veh)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ListaVehiculos;
