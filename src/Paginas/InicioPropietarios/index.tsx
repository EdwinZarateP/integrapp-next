'use client';
import React, { useState, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@/Imagenes/albatros.png";
import Cookies from 'js-cookie';
import BotonSencillo from "@/Componentes/BotonSencillo";
import { ContextoApp } from "@/Contexto/index";
import HashLoader from "react-spinners/HashLoader";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import "./estilos.css";

const InicioPropietarios: React.FC = () => {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  const almacenVariables = useContext(ContextoApp);
  const [passwordVisible, setVisibilidadPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const manejarVisibilidadPassword = () => setVisibilidadPassword(v => !v);

  const manejarCambio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (almacenVariables) {
      if (name === "email") almacenVariables.setEmail(value);
      if (name === "password") almacenVariables.setPassword(value);
    }
  };

  const manejarEnvioFormulario = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/usuarios/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: almacenVariables?.email || "",
          password: almacenVariables?.password || "",
        }),
      });
      if (!response.ok) throw new Error("Credenciales incorrectas");
      const data = await response.json();
      if (data.nombre) {
        almacenVariables?.setNombre(data.nombre);
        Cookies.set('nombreIntegrapp', data.nombre, { expires: 7 });
      }
      if (data.tenedor) {
        await almacenVariables?.setTenedor(data.tenedor);
        Cookies.set('tenedorIntegrapp', data.tenedor, { expires: 7 });
      } else {
        throw new Error("El servidor no devolvió el tenedor.");
      }
      router.push("/SalaEspera");
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="IP-loadingOverlay">
        <HashLoader size={60} color={"#e8a000"} loading={loading} />
        <p>Verificando tu identidad…</p>
      </div>
    );
  }

  return (
    <div className="IP-layout">

      {/* ── HEADER ── */}
      <header className="IP-header">
        <div className="IP-headerInner">
          <button className="IP-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="IP-brandName">
              Integr<span className="IP-brandAccent">App</span>
            </span>
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="IP-main">
        <div className="IP-card">
          <div className="IP-cardHeader">
            <Image src={logo} alt="Logo Integra" height={64} />
            <h2 className="IP-titulo">Portal Transportadores</h2>
            <p className="IP-subtitulo">Ingresa con tu correo y contraseña</p>
          </div>

          <form className="IP-formulario" onSubmit={manejarEnvioFormulario}>
            <div className="IP-grupo">
              <label htmlFor="email" className="IP-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="correo@ejemplo.com"
                className="IP-input"
                value={almacenVariables?.email || ""}
                onChange={manejarCambio}
                required
                autoComplete="username"
              />
            </div>

            <div className="IP-grupo">
              <label htmlFor="password" className="IP-label">Contraseña</label>
              <div className="IP-passwordWrap">
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Digite su contraseña"
                  className="IP-input IP-inputPassword"
                  value={almacenVariables?.password || ""}
                  onChange={manejarCambio}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={manejarVisibilidadPassword}
                  className="IP-ojito"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {passwordVisible ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {errorMessage && <p className="IP-error">{errorMessage}</p>}

            <BotonSencillo type="submit" texto="Ingresar" colorClass="negro" />
          </form>

          <div className="IP-links">
            <Link href="/Registro" className="IP-enlace">Registrarse</Link>
            <Link href="/olvidoclave" className="IP-enlace">Olvidé la clave</Link>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="IP-footer">
        <div className="IP-footerInner">
          <div className="IP-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="IP-footerLinks">
            <a href="tel:+573125443396" className="IP-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="IP-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="IP-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="IP-footerCopy">© {new Date().getFullYear()} Integra — Portal Transportadores</span>
        </div>
      </footer>
    </div>
  );
};

export default InicioPropietarios;
