'use client';
import React, { useContext, useState } from "react";
import { ContextoApp } from "@/Contexto/index";
import VerCaraDocumento from "@/Componentes/VerCaraDocumento";
import VerDocumento from "@/Componentes/VerDocumento";
import { Vehiculo } from "../tipos";

/* Documentos mostrados como tarjetas (las de Seguridad van aparte, abajo). */
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
  { key: "planillaEpsArl", label: "Planilla EPS/ARL" },
  { key: "documentoIdentidadTenedor", label: "Cédula Tenedor", dosCaras: true },
  { key: "documentoIdentidadPropietario", label: "Cédula Propietario", dosCaras: true },
  { key: "rutTenedor", label: "RUT Tenedor" },
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

const PestanaDocumentos: React.FC<{ veh: Vehiculo }> = ({ veh }) => {
  const almacenVariables = useContext(ContextoApp);
  if (!almacenVariables) throw new Error("Contexto no disponible");
  const { verDocumento, setVerDocumento } = almacenVariables;

  const [docAbierto, setDocAbierto] = useState<DocAbierto | null>(null);

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
      {/* Estudio y foto de Seguridad (propios del área). */}
      <div className="rev-docs-seguridad">
        {veh.estudioSeguridad ? (
          <div
            className="rev-doc-card rev-doc-card--seguridad"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.estudioSeguridad, etiqueta: 'Estudio de Seguridad', reverso: undefined })}
          >
            <p>🛡️ Estudio de Seguridad</p>
            <span>Ver</span>
          </div>
        ) : (
          <div className="rev-doc-card rev-doc-card--falta"><p>🛡️ Estudio de Seguridad</p><span>Sin cargar</span></div>
        )}
        {veh.fotoconductorseguridad && (
          <div
            className="rev-doc-card rev-doc-card--seguridad"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.fotoconductorseguridad, etiqueta: 'Foto del Conductor (Seguridad)', reverso: undefined })}
          >
            <p>📷 Foto Conductor (Seguridad)</p>
            <span>Ver</span>
          </div>
        )}
      </div>

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
