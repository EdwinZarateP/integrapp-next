'use client';
import React, { useState } from "react";
import { FaChevronLeft, FaFilePdf } from "react-icons/fa";
import HvVehiculos from "@/Componentes/HvVehiculos";
import { Vehiculo, PestanaDetalle } from "../tipos";
import PestanaDatos from "./PestanaDatos";
import PestanaDocumentos from "./PestanaDocumentos";
import PestanaCambios from "./PestanaCambios";
import AccionesVehiculo from "./AccionesVehiculo";

/* Chip de estado con color por semáforo. */
const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  registro_incompleto: { texto: 'Pendiente', clase: 'rev-chip--pendiente' },
  completado_revision: { texto: 'En revisión', clase: 'rev-chip--revision' },
  aprobado: { texto: 'Aprobado', clase: 'rev-chip--aprobado' },
  inactivo: { texto: 'Inactivo', clase: 'rev-chip--inactivo' },
  devuelto: { texto: 'Devuelto', clase: 'rev-chip--devuelto' },
};

interface PanelDetalleProps {
  veh: Vehiculo;
  onClose: () => void;
  alCambiar: (mensaje: string) => void;
}

/**
 * Panel de detalle: cabecera (placa, conductor, chip de estado, badge de
 * re-revisión) + pestañas internas (Datos/Documentos/Cambios) + barra de
 * acciones SIEMPRE visible al fondo. Desktop: lateral; móvil: fullscreen.
 */
const PanelDetalle: React.FC<PanelDetalleProps> = ({ veh, onClose, alCambiar }) => {
  const [pestana, setPestana] = useState<PestanaDetalle>('datos');

  const estado = ETIQUETA_ESTADO[veh.estadoIntegra] || { texto: veh.estadoIntegra, clase: '' };
  const esReRevison = (veh.historialCambios?.length ?? 0) > 0;
  const puedeHV = veh.estadoIntegra === 'aprobado' || veh.estadoIntegra === 'inactivo';

  const pestanas: Array<{ id: PestanaDetalle; texto: string }> = [
    { id: 'datos', texto: 'Datos' },
    { id: 'documentos', texto: 'Documentos' },
    { id: 'cambios', texto: 'Cambios' },
  ];

  return (
    <div className="rev-panel">
      <div className="rev-panel-header">
        <button className="rev-panel-volver" onClick={onClose} title="Volver a la bandeja">
          <FaChevronLeft /> Volver
        </button>
        <div className="rev-panel-titulo">
          <h3>{veh.placa}</h3>
          <span className="rev-panel-conductor">
            {veh.condNombres || 'SIN NOMBRE'} {veh.condPrimerApellido || ''}
          </span>
        </div>
        <div className="rev-panel-chips">
          <span className={`rev-chip ${estado.clase}`}>{estado.texto}</span>
          {esReRevison && <span className="rev-chip rev-chip--rerevision">🔄 Re-revisión</span>}
        </div>
      </div>

      <div className="rev-panel-pestanas">
        {pestanas.map(p => (
          <button
            key={p.id}
            className={`rev-panel-pestana ${pestana === p.id ? 'rev-panel-pestana--activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div className="rev-panel-cuerpo">
        {pestana === 'datos' && <PestanaDatos veh={veh} />}
        {pestana === 'documentos' && <PestanaDocumentos veh={veh} />}
        {pestana === 'cambios' && <PestanaCambios veh={veh} />}
      </div>

      <div className="rev-panel-footer">
        <AccionesVehiculo veh={veh} alCambiar={alCambiar} />
        {puedeHV && (
          <div className="rev-panel-hv" title="Descargar hoja de vida en PDF">
            <FaFilePdf className="rev-panel-hv-icon" />
            <HvVehiculos vehiculo={veh} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PanelDetalle;
