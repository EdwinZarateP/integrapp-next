"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaFingerprint, FaShieldAlt, FaTimesCircle } from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import "./estilos.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface FuentePublica {
  codigo: string;
  nombre: string;
  estado: string;
}

interface Verificacion {
  valido: boolean;
  consulta_id?: string;
  estado?: string;
  fecha?: string;
  empresa?: string;
  cedula?: string;
  fuentes?: FuentePublica[];
  huella_documento?: string;
}

const ESTADOS: Record<string, string> = {
  COMPLETADA: "Estudio completado",
  COMPLETADA_CON_ADVERTENCIAS: "Completado con advertencias",
  PARCIAL: "Resultado parcial",
  ERROR: "No fue posible completar el estudio",
  EXITO: "Consultada correctamente",
  ADVERTENCIA: "Consultada con advertencia",
  NO_DISPONIBLE: "Fuente no disponible",
};

const claseEstado = (estado = "") => {
  if (estado === "COMPLETADA" || estado === "EXITO") return "ok";
  if (estado.includes("ADVERTENCIA") || estado === "PARCIAL") return "warning";
  return "error";
};

const fechaColombia = (valor?: string) => {
  if (!valor) return "No disponible";
  const fecha = new Date(valor.endsWith("Z") ? valor : `${valor}Z`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(fecha);
};

function ContenidoVerificacion() {
  const searchParams = useSearchParams();
  const [datos, setDatos] = useState<Verificacion | null>(null);
  const [cargando, setCargando] = useState(true);

  const consultaId = String(searchParams.get("consulta") || "").toUpperCase();
  const codigo = searchParams.get("codigo") || "";

  useEffect(() => {
    const controller = new AbortController();
    const verificar = async () => {
      if (!consultaId || !codigo) {
        setDatos({ valido: false });
        setCargando(false);
        return;
      }
      try {
        const url = `${API}/seguridad/estudios/verificar/${encodeURIComponent(consultaId)}?codigo=${encodeURIComponent(codigo)}`;
        const respuesta = await fetch(url, { signal: controller.signal, cache: "no-store" });
        setDatos(respuesta.ok ? await respuesta.json() : { valido: false });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setDatos(null);
      } finally {
        setCargando(false);
      }
    };
    verificar();
    return () => controller.abort();
  }, [codigo, consultaId]);

  const estadoClase = claseEstado(datos?.estado);

  return (
    <main className="VE-page">
      <header className="VE-header">
        <div className="VE-brand">
          <Image src={logo} alt="Integra Logística" width={44} height={44} priority />
          <div><strong>IntegrApp</strong><span>Integra Logística</span></div>
        </div>
        <div className="VE-secure"><FaShieldAlt /> Verificación segura</div>
      </header>

      <section className="VE-shell">
        {cargando ? (
          <div className="VE-card VE-loading">
            <div className="VE-spinner" />
            <h1>Verificando autenticidad</h1>
            <p>Estamos contrastando el código con el registro original.</p>
          </div>
        ) : datos?.valido ? (
          <div className="VE-card">
            <div className={`VE-result ${estadoClase}`}>
              {estadoClase === "ok" ? <FaCheckCircle /> : <FaExclamationTriangle />}
              <div>
                <span>Documento auténtico</span>
                <h1>{ESTADOS[datos.estado || ""] || datos.estado}</h1>
                <p>Este informe fue emitido por el módulo de Estudios de Seguridad de Integra Logística.</p>
              </div>
            </div>

            <div className="VE-grid">
              <div><span>Consulta</span><strong>{datos.consulta_id}</strong></div>
              <div><span>Fecha de emisión</span><strong>{fechaColombia(datos.fecha)}</strong></div>
              <div><span>Empresa solicitante</span><strong>{datos.empresa || "No disponible"}</strong></div>
              <div><span>Documento evaluado</span><strong>{datos.cedula || "No disponible"}</strong></div>
            </div>

            <div className="VE-section">
              <h2>Fuentes incluidas en el informe</h2>
              <p>La verificación pública confirma las fuentes consultadas, pero no revela sus resultados personales.</p>
              <div className="VE-sources">
                {(datos.fuentes || []).map((fuente) => (
                  <div className="VE-source" key={fuente.codigo}>
                    <span className={`VE-dot ${claseEstado(fuente.estado)}`} />
                    <div><strong>{fuente.nombre}</strong><span>{ESTADOS[fuente.estado] || fuente.estado}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {datos.huella_documento && (
              <div className="VE-hash">
                <FaFingerprint />
                <div><span>Huella digital SHA-256 del PDF</span><code>{datos.huella_documento}</code></div>
              </div>
            )}

            <div className="VE-privacy">
              Por protección de datos, esta página no publica antecedentes, viajes, vehículos ni certificados. El detalle permanece en el PDF privado entregado a la empresa solicitante.
            </div>
          </div>
        ) : datos ? (
          <div className="VE-card VE-invalid">
            <FaTimesCircle />
            <h1>No pudimos validar este documento</h1>
            <p>El identificador o el código de verificación no coincide con nuestros registros. Revise que el enlace esté completo o solicite nuevamente el documento original.</p>
            <span>Consulta recibida: {consultaId || "sin identificador"}</span>
          </div>
        ) : (
          <div className="VE-card VE-invalid">
            <FaExclamationTriangle />
            <h1>Servicio temporalmente no disponible</h1>
            <p>No fue posible conectar con el servicio de verificación. Intente nuevamente en unos minutos.</p>
          </div>
        )}
      </section>

      <footer className="VE-footer">Verificación pública · Datos mínimos · Integra Logística</footer>
    </main>
  );
}

export default function VerificarEstudio() {
  return (
    <Suspense fallback={<main className="VE-page" />}>
      <ContenidoVerificacion />
    </Suspense>
  );
}
