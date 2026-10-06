'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaBalanceScale } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import '../VerificarCorreo/estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

/* Declaración que NO bloquea (mismo criterio del backend). */
const DECLARACION_NO_EXIGIDA = 'tratamiento_datos';

type Estado = 'verificando' | 'pendiente' | 'exito' | 'error';

interface Declaracion {
  id: string;
  titulo: string;
  texto_html: string;
}

interface Politica {
  version: number;
  titulo: string;
  texto_html: string;
  declaraciones?: Declaracion[];
}

/**
 * Página PÚBLICA de autorización de tratamiento de datos (2026-10-05): la
 * consumen los actores del estudio de seguridad SIN cuenta en el portal
 * (propietario, tenedor, dueño del remolque) desde el link que les llega por
 * correo. Sin login: el token (48 h) identifica a la persona. La aceptación
 * queda como evidencia append-only (canal «vinculo_correo») con fecha, IP y
 * navegador — lo que se muestra en /revision para auditorías de habeas data.
 */
const AutorizacionDatos: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('');
  const [nombre, setNombre] = useState('');
  const [placa, setPlaca] = useState('');
  const [politica, setPolitica] = useState<Politica | null>(null);
  const [aceptadas, setAceptadas] = useState<Record<string, boolean>>({});
  const [aceptado, setAceptado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorAceptacion, setErrorAceptacion] = useState('');

  const declaraciones = politica?.declaraciones || [];
  const declaracionesExigidas = declaraciones.filter((d) => d.id !== DECLARACION_NO_EXIGIDA);
  const todasAceptadas = declaraciones.length > 0
    ? declaracionesExigidas.every((d) => aceptadas[d.id])
    : aceptado;

  useEffect(() => {
    if (!token) {
      setEstado('error');
      setMensaje('Enlace inválido o incompleto. Solicita uno nuevo al área de Seguridad.');
      return;
    }
    (async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/conductores/autorizacion/verificar?token=${encodeURIComponent(token)}`);
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.estado === 'pendiente') {
          setNombre(data.nombre || '');
          setPlaca(data.placa || '');
          setPolitica(data.politica || null);
          setEstado('pendiente');
        } else {
          setEstado('error');
          setMensaje(data.detail || 'El enlace no es válido o ya fue usado.');
        }
      } catch {
        setEstado('error');
        setMensaje('Error de conexión con el servidor. Intenta de nuevo.');
      }
    })();
  }, [token]);

  const aceptar = async () => {
    if (!token || !politica || enviando) return;
    setEnviando(true);
    setErrorAceptacion('');
    try {
      const resp = await fetch(`${API_BASE}/conductores/autorizacion/aceptar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          declaraciones_aceptadas: declaraciones.filter((d) => aceptadas[d.id]).map((d) => d.id),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setEstado('exito');
      } else {
        setErrorAceptacion(
          typeof data.detail === 'string' ? data.detail : 'No pudimos registrar la autorización.');
      }
    } catch {
      setErrorAceptacion('Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="VC-layout">
      <header className="VC-header">
        <div className="VC-headerInner">
          <button className="VC-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="VC-brandName">
              Integr<span className="VC-brandAccent">App</span>
            </span>
          </button>
        </div>
      </header>

      <main className="VC-main">
        <div className="VC-card">
          {estado === 'verificando' && (
            <div className="VC-estado">
              <FaSpinner className="VC-spinner" />
              <h2 className="VC-titulo">Validando tu enlace…</h2>
              <p className="VC-subtitulo">Un momento mientras verificamos la solicitud.</p>
            </div>
          )}

          {estado === 'pendiente' && politica && (
            <div className="VC-estado">
              <FaBalanceScale style={{ fontSize: 34, color: '#0f1928', marginBottom: 8 }} />
              <h2 className="VC-titulo">Autorización de tratamiento de datos</h2>
              <p className="VC-subtitulo">
                {nombre ? `${nombre}, ` : ''}
                estás siendo vinculado(a) como actor del vehículo{' '}
                <strong>{placa || '—'}</strong> de IntegrApp (ORION TRANSPORTADORA DE
                CARGA S.A.S.). Para consultar tu información en fuentes públicas
                necesitamos tu autorización expresa. Lee y acepta cada declaración:
              </p>

              {declaraciones.length > 0 ? (
                <>
                  {declaraciones.map((decl) => (
                    <div key={decl.id} className="VC-politicaCaja">
                      <h3 className="VC-politicaTitulo">{decl.titulo}</h3>
                      <div
                        className="VC-politicaTexto"
                        dangerouslySetInnerHTML={{ __html: decl.texto_html }}
                      />
                      <label className="VC-checkboxFila">
                        <input
                          type="checkbox"
                          className="VC-checkbox"
                          checked={!!aceptadas[decl.id]}
                          onChange={(e) =>
                            setAceptadas((prev) => ({ ...prev, [decl.id]: e.target.checked }))
                          }
                          disabled={enviando}
                        />
                        <span className="VC-checkboxLabel">Acepto esta declaración</span>
                      </label>
                    </div>
                  ))}
                  <p className="VC-progresoDeclaraciones">
                    {declaracionesExigidas.filter((d) => aceptadas[d.id]).length} de{' '}
                    {declaracionesExigidas.length} declaraciones aceptadas
                  </p>
                </>
              ) : (
                <div className="VC-politicaCaja">
                  <h3 className="VC-politicaTitulo">
                    {politica.titulo} <span className="VC-politicaVersion">v{politica.version}</span>
                  </h3>
                  <div
                    className="VC-politicaTexto"
                    dangerouslySetInnerHTML={{ __html: politica.texto_html }}
                  />
                  <label className="VC-checkboxFila">
                    <input
                      type="checkbox"
                      className="VC-checkbox"
                      checked={aceptado}
                      onChange={(e) => setAceptado(e.target.checked)}
                      disabled={enviando}
                    />
                    <span className="VC-checkboxLabel">
                      He leído y autorizo el tratamiento de mis datos personales
                      (Ley 1581 de 2012).
                    </span>
                  </label>
                </div>
              )}

              {errorAceptacion && <p className="VC-errorAceptacion">{errorAceptacion}</p>}
              <button
                className="VC-boton"
                onClick={aceptar}
                disabled={!todasAceptadas || enviando}
              >
                {enviando ? 'Registrando…' : 'Autorizar'}
              </button>
            </div>
          )}

          {estado === 'exito' && (
            <div className="VC-estado">
              <FaCheckCircle className="VC-iconoExito" />
              <h2 className="VC-titulo">¡Autorización registrada!</h2>
              <p className="VC-subtitulo">
                Gracias{nombre ? `, ${nombre}` : ''}. Tu autorización quedó registrada con
                fecha y hora. No necesitas hacer nada más — puedes cerrar esta página.
              </p>
            </div>
          )}

          {estado === 'error' && (
            <div className="VC-estado">
              <FaTimesCircle className="VC-iconoError" />
              <h2 className="VC-titulo">No pudimos validar tu enlace</h2>
              <p className="VC-subtitulo">{mensaje}</p>
              <p className="VC-subtitulo" style={{ fontSize: '0.85em' }}>
                Comunícate con el área de Seguridad de Integra para que te envíen uno nuevo.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="VC-footer">
        <span className="VC-footerCopy">© {new Date().getFullYear()} Integra — Autorización de datos</span>
      </footer>
    </div>
  );
};

export default AutorizacionDatos;
