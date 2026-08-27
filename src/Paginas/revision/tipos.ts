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
  [key: string]: any;
}

export type PestanaBandeja = 'pendientes' | 'revision' | 'aprobados' | 'inactivos';

export type PestanaDetalle = 'datos' | 'documentos' | 'cambios';
