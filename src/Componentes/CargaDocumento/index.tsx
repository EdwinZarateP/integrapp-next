'use client';
import React, { useRef, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import Lottie from 'lottie-react';
import animationData from "@/Imagenes/AnimationPuntos.json";
import { tiposMapping } from '@/Funciones/documentConstants';
import './estilos.css';

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/* Documentos de DOS CARAS en el paso 3: tras elegir el frente se pide el
   reverso y AMBOS suben en un solo request (obligatorio para TODAS las
   cédulas, la licencia y la tarjeta de propiedad — 2026-08-27). */
const TIPOS_DOS_CARAS = [
  'documentoIdentidadConductor', 'documentoIdentidadPropietario', 'documentoIdentidadTenedor',
  'licencia', 'tarjetaPropiedad',
];

interface CargaDocumentoProps {
  documentName: string;
  endpoint: string;
  placa: string;
  /** idUsuario cuando se edita un vehículo aprobado (baja a re-revisión). */
  editadoPor?: string;
  /** Tipos gemelos (figuras iguales) donde replicar la URL subida. */
  replicarEn?: string[];
  /** Tope TOTAL de archivos permitidos (ej. fotos del vehículo: máx. 10). */
  maximo?: number;
  /** Cuántos hay ya subidos (para respetar el tope con esta tanda). */
  cantidadActual?: number;
  onClose: () => void;
  onUploadSuccess?: (result: string | string[], urlReverso?: string) => void;
}

interface UploadResponse {
  urls?: string[];
  url?: string;
  url_reverso?: string;
  lectura_ia?: { datos?: Record<string, any>; avisos?: string[] } | null;
}


const CargaDocumento: React.FC<CargaDocumentoProps> = ({
  documentName,
  endpoint,
  placa,
  editadoPor,
  replicarEn,
  maximo,
  cantidadActual,
  onClose,
  onUploadSuccess,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFileNames, setSelectedFileNames] = useState<string>("Ningún archivo seleccionado");
  // Dos caras: frente elegido esperando que se elija el reverso.
  const frentePendienteRef = useRef<File | null>(null);
  const inputReversoRef = useRef<HTMLInputElement>(null);

  const tipoDoc = tiposMapping[documentName.trim().toLowerCase()] || '';
  const esDosCaras = TIPOS_DOS_CARAS.includes(tipoDoc);

  const validarArchivo = (file: File): boolean => {
    if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)) {
      Swal.fire({ icon: 'error', title: 'Formato no válido', text: 'Solo se permiten archivos de imagen (jpg, jpeg, png) o PDF.' });
      return false;
    }
    if (file.size > MAX_SIZE_BYTES) {
      Swal.fire({ icon: 'error', title: 'Archivo muy pesado', text: `Cada archivo debe pesar máximo ${MAX_SIZE_MB} MB. Revisa: ${file.name}` });
      return false;
    }
    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        setSelectedFileNames(files.map(file => file.name).join(", "));
      } else {
        setSelectedFileNames("Ningún archivo seleccionado");
      }
      const validFiles = files.filter(file =>
        ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)
      );
      if (validFiles.length === 0) {
        Swal.fire({ icon: 'error', title: 'Formato no válido', text: 'Solo se permiten archivos de imagen (jpg, jpeg, png) o PDF.' });
        return;
      }
      const tooBig = validFiles.filter(file => file.size > MAX_SIZE_BYTES);
      if (tooBig.length > 0) {
        Swal.fire({ icon: 'error', title: 'Archivo muy pesado', text: `Cada archivo debe pesar máximo ${MAX_SIZE_MB} MB. Revisa: ${tooBig.map(f => f.name).join(', ')}` });
        return;
      }
      // Tope total (fotos del vehículo): las ya subidas + esta tanda.
      if (maximo != null && (cantidadActual ?? 0) + validFiles.length > maximo) {
        Swal.fire({
          icon: 'warning',
          title: 'Demasiadas fotos',
          text: `Máximo ${maximo} fotos del vehículo. Ya tienes ${cantidadActual ?? 0}; puedes subir hasta ${Math.max(maximo - (cantidadActual ?? 0), 0)} más.`,
        });
        return;
      }
      // Dos caras (licencia/tarjeta): el FRENTE queda listo y se pide el
      // REVERSO a continuación — ambos suben juntos en un solo request.
      if (esDosCaras) {
        frentePendienteRef.current = validFiles[0];
        const etiqueta = documentName.toLowerCase();
        const res = await Swal.fire({
          icon: 'info',
          title: 'Ahora el REVERSO',
          html: `El <b>frente</b> de la ${etiqueta} está listo.<br/>Este documento tiene <b>dos caras</b> y ambas son obligatorias: elige ahora la foto o PDF del <b>reverso</b>.`,
          showCancelButton: true,
          confirmButtonText: 'Elegir reverso',
          cancelButtonText: 'Solo el frente',
          confirmButtonColor: '#2c5f9e',
          allowOutsideClick: false,
        });
        if (res.isConfirmed) {
          setTimeout(() => inputReversoRef.current?.click(), 0);
        } else {
          const frente = frentePendienteRef.current;
          frentePendienteRef.current = null;
          if (frente) await handleUpload([frente]);
        }
        return;
      }
      await handleUpload(validFiles);
    }
  };

  // Reverso elegido del documento de dos caras: subir frente+reverso juntos.
  const manejarReversoElegido = async () => {
    const reverso = inputReversoRef.current?.files?.[0] || null;
    if (inputReversoRef.current) inputReversoRef.current.value = '';
    const frente = frentePendienteRef.current;
    frentePendienteRef.current = null;
    if (!frente) return;
    if (reverso && !validarArchivo(reverso)) {
      await handleUpload([frente]);
      return;
    }
    await handleUpload([frente], reverso || undefined);
  };

  const handleUpload = async (files: File[], reverso?: File) => {
    const formData = new FormData();
    const key = documentName === "Fotos" ? 'archivos' : 'archivo';
    files.forEach(file => formData.append(key, file));
    if (reverso) formData.append('reverso', reverso);
    formData.append('placa', placa);
    if (editadoPor) formData.append('editado_por', editadoPor);

    const lower = documentName.toLowerCase();
    const tipo = tiposMapping[lower] || lower.replace(/\s+/g, "_");
    formData.append('tipo', tipo);
    if (replicarEn && replicarEn.length > 0 && tipo !== 'fotos') {
      formData.append('replicar_en', replicarEn.join(','));
    }

    setUploading(true);
    setProgress(0);
    try {
      const response = await axios.put<UploadResponse>(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const pct = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setProgress(Math.min(pct, 99));
        }
      });

      if (response.status === 200) {
        setProgress(100);
        let result = response.data.urls || response.data.url;
        if (result && onUploadSuccess) {
            if (Array.isArray(result)) {
                const cleanResult = result.filter(u => u && u !== "null" && u !== "undefined" && u.trim() !== "");
                onUploadSuccess(cleanResult, response.data.url_reverso);
            } else {
                onUploadSuccess(result, response.data.url_reverso);
            }
        }
        // Lectura IA: el backend ya persistió los datos en lecturasIA; se
        // aplican al abrir el paso 2 (Datos). Solo se informa aquí.
        const lectura = response.data.lectura_ia;
        if (lectura && lectura.datos && Object.keys(lectura.datos).length > 0) {
          const avisos = (lectura.avisos || []);
          const htmlAvisos = avisos.length
            ? `<div style="text-align:left; margin-top:8px; font-size:0.85em;">${avisos.map(a => `<div>${a}</div>`).join('')}</div>`
            : '';
          Swal.fire({
            icon: 'success',
            title: 'Documento leído con IA',
            html: `Extraimos <b>${Object.keys(lectura.datos).length}</b> dato(s) del documento.<br/>
                   Se usarán para <b>autollenar el formulario</b> del paso 2 (los que estén vacíos).${htmlAvisos}`,
            confirmButtonColor: '#27ae60',
            timer: 6000,
          });
        }
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error al subir el documento.' });
      }
    } catch (error: any) {
      console.error('Error de carga:', error);
      Swal.fire({ icon: 'error', title: 'Error al subir', text: error?.message || 'No se pudo subir el documento.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="CargaDocumento-overlay">
      <div className="CargaDocumento-modal">
        <h2>Cargar {documentName}</h2>
        {documentName === "Fotos" && (
          <p className="CargaDocumento-hint">
            Fotos del vehículo: <b>mínimo 1</b> y <b>máximo {maximo ?? 10}</b> en total
            {cantidadActual ? <> — ya tienes <b>{cantidadActual}</b></> : ''}.
          </p>
        )}
        {esDosCaras && (
          <p className="CargaDocumento-hint">
            Este documento tiene <b>dos caras</b>: primero eliges el <b>frente</b> y luego
            te pediremos el <b>reverso</b> — suben juntos.
          </p>
        )}
        <div className="CargaDocumento-file-input-wrapper">
          <label className="CargaDocumento-btn-file" htmlFor="file-upload">
            {documentName === "Fotos" ? "Elegir Archivos" : "Elegir Archivo"}
          </label>
          <span className="CargaDocumento-file-text">
            {selectedFileNames}
          </span>
          <input
            id="file-upload"
            type="file"
            accept="image/jpeg, image/png, image/jpg, application/pdf"
            multiple={documentName === "Fotos"}
            onChange={handleFileChange}
            disabled={uploading}
            className="CargaDocumento-input-hidden"
          />
          {/* Reverso del documento de dos caras (elegido tras el frente). */}
          <input
            ref={inputReversoRef}
            type="file"
            accept="image/jpeg, image/png, image/jpg, application/pdf"
            onChange={manejarReversoElegido}
            disabled={uploading}
            className="CargaDocumento-input-hidden"
            style={{ display: 'none' }}
          />
        </div>
        {uploading && (
          <div className="CargaDocumento-uploading-container">
            <p className="CargaDocumento-mensaje-subiendo">Subiendo...</p>
            <Lottie animationData={animationData} style={{ height: 200, width: '100%', margin: 'auto' }} />
          </div>
        )}
        {progress === 100 && !uploading && (
          <div className="CargaDocumento-mensaje-progreso">¡Carga completa!</div>
        )}
        <button className="CargaDocumento-btn-cerrar" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default CargaDocumento;
