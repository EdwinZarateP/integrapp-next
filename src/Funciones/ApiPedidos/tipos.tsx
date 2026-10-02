export interface BaseUsuario {
  id?: string;
  nombre: string;
  correo?: string;
  regional: string;
  celular?: string;
  perfil: string;
  usuario: string;
  clave: string;
  clientes?: string[];
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
    perfil: string;
    regional: string;
    clientes: string[];
  };
}
