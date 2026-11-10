'use client';
import React from 'react';
import dynamic from 'next/dynamic';
// Camión de marca (verde #98C74C): ruedas girando, pista pasando y rebote de
// suspensión — animación Lottie escrita a mano (2 s, loop perfecto).
import animacion from './camion.json';
import './estilos.css';

// (2026-11-10) lottie-react (lottie-web) pesa ~250KB: import DINÁMICO al
// montar — mismo patrón que XLSX y @react-pdf, nada de lottie en el bundle
// inicial ni en el prerender (output: 'export').
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

/** Camión animado + texto, para estados de espera (consulta de guía, etc.).
 * `alto` = px de la animación (por defecto 120). */
const CamionCargando: React.FC<{ texto?: string; alto?: number }> = ({ texto, alto = 120 }) => (
  <div className="CC-camion" role="status" aria-live="polite">
    <div className="CC-lottie" style={{ height: alto }}>
      <Lottie animationData={animacion} loop autoplay />
    </div>
    {/* prefers-reduced-motion: sin animación — el emoji hace de fallback. */}
    <span className="CC-emoji" aria-hidden="true">🚛</span>
    {texto && <p className="CC-texto">{texto}</p>}
  </div>
);

export default CamionCargando;
