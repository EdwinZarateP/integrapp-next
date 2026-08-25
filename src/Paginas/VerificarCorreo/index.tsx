'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

type Estado = 'verificando' | 'pendiente_aceptacion' | 'exito' | 'error';

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

const VerificarCorreo: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('');
  const [correo, setCorreo] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMensaje, setReenvioMensaje] = useState('');
  const [politica, setPolitica] = useState<Politica | null>(null);
  const [aceptado, setAceptado] = useState(false);
  // Modelo declaraciones: checkbox individual por cada declaración.
  const [aceptadas, setAceptadas] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorAceptacion, setErrorAceptacion] = useState('');

  const declaraciones = politica?.declaraciones || [];
  const todasAceptadas = declaraciones.length > 0
    ? declaraciones.every((d) => aceptadas[d.id])
    : aceptado;

  useEffect(() => {
    if (!token) {
      setEstado('error');
      setMensaje('Enlace inválido o incompleto. Solicita uno nuevo desde el login.');
      return;
    }

    const verificar = async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/conductores/verificar-correo?token=${encodeURIComponent(token)}`
        );
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.estado === 'pendiente_aceptacion') {
          setCorreo(data.correo || '');
          setPolitica(data.politica || null);
          setEstado('pendiente_aceptacion');
        } else if (resp.ok) {
          // 'ya_verificado' o respuestas futuras: la cuenta ya está activa.
          setEstado('exito');
          setMensaje(data.mensaje || 'Tu correo ya fue verificado. Puedes iniciar sesión.');
          setCorreo(data.correo || '');
        } else {
          setEstado('error');
          setMensaje(data.detail || 'No pudimos verificar el correo.');
        }
      } catch {
        setEstado('error');
        setMensaje('Error de conexión con el servidor. Intenta de nuevo.');
      }
    };

    verificar();
  }, [token]);

  const irALogin = () => router.push('/LoginConductores');

  const aceptarPolitica = async () => {
    if (!token || !politica || enviando) return;
    setEnviando(true);
    setErrorAceptacion('');
    try {
      const resp = await fetch(`${API_BASE}/conductores/aceptar-politica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          version_politica: politica.version,
          acepta: true,
          declaraciones_aceptadas: declaraciones.map((d) => d.id),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setEstado('exito');
        setMensaje(data.mensaje || 'Correo verificado y declaraciones aceptadas. Ya puedes iniciar sesión.');
      } else if (data.detail?.politica) {
        // La política cambió de versión entre el enlace y la aceptación.
        setPolitica(data.detail.politica);
        setAceptadas({});
        setAceptado(false);
        setErrorAceptacion('Las declaraciones fueron actualizadas. Revísalas y acéptalas nuevamente.');
      } else {
        setEstado('error');
        setMensaje(data.detail?.mensaje || data.detail || 'No pudimos completar la verificación.');
      }
    } catch {
      setErrorAceptacion('Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    const correoReenvio = correo || window.prompt('Escribe tu correo para reenviar el enlace:') || '';
    if (!correoReenvio || !correoReenvio.includes('@')) {
      setReenvioMensaje('Ingresa un correo válido.');
      return;
    }
    setReenviando(true);
    setReenvioMensaje('');
    try {
      const resp = await fetch(`${API_BASE}/conductores/reenviar-verificacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correoReenvio.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      setReenvioMensaje(data.mensaje || 'Si el correo está pendiente, se envió un nuevo enlace.');
    } catch {
      setReenvioMensaje('Error de conexión. Intenta de nuevo.');
    } finally {
      setReenviando(false);
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
              <h2 className="VC-titulo">Verificando tu correo…</h2>
              <p className="VC-subtitulo">Un momento mientras validamos el enlace.</p>
            </div>
          )}

          {estado === 'pendiente_aceptacion' && politica && (
            <div className="VC-estado">
              <h2 className="VC-titulo">Un último paso</h2>
              <p className="VC-subtitulo">
                Para activar tu cuenta{correo ? ` (${correo})` : ''} debes leer y aceptar
                las siguientes declaraciones de vinculación. Cada una se acepta
                individualmente.
              </p>

              {declaraciones.length > 0 ? (
                <>
                  {declaraciones.map((decl) => (
                    <div key={decl.id} className="VC-politicaCaja">
                      <h3 className="VC-politicaTitulo">
                        {decl.titulo}
                      </h3>
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
                    {declaraciones.filter((d) => aceptadas[d.id]).length} de{' '}
                    {declaraciones.length} declaraciones aceptadas
                  </p>
                </>
              ) : (
                /* Modelo viejo (sin declaraciones): política única. */
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
                      He leído y acepto las Políticas de Tratamiento de Datos Personales
                      (Ley 1581 de 2012).
                    </span>
                  </label>
                </div>
              )}

              {errorAceptacion && <p className="VC-errorAceptacion">{errorAceptacion}</p>}
              <button
                className="VC-boton"
                onClick={aceptarPolitica}
                disabled={!todasAceptadas || enviando}
              >
                {enviando ? 'Verificando…' : 'Aceptar y verificar'}
              </button>
            </div>
          )}

          {estado === 'exito' && (
            <div className="VC-estado">
              <FaCheckCircle className="VC-iconoExito" />
              <h2 className="VC-titulo">¡Correo verificado!</h2>
              <p className="VC-subtitulo">{mensaje}</p>
              <button className="VC-boton" onClick={irALogin}>
                Ir a iniciar sesión
              </button>
            </div>
          )}

          {estado === 'error' && (
            <div className="VC-estado">
              <FaTimesCircle className="VC-iconoError" />
              <h2 className="VC-titulo">No pudimos verificar tu correo</h2>
              <p className="VC-subtitulo">{mensaje}</p>
              <button className="VC-boton" onClick={reenviar} disabled={reenviando}>
                {reenviando ? 'Enviando…' : 'Reenviar enlace de verificación'}
              </button>
              {reenvioMensaje && <p className="VC-reenvioMensaje">{reenvioMensaje}</p>}
              <button className="VC-linkVolver" onClick={irALogin}>
                ← Volver al login
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="VC-footer">
        <span className="VC-footerCopy">© {new Date().getFullYear()} Integra — Conductores</span>
      </footer>
    </div>
  );
};

export default VerificarCorreo;
