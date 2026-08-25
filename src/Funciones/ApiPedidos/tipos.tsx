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
  activo?: boolean;
  notificaciones_mc?: string[];
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
