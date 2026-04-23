'use client';
import React, { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import "./estilos.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

const OlvidoClaveBaseUsuario = () => {
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");
  const [step, setStep] = useState(1);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const router = useRouter();

  const enviarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/baseusuarios/recuperar/solicitar`, {
        correo,
      });
      setStep(2);
      setMensaje(response.data.mensaje);
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Error al enviar el código. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const validarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    if (!codigo.trim()) {
      setError("Ingresa el código de verificación.");
      return;
    }
    setStep(3);
    setMensaje("Código recibido. Ahora crea tu nueva contraseña.");
  };

  const cambiarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (nuevaClave.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (nuevaClave !== confirmarClave) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/baseusuarios/recuperar/confirmar`, {
        correo,
        codigo,
        nuevaClave,
      });
      setMensaje("Contraseña actualizada correctamente. Redirigiendo al login...");
      setTimeout(() => router.push("/LoginUsuario"), 2000);
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("No se pudo actualizar la contraseña.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={enviarCodigo} style={{ width: "100%" }}>
            <div className="OCBU-grupo">
              <label className="OCBU-label">Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="OCBU-input"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="OCBU-boton" disabled={loading}>
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        );
      case 2:
        return (
          <form onSubmit={validarCodigo} style={{ width: "100%" }}>
            <div className="OCBU-grupo">
              <label className="OCBU-label">Código de verificación</label>
              <input
                type="text"
                placeholder="Ej: 1234"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="OCBU-input"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="OCBU-boton">
              Validar código
            </button>
            <p className="OCBU-link" onClick={() => setStep(1)}>
              No recibiste el código? Volver a enviar
            </p>
          </form>
        );
      case 3:
        return (
          <form onSubmit={cambiarClave} style={{ width: "100%" }}>
            <div className="OCBU-grupo">
              <label className="OCBU-label">Nueva contraseña</label>
              <div className="OCBU-passwordWrap">
                <input
                  type={mostrarNueva ? "text" : "password"}
                  placeholder="Nueva contraseña"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  className="OCBU-input OCBU-inputPassword"
                  required
                  autoFocus
                />
                <button type="button" className="OCBU-ojito" onClick={() => setMostrarNueva(v => !v)}>
                  {mostrarNueva ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <div className="OCBU-grupo">
              <label className="OCBU-label">Confirmar contraseña</label>
              <div className="OCBU-passwordWrap">
                <input
                  type={mostrarConfirmar ? "text" : "password"}
                  placeholder="Repite la contraseña"
                  value={confirmarClave}
                  onChange={(e) => setConfirmarClave(e.target.value)}
                  className="OCBU-input OCBU-inputPassword"
                  required
                />
                <button type="button" className="OCBU-ojito" onClick={() => setMostrarConfirmar(v => !v)}>
                  {mostrarConfirmar ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <button type="submit" className="OCBU-boton" disabled={loading}>
              {loading ? "Actualizando..." : "Cambiar contraseña"}
            </button>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <div className="OCBU-layout">
      <header className="OCBU-header">
        <div className="OCBU-headerInner">
          <button className="OCBU-brand" onClick={() => router.push("/")} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="OCBU-brandName">
              Integr<span className="OCBU-brandAccent">App</span>
            </span>
          </button>
        </div>
      </header>

      <main className="OCBU-main">
        <div className="OCBU-card">
          <div className="OCBU-cardHeader">
            <Image src={logo} alt="Logo Integra" height={56} />
            <h2 className="OCBU-titulo">Recuperar contraseña</h2>
            <p className="OCBU-subtitulo">
              {step === 1 && "Ingresa tu correo para recibir un código de verificación"}
              {step === 2 && "Ingresa el código que enviamos a tu correo"}
              {step === 3 && "Crea tu nueva contraseña"}
            </p>
          </div>

          {renderStep()}

          {error && <p className="OCBU-error">{error}</p>}
          {mensaje && <p className="OCBU-exito">{mensaje}</p>}

          <button className="OCBU-volver" onClick={() => router.push("/LoginUsuario")}>
            Volver al login
          </button>
        </div>
      </main>
    </div>
  );
};

export default OlvidoClaveBaseUsuario;
