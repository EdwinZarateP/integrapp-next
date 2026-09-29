/* Tipos compartidos de /revision. Se exportan desde index.tsx para no romper
   el import de HvVehiculos: `import { Vehiculo } from '@/Paginas/revision'`. */

export interface Vehiculo {
  _id: string;
  placa: string;
  estadoIntegra: string;
  idUsuario: string;
  estudioSeguridad?: string;
  fotoconductorseguridad?: string;
  observaciones?: string;
  /** Fecha del último cambio de estado (para "tiempo esperando"). */
  fechaEstado?: string;
  // Re-revisión: cambios editados sobre un vehículo aprobado.
  historialCambios?: Array<{
    fecha: string;
    usuario: string;
    seccion: string;
    campos: Array<{ campo: string; antes: any; despues: any }>;
  }>;
  // Inactivaciones/reactivaciones por Seguridad (append-only).
  historialInactivacion?: Array<{
    fecha: string;
    usuario: string;
    motivo: string;
    accion: 'inactivo' | 'reactivado';
  }>;
  // Vinculación tenedor → conductor invitado.
  idConductor?: string | null;
  invitacionConductor?: { correo: string; estado: string } | null;
  // Estudios de seguridad automáticos (TusDatos) disparados al pasar a
  // completado_revision: uno por cédula única (roles combinados) + placa.
  estudiosSeguridadAuto?: EstudioAuto[];
  // Corridas anteriores (append por el frente, tope 10 en el backend).
  historialEstudios?: Array<{ fecha: string; estudios: EstudioAuto[] }>;
  [key: string]: any;
}

/** Un estudio automático (elemento de `estudiosSeguridadAuto` del vehículo). */
export interface EstudioAuto {
  id: string;
  tipo: 'persona' | 'vehiculo';
  roles?: string[];            // solo persona: conductor/propietario/tenedor
  cedula?: string;             // solo persona
  placa?: string;              // solo vehiculo
  estado: 'pendiente' | 'en_curso' | 'finalizado' | 'error';
  proveedor: string;           // hoy "tusdatos"
  hallazgo?: boolean;          // true si alguna fuente registró hallazgo
  categoria?: string;          // alto | medio | bajo | info | ""
  fuentes?: Record<string, boolean | 'Error'>;
  reporte_id?: string;         // PDF del reporte vía /tusdatos/reportes/{id}/pdf
  error?: string;
  iniciado_en?: string;
  finalizado_en?: string;
  [key: string]: any;
}

export type PestanaBandeja = 'pendientes' | 'revision' | 'aprobados' | 'inactivos';

export type PestanaDetalle = 'datos' | 'documentos' | 'cambios' | 'estudios';
