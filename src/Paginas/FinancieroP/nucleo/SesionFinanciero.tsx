'use client';

/**
 * Sesión del Módulo Financiero: bootstrap + guard.
 * - useSesionFin() canjea/renueva el token y expone el usuario del módulo.
 * - GuardRolFin envuelve una pestaña: sin sesión → login IntegrApp; sin
 *   acceso → aviso claro; OK → render.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FinSinAcceso, FinSinSesion, asegurarSesionFin, UsuarioFin,
} from '@/Funciones/ApiPedidos/financiero';

export type EstadoSesion =
  | { fase: 'cargando' }
  | { fase: 'ok'; usuario: UsuarioFin }
  | { fase: 'sin_sesion' }
  | { fase: 'sin_acceso' };

export function useSesionFin(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: 'cargando' });

  const cargar = useCallback(async () => {
    setEstado({ fase: 'cargando' });
    try {
      const usuario = await asegurarSesionFin();
      setEstado({ fase: 'ok', usuario });
    } catch (e) {
      if (e instanceof FinSinAcceso) setEstado({ fase: 'sin_acceso' });
      else if (e instanceof FinSinSesion) setEstado({ fase: 'sin_sesion' });
      else setEstado({ fase: 'sin_sesion' });
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  return estado;
}

export function AvisoSesion({ estado }: { estado: EstadoSesion }) {
  if (estado.fase === 'cargando') {
    return (
      <div className="fin-cargando">
        <div className="fin-spinner" />
        <p>Validando tu sesión con IntegrApp…</p>
      </div>
    );
  }
  if (estado.fase === 'sin_sesion') {
    return (
      <div className="fin-avisoCentral">
        <h2>Tu sesión de IntegrApp expiró</h2>
        <p>El Módulo Financiero usa el mismo login de IntegrApp.</p>
        <button className="fin-btn fin-btnPrimario" onClick={() => (window.location.href = '/integrapp/LoginUsuario/')}>
          Ir a iniciar sesión
        </button>
      </div>
    );
  }
  return (
    <div className="fin-avisoCentral">
      <h2>No tienes acceso al Módulo Financiero</h2>
      <p>
        Pide al administrador del módulo que te dé de alta con tu correo de
        IntegrApp (<b>{estado.fase === 'sin_acceso' ? 'correo no registrado o inactivo' : ''}</b>).
      </p>
      <button className="fin-btn fin-btnSecundario" onClick={() => (window.location.href = '/integrapp/Modulos/')}>
        Volver a IntegrApp
      </button>
    </div>
  );
}
