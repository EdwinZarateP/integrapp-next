'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import '../VerificarCorreo/estilos.css';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

/* Declaración que NO bloquea la activación (2026-08-31): si no se marca, el
   flujo continúa igual; si se marca, viaja al backend para dejar evidencia.
   En la UI se ve idéntica a las demás (no se comunica como opcional). Debe
   coincidir con DECLARACIONES_NO_EXIGIDAS del backend (conductores.py). */
const DECLARACION_NO_EXIGIDA = 'tratamiento_datos';

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

const AceptarInvitacion: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const placa = searchParams.get('placa')?.toUpperCase() || '';
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('');
  const [correo, setCorreo] = useState('');
  const [politica, setPolitica] = useState<Politica | null>(null);

  // Formulario de activación.
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [celular, setCelular] = useState('');
  const [aceptado, setAceptado] = useState(false);
  // Modelo declaraciones: checkbox individual por cada declaración.
  const [aceptadas, setAceptadas] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const declaraciones = politica?.declaraciones || [];
  const declaracionesExigidas = declaraciones.filter((d) => d.id !== DECLARACION_NO_EXIGIDA);
  const todasAceptadas = declaraciones.length > 0
    ? declaracionesExigidas.every((d) => aceptadas[d.id])
    : aceptado;

  // 1. Validar el token contra /verificar-correo (mismo token de verificación).
  useEffect(() => {
    if (!token) {
      setEstado('error');
      setMensaje('Enlace de invitación inválido o incompleto. Pide al tenedor que reenvíe la invitación.');
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
          // Cuenta ya verificada (p. ej. invitación reabierta): si el vehículo
          // aún no está vinculado igual ofrecemos completar el formulario.
          setCorreo(data.correo || '');
          const respPol = await fetch(`${API_BASE}/conductores/politica-datos`);
          const pol = await respPol.json().catch(() => null);
          setPolitica(pol || null);
          setEstado('pendiente_aceptacion');
        } else {
          setEstado('error');
          setMensaje(data.detail || 'El enlace de invitación expiró. Pide al tenedor que te reenvíe.');
        }
      } catch {
        setEstado('error');
        setMensaje('Error de conexión con el servidor. Intenta de nuevo.');
      }
    };

    verificar();
  }, [token]);

  const irALogin = () => router.push('/LoginConductores');

  // 2. Activar cuenta: clave + política + datos del conductor.
  const activarCuenta = async () => {
    if (!token || !politica || enviando) return;
    setErrorForm('');

    if (clave.trim().length < 6) {
      setErrorForm('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (clave !== clave2) {
      setErrorForm('Las contraseñas no coinciden.');
      return;
    }
    if (celular && !/^\d{10}$/.test(celular)) {
      setErrorForm('El celular debe tener 10 dígitos.');
      return;
    }
    if (!todasAceptadas) {
      setErrorForm('Debes aceptar todas las declaraciones de vinculación.');
      return;
    }

    setEnviando(true);
    try {
      const resp = await fetch(`${API_BASE}/conductores/aceptar-invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          placa,
          clave: clave.trim(),
          version_politica: politica.version,
          acepta: true,
          declaraciones_aceptadas: declaraciones.filter((d) => aceptadas[d.id]).map((d) => d.id),
          celular: celular || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setEstado('exito');
        setMensaje(data.mensaje || 'Cuenta activada y vehículo vinculado. Ya puedes iniciar sesión.');
      } else if (data.detail?.politica) {
        // La política cambió de versión entre el enlace y la aceptación.
        setPolitica(data.detail.politica);
        setAceptadas({});
        setAceptado(false);
        setErrorForm('Las declaraciones fueron actualizadas. Revísalas y acéptalas nuevamente.');
      } else {
        setErrorForm(
          typeof data.detail === 'string'
            ? data.detail
            : data.detail?.mensaje || 'No pudimos completar la activación.'
        );
      }
    } catch {
      setErrorForm('Error de conexión con el servidor. Intenta de nuevo.');
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
              <h2 className="VC-titulo">Validando tu invitación…</h2>
              <p className="VC-subtitulo">Un momento mientras verificamos el enlace.</p>
            </div>
          )}

          {estado === 'pendiente_aceptacion' && (
            <div className="VC-estado">
              <h2 className="VC-titulo">Activa tu cuenta de conductor</h2>
              <p className="VC-subtitulo">
                Te invitaron a operar{placa ? <> el vehículo de placa <strong>{placa}</strong></> : ' un vehículo'}
                {correo ? <> con el correo <strong>{correo}</strong></> : null}. Elige tu
                contraseña para activarla.
              </p>

              <div className="AI-formulario">
                <div className="AI-grupo">
                  <label className="AI-label">Contraseña (mínimo 6 caracteres)</label>
                  <div className="AI-claveWrap">
                    <input
                      type={mostrarClave ? 'text' : 'password'}
                      className="AI-input"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      disabled={enviando}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="AI-ojito"
                      onClick={() => setMostrarClave(v => !v)}
                      aria-label="Mostrar u ocultar contraseña"
                    >
                      {mostrarClave ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div className="AI-grupo">
                  <label className="AI-label">Confirmar contraseña</label>
                  <input
                    type={mostrarClave ? 'text' : 'password'}
                    className="AI-input"
                    value={clave2}
                    onChange={(e) => setClave2(e.target.value)}
                    disabled={enviando}
                    autoComplete="new-password"
                  />
                </div>

                <div className="AI-grupo">
                  <label className="AI-label">Celular (10 dígitos)</label>
                  <input
                    type="tel"
                    className="AI-input"
                    value={celular}
                    onChange={(e) => setCelular(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    disabled={enviando}
                    placeholder="3001234567"
                    autoComplete="tel"
                  />
                </div>

              </div>

              {politica && declaraciones.length > 0 && (
                <>
                  <h3 className="VC-politicaTitulo" style={{ alignSelf: 'flex-start' }}>
                    Declaraciones de vinculación
                  </h3>
                  <p className="VC-progresoDeclaraciones" style={{ alignSelf: 'flex-start' }}>
                    Lee y acepta cada declaración ({declaracionesExigidas.filter((d) => aceptadas[d.id]).length} de{' '}
                    {declaracionesExigidas.length} aceptadas)
                  </p>
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
                </>
              )}

              {politica && declaraciones.length === 0 && (
                /* Modelo viejo (sin declaraciones): política única. */
                <>
                  <div className="VC-politicaCaja">
                    <h3 className="VC-politicaTitulo">
                      {politica.titulo} <span className="VC-politicaVersion">v{politica.version}</span>
                    </h3>
                    <div
                      className="VC-politicaTexto"
                      dangerouslySetInnerHTML={{ __html: politica.texto_html }}
                    />
                  </div>
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
                </>
              )}

              {errorForm && <p className="VC-errorAceptacion">{errorForm}</p>}
              <button
                className="VC-boton"
                onClick={activarCuenta}
                disabled={!todasAceptadas || enviando || clave.length < 6}
              >
                {enviando ? 'Activando…' : 'Activar mi cuenta'}
              </button>
            </div>
          )}

          {estado === 'exito' && (
            <div className="VC-estado">
              <FaCheckCircle className="VC-iconoExito" />
              <h2 className="VC-titulo">¡Cuenta activada!</h2>
              <p className="VC-subtitulo">{mensaje}</p>
              <button className="VC-boton" onClick={irALogin}>
                Ir a iniciar sesión
              </button>
            </div>
          )}

          {estado === 'error' && (
            <div className="VC-estado">
              <FaTimesCircle className="VC-iconoError" />
              <h2 className="VC-titulo">No pudimos activar tu cuenta</h2>
              <p className="VC-subtitulo">{mensaje}</p>
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

export default AceptarInvitacion;
