'use client';

/**
 * Polling del Módulo Financiero (decisión de arquitectura: sin WebSocket/SSE
 * — worker único en Render starter). Refresca cada 25 s con la pestaña
 * visible y expone `recargar` para revalidar tras cada mutación propia.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const INTERVALO_MS = 25_000;

export function useFinDatos<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const recargar = useCallback(async () => {
    try {
      const nuevos = await cargarRef.current();
      setDatos(nuevos);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de consulta');
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial + cuando cambian las deps (filtros)
  useEffect(() => { setCargando(true); recargar(); }, [recargar, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling solo con la pestaña visible
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') recargar();
    }, INTERVALO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar]);

  return { datos, cargando, error, recargar };
}
