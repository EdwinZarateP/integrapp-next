'use client';
import React, { useState, useEffect } from 'react';
import { obtenerPacientes } from '@/Funciones/ApiPedidos/apiMedicalCare';
import type { PacienteMedicalCare } from '@/Funciones/ApiPedidos/tiposMedicalCare';
import './TablaPacientesMedicalCare.css';

interface TablaPacientesMedicalCareProps {
  recargar?: boolean;
}

const TablaPacientesMedicalCare: React.FC<TablaPacientesMedicalCareProps> = ({ recargar }) => {
  const [pacientes, setPacientes] = useState<PacienteMedicalCare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const porPagina = 50;

  const cargarPacientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await obtenerPacientes(pagina * porPagina, porPagina);
      setPacientes(response.pacientes);
    } catch (err: any) {
      setError('Error al cargar pacientes: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPacientes();
  }, [pagina, recargar]);

  if (loading) {
    return (
      <div className="TablaPacientesMedicalCare-loading">
        <div className="TablaPacientesMedicalCare-spinner"></div>
        <p>Cargando pacientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="TablaPacientesMedicalCare-error">
        <p>{error}</p>
      </div>
    );
  }

  if (pacientes.length === 0) {
    return (
      <div className="TablaPacientesMedicalCare-vacio">
        <p>No hay pacientes registrados</p>
      </div>
    );
  }

  return (
    <div className="TablaPacientesMedicalCare-container">
      <div className="TablaPacientesMedicalCare-header">
        <h3>Pacientes Importados</h3>
        <span className="TablaPacientesMedicalCare-total">
          Total: {pacientes.length} registros (página {pagina + 1})
        </span>
      </div>

      <div className="TablaPacientesMedicalCare-tableWrapper">
        <table className="TablaPacientesMedicalCare-table">
          <thead>
            <tr>
              <th>Cédula</th>
              <th>Paciente</th>
              <th>Dirección</th>
              <th>Municipio</th>
              <th>Departamento</th>
              <th>Celular</th>
              <th>Sede</th>
              <th>CEDI</th>
              <th>Ruta</th>
              <th>Fecha Carga</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((paciente, index) => (
              <tr key={paciente._id || index} className={index % 2 === 0 ? 'par' : 'impar'}>
                <td>{paciente.cedula}</td>
                <td>{paciente.paciente}</td>
                <td>{paciente.direccion || '-'}</td>
                <td>{paciente.municipio || '-'}</td>
                <td>{paciente.departamento || '-'}</td>
                <td>{paciente.celular || '-'}</td>
                <td>{paciente.sede || '-'}</td>
                <td>{paciente.cedi || '-'}</td>
                <td>{paciente.ruta || '-'}</td>
                <td>{paciente.fecha_carga}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="TablaPacientesMedicalCare-pagination">
        <button
          onClick={() => setPagina(p => Math.max(0, p - 1))}
          disabled={pagina === 0}
          className="TablaPacientesMedicalCare-paginaBtn"
        >
          Anterior
        </button>
        <span className="TablaPacientesMedicalCare-paginaInfo">
          Página {pagina + 1}
        </span>
        <button
          onClick={() => setPagina(p => p + 1)}
          disabled={pacientes.length < porPagina}
          className="TablaPacientesMedicalCare-paginaBtn"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default TablaPacientesMedicalCare;