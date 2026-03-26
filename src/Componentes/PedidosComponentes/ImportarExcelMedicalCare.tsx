'use client';
import React, { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { cargarPacientesMasivo } from '@/Funciones/ApiPedidos/apiMedicalCare';
import type { CargarPacientesResponse } from '@/Funciones/ApiPedidos/tiposMedicalCare';
import './ImportarExcelMedicalCare.css';

interface ImportarExcelMedicalCareProps {
  onCargarExitoso?: () => void;
}

const ImportarExcelMedicalCare: React.FC<ImportarExcelMedicalCareProps> = ({ onCargarExitoso }) => {
  const [autorizado, setAutorizado] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const perfil = Cookies.get('perfilPedidosCookie');
    if (perfil === 'ADMIN' || perfil === 'OPERATIVO') {
      setAutorizado(true);
    }
  }, []);

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0] ?? null;
    if (!archivo) return;

    const usuario = Cookies.get('usuarioPedidosCookie');
    if (!usuario) {
      Swal.fire('Error', 'Usuario no válido.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res: CargarPacientesResponse = await cargarPacientesMasivo(usuario, archivo);

      const segundos = Math.round(res.tiempo_segundos);
      
      if (res.registros_con_errores > 0) {
        // Hay errores pero se cargó parcialmente
        Swal.fire({
          icon: 'warning',
          title: 'Carga con advertencias',
          html: `
            <div style="text-align: left;">
              <p><b>Registros exitosos:</b> ${res.registros_exitosos}</p>
              <p><b>Registros con errores:</b> ${res.registros_con_errores}</p>
              <p><b>Tiempo:</b> ${segundos} s</p>
              <p style="margin-top: 10px; font-size: 12px; color: #666;">
                ${res.errores ? res.errores.slice(0, 10).join('<br/>') : ''}
                ${res.errores && res.errores.length > 10 ? '<br/>... (y más errores)' : ''}
              </p>
            </div>
          `,
          confirmButtonText: 'OK',
          width: 600
        }).then(() => {
          if (onCargarExitoso) onCargarExitoso();
        });
      } else {
        // Éxito total
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          html: `
            ${res.mensaje}<br/>
            <b>Tiempo:</b> ${segundos} s
          `,
          confirmButtonText: 'OK'
        }).then(() => {
          if (onCargarExitoso) onCargarExitoso();
        });
      }

    } catch (err: any) {
      console.error('Error de API:', err.response?.data);

      let data = err.response?.data?.detail ?? err.response?.data;

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // If not valid JSON, leave as string
        }
      }

      if (typeof data === 'string') {
        Swal.fire('Error', data, 'error');
      } else if (data?.errores && Array.isArray(data.errores)) {
        Swal.fire({
          title: data.mensaje || 'Errores en el archivo',
          html: `<ul style="text-align:left">${data.errores
            .map((e: string) => `<li>${e}</li>`)
            .join('')}</ul>`,
          icon: 'error',
          width: 600
        });
      } else {
        const msg = data?.mensaje || err.response?.statusText || err.message;
        Swal.fire('Error', msg, 'error');
      }
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const lanzarSelector = () => {
    if (inputRef.current) inputRef.current.click();
  };

  if (!autorizado) return null;

  return (
    <div className="ImportarExcelMedicalCare-contenedor">
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".xlsx,.xls,.xlsm"
        onChange={handleArchivo}
        disabled={loading}
      />
      <button
        className="ImportarExcelMedicalCare-boton"
        onClick={lanzarSelector}
        disabled={loading}
      >
        {loading ? 'Cargando...' : 'Importar Excel'}
      </button>
    </div>
  );
};

export default ImportarExcelMedicalCare;