'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
// Mismo sistema visual que el login de conductores (LC-*): header, card, footer.
import '../LoginConductores/estilos.css';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

const RegistroConductor: React.FC = () => {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState('');
  const [registrado, setRegistrado] = useState(false);

  const [cargando, setCargando] = useState(false);

  const [formData, setFormData] = useState({
      nombre: '',
      telefono: '',
      email: '',
      password: ''
  });
  // ¿Quién se registra: el que maneja (CONDUCTOR) o el dueño del vehículo (TENEDOR)?
  const [perfil, setPerfil] = useState<'CONDUCTOR' | 'TENEDOR'>('CONDUCTOR');

  const manejarCambio = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMensaje) setErrorMensaje('');
  };

  const lanzarConfetti = () => {
    confetti({
      particleCount: 200,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const manejarEnvioFormulario = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (cargando) return;

    if (!formData.email.includes('@')) {
      setErrorMensaje('Por favor, ingresa un email válido.');
      return;
    }

    setErrorMensaje('');
    setCargando(true);

    try {
      const payload = {
        nombre: formData.nombre,
        usuario: formData.email,
        celular: formData.telefono,
        regional: 'N/A',
        correo: formData.email,
        clave: formData.password,
        perfil: perfil
      };

      const response = await fetch(`${API_BASE}/conductores/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();

        const detalleError = errorData.detail || '';

        if (detalleError === "El usuario ya existe" || detalleError.includes("existe") || response.status === 409) {
             throw new Error("Este correo electrónico ya está registrado en el sistema.");
        }

        throw new Error(detalleError || 'Error al registrar el conductor');
      }

      lanzarConfetti();
      // La cuenta queda pendiente de verificación: el enlace llega por correo.
      setRegistrado(true);

    } catch (error: any) {
      console.error("Error al registrar:", error);
      setErrorMensaje(error.message || 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="LC-layout">

      {/* ── HEADER ── */}
      <header className="LC-header">
        <div className="LC-headerInner">
          <button className="LC-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="LC-brandName">
              Integr<span className="LC-brandAccent">App</span>
            </span>
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="LC-main">
        <div className="LC-card">

          {registrado ? (
            /* ── Vista post-registro: verificar correo ── */
            <div className="RegVer-estado">
              <h2 className="LC-titulo">¡Casi listo!</h2>
              <p className="RegVer-texto">
                Enviamos un <strong>enlace de verificación</strong> a{' '}
                <strong>{formData.email}</strong>.
              </p>
              <p className="RegVer-texto">
                Ábrelo para activar tu cuenta y poder iniciar sesión. Revisa también la carpeta de
                spam. El enlace vence en 48 horas.
              </p>
              <div className="RegVer-acciones">
                <button
                  type="button"
                  className="LC-boton"
                  onClick={() => router.push('/LoginConductores')}
                >
                  Ir al login
                </button>
                <div className="LC-linksFila">
                  <span className="LC-link" onClick={() => window.location.reload()}>
                    Registrar otro conductor
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="LC-cardHeader">
                <Image src={logo} alt="Logo Integra" height={64} priority />
                <h2 className="LC-titulo">Registro de Conductor</h2>
                <p className="LC-subtitulo">Crea tu cuenta para registrar tu vehículo</p>
              </div>

              <form className="LC-formulario" onSubmit={manejarEnvioFormulario}>

                {/* ¿Quién se registra? Conductor (maneja) o Tenedor (dueño). */}
                <div className="LC-grupo">
                  <label className="LC-label">¿Quién eres?</label>
                  <div className="RegPerfil-toggle">
                    <button
                      type="button"
                      className={`RegPerfil-opcion ${perfil === 'CONDUCTOR' ? 'RegPerfil-opcion--activa' : ''}`}
                      onClick={() => setPerfil('CONDUCTOR')}
                      disabled={cargando}
                    >
                      🚛 Yo conduzco el vehículo
                    </button>
                    <button
                      type="button"
                      className={`RegPerfil-opcion ${perfil === 'TENEDOR' ? 'RegPerfil-opcion--activa' : ''}`}
                      onClick={() => setPerfil('TENEDOR')}
                      disabled={cargando}
                    >
                      📋 Soy el dueño (tenedor)
                    </button>
                  </div>
                  {perfil === 'TENEDOR' && (
                    <p className="RegPerfil-nota">
                      Como tenedor podrás registrar varias placas e invitar a un conductor
                      distinto para cada vehículo.
                    </p>
                  )}
                </div>

                <div className="LC-grupo">
                  <label className="LC-label" htmlFor="nombre">Nombre Completo</label>
                  <input
                    id="nombre" name="nombre" type="text" placeholder="Ej: Juan Pérez"
                    className="LC-input"
                    value={formData.nombre} onChange={manejarCambio} required disabled={cargando}
                    autoComplete="name"
                  />
                </div>

                <div className="LC-grupo">
                  <label className="LC-label" htmlFor="telefono">Celular</label>
                  <input
                    id="telefono" name="telefono" type="tel" placeholder="Ej: 3001234567"
                    className="LC-input"
                    value={formData.telefono} onChange={manejarCambio} required disabled={cargando}
                    autoComplete="tel"
                  />
                </div>

                <div className="LC-grupo">
                  <label className="LC-label" htmlFor="email">Correo Electrónico (Usuario)</label>
                  <input
                    id="email" name="email" type="email"
                    placeholder="conductor@ejemplo.com"
                    className="LC-input"
                    value={formData.email} onChange={manejarCambio} required
                    disabled={cargando}
                    autoComplete="email"
                  />
                </div>

                <div className="LC-grupo">
                  <label className="LC-label" htmlFor="password">Contraseña</label>
                  <div className="LC-passwordWrap">
                    <input
                      id="password" name="password"
                      className="LC-input LC-inputPassword"
                      type={passwordVisible ? 'text' : 'password'}
                      placeholder="Crea una contraseña segura"
                      value={formData.password} onChange={manejarCambio} required
                      disabled={cargando}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="LC-ojito"
                      aria-label="Mostrar u ocultar contraseña"
                      tabIndex={-1}
                    >
                      {passwordVisible ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                {errorMensaje && <p className="LC-error">{errorMensaje}</p>}

                <button
                  type="submit"
                  className="LC-boton"
                  disabled={cargando}
                >
                  {cargando ? 'Registrando…' : 'Crear cuenta'}
                </button>

                <div className="LC-linksFila">
                  <Link href="/LoginConductores" className="LC-link">
                    ¿Ya tienes cuenta? Inicia sesión
                  </Link>
                </div>

              </form>
            </>
          )}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="LC-footer">
        <div className="LC-footerInner">
          <div className="LC-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="LC-footerLinks">
            <a href="tel:+573125443396" className="LC-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="LC-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="LC-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="LC-footerCopy">© {new Date().getFullYear()} Integra — Conductores</span>
        </div>
      </footer>
    </div>
  );
};

export default RegistroConductor;
