'use client';
import React, { useContext, useRef, useState } from "react";
import Cookies from "js-cookie";
import Swal from "sweetalert2";
import { FaUpload } from "react-icons/fa";
import { ContextoApp } from "@/Contexto/index";
import VerCaraDocumento from "@/Componentes/VerCaraDocumento";
import VerDocumento from "@/Componentes/VerDocumento";
import { Vehiculo } from "../tipos";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Documentos mostrados como tarjetas (las de Seguridad van aparte, abajo).
   La Hoja de Vida Física NO está aquí: tiene su propia tarjeta con botón de
   subida — la carga Seguridad (casos históricos con autorización en papel),
   no el conductor. */
const DOCUMENTOS_DISPLAY = [
  { key: "documentoIdentidadConductor", label: "Cédula Conductor", dosCaras: true },
  { key: "licencia", label: "Licencia Conducción", dosCaras: true },
  { key: "tarjetaPropiedad", label: "Tarjeta Propiedad", dosCaras: true },
  { key: "soat", label: "SOAT" },
  { key: "revisionTecnomecanica", label: "Tecnomecánica" },
  { key: "tarjetaRemolque", label: "Tarjeta Remolque" },
  { key: "polizaResponsabilidad", label: "Póliza Resp." },
  { key: "condFoto", label: "Foto Conductor (App)" },
  { key: "fotoconductorseguridad", label: "Foto Conductor (Seguridad)" },
  { key: "planillaEpsArl", label: "Planilla de Seguridad Social" },
  { key: "documentoIdentidadTenedor", label: "Cédula Tenedor", dosCaras: true },
  { key: "documentoIdentidadPropietario", label: "Cédula Propietario", dosCaras: true },
  { key: "documentoIdentidadRemolque", label: "Cédula Dueño Remolque", dosCaras: true },
  { key: "rutTenedor", label: "RUT Tenedor" },
  { key: "rutPropietario", label: "RUT Propietario (empresa)" },
  { key: "condCertificacionBancaria", label: "Cert. Bancaria Cond." },
  { key: "tenedCertificacionBancaria", label: "Cert. Bancaria Tened." },
];

interface DocAbierto {
  tipo: 'dosCaras' | 'galeria';
  frente?: string;
  reverso?: string;
  urls?: string[];
  etiqueta: string;
}

const PestanaDocumentos: React.FC<{ veh: Vehiculo; alCambiar: (mensaje: string) => void }> = ({ veh, alCambiar }) => {
  const almacenVariables = useContext(ContextoApp);
  if (!almacenVariables) throw new Error("Contexto no disponible");
  const { verDocumento, setVerDocumento } = almacenVariables;

  const [docAbierto, setDocAbierto] = useState<DocAbierto | null>(null);
  const inputHV = useRef<HTMLInputElement | null>(null);

  /* Hoja de Vida Física: la sube SEGURIDAD desde acá (PDF o imagen firmada).
     No baja un aprobado a re-revisión (excepción backend) — es un adjunto de
     archivo histórico, no un dato del conductor. */
  const subirHojaVida = async (archivo: File) => {
    if (!/^(image\/|application\/pdf)/.test(archivo.type)) {
      Swal.fire('Archivo no válido', 'Sube el PDF o una imagen de la hoja de vida firmada.', 'warning');
      return;
    }
    Swal.fire({ title: 'Subiendo Hoja de Vida…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const body = new FormData();
      body.append('placa', veh.placa);
      body.append('tipo', 'hojaVidaFisica');
      body.append('archivo', archivo);
      const nombre = Cookies.get('seguridadNombre');
      if (nombre) body.append('editado_por', nombre);
      const resp = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo subir la hoja de vida.');
      alCambiar(`Hoja de Vida Física cargada en ${veh.placa}`);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo subir la hoja de vida.', 'error');
    }
  };

  const abrirDosCaras = (frente: string | undefined, campoBase: string, etiqueta: string) => {
    if (!frente) return;
    setDocAbierto({
      tipo: 'dosCaras',
      frente,
      reverso: veh[`${campoBase}Reverso`] as string | undefined,
      etiqueta,
    });
  };

  const cerrar = () => {
    setDocAbierto(null);
    setVerDocumento(false);
  };

  const fotos = Array.isArray(veh.fotos)
    ? veh.fotos.filter((u: any) => u && String(u).trim())
    : [];

  return (
    <div className="rev-detalle-scroll">
      {/* Foto del conductor tomada por Seguridad (el estudio de seguridad
          vive en la pestaña Estudios). */}
      {veh.fotoconductorseguridad && (
        <div className="rev-docs-seguridad">
          <div
            className="rev-doc-card rev-doc-card--seguridad"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.fotoconductorseguridad, etiqueta: 'Foto del Conductor (Seguridad)', reverso: undefined })}
          >
            <p>📷 Foto Conductor (Seguridad)</p>
            <span>Ver</span>
          </div>
        </div>
      )}

      <div className="grid-documentos">
        {veh.firmaUrl && (
          <div
            className="documento-card"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.firmaUrl, etiqueta: 'Firma del Conductor', reverso: undefined })}
          >
            <p>✍️ Firma Conductor</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        )}

        {fotos.length > 0 && (
          <div
            className="documento-card documento-card--fotos"
            onClick={() => {
              setDocAbierto({ tipo: 'galeria', urls: fotos, etiqueta: 'Fotos del vehículo' });
              setVerDocumento(true);
            }}
          >
            <p>📸 Fotos del Vehículo ({fotos.length})</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        )}

        {/* Hoja de Vida FÍSICA: documento que sube Seguridad (autorización en
            papel de los casos históricos) — el conductor ya no la ve en su
            paso 3. Sin archivo → botón de carga directo. */}
        {veh.hojaVidaFisica ? (
          <div
            className="documento-card"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.hojaVidaFisica as string, etiqueta: 'Hoja de Vida Física', reverso: undefined })}
          >
            <p className="font-medium">📄 Hoja de Vida Física</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        ) : (
          <div
            className="documento-card"
            onClick={() => inputHV.current?.click()}
            title="Subir la hoja de vida firmada (solo la carga Seguridad)"
          >
            <p className="font-medium"><FaUpload /> Hoja de Vida Física</p>
            <span className="text-xs text-blue-600">Cargar</span>
          </div>
        )}
        <input
          ref={inputHV}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = ''; // permitir re-elegir el mismo archivo
            if (archivo) subirHojaVida(archivo);
          }}
        />

        {DOCUMENTOS_DISPLAY.map((doc) => {
          const url = veh[doc.key] as string | undefined;

          if (doc.dosCaras && url && typeof url === 'string') {
            return (
              <div key={doc.key} className="documento-card" onClick={() => abrirDosCaras(url, doc.key, doc.label)}>
                <p className="font-medium">{doc.label}</p>
                <span className="text-xs text-blue-600">{veh[`${doc.key}Reverso`] ? 'Frente/Reverso' : 'Ver'}</span>
              </div>
            );
          }
          if (url && typeof url === 'string') {
            return (
              <div key={doc.key} className="documento-card" onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: url, etiqueta: doc.label, reverso: undefined })}>
                <p className="font-medium">{doc.label}</p>
                <span className="text-xs text-blue-600">Ver</span>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Visores (en app, no window.open): dos caras con giro, fotos en carrusel. */}
      {docAbierto?.tipo === 'dosCaras' && docAbierto.frente && (
        <VerCaraDocumento
          frenteUrl={docAbierto.frente}
          reversoUrl={docAbierto.reverso}
          etiqueta={docAbierto.etiqueta}
          unaCara={!docAbierto.reverso}
          onClose={cerrar}
        />
      )}
      {docAbierto?.tipo === 'galeria' && verDocumento && (
        <VerDocumento
          urls={docAbierto.urls || []}
          placa={veh.placa}
          soloLectura
          onClose={cerrar}
          onDeleteSuccess={() => undefined}
        />
      )}
    </div>
  );
};

export default PestanaDocumentos;
