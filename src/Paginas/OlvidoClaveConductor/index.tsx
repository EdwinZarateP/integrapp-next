'use client';
import React, { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FaPhone, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import "../LoginConductores/estilos.css";
import "./estilos.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

interface RespuestaVerificacion {
  existe: boolean;
  mensaje?: string;
}
interface RespuestaCodigo {
  valido: boolean;
}

const OlvidoClaveConductor = () => {
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");

  const [step, setStep] = useState(1);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // --- PASO 1: Verificar Usuario y Enviar Código ---
  const enviarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setLoading(true);

    try {
      const response = await axios.post<RespuestaVerificacion>(`${API_BASE}/conductores/recuperar/verificar`, {
        usuario: correo.trim(),
        perfil: "CONDUCTOR"
      });

      if (response.data.existe) {
        setStep(2);
        setMensaje("¡Correo encontrado! Te enviamos un código de verificación.");
      } else {
        setError("No hay ninguna cuenta de conductor con ese correo.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 404) {
        setError("Correo no encontrado.");
      } else {
        setError("Error al enviar el código. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 2: Validar el Código Ingresado ---
  const validarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setLoading(true);

    try {
        const response = await axios.post<RespuestaCodigo>(`${API_BASE}/conductores/recuperar/validar`, {
            usuario: correo.trim(),
            codigo: codigo,
            perfil: "CONDUCTOR"
        });

        if (response.data.valido) {
            setStep(3);
            setMensaje("Código correcto. Ahora crea tu nueva contraseña.");
        } else {
            setError("El código ingresado es incorrecto o ha expirado.");
        }
    } catch (err: any) {
        console.error(err);
        setError("Error al validar el código.");
    } finally {
        setLoading(false);
    }
  };

  // --- PASO 3: Actualizar la contraseña ---
  const cambiarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (nuevaClave !== confirmarClave) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (nuevaClave.length < 4) {
      setError("La contraseña es muy corta.");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_BASE}/conductores/recuperar/cambiar`, {
        usuario: correo.trim(),
        nuevaClave: nuevaClave,
        codigo: codigo,
        perfil: "CONDUCTOR"
      });

      setMensaje("¡Contraseña actualizada con éxito!");
      setTimeout(() => router.push("/LoginConductores"), 2000);

    } catch (err: any) {
      console.error(err);
      setError("No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const renderFormulario = () => {
    switch(step) {
      case 1:
        return (
          <form className="LC-formulario" onSubmit={enviarCodigo}>
            <div className="LC-grupo">
              <label className="LC-label">Correo Electrónico</label>
              <input
                className="LC-input"
                type="email"
                placeholder="ejemplo@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="LC-boton" type="submit" disabled={loading}>
              {loading ? "Buscando…" : "Enviar Código"}
            </button>
          </form>
        );
      case 2:
        return (
          <form className="LC-formulario" onSubmit={validarCodigo}>
            <div className="OC-infoBox">
              Enviamos un código a <strong>{correo}</strong>
            </div>
            <div className="LC-grupo">
              <label className="LC-label">Código de Verificación</label>
              <input
                className="LC-input"
                type="text"
                placeholder="Ingrese el código (Ej: 1234)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="LC-boton" type="submit" disabled={loading}>
              {loading ? "Verificando…" : "Validar Código"}
            </button>
            <div className="LC-linksFila">
              <button
                type="button"
                className="LC-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                onClick={() => setStep(1)}
              >
                ¿No recibiste el código? Volver
              </button>
            </div>
          </form>
        );
      case 3:
        return (
          <form className="LC-formulario" onSubmit={cambiarClave}>
            <div className="LC-grupo">
              <label className="LC-label">Nueva Contraseña</label>
              <input
                className="LC-input"
                type="password"
                placeholder="Nueva contraseña"
                value={nuevaClave}
                onChange={(e) => setNuevaClave(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="LC-grupo">
              <label className="LC-label">Confirmar Contraseña</label>
              <input
                className="LC-input"
                type="password"
                placeholder="Repita la contraseña"
                value={confirmarClave}
                onChange={(e) => setConfirmarClave(e.target.value)}
                required
              />
            </div>
            <button className="LC-boton" type="submit" disabled={loading}>
              {loading ? "Actualizando…" : "Confirmar Cambio"}
            </button>
          </form>
        );
      default:
        return null;
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
          <div className="LC-cardHeader">
            <Image src={logo} alt="Logo Integra" height={64} priority />
            <h2 className="LC-titulo">Recuperar Acceso</h2>
            <p className="LC-subtitulo">
              {step === 1 && "Conductores — recupera tu clave con tu correo"}
              {step === 2 && "Ingresa el código que enviamos a tu correo"}
              {step === 3 && "Crea tu nueva contraseña"}
            </p>
          </div>

          {renderFormulario()}

          {error && <p className="LC-error" style={{ marginTop: '12px' }}>{error}</p>}
          {mensaje && <p className="LC-reenvioMensaje" style={{ marginTop: '12px' }}>{mensaje}</p>}

          <div className="LC-linksFila" style={{ marginTop: '18px' }}>
            <Link href="/LoginConductores" className="LC-link">
              ← Volver al Login
            </Link>
          </div>
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

export default OlvidoClaveConductor;
