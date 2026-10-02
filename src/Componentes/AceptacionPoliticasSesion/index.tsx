'use client';
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import "./estilos.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Debe coincidir con DECLARACIONES_NO_EXIGIDAS del backend (conductores.py). */
const DECLARACION_NO_EXIGIDA = 'tratamiento_datos';

interface Declaracion {
  id: string;
  titulo: string;
  texto_html: string;
}

interface Politica {
  version: number;
  titulo?: string;
  texto_html?: string;
  declaraciones?: Declaracion[];
}

/**
 * Overlay BLOQUEANTE de aceptación de políticas para cuentas creadas por
 * Seguridad (alta por Seguridad, 2026-09-28): el conductor acepta las
 * declaraciones de vinculación en su PRIMER ingreso al panel — misma
 * evidencia trazable que la verificación por correo (canal alta_seguridad).
 */
const AceptacionPoliticasSesion: React.FC<{ onAceptada: () => void }> = ({ onAceptada }) => {
  const [politica, setPolitica] = useState<Politica | null>(null);
  const [aceptadas, setAceptadas] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get<Politica>(`${API_BASE}/conductores/politica-actual`)
      .then(r => setPolitica(r.data))
      .catch(() => setError("No se pudo cargar la política. Revisa tu conexión."));
  }, []);

  const declaraciones = politica?.declaraciones || [];
  const exigidas = declaraciones.filter(d => d.id !== DECLARACION_NO_EXIGIDA);
  const todasAceptadas = declaraciones.length > 0
    ? exigidas.every(d => aceptadas[d.id])
    : true;

  const aceptar = async () => {
    setEnviando(true);
    setError("");
    try {
      await axios.post(`${API_BASE}/conductores/aceptar-politica-sesion`, {
        conductor_id: Cookies.get("conductorId"),
        declaraciones_aceptadas: declaraciones.filter(d => aceptadas[d.id]).map(d => d.id),
      });
      onAceptada();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo registrar la aceptación.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="APS-overlay">
      <div className="APS-caja">
        <h2 className="APS-titulo">Un último paso</h2>
        <p className="APS-subtitulo">
          Bienvenido. Para usar la plataforma debes leer y aceptar las siguientes
          declaraciones de vinculación. Cada una se acepta individualmente.
        </p>

        {error && <p className="APS-error">{error}</p>}

        {!politica && !error && <p className="APS-subtitulo">Cargando política…</p>}

        {politica && declaraciones.length > 0 && (
          <>
            {declaraciones.map(decl => (
              <div key={decl.id} className="APS-cajaDecl">
                <h3 className="APS-tituloDecl">{decl.titulo}</h3>
                <div
                  className="APS-textoDecl"
                  dangerouslySetInnerHTML={{ __html: decl.texto_html }}
                />
                <label className="APS-fila">
                  <input
                    type="checkbox"
                    checked={!!aceptadas[decl.id]}
                    onChange={e => setAceptadas(prev => ({ ...prev, [decl.id]: e.target.checked }))}
                    disabled={enviando}
                  />
                  <span>Acepto esta declaración</span>
                </label>
              </div>
            ))}
            <p className="APS-progreso">
              {exigidas.filter(d => aceptadas[d.id]).length} de {exigidas.length} declaraciones aceptadas
            </p>
          </>
        )}

        {politica && declaraciones.length === 0 && (
          <div className="APS-cajaDecl">
            <h3 className="APS-tituloDecl">
              {politica.titulo} <small>v{politica.version}</small>
            </h3>
            <div
              className="APS-textoDecl"
              dangerouslySetInnerHTML={{ __html: politica.texto_html || "" }}
            />
            <label className="APS-fila">
              <input
                type="checkbox"
                checked={!!aceptadas.politica_unica}
                onChange={e => setAceptadas(prev => ({ ...prev, politica_unica: e.target.checked }))}
                disabled={enviando}
              />
              <span>He leído y acepto las Políticas de Tratamiento de Datos Personales (Ley 1581 de 2012).</span>
            </label>
          </div>
        )}

        <button
          className="APS-boton"
          disabled={enviando || !politica || (declaraciones.length > 0 ? !todasAceptadas : !aceptadas.politica_unica)}
          onClick={aceptar}
        >
          {enviando ? "Registrando…" : "Aceptar y continuar"}
        </button>
      </div>
    </div>
  );
};

export default AceptacionPoliticasSesion;
