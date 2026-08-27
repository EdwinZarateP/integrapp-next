'use client';
import React, { useContext, useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import Lottie from "lottie-react";
import animationData from "@/Imagenes/AnimationPuntos.json";
import { ContextoApp } from "@/Contexto/index";
import "./estilos.css";

interface VerDocumentoProps {
  urls: string[];
  placa: string;
  onDeleteSuccess: (nuevasUrls: string[]) => void;
  onClose: () => void;
  /** URL del REVERSO cuando el documento tiene dos caras (cédula/licencia/
   *  tarjeta): activa el botón «🔄 Girar para ver el respaldo». */
  reversoUrl?: string;
  /** Modo SOLO LECTURA (ej. /revision de Seguridad): oculta el botón 🗑 y no
   *  dispara eliminaciones. Default false = flujo del conductor intacto. */
  soloLectura?: boolean;
}

const API_BASE_URL = "https://integrappi-dvmh.onrender.com/vehiculos";

const VerDocumento: React.FC<VerDocumentoProps> = ({ urls, placa, onDeleteSuccess, onClose, reversoUrl, soloLectura = false }) => {
  const almacenVariables = useContext(ContextoApp);
  if (!almacenVariables) {
    throw new Error("El contexto no está disponible. Asegúrate de envolver el componente en un proveedor de contexto.");
  }
  const { verDocumento } = almacenVariables;

  const [documentos, setDocumentos] = useState<string[]>(urls);
  const [cargando, setCargando] = useState(true);
  // Cara visible cuando el documento tiene reverso (frente ↔ respaldo).
  const [viendoReverso, setViendoReverso] = useState(false);
  // Carrusel de fotos: se muestra UNA imagen a la vez (índice de la actual).
  const [indiceActual, setIndiceActual] = useState(0);
  // Pista con scroll-snap: arrastre horizontal (dedo/trackpad) pasa de foto,
  // como la galería de Airbnb. Las flechas scrollean la pista programáticamente.
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocumentos(urls);
    setViendoReverso(false);
    setIndiceActual(0);
    if (trackRef.current) trackRef.current.scrollTo({ left: 0 });
  }, [urls]);

  // Al eliminar una foto el array se acorta: mantener el índice dentro de rango.
  useEffect(() => {
    setIndiceActual(i => Math.min(i, Math.max(documentos.length - 1, 0)));
  }, [documentos]);

  const irAFoto = (indice: number) => {
    const nuevo = Math.max(0, Math.min(indice, documentos.length - 1));
    setIndiceActual(nuevo);
    const pista = trackRef.current;
    if (pista) pista.scrollTo({ left: nuevo * pista.clientWidth, behavior: 'smooth' });
  };

  // El usuario arrastra la pista: el contador sigue a la foto visible.
  const manejarScrollPista = () => {
    const pista = trackRef.current;
    if (!pista || pista.clientWidth === 0) return;
    const visible = Math.round(pista.scrollLeft / pista.clientWidth);
    if (visible !== indiceActual) setIndiceActual(visible);
  };

  useEffect(() => {
    const timer = setTimeout(() => setCargando(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!verDocumento) return null;

  const esImagen = (url: string): boolean => {
    const urlSinQuery = url.split("?")[0].toLowerCase();
    const extensiones = [".png", ".jpg", ".jpeg", ".webp"];
    return extensiones.some(ext => urlSinQuery.endsWith(ext));
  };

  const obtenerNombreArchivo = (url: string): string => {
    const cleanUrl = url.split("?")[0];
    return cleanUrl.split("/").pop() || "Documento.pdf";
  };

  const obtenerTipoDocumentoDesdeUrl = (url: string): string | null => {
    const mappingTipos: Record<string, string> = {
      "tarjetaPropiedad": "tarjetaPropiedad",
      "soat": "soat",
      "revisionTecnomecanica": "revisionTecnomecanica",
      "tarjetaRemolque": "tarjetaRemolque",
      "fotos": "fotos",
      "polizaResponsabilidad": "polizaResponsabilidad",
      "documentoIdentidadConductor": "documentoIdentidadConductor",
      "documentoIdentidadPropietario": "documentoIdentidadPropietario",
      "documentoIdentidadTenedor": "documentoIdentidadTenedor",
      "licencia": "licencia",
      "planillaEps": "planillaEps",
      "planillaArl": "planillaArl",
      "condFoto": "condFoto",
      "planillaEpsArl": "planillaEpsArl",
      "condCertificacionBancaria": "condCertificacionBancaria",
      "propCertificacionBancaria": "propCertificacionBancaria",
      "tenedCertificacionBancaria": "tenedCertificacionBancaria",
      "documentoAcreditacionTenedor": "documentoAcreditacionTenedor",
      "rutTenedor": "rutTenedor",
      "rutPropietario": "rutPropietario"
    };

    const partes = url.split("/").pop()?.split("_");
    const nombreArchivo = partes ? partes[0] : null;
    if (!nombreArchivo) return null;

    if (nombreArchivo.toLowerCase() === "foto") {
      return "fotos";
    }
    return mappingTipos[nombreArchivo] || null;
  };

  const handleEliminarDocumento = async (urlAEliminar: string) => {
    const confirmacion = await Swal.fire({
      title: "¿Eliminar documento?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar"
    });
    if (!confirmacion.isConfirmed) return;

    try {
      const urlLimpia = urlAEliminar.split("?")[0];
      const tipoDocumento = obtenerTipoDocumentoDesdeUrl(urlLimpia);

      if (!tipoDocumento) {
        console.warn("Tipo de documento no detectado; usando PDF por defecto.");
        const response = await axios.delete(
          `${API_BASE_URL}/eliminar-documento?placa=${placa}&tipo=pdf`
        );
        if (response.status === 200) {
          Swal.fire("Eliminado", "El documento ha sido eliminado", "success");
          const nuevas = documentos.filter((doc) => doc !== urlAEliminar);
          setDocumentos(nuevas);
          onDeleteSuccess(nuevas);
        } else {
          throw new Error("No se pudo eliminar el documento.");
        }
        return;
      }

      let deleteEndpoint = "";
      if (tipoDocumento === "fotos") {
        deleteEndpoint = `${API_BASE_URL}/eliminar-foto?placa=${placa}&url=${encodeURIComponent(urlLimpia)}`;
      } else {
        deleteEndpoint = `${API_BASE_URL}/eliminar-documento?placa=${placa}&tipo=${tipoDocumento}`;
      }

      const response = await axios.delete(deleteEndpoint);
      if (response.status === 200) {
        Swal.fire("Eliminado", "El documento ha sido eliminado", "success");
        const nuevas = documentos.filter((doc) => doc !== urlAEliminar);
        setDocumentos(nuevas);
        onDeleteSuccess(nuevas);
      } else {
        throw new Error("No se pudo eliminar el documento.");
      }
    } catch (error) {
      console.error("Error al eliminar el documento:", error);
      Swal.fire("Error", "No se pudo eliminar el documento", "error");
    }
  };

  return (
    <div
      className="VerDocumento-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="VerDocumento-contenedor">
        <button className="VerDocumento-boton-cerrar" onClick={onClose}>✖</button>

        {cargando ? (
          <div className="VerDocumento-carga">
            <Lottie animationData={animationData} style={{ height: 200, width: "100%", margin: "auto" }} />
            <p className="VerDocumento-texto-carga">Cargando documento...</p>
          </div>
        ) : (
          <>
            {/* Documento de dos caras: girar entre frente y respaldo SIN salir
                del visor (más intuitivo que elegir la cara antes de ver). */}
            {reversoUrl && (
              <button
                type="button"
                className="VerDocumento-boton-girar"
                onClick={() => setViendoReverso(v => !v)}
              >
                {viendoReverso ? '↩️ Volver al frente' : '🔄 Girar para ver el respaldo'}
              </button>
            )}

            {viendoReverso && reversoUrl ? (
              /* Respaldo: solo lectura (eliminar-documento borra ambas caras). */
              <div className="VerDocumento-galeria" key={reversoUrl}>
                <div className="VerDocumento-imagen-container VerDocumento-cara-girada">
                  <span className="VerDocumento-cara-etiqueta">Reverso</span>
                  {esImagen(reversoUrl) ? (
                    <img src={reversoUrl} alt="Reverso del documento" className="VerDocumento-imagen" />
                  ) : (
                    <div className="VerDocumento-pdf-line">
                      <span className="VerDocumento-pdf-nombre">{obtenerNombreArchivo(reversoUrl)}</span>
                      <a
                        href={reversoUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="VerDocumento-pdf-descargar"
                      >
                        Descargar
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="VerDocumento-galeria">
                {documentos.length > 1 ? (
                  /* VARIAS fotos: carrusel con SCROLL-SNAP — arrastrar a los
                     lados pasa de foto (dedo/trackpad, estilo Airbnb), una a
                     la vez. Las flechas y el contador siguen sincronizados. */
                  <div className="VerDocumento-carrusel">
                    <div className="VerDocumento-carrusel-wrap">
                      {/* Flechas SUPERPUESTAS a los lados de la foto; en los
                          extremos NO se muestran (primera → sin ◀, última → sin ▶). */}
                      {indiceActual > 0 && (
                        <button
                          type="button"
                          className="VerDocumento-carrusel-flecha VerDocumento-carrusel-flecha--izq"
                          onClick={() => irAFoto(indiceActual - 1)}
                          title="Foto anterior"
                          aria-label="Foto anterior"
                        >
                          ◀
                        </button>
                      )}
                      {indiceActual < documentos.length - 1 && (
                        <button
                          type="button"
                          className="VerDocumento-carrusel-flecha VerDocumento-carrusel-flecha--der"
                          onClick={() => irAFoto(indiceActual + 1)}
                          title="Foto siguiente"
                          aria-label="Foto siguiente"
                        >
                          ▶
                        </button>
                      )}
                    <div className="VerDocumento-carrusel-track" ref={trackRef} onScroll={manejarScrollPista}>
                      {documentos.map((url, i) => (
                        <div className="VerDocumento-carrusel-slide" key={url}>
                          <div className="VerDocumento-imagen-container">
                            {esImagen(url) ? (
                              <>
                                <img
                                  src={url}
                                  alt={`Foto ${i + 1} de ${documentos.length}`}
                                  className="VerDocumento-imagen"
                                  draggable={false}
                                />
                                {i === indiceActual && !soloLectura && (
                                  <button
                                    className="VerDocumento-boton-eliminar"
                                    onClick={() => handleEliminarDocumento(url)}
                                    title="Eliminar esta foto"
                                  >
                                    🗑
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="VerDocumento-pdf-line">
                                <span className="VerDocumento-pdf-nombre">{obtenerNombreArchivo(url)}</span>
                                <a
                                  href={url}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="VerDocumento-pdf-descargar"
                                >
                                  Descargar
                                </a>
                                {i === indiceActual && !soloLectura && (
                                  <button
                                    className="VerDocumento-boton-eliminar"
                                    onClick={() => handleEliminarDocumento(url)}
                                    title="Eliminar este archivo"
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>

                    <div className="VerDocumento-carrusel-controles">
                      <span className="VerDocumento-contador">
                        {indiceActual + 1} de {documentos.length}
                      </span>
                    </div>
                  </div>
                ) : (
                  documentos.map((url, index) => (
                    <div key={index} className="VerDocumento-imagen-container">
                      {esImagen(url) ? (
                        <>
                          <img
                            src={`${url}?t=${new Date().getTime()}`}
                            alt={`Documento ${index + 1}`}
                            className="VerDocumento-imagen"
                          />
                          {!soloLectura && (
                          <button
                            className="VerDocumento-boton-eliminar"
                            onClick={() => handleEliminarDocumento(url)}
                          >
                            🗑
                          </button>
                          )}
                        </>
                      ) : (
                        <div className="VerDocumento-pdf-line">
                          <span className="VerDocumento-pdf-nombre">{obtenerNombreArchivo(url)}</span>
                          <a
                            href={url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="VerDocumento-pdf-descargar"
                          >
                            Descargar
                          </a>
                          {!soloLectura && (
                          <button
                            className="VerDocumento-boton-eliminar"
                            onClick={() => handleEliminarDocumento(url)}
                          >
                            🗑
                          </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VerDocumento;
