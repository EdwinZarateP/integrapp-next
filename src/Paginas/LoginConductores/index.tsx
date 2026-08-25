'use client';
import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
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
  const [cargando, setCargando] = useState(false);
  const [noVerificado, setNoVerificado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMensaje, setReenvioMensaje] = useState("");

  const router = useRouter();

  // 1. Cargar correo guardado y auto-ingresar si la sesión sigue viva.
  //    Ya NO se guarda ni lee la clave en cookies.
  useEffect(() => {
    Cookies.remove("conductorClave"); // purga la cookie legacy en claro
    const savedCorreo = Cookies.get("conductorCorreo");
    const savedId = Cookies.get("conductorId");
    const savedPerfil = Cookies.get("conductorPerfil");
    if (savedCorreo) setCorreo(savedCorreo);

    if (savedId && savedPerfil && savedCorreo) {
      if (savedPerfil === "CONDUCTOR" || savedPerfil === "TENEDOR" || savedPerfil === "ADMIN") {
        router.replace("/PanelConductores");
      }
    }
  }, [router]);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNoVerificado(false);
    setReenvioMensaje("");
    setCargando(true);

    try {
      const correoNormalizado = correo.trim().toLowerCase();

      const response = await axios.post<RespuestaBackend>(
        `${API_BASE}/conductores/login`,
        {
          usuario: correoNormalizado,
          clave
        }
      );

      const data = response.data.usuario || response.data;
      const perfilUsuario = data.perfil ? data.perfil.toString().toUpperCase() : "";

      // 2. Validación estricta de Perfil (CONDUCTOR, TENEDOR o ADMIN de soporte).
      if (perfilUsuario !== "CONDUCTOR" && perfilUsuario !== "TENEDOR" && perfilUsuario !== "ADMIN") {
        setError("🚫 Acceso denegado. Este sistema es exclusivo para Conductores y Tenedores.");
        return;
      }

      // 3. Guardar cookies (sin la clave)
      Cookies.set("conductorCorreo", correoNormalizado, { expires: 30 });
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

      if (err.response && err.response.status === 403 && /pendiente de activaci/i.test(err.response.data?.detail || "")) {
        // 403 de cuenta stub por invitación: aún no aceptó el enlace del tenedor.
        Cookies.remove("conductorId");
        Cookies.remove("conductorPerfil");
        Cookies.remove("conductorPrimerNombre");

        setClave("");
        setError(err.response.data.detail);

      } else if (err.response && err.response.status === 403 && /verificado/i.test(err.response.data?.detail || "")) {
        // 403 de correo sin verificar: ofrecer reenvío del enlace.
        Cookies.remove("conductorId");
        Cookies.remove("conductorPerfil");
        Cookies.remove("conductorPrimerNombre");

        setClave("");
        setNoVerificado(true);
        setError(err.response.data.detail);

      } else if (err.response && (err.response.status === 401 || err.response.status === 403)) {
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
    } finally {
      setCargando(false);
    }
  };

  const reenviarVerificacion = async () => {
    setReenviando(true);
    setReenvioMensaje("");
    try {
      const resp = await fetch(`${API_BASE}/conductores/reenviar-verificacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo.trim().toLowerCase() }),
      });
      const data = await resp.json().catch(() => ({}));
      setReenvioMensaje(data.mensaje || "Si el correo está pendiente, se envió un nuevo enlace.");
    } catch {
      setReenvioMensaje("Error de conexión. Intenta de nuevo.");
    } finally {
      setReenviando(false);
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
            <h2 className="LC-titulo">Ingreso Conductores</h2>
            <p className="LC-subtitulo">Ingresa con tu correo para gestionar tus vehículos</p>
          </div>

          <form className="LC-formulario" onSubmit={manejarLogin}>
            <div className="LC-grupo">
              <label className="LC-label">Correo Electrónico</label>
              <input
                className="LC-input"
                type="email"
                placeholder="ejemplo@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="LC-grupo">
              <label className="LC-label">Contraseña</label>
              <div className="LC-passwordWrap">
                <input
                  className="LC-input LC-inputPassword"
                  type={mostrarClave ? "text" : "password"}
                  placeholder="Contraseña"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarClave(p => !p)}
                  className="LC-ojito"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {mostrarClave ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && <p className="LC-error">{error}</p>}

            {noVerificado && (
              <>
                <button
                  type="button"
                  className="LC-boton LC-botonReenvio"
                  onClick={reenviarVerificacion}
                  disabled={reenviando}
                >
                  {reenviando ? "Enviando…" : "Reenviar correo de verificación"}
                </button>
                {reenvioMensaje && <p className="LC-reenvioMensaje">{reenvioMensaje}</p>}
              </>
            )}

            <button className="LC-boton" type="submit" disabled={cargando}>
              {cargando ? "Verificando…" : "Ingresar"}
            </button>

            <div className="LC-linksFila">
              <Link href="/RegistroConductor" className="LC-link">
                Registrarse
              </Link>
              <span className="LC-separador">·</span>
              <Link href="/OlvidoClaveConductor" className="LC-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
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

export default LoginConductores;
