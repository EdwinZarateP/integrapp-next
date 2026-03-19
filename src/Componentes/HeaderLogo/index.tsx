'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const HeaderLogo: React.FC = () => {
  const router = useRouter();

  return (
    <header
      className="HeaderLogo-contenedor"
      onClick={() => router.push("/")}
      title="Volver al inicio"
    >
      <img src={logo.src} alt="Logo Albatros" className="HeaderLogo-img" />

      <div className="HeaderLogo-titulo">
        <span>Integr</span>
        <span>App</span>
      </div>

      <div className="HeaderLogo-subtitulo">
        <span>Cadena De</span>
        <span>Servicios</span>
      </div>
    </header>
  );
};

export default HeaderLogo;
