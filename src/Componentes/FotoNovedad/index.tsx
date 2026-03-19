'use client';
import React from 'react';
import './estilos.css';
import { useContext } from 'react';
import { ContextoApp } from '@/Contexto/index';
import { useRouter } from 'next/navigation';

const FotoNovedad: React.FC = () => {
  const almacenVariables = useContext(ContextoApp);
  const router = useRouter();

  return (
    <div className="fotoNovedad-contenedor">
      <div className="iframe-contenedor">
        <iframe
          src={almacenVariables?.link}
          title="Contenido de novedad"
          className="iframe-contenido"
        ></iframe>
      </div>

      <button
        className="navegacion-btn"
        onClick={() => router.push('/Estados')}
      >
        Volver
      </button>
    </div>
  );
};

export default FotoNovedad;
