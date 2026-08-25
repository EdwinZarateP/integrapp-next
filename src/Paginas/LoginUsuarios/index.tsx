'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginUsuario } from "@/Funciones/ApiPedidos/usuarios";
import confetti from "canvas-confetti";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaEye, FaEyeSlash, FaChevronRight } from "react-icons/fa";
import Link from "next/link";
import logo from '@/Imagenes/albatros.png';
import "./estilos.css";

// Perfiles que pueden ver el portal de Flota Disponible (coincide con /FlotaDisponible).
const PERFILES_FLOTA = ["ADMIN", "ANALISTA", "COORDINADOR", "CONTROL"];

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
  FLOTA: {
    label: "Flota Disponible",
    desc: "Vehículos disponibles hoy — contacto directo a conductores",
    color: "#e8a000",
    ruta: "/FlotaDisponible",
  },
  INDICADORES: {
    label: "Indicadores Integra",
    desc: "Menú principal de dashboards e indicadores",
    color: "#2563eb",
    ruta: "/indicadores",
  },
  SICETAC: {
    label: "SICE-TAC",
    desc: "Consulta masiva de costos eficientes de transporte",
    color: "#00796b",
    ruta: "/Sicetac",
  },
  SEGURIDAD: {
    label: "Seguridad",
    desc: "Revisión y aprobación de vehículos",
    color: "#dc2626",
    ruta: "/revision",
  },
};

// Perfiles que pueden ver el portal de Seguridad (/revision).
const PERFILES_SEGURIDAD = ["ADMIN", "SEGURIDAD"];

// Orden visual de los portales en el selector (Flota va justo después de Medical Care).
const ORDEN_PORTALES = ["KABI", "MEDICAL_CARE", "FLOTA", "INDICADORES", "SICETAC", "SEGURIDAD"];

const LoginUsuario: React.FC = () => {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [datosUsuario, setDatosUsuario] = useState<{ id: string; usuario: string; nombre?: string; correo?: string; perfil: string; regional: string; clientes: string[] } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const clienteCookie = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/);
    const token = window.localStorage.getItem('baseUsuarioAccessToken');
    if (match && clienteCookie && token) {
      const perfilCookie = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
      // FINANCIERO es un micro-portal aislado: aterriza directo en Otros Costos.
      if (perfilCookie === 'FINANCIERO') { router.replace('/OtrosCostos'); return; }
      const cliente = clienteCookie[2];
      // Seguridad entró desde la Torre de Control: vuelve a /revision.
      if (cliente === 'SEGURIDAD') { router.replace('/revision'); return; }
      router.replace(CLIENTES_CONFIG[cliente]?.ruta || "/Pedidos");
    }
  }, [router]);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError("");
    setCargando(true);
    try {
      const res = await loginUsuario(usuario, clave);
      window.localStorage.setItem('baseUsuarioAccessToken', res.access_token);
      const expiracion = new Date();
      expiracion.setDate(expiracion.getDate() + 14);
      const expires = `expires=${expiracion.toUTCString()}`;
      document.cookie = `usuarioPedidosCookie=${res.usuario.usuario}; path=/; ${expires}`;
      document.cookie = `regionalPedidosCookie=${res.usuario.regional}; path=/; ${expires}`;
      document.cookie = `perfilPedidosCookie=${res.usuario.perfil}; path=/; ${expires}`;

      const clientes = res.usuario.clientes || ["KABI"];
      // Guardar la lista completa de clientes para habilitar el cambio de portal en los menús
      document.cookie = `clientesPedidosCookie=${clientes.join(",")}; path=/; ${expires}`;

      // Portales extra en el selector: Indicadores siempre; Flota solo si el perfil puede verla.
      const perfilUpper = (res.usuario.perfil || "").toUpperCase();

      // FINANCIERO: acceso únicamente al módulo de Otros Costos.
      if (perfilUpper === 'FINANCIERO') {
        document.cookie = `clientePedidosCookie=MEDICAL_CARE; path=/; ${expires}`;
        setTimeout(() => router.replace('/OtrosCostos'), 200);
        return;
      }

      const extras = ["INDICADORES"];
      if (PERFILES_FLOTA.includes(perfilUpper)) extras.push("FLOTA");
      if (["ADMIN", "ADMINISTRADOR"].includes(perfilUpper)) extras.push("SICETAC");
      if (PERFILES_SEGURIDAD.includes(perfilUpper)) extras.push("SEGURIDAD");

      // Reordenar según el orden canónico del selector (Flota después de Medical Care).
      const keys = Array.from(new Set([...clientes, ...extras]));
      const keysOrdenadas = ORDEN_PORTALES.filter((k) => keys.includes(k));
      setDatosUsuario({ ...res.usuario, clientes: keysOrdenadas });

      if (keysOrdenadas.length === 1) {
        seleccionarCliente(keysOrdenadas[0], expires);
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

    // Portal de Seguridad: setea las cookies que /revision gatea y entra directo.
    if (clienteKey === "SEGURIDAD") {
      document.cookie = `clientePedidosCookie=SEGURIDAD; path=/; ${expires}`;
      if (datosUsuario) {
        document.cookie = `seguridadId=${datosUsuario.id}; path=/; ${expires}`;
        document.cookie = `seguridadNombre=${encodeURIComponent(datosUsuario.nombre || datosUsuario.usuario)}; path=/; ${expires}`;
        document.cookie = `seguridadPerfil=${datosUsuario.perfil}; path=/; ${expires}`;
        if (datosUsuario.correo) {
          document.cookie = `seguridadCorreo=${encodeURIComponent(datosUsuario.correo)}; path=/; ${expires}`;
        }
      }
      router.replace("/revision");
      return;
    }

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
                <label className="LU-label">Correo Electrónico</label>
                <input
                  className="LU-input"
                  type="email"
                  placeholder="nombre@integralogistica.com"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  autoComplete="email"
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

              <Link href="/OlvidoClaveBaseUsuario" className="LU-olvidaste">
                ¿Olvidaste tu contraseña?
              </Link>
            </form>
          </div>
        )}

        {/* ── PASO 2: selección de cliente ── */}
        {paso === 2 && datosUsuario && (
          <div className="LU-card LU-cardClientes">
            <div className="LU-cardHeader">
              <Image src={logo} alt="Logo Integra" height={64} />
              <h2 className="LU-titulo">Bienvenido, {datosUsuario.nombre || datosUsuario.usuario}</h2>
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
