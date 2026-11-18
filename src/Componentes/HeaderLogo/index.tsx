'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import './estilos.css';

const HeaderLogo: React.FC = () => {
  const router = useRouter();

  return (
    <header
      className="HeaderLogo-contenedor"
      onClick={() => router.push("/")}
      title="Volver al inicio"
    >
      <img src={LOGO_INTEGRA} alt="Integra Logística" className="HeaderLogo-img" />

      <div className="HeaderLogo-subtitulo">
        <span>Cadena De</span>
        <span>Servicios</span>
      </div>
    </header>
  );
};

export default HeaderLogo;
