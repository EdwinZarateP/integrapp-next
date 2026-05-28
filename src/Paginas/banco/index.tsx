'use client';
import { useState, useRef } from 'react';
import './estilos.css';

const BancoPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      alert('Por favor selecciona un archivo PDF');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API}/banco/pdf-a-excel`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Error al procesar el PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = file.name.replace(/\.pdf$/i, '');
      a.download = `${baseName}_extracto.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert(error.message || 'Error al procesar el PDF');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="Banco-layout">
      <div className="Banco-main">
        <div className="Banco-card">
          <h1 className="Banco-title">Extracto Bancario</h1>
          <p className="Banco-subtitle">
            Convierte tu PDF de extracto bancario a Excel
          </p>

          <div
            className={`Banco-dropZone ${dragActive ? 'Banco-dropZoneActive' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="Banco-dropIcon">📄</div>
            <div className="Banco-dropText">
              Arrastra tu PDF aqui o haz clic para seleccionar
            </div>
            <div className="Banco-dropHint">Solo archivos PDF de Bancolombia</div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {file && (
            <div className="Banco-fileInfo">
              <span className="Banco-fileIcon">📎</span>
              <span className="Banco-fileName">{file.name}</span>
              <button className="Banco-fileRemove" onClick={handleRemoveFile}>✕</button>
            </div>
          )}

          <button
            className="Banco-btnProcess"
            onClick={handleProcess}
            disabled={!file || processing}
          >
            {processing ? 'Procesando...' : 'Convertir a Excel'}
          </button>
        </div>
      </div>

      <footer className="Banco-footer">
        <span className="Banco-footerText">Integra Logistica</span>
      </footer>
    </div>
  );
};

export default BancoPage;
