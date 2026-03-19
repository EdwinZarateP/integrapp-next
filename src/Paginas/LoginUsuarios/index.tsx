'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginUsuario } from "@/Funciones/ApiPedidos/usuarios";
import confetti from "canvas-confetti";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaEye, FaEyeSlash, FaChevronRight } from "react-icons/fa";
import logo from '@/Imagenes/albatros.png';
import "./estilos.css";

const CLIENTES_CONFIG: Record<string, { label: string; desc: string; color: string; ruta: string }> = {
  KABI: {
    label: "Fresenius Kabi",
    desc: "Portal de gestión de pedidos Fresenius Kabi",
    color: "#0f1928",
    ruta: "/Pedidos",
  },
  MEDICAL_CARE: {
    label: "Fresenius Medical Care",
    desc: "Portal de operaciones Fresenius Medical Care",
    color: "#006b5e",
    ruta: "/MedicalCare",
  },
};

const LoginUsuario: React.FC = () => {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [datosUsuario, setDatosUsuario] = useState<{ id: string; usuario: string; perfil: string; regional: string; clientes: string[] } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const clienteCookie = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/);
    if (match && clienteCookie) {
      const cliente = clienteCookie[2];
      router.replace(CLIENTES_CONFIG[cliente]?.ruta || "/Pedidos");
    }
  }, [router]);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError("");
    setCargando(true);
    try {
      const res = await loginUsuario(usuario, clave);
      const expiracion = new Date();
      expiracion.setDate(expiracion.getDate() + 14);
      const expires = `expires=${expiracion.toUTCString()}`;
      document.cookie = `usuarioPedidosCookie=${res.usuario.usuario}; path=/; ${expires}`;
      document.cookie = `regionalPedidosCookie=${res.usuario.regional}; path=/; ${expires}`;
      document.cookie = `perfilPedidosCookie=${res.usuario.perfil}; path=/; ${expires}`;

      const clientes = res.usuario.clientes || ["KABI"];
      setDatosUsuario({ ...res.usuario, clientes });

      if (clientes.length === 1) {
        seleccionarCliente(clientes[0], expires);
      } else {
        setPaso(2);
      }
    } catch {
      setMensajeError("Usuario o clave incorrectos. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const seleccionarCliente = (clienteKey: string, expiresStr?: string) => {
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + 14);
    const expires = expiresStr || `expires=${expiracion.toUTCString()}`;
    document.cookie = `clientePedidosCookie=${clienteKey}; path=/; ${expires}`;
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    const ruta = CLIENTES_CONFIG[clienteKey]?.ruta || "/Pedidos";
    setTimeout(() => router.replace(ruta), 800);
  };

  return (
    <div className="LU-layout">

      {/* ── HEADER ── */}
      <header className="LU-header">
        <div className="LU-headerInner">
          <button className="LU-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="LU-brandName">
              Integr<span className="LU-brandAccent">App</span>
            </span>
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="LU-main">

        {/* ── PASO 1: credenciales ── */}
        {paso === 1 && (
          <div className="LU-card">
            <div className="LU-cardHeader">
              <Image src={logo} alt="Logo Integra" height={64} />
              <h2 className="LU-titulo">Torre de Control</h2>
              <p className="LU-subtitulo">Ingresa tus credenciales para continuar</p>
            </div>

            <form className="LU-formulario" onSubmit={manejarLogin}>
              <div className="LU-grupo">
                <label className="LU-label">Usuario</label>
                <input
                  className="LU-input"
                  type="text"
                  placeholder="Nombre de usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="LU-grupo">
                <label className="LU-label">Contraseña</label>
                <div className="LU-passwordWrap">
                  <input
                    className="LU-input LU-inputPassword"
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
                    className="LU-ojito"
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {mostrarClave ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {mensajeError && <p className="LU-error">{mensajeError}</p>}

              <button className="LU-boton" type="submit" disabled={cargando}>
                {cargando ? "Verificando…" : "Ingresar"}
              </button>
            </form>
          </div>
        )}

        {/* ── PASO 2: selección de cliente ── */}
        {paso === 2 && datosUsuario && (
          <div className="LU-card LU-cardClientes">
            <div className="LU-cardHeader">
              <Image src={logo} alt="Logo Integra" height={64} />
              <h2 className="LU-titulo">Bienvenido, {datosUsuario.usuario}</h2>
              <p className="LU-subtitulo">Selecciona el portal al que deseas ingresar</p>
            </div>

            <div className="LU-clientesLista">
              {datosUsuario.clientes.map((key) => {
                const cfg = CLIENTES_CONFIG[key];
                if (!cfg) return null;
                return (
                  <button
                    key={key}
                    className="LU-clienteCard"
                    style={{ borderColor: cfg.color }}
                    onClick={() => seleccionarCliente(key)}
                  >
                    <div className="LU-clienteCardDot" style={{ background: cfg.color }} />
                    <div className="LU-clienteCardTexto">
                      <span className="LU-clienteCardNombre">{cfg.label}</span>
                      <span className="LU-clienteCardDesc">{cfg.desc}</span>
                    </div>
                    <FaChevronRight className="LU-clienteCardFlecha" />
                  </button>
                );
              })}
            </div>

            <button className="LU-volverBtn" onClick={() => { setPaso(1); setDatosUsuario(null); }}>
              ← Volver
            </button>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="LU-footer">
        <div className="LU-footerInner">
          <div className="LU-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="LU-footerLinks">
            <a href="tel:+573125443396" className="LU-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="LU-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="LU-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="LU-footerCopy">© {new Date().getFullYear()} Integra — Torre de Control</span>
        </div>
      </footer>
    </div>
  );
};

export default LoginUsuario;
