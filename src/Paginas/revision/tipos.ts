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
  // Inactivaciones/reactivaciones por Seguridad (append-only). El rechazo
  // definitivo también viaja aquí con su acción propia.
  historialInactivacion?: Array<{
    fecha: string;
    usuario: string;
    motivo: string;
    accion: 'inactivo' | 'reactivado' | 'rechazado';
  }>;
  // Vinculación tenedor → conductor invitado.
  idConductor?: string | null;
  invitacionConductor?: { correo: string; estado: string } | null;
  // SEGUNDO CONDUCTOR (2026-10-14): slot 2 opcional con HV completa
  // (cond2* + documentos propios + firma propia firmaUrl2/firmaEvidencia2).
  idConductor2?: string | null;
  invitacionConductor2?: { correo: string; estado: string } | null;
  firmaUrl2?: string | null;
  firmaEvidencia2?: any;
  // Estudios de seguridad automáticos (TusDatos) disparados al pasar a
  // completado_revision: uno por cédula única (roles combinados) + placa.
  estudiosSeguridadAuto?: EstudioAuto[];
  // Corridas anteriores (append por el frente, tope 10 en el backend).
  historialEstudios?: Array<{ fecha: string; estudios: EstudioAuto[] }>;
  // Vigencia de la corrida vigente (renovación automática).
  estudiosVigencia?: { desde?: string; vence?: string };
  // Bitácora de auditoría (append-only): quién hizo cada mutación, cuándo y
  // por qué canal — conductor con su cuenta | Seguridad impersonando |
  // Seguridad directa.
  auditoriaVehiculo?: EntradaAuditoria[];
  // Fotos del vehículo POR ÁNGULO (2026-10-14): los 4 exigidos — frontal,
  // lateral izquierda/derecha y posterior. `fotos` sigue siendo el espejo
  // plano de todas. Las rutas llegan firmadas.
  fotosVehiculo?: Array<{ tipo: string; ruta: string; fecha?: string }>;
  // Espejo plano de TODAS las fotos del vehículo (ángulos + adicionales).
  fotos?: string[];
  // Planillas de Seguridad Social (2026-10-07): se actualizan mensualmente →
  // cada carga ACUMULA acá (tope 24); `planillaEpsArl` es el espejo de la
  // última. Las rutas llegan firmadas.
  documentosPlanillaSegSocial?: Array<{ ruta: string; fecha: string; nombre?: string }>;
  // Historial UNIVERSAL de documentos: toda subida de cualquier documento
  // (frente/reverso/reutilización) queda acá con su propio archivo; el campo
  // del documento apunta a la última versión. Tope 200 en el backend.
  historialDocumentos?: Array<{
    tipo: string; etiqueta?: string; ruta: string; fecha: string;
    nombre?: string; actor?: string; reverso?: boolean;
  }>;
  [key: string]: any;
}

/** Entrada de la bitácora de auditoría del vehículo (append-only, backend). */
export interface EntradaAuditoria {
  fecha: string;
  actor?: string | null;         // nombre de Seguridad; null = el titular
  via: 'conductor' | 'impersonacion' | 'seguridad';
  accion: string;                // vehiculo_creado, datos_actualizados, documento_subido…
  detalle?: string;
}

/** Un estudio automático (elemento de `estudiosSeguridadAuto` del vehículo). */
export interface EstudioAuto {
  id: string;
  tipo: 'persona' | 'vehiculo' | 'empresa';
  roles?: string[];            // persona/empresa: conductor/propietario/tenedor
  cedula?: string;             // solo persona
  nit?: string;                // solo empresa
  placa?: string;              // solo vehiculo
  estado: 'pendiente' | 'en_curso' | 'finalizado' | 'error';
  proveedor: string;           // hoy "tusdatos"
  hallazgo?: boolean;          // true si alguna fuente registró hallazgo
  categoria?: string;          // alto | medio | bajo | info | ""
  /** true=hallazgo, false=sin hallazgo, 'Error'/'Página no disponible'=fallida,
   *  ''=no aplicó a la consulta (el proveedor envía más estados de los documentados). */
  fuentes?: Record<string, boolean | string | null>;
  reporte_id?: string;         // PDF del reporte vía /tusdatos/reportes/{id}/pdf
  // Origen de la corrida (2026-10-21): 'manual' = usuario de Seguridad
  // (ver `disparado_por`) · 'automatico' = plataforma (al pasar a revisión);
  // undefined = corrida previa al sello (se muestra «—»).
  canal?: 'manual' | 'automatico';
  disparado_por?: string | null;
  /** URL firmada del PDF ARCHIVADO en el bucket privado (si existe). */
  pdf_url?: string;
  pdf_gcs?: { ruta: string; tamano?: number; archivado_en?: string };
  /** Placa de la que se copió este estudio sin gastar consulta. */
  reutilizado_de?: string;
  error?: string;
  /** Respuesta CRUDA del proveedor ante un fallo (diagnóstico a posteriori). */
  error_proveedor?: string;
  iniciado_en?: string;
  finalizado_en?: string;
  [key: string]: any;
}

export type PestanaBandeja = 'pendientes' | 'revision' | 'aprobados' | 'inactivos' | 'actualizacion' | 'rechazados';

export type PestanaDetalle = 'datos' | 'documentos' | 'cambios' | 'estudios';
