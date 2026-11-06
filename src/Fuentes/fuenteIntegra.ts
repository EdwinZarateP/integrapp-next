import { Nunito_Sans } from 'next/font/google';

// (2026-11-05) Nunito Sans — fuente oficial del sistema de diseño Integra
// Logística (SB Admin Pro / Smart Logistics). Self-hosted por next/font en
// build (compatible con output:'export' de GoDaddy). La variable
// --fuente-integra la consumen las pantallas que adoptan el sistema de
// diseño (portal Mis Indicadores, LoginUsuario): envolver con
// <div className={fuenteIntegra.variable}> y declarar
// font-family: var(--fuente-integra, 'Nunito Sans'), ... en el contenedor.
export const fuenteIntegra = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--fuente-integra',
  display: 'swap',
  // Sin fallback métrico automático: Nunito Sans no trae override values en
  // esta versión de Next y el build lo reporta como error (benigno).
  adjustFontFallback: false,
});
