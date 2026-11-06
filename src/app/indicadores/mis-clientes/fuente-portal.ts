import { Nunito_Sans } from 'next/font/google';

// (2026-11-05) Nunito Sans — fuente oficial del sistema de diseño Integra
// Logística (SB Admin Pro / Smart Logistics). Self-hosted por next/font en
// build (compatible con output:'export' de GoDaddy). La variable
// --fuente-portal la consume .DC-portalClaro (DashboardCliente/estilos.css);
// usarla es envolver el dashboard con <div className={fuentePortal.variable}>.
export const fuentePortal = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--fuente-portal',
  display: 'swap',
  // Sin fallback métrico automático: Nunito Sans no trae override values en
  // esta versión de Next y el build lo reporta como error (benigno).
  adjustFontFallback: false,
});
