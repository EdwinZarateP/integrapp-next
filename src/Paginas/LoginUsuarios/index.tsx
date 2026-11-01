'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginUsuario } from "@/Funciones/ApiPedidos/usuarios";
import confetti from "canvas-confetti";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import Link from "next/link";
import logo from '@/Imagenes/albatros.png';
import "./estilos.css";

const LoginUsuario: React.FC = () => {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const clienteCookie = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/);
    const token = window.localStorage.getItem('baseUsuarioAccessToken');
    if (match && clienteCookie && token) {
      const perfilCookie = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
      // FINANCIERO es un micro-portal aislado: aterriza directo en Otros Costos.
      if (perfilCookie === 'FINANCIERO') { router.replace('/OtrosCostos'); return; }
      // VISUALIZADOR es solo lectura: aterriza directo en el panel de indicadores.
      if (perfilCookie === 'VISUALIZADOR') { router.replace('/indicadores'); return; }
      // CLIENTE_ESTUDIOS es cliente externo del portal de Estudios de
      // Seguridad: jamás entra a la Torre de Control ni a /revision.
      if (perfilCookie === 'CLIENTE_ESTUDIOS') { router.replace('/PortalSeguridad'); return; }
      // CLIENTE (2026-10-29) es cliente externo de indicadores: solo ve su
      // portal «Mis Indicadores» con los clientes que tiene asignados.
      if (perfilCookie === 'CLIENTE') { router.replace('/indicadores/mis-clientes'); return; }
      // PADRINO (2026-10-15): su único módulo es Seguridad — vuelve directo a
      // /revision, sin pasar por la pantalla de módulos.
      if (perfilCookie === 'PADRINO') { router.replace('/revision'); return; }
      const cliente = clienteCookie[2];
      // Seguridad entró desde la Torre de Control: vuelve a /revision.
      if (cliente === 'SEGURIDAD') { router.replace('/revision'); return; }
      // El admin del cobro de estudios vuelve a su panel.
      if (cliente === 'ADMIN_SEGURIDAD') { router.replace('/AdminSeguridad'); return; }
      // (2026-10-31) El resto de portales ya no restaura la última sección:
      // todos los perfiles multi-módulo vuelven a la pantalla de Módulos.
      router.replace('/Modulos');
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

      // (2026-10-31) Info completa del usuario para la pantalla de Módulos:
      // le permite setear las cookies seguridad* al entrar al portal de
      // Seguridad sin volver a consultar el backend.
      document.cookie = `usuarioInfoPedidosCookie=${encodeURIComponent(JSON.stringify({
        id: res.usuario.id,
        usuario: res.usuario.usuario,
        nombre: res.usuario.nombre,
        correo: res.usuario.correo,
        perfil: res.usuario.perfil,
        perfiles_adicionales: res.usuario.perfiles_adicionales || [],
      }))}; path=/; ${expires}`;

      const clientes = res.usuario.clientes || ["KABI"];
      // Guardar la lista completa de clientes para habilitar el cambio de portal en los menús
      document.cookie = `clientesPedidosCookie=${clientes.join(",")}; path=/; ${expires}`;

      const perfilUpper = (res.usuario.perfil || "").toUpperCase();

      // FINANCIERO: acceso únicamente al módulo de Otros Costos.
      if (perfilUpper === 'FINANCIERO') {
        document.cookie = `clientePedidosCookie=MEDICAL_CARE; path=/; ${expires}`;
        setTimeout(() => router.replace('/OtrosCostos'), 200);
        return;
      }

      // VISUALIZADOR: solo lectura (históricos e indicadores), aterriza en
      // el panel de indicadores sin pasar por la pantalla de módulos.
      if (perfilUpper === 'VISUALIZADOR') {
        document.cookie = `clientePedidosCookie=MEDICAL_CARE; path=/; ${expires}`;
        setTimeout(() => router.replace('/indicadores'), 200);
        return;
      }

      // CLIENTE_ESTUDIOS: cliente externo → directo al portal de consultas,
      // sin pasar por la Torre de Control (no ve nada de la Torre).
      if (perfilUpper === 'CLIENTE_ESTUDIOS') {
        setTimeout(() => router.replace('/PortalSeguridad'), 200);
        return;
      }

      // CLIENTE (2026-10-29): cliente externo de indicadores → directo a su
      // portal «Mis Indicadores» (solo los clientes que tiene asignados),
      // sin pasar por la pantalla de módulos. (2026-10-30) Si tiene UN solo
      // cliente asignado CON dashboard publicado, entra DERECHO al tablero
      // sin pasar por el panel de selección.
      if (perfilUpper === 'CLIENTE') {
        // El backend rellena clientes=['KABI'] por default cuando la lista va
        // vacía: pisarla para no dejar un portal clásico colgado en cookies.
        document.cookie = `clientesPedidosCookie=MIS_INDICADORES; path=/; ${expires}`;
        document.cookie = `clientePedidosCookie=MIS_INDICADORES; path=/; ${expires}`;
        let ruta = '/indicadores/mis-clientes';
        try {
          const rMis = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/mis-indicadores?usuario=${encodeURIComponent(res.usuario.usuario)}`
          );
          const jMis = await rMis.json().catch(() => null);
          const conDash = (jMis?.data?.clientes || []).filter(
            (c: { cliente_id?: string | null }) => c.cliente_id
          );
          if (conDash.length === 1) ruta = `/indicadores/mis-clientes/${conDash[0].cliente_id}`;
        } catch { /* sin respuesta → al panel, que muestra la asignación */ }
        // Confeti de bienvenida — mismo de la pantalla de módulos (800ms para
        // que se vea antes de navegar).
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        setTimeout(() => router.replace(ruta), 800);
        return;
      }

      // PADRINO (2026-10-15): su único módulo es Seguridad — micro-portal
      // aislado (patrón FINANCIERO/VISUALIZADOR): entra directo a /revision
      // con las cookies seguridad* seteadas, sin ver la pantalla de módulos
      // (KABI/MEDICAL_CARE/INDICADORES quedan fuera de su alcance).
      if (perfilUpper === 'PADRINO') {
        document.cookie = `clientePedidosCookie=SEGURIDAD; path=/; ${expires}`;
        document.cookie = `seguridadId=${res.usuario.id}; path=/; ${expires}`;
        document.cookie = `seguridadNombre=${encodeURIComponent(res.usuario.nombre || res.usuario.usuario)}; path=/; ${expires}`;
        document.cookie = `seguridadPerfil=${res.usuario.perfil}; path=/; ${expires}`;
        if (res.usuario.correo) {
          document.cookie = `seguridadCorreo=${encodeURIComponent(res.usuario.correo)}; path=/; ${expires}`;
        }
        setTimeout(() => router.replace('/revision'), 200);
        return;
      }

      // (2026-10-31) Resto de perfiles (multi-módulo): a la pantalla de
      // Módulos con menú lateral — reemplaza el selector de portales. Los
      // permisos por perfil/cliente los resuelve construirMenu() allí.
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
      setTimeout(() => router.replace('/Modulos'), 800);
    } catch (err: any) {
      // (2026-10-16) El backend distingue «cuenta no existe» de «clave
      // incorrecta» (y el 403 de usuario inactivo): mostrar SU detalle en
      // vez del genérico que no decía qué corregir.
      const detalle = err?.response?.data?.detail;
      if (detalle && [401, 403].includes(err?.response?.status)) {
        setMensajeError(detalle);
      } else {
        setMensajeError("No se pudo iniciar sesión. Verifica tu conexión e inténtalo de nuevo.");
      }
    } finally {
      setCargando(false);
    }
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

        <div className="LU-card">
          <div className="LU-cardHeader">
            <Image src={logo} alt="Logo Integra" height={64} priority />
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
