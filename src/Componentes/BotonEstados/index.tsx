'use client';
import React from 'react';
import './estilos.css';

interface PropiedadesBotonManifiestos {
  nombreEstado: string;
  icono: JSX.Element;
}

const BotonEstado: React.FC<PropiedadesBotonManifiestos> = ({ nombreEstado, icono }) => {
  return (
    <div className='contenedorBotonEstado'>
        <div className='contenedorImagenEstado'>
            {icono}
        </div>
        <div className='contenedorInformacionEstado'>
            <h2>{nombreEstado}</h2>
        </div>
    </div>
  );
};

export default BotonEstado;
