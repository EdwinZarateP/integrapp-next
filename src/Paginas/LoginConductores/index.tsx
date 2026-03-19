'use client';
import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import Link from "next/link";
import logo from "@/Imagenes/albatros.png";
import HeaderLogo from "@/Componentes/HeaderLogo";
import "./estilos.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

interface UsuarioBackend {
  id: string;
  usuario: string;
  perfil: string;
  primerNombre?: string;
}

interface RespuestaBackend {
  mensaje: string;
  usuario: UsuarioBackend;
  token?: string;
}

const LoginConductores = () => {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  // 1. Cargar cookies al abrir
  useEffect(() => {
    const savedCorreo = Cookies.get("conductorCorreo");
    const savedPass = Cookies.get("conductorClave");
    const savedId = Cookies.get("conductorId");
    const savedPerfil = Cookies.get("conductorPerfil");
    if (savedCorreo) setCorreo(savedCorreo);
    if (savedPass) setClave(savedPass);

    if (savedId && savedPerfil && savedCorreo && savedPass) {
      if (savedPerfil === "CONDUCTOR" || savedPerfil === "ADMIN") {
        router.replace("/PanelConductores");
      }
    }
  }, [router]);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const correoNormalizado = correo.trim().toLowerCase();

      const response = await axios.post<RespuestaBackend>(
        `${API_BASE}/baseusuarios/loginConductor`,
        {
          usuario: correoNormalizado,
          clave
        }
      );

      const data = response.data.usuario || response.data;
      const perfilUsuario = data.perfil ? data.perfil.toString().toUpperCase() : "";

      // 2. Validación estricta de Perfil
      if (perfilUsuario !== "CONDUCTOR" && perfilUsuario !== "ADMIN") {
        setError("🚫 Acceso denegado. Este sistema es exclusivo para Conductores.");
        return;
      }

      // 3. Guardar cookies
      Cookies.set("conductorCorreo", correoNormalizado, { expires: 30 });
      Cookies.set("conductorClave", clave, { expires: 30 });
      Cookies.set("conductorId", data.id.toString(), { expires: 30 });
      Cookies.set("conductorPerfil", perfilUsuario, { expires: 30 });
      if (data.primerNombre) {
          Cookies.set("conductorPrimerNombre", data.primerNombre, { expires: 30 });
      }

      // Efecto de éxito
      confetti({
        particleCount: 180,
        spread: 80,
        origin: { y: 0.6 },
      });

      // Redirección
      setTimeout(() => {
        router.replace("/PanelConductores");
      }, 800);

    } catch (err: any) {
      console.error(err);

      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        Cookies.remove("conductorClave");
        Cookies.remove("conductorId");
        Cookies.remove("conductorPerfil");
        Cookies.remove("conductorPrimerNombre");

        setClave("");
        setError("Correo o contraseña incorrectos.");

      } else if (err.response && err.response.status === 404) {
        setError("Conductor no encontrado.");
      } else {
        setError("Error de conexión con el servidor.");
      }
    }
  };

  return (
    <div className="LoginConductores-contenedor" style={{ position: 'relative' }}>

      {/* Header fijo */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 10 }}>
          <HeaderLogo />
      </div>

      <img src={logo.src} alt="logo" className="LoginConductores-Logo" style={{ marginTop: '80px' }} />

      <div className="LoginConductores-titulo-app">
          <h1>Ingreso</h1>
          <h1>Conductores</h1>
      </div>

      <form className="LoginConductores-formulario" onSubmit={manejarLogin}>
        <div className="LoginConductores-grupo-input">
            <label>Correo Electrónico</label>
            <input
            type="email"
            placeholder="ejemplo@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="LoginConductores-input"
            required
            autoComplete="email"
            />
        </div>

        <div className="LoginConductores-grupo-input">
            <label>Contraseña</label>
            <div className="LoginConductores-password-wrapper">
            <input
                type={mostrarClave ? "text" : "password"}
                placeholder="Contraseña"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="LoginConductores-input"
                required
            />
            <button
                type="button"
                onClick={() => setMostrarClave(!mostrarClave)}
                className="LoginConductores-ojito"
                tabIndex={-1}
            >
                {mostrarClave ? "🙈" : "👁️"}
            </button>
            </div>
        </div>

        <button type="submit" className="LoginConductores-boton">
          Ingresar
        </button>
      </form>

      <div className="LoginConductores-links">
        <Link href="/RegistroConductor" className="LoginConductores-link">
            Registrarse
        </Link>
        <Link href="/OlvidoClaveConductor" className="LoginConductores-link">
            Olvidé la clave
        </Link>
      </div>

      {error && <p className="LoginConductores-error">{error}</p>}
    </div>
  );
};

export default LoginConductores;
