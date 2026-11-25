/**
 * TelemetriaGlobal (2026-11-25) — componente cliente SIN UI montado en
 * ClientProviders (el único punto client-side global de la app): emite un
 * pageview por CAMBIO de ruta en toda la aplicación.
 *
 * - Dedupe por useRef: sobrevive al doble-effect de React StrictMode (dev)
 *   y a re-renders — una sola emisión por ruta visitada.
 * - SKIP de `/indicadores*`: el portal de clientes ya instrumenta sus propias
 *   páginas (beacons de DashboardCliente con cliente_id) — evitar duplicar.
 * - Logins públicos (sin cookie de usuario/conductor): telemetriaApp es no-op.
 */
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageview } from '@/Funciones/telemetriaApp';

const TelemetriaGlobal: React.FC = () => {
  const pathname = usePathname();
  const ultimaRuta = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || ultimaRuta.current === pathname) return;
    ultimaRuta.current = pathname;
    if (pathname.startsWith('/indicadores')) return; // ya instrumentado (portal Kabi)
    trackPageview(pathname);
  }, [pathname]);

  return null;
};

export default TelemetriaGlobal;
