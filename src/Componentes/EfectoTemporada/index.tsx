/**
 * EfectoTemporada (2026-11-25, 10.ª tanda) — efecto visual GLOBAL de la app,
 * configurado por el ADMIN desde /Apariencia (backend GET /apariencia).
 * Montado en ClientProviders (como LanzadorModulos): cuando hay efecto activo,
 * agrega una clase al <body> (acento del header unificado) y renderiza un
 * overlay de partículas pointer-events:none sobre toda la página.
 *
 * - Cache localStorage TTL 5 min + RECONSULTA al volver a enfocar la pestaña
 *   si la caché pasó 1 min: los usuarios en línea ven el efecto del ADMIN al
 *   volver a la pestaña, sin recargar. Fallo de red → sin efecto, silencioso.
 * - Partículas generadas UNA vez (useMemo): posiciones/delays inline.
 * - prefers-reduced-motion: el CSS oculta el overlay (patrón CamionCargando).
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { EFECTOS } from '@/Funciones/efectosTemporada';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const CACHE_KEY = 'integrapp.efectoTemporada';
const CACHE_TTL_MS = 5 * 60 * 1000;
const N_PARTICULAS = 25;

type CacheEfecto = { efecto: string; ts: number };

const leerCache = (): string | null => {
  try {
    const cruda = localStorage.getItem(CACHE_KEY);
    if (!cruda) return null;
    const c = JSON.parse(cruda) as CacheEfecto;
    if (Date.now() - c.ts > CACHE_TTL_MS) return null;
    return c.efecto;
  } catch {
    return null;
  }
};

const guardarCache = (efecto: string) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ efecto, ts: Date.now() } as CacheEfecto));
  } catch { /* sin localStorage */ }
};

const EfectoTemporada: React.FC = () => {
  const [efecto, setEfecto] = useState<string>('ninguno');

  // Consulta al backend (con caché) y aplica al estado. `forzar` salta la
  // caché; si no, aplica la caché fresca si la hay.
  const cargar = (forzar = false) => {
    if (!API) return;
    if (!forzar) {
      const cacheado = leerCache();
      if (cacheado) {
        setEfecto(cacheado);
        return;
      }
    }
    fetch(`${API}/apariencia`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const e = j?.efecto || 'ninguno';
        setEfecto(e);
        guardarCache(e);
      })
      .catch(() => { /* sin efecto: nunca afecta la app */ });
  };

  /** Sincroniza el ESTADO con la caché (aunque esté fresca) — sin fetch. */
  const aplicarDesdeCache = () => {
    try {
      const cruda = localStorage.getItem(CACHE_KEY);
      if (cruda) setEfecto((JSON.parse(cruda) as CacheEfecto).efecto || 'ninguno');
    } catch { /* noop */ }
  };

  useEffect(() => {
    cargar();
    // (11.ª tanda, ajuste + fix bis) El componente vive desde que abrió la
    // app: sin esto, un efecto activado por el ADMIN NO aparecía hasta
    // recargar. Tres vías de refresco:
    // 1. Al volver a enfocar la pestaña: caché fresca → aplicarla al estado;
    //    caché >1 min → reconsultar al backend.
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      let ts = 0;
      try {
        const cruda = localStorage.getItem(CACHE_KEY);
        ts = cruda ? (JSON.parse(cruda) as CacheEfecto).ts : 0;
      } catch { /* cache corrupta */ }
      if (ts && Date.now() - ts <= 60_000) aplicarDesdeCache();
      else cargar(true);
    };
    // 2. Evento local: la página /Apariencia lo dispara al activar un efecto
    //    (escribió la caché antes) → partículas EN LA MISMA sesión, al instante.
    const alCambiar = () => aplicarDesdeCache();
    // 3. Evento `storage`: la caché cambió desde OTRA pestaña del navegador.
    const alStorage = (ev: StorageEvent) => {
      if (ev.key === CACHE_KEY) aplicarDesdeCache();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    window.addEventListener('efecto-temporada-cambiado', alCambiar);
    window.addEventListener('storage', alStorage);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('efecto-temporada-cambiado', alCambiar);
      window.removeEventListener('storage', alStorage);
    };
  }, []);

  // Clase en el <body> para el acento del header unificado / lanzador.
  useEffect(() => {
    EFECTOS.forEach(e => document.body.classList.remove(`efecto-${e.id}`));
    if (efecto && efecto !== 'ninguno') {
      document.body.classList.add(`efecto-${efecto}`);
    }
  }, [efecto]);

  // Partículas generadas UNA vez: posición/velocidad/delay deterministas por
  // índice (useMemo — no re-renderiza con la app). Dimensionadas para la
  // FRANJA del header (recorrido corto: caen 88px, más rápido y pequeñas).
  const particulas = useMemo(
    () => Array.from({ length: N_PARTICULAS }, (_, i) => ({
      left: (i * 97) % 100,                    // distribución pareja, determinista
      delay: -((i * 37) % 70) / 10,            // negativo: la lluvia ya empezó
      duracion: 4 + ((i * 53) % 50) / 10,      // 4–9 s
      tamano: 0.6 + ((i * 29) % 50) / 100,     // 0.6–1.1
      giro: ((i * 31) % 60) - 30,              // -30..30 deg (confeti)
    })),
    [],
  );

  if (!efecto || efecto === 'ninguno') return null;

  const emojis: Record<string, string[]> = {
    navidad: ['❄', '❅', '❆', '⛄'],
    halloween: ['🦇', '🎃', '👻'],
    patrias: ['🇨🇴', '🎀'],
    san_valentin: ['💗', '❤️', '💕'],
    semana_santa: ['🕊', '✝'],
    celebracion: [], // confeti: divs de colores, sin emoji
  };
  const variantes = emojis[efecto] || [];
  const coloresConfeti = ['#dc2626', '#F2D200', '#1baf7a', '#2a78d6', '#9333ea', '#eb6834'];

  return (
    <div className="ET-overlay" aria-hidden="true">
      {particulas.map((p, i) =>
        efecto === 'celebracion' ? (
          <span
            key={i}
            className="ET-confeti"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duracion}s`,
              background: coloresConfeti[i % coloresConfeti.length],
              transform: `rotate(${p.giro}deg)`,
            }}
          />
        ) : (
          <span
            key={i}
            className="ET-particula"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duracion}s`,
              fontSize: `${p.tamano}rem`,
            }}
          >
            {variantes[i % variantes.length] || ''}
          </span>
        ),
      )}
    </div>
  );
};

export default EfectoTemporada;
