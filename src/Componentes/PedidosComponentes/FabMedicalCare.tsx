'use client';
import React, { useState } from 'react';
import { FaFileExcel, FaPlus } from 'react-icons/fa';
import ImportarExcelMedicalCare from './ImportarExcelMedicalCare';
import './FabMedicalCare.css';

interface FabMedicalCareProps {
  onCargarExitoso?: () => void;
}

const FabMedicalCare: React.FC<FabMedicalCareProps> = ({ onCargarExitoso }) => {
  const [abierto, setAbierto] = useState(false);

  const toggleMenu = () => {
    setAbierto(!abierto);
  };

  return (
    <div className="FabMedicalCare">
      {/* Componentes montados fuera de pantalla para usar click programático */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
        <ImportarExcelMedicalCare onCargarExitoso={onCargarExitoso} />
      </div>

      {/* Opción: Importar Excel */}
      {abierto && (
        <div className="FabMedicalCare-opcion" onClick={() => {
          document.querySelector('.ImportarExcelMedicalCare-boton')?.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
          );
          setAbierto(false);
        }}>
          <span className="FabMedicalCare-label">Importar Excel</span>
          <FaFileExcel className="FabMedicalCare-icono" />
        </div>
      )}

      {/* Botón principal */}
      <button 
        className="FabMedicalCare-boton" 
        onClick={toggleMenu}
        aria-label="Acciones"
      >
        <FaPlus className={`FabMedicalCare-iconoPrincipal ${abierto ? 'abierto' : ''}`} />
      </button>
    </div>
  );
};

export default FabMedicalCare;