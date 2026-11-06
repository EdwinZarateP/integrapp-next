'use client';
import dynamic from 'next/dynamic';
import { fuenteIntegra } from '@/Fuentes/fuenteIntegra';

// (2026-11-05) Nunito Sans (sistema de diseño Integra) vía next/font: la
// variable --fuente-integra la consume .LU-layout (LoginUsuarios/estilos.css).
const LoginUsuario = dynamic(() => import('@/Paginas/LoginUsuarios'), { ssr: false });

export default function Page() {
  return (
    <div className={fuenteIntegra.variable}>
      <LoginUsuario />
    </div>
  );
}
