export interface BaseUsuario {
  id?: string;
  nombre: string;
  correo?: string;
  regional: string;
  celular?: string;
  perfil: string;
  // Perfiles adicionales (2026-10-15): p. ej. OPERATIVO que también es Padrino.
  perfiles_adicionales?: string[];
  usuario: string;
  clave: string;
  clientes?: string[];
  // (2026-10-29) Clientes asignados del catálogo clientes_siscore (NITs) —
  // aplicable a cualquier perfil; null/undefined = usuario anterior al campo.
  clientes_siscore?: string[] | null;
  // Alcance de aprobación por cliente en Otros Costos (COORDINADOR/CONTROL; [] = TODOS)
  clientes_aprobacion?: string[];
  activo?: boolean;
  notificaciones_mc?: string[];
  // Módulo Estudios de Seguridad (solo perfil SEGURIDAD)
  empresa_id_seguridad?: string;
  rol_seguridad?: string;
}

export interface LoginRespuesta {
  mensaje: string;
  access_token: string;
  token_type: string;
  usuario: {
    id: string;
    usuario: string;
    // El backend /login los incluye (baseusuarios.py): se usan para las
    // cookies seguridad* del portal de Seguridad (p. ej. login PADRINO).
    nombre?: string;
    correo?: string;
    perfil: string;
    // Perfiles adicionales (2026-10-15): p. ej. OPERATIVO que también es Padrino.
    perfiles_adicionales?: string[];
    regional: string;
    clientes: string[];
    clientes_siscore?: string[] | null;
  };
}
