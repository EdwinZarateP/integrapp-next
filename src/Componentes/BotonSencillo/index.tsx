'use client';
import React from 'react';
import './estilos.css';

// Definir las propiedades (props) que el botón va a recibir
interface PropiedadesBotonSencillo {
  type: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  texto: string;
  colorClass?: string;
}

const BotonSencillo: React.FC<PropiedadesBotonSencillo> = ({ type, onClick, texto, colorClass }) => {
  return (
    <button type={type} className={`boton-${colorClass}`} onClick={onClick}>{texto}</button>
  );
};

export default BotonSencillo;
