"use client";

/* Portal CLIENTE de Estudios de Seguridad: la empresa cliente entra con su
   correo y clave, ve su plan, consulta una cédula, descarga el PDF del
   informe y revisa su historial. Independiente de la Torre de Control. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Swal from "sweetalert2";
import { ClipLoader } from "react-spinners";
import Lottie from "lottie-react";
import animationDetective from "@/Imagenes/AnimationDetective.json";
import logo from "@/Imagenes/albatros.png";
import {
  FaSearch, FaFilePdf, FaSignOutAlt, FaHistory, FaIdCard, FaChartPie,
  FaUserCircle, FaChevronDown, FaBars, FaArrowLeft, FaCarSide,
} from "react-icons/fa";
import {
  CupoCliente,
  EstudioDetalle,
  EstudioResumen,
  crearEstudio,
  descargarPdfEstudio,
  haySesionCliente,
  listarEstudios,
  loginCliente,
  cerrarSesionCliente,
  mensajeError,
  obtenerCupo,
  pesosColombianos,
  usuarioCliente,
} from "@/Funciones/ApiPedidos/seguridadCliente";
import "./estilos.css";

// Mongo/FastAPI entrega actualmente algunos datetime UTC sin sufijo `Z`.
// JavaScript interpretaría esos valores como hora local. Añadir la zona UTC
// cuando falta y mostrar siempre en la zona oficial de Colombia también
// corrige los estudios históricos ya almacenados.
const fechaHoraColombia = (valor: string) => {
  const fechaConZona = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(valor) ? valor : `${valor}Z`;
  return new Date(fechaConZona).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
  });
};

export default function PortalSeguridadP() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sesion, setSesion] = useState<ReturnType<typeof usuarioCliente>>(null);
  const [cupo, setCupo] = useState<CupoCliente | null>(null);
  const [cedula, setCedula] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [estudioNuevo, setEstudioNuevo] = useState<EstudioDetalle | null>(null);
  const [historial, setHistorial] = useState<EstudioResumen[]>([]);
  const [totalHistorial, setTotalHistorial] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Login (pantalla 1) o portal (pantalla 2)
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [errorLogin, setErrorLogin] = useState("");

  const esSesionValida = useCallback(() => haySesionCliente(), []);

  // Posición del mensaje rotativo que acompaña al detective.
  const [indiceMensaje, setIndiceMensaje] = useState(0);

  const cargarPortal = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([
        obtenerCupo(),
        listarEstudios({ limit: 10, skip: pagina * 10 }),
      ]);
      setCupo(c);
      setHistorial(h.items);
      setTotalHistorial(h.total);
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        cerrarSesionCliente();
        setSesion(null);
        return;
      }
      Swal.fire("Error", mensajeError(e), "error");
    }
  }, [pagina]);

  useEffect(() => {
    if (esSesionValida()) {
      setSesion(usuarioCliente());
    }
  }, [esSesionValida]);

  // Cerrar el menú de usuario al hacer click fuera (patrón AdminSeguridad).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (sesion) cargarPortal();
  }, [sesion, cargarPortal]);

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin("");
    setEntrando(true);
    try {
      const s = await loginCliente(correo.trim(), clave);
      setSesion(s.usuario);
    } catch (e: any) {
      setErrorLogin(mensajeError(e));
    } finally {
      setEntrando(false);
    }
  };

  const salir = () => {
    cerrarSesionCliente();
    setSesion(null);
    setCupo(null);
    setEstudioNuevo(null);
    setCorreo("");
    setClave("");
  };

  // ── CONSULTA ────────────────────────────────────────────────────────────
  // El plan se elige ABRRIENDO su acordeón: el formulario pide los campos que
  // ESE plan requiere (cédula siempre; placa solo si incluye la fuente runt).
  const [planAbierto, setPlanAbierto] = useState<string | null>(null);
  const [placa, setPlaca] = useState("");
  // Cédula del PROPIETARIO del vehículo (solo runt): el RUNT valida contra el
  // dueño ACTIVO de la placa, que muchas veces no es el conductor evaluado.
  const [cedulaPropietario, setCedulaPropietario] = useState("");
  // Nombres/apellidos de la persona evaluada (solo procuraduria): el captcha
  // de la PGN pregunta por ellos ("¿cuál es el primer nombre de la persona
  // que está consultando?"). Se envían SIN tildes (el backend normaliza).
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [nit, setNit] = useState("");

  // Sonido de notificación al terminar la consulta (2026-09-01, pedido del
  // usuario): el mismo "ding" de SolicitudVehiculos al cargar planillas —
  // Web Audio API, sin archivo. La consulta tarda hasta ~2 min: el aviso
  // sonoro permite atender otra cosa mientras tanto.
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Sonido tipo "ding" agradable
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);

      // Envelope suave
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.warn("No se pudo reproducir el sonido:", error);
    }
  };

  const nombreFuente = (f: string) =>
    f === "manifiestos_rndc" ? "Manifiestos RNDC"
    : f === "procuraduria" ? "Procuraduría"
    : f === "contraloria" ? "Contraloría (fiscales)"
    : f === "policia" ? "Antecedentes Policía"
    : f === "runt" ? "Vehículo RUNT"
    : f === "simit" ? "Comparendos SIMIT"
    : f === "sena" ? "Formación SENA"
    : f === "ofac" ? "OFAC personas (cédula)"
    : f === "ofac_nit" ? "OFAC empresas (NIT)"
    : f === "bdme" ? "BDME personas (cédula)"
    : f === "bdme_nit" ? "BDME empresas (NIT)"
    : f === "rama_judicial" ? "Rama Judicial (procesos por nombre)"
    : f === "rues" ? "RUES — Registro Mercantil (NIT)"
    : f;

  const planActivo = cupo?.planes?.find((p) => p.plan_id === planAbierto) ?? null;
  const mensajePorFuente: Record<string, string> = {
    manifiestos_rndc: "Investigando en Manifiestos RNDC…",
    procuraduria: "Revisando antecedentes en Procuraduría…",
    contraloria: "Consultando antecedentes fiscales en la Contraloría…",
    policia: "Consultando antecedentes judiciales en la Policía…",
    runt: "Consultando información del vehículo en RUNT…",
    simit: "Revisando comparendos en SIMIT…",
    sena: "Consultando formación en el SENA…",
    ofac: "Cruzando la persona con listas OFAC…",
    ofac_nit: "Cruzando la empresa con listas OFAC…",
    bdme: "Consultando la persona en BDME…",
    bdme_nit: "Consultando la empresa en BDME…",
    rama_judicial: "Buscando procesos en la Rama Judicial…",
    rues: "Verificando la matrícula mercantil en el RUES…",
  };
  // Mostrar solamente las fuentes del plan abierto. Antes esta lista era
  // fija y por eso un plan exclusivo de BDME mencionaba Procuraduría y
  // Policía aunque nunca se estuvieran consultando.
  const mensajesConsulta = [
    ...(planActivo?.fuentes ?? []).map(
      (fuente) => mensajePorFuente[fuente] ?? `Consultando ${nombreFuente(fuente)}…`
    ),
    "Cruzando resultados y preparando su informe…",
  ];
  useEffect(() => {
    if (!consultando) return;
    setIndiceMensaje(0);
    const rotador = setInterval(() => {
      setIndiceMensaje((i) => (i + 1) % mensajesConsulta.length);
    }, 4000);
    return () => clearInterval(rotador);
    // El plan no puede cambiar mientras el formulario está consultando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultando, planAbierto]);
  // Placa la piden runt Y simit (ambas consultan por vehículo); la cédula del
  // propietario es SOLO de runt (simit no conoce propietario).
  const requierePlaca =
    planActivo?.fuentes?.some((f) => f === "runt" || f === "simit") ?? false;
  const requierePropietario = planActivo?.fuentes?.includes("runt") ?? false;
  // Procuraduría: el captcha de la PGN pregunta por el NOMBRE de la persona
  // consultada — el portal lo exige para poder responderla.
  const requiereNombres = planActivo?.fuentes?.some(
    (f) => f === "procuraduria" || f === "rama_judicial"
  ) ?? false;
  const requiereNit = planActivo?.fuentes?.some((f) => f === "ofac_nit" || f === "bdme_nit" || f === "rues") ?? false;
  const requiereCedula = planActivo?.fuentes?.some(
    (f) => f !== "ofac_nit" && f !== "bdme_nit" && f !== "rama_judicial" && f !== "rues"
  ) ?? false;
  // Las fuentes del plan se consultan EN PARALELO: el tiempo total es el de
  // la MÁS LENTA (no la suma). Presupuesto orientativo por fuente (portal
  // vivo + reintento), tope del backend 150 s por fuente.
  const SEGUNDOS_FUENTE: Record<string, number> = {
    manifiestos_rndc: 45,
    procuraduria: 120,
    contraloria: 110, // reCAPTCHA v2 (solve 10-60 s) + descarga del certificado
    policia: 110,
    runt: 75,
    simit: 20,
    sena: 70, // portal rápido (~5 s) + solve del captcha de imagen (10-60 s)
    ofac: 15, // dataset oficial indexado; la primera descarga puede tardar
    ofac_nit: 15,
    bdme: 120,
    bdme_nit: 120,
    rama_judicial: 90,
    rues: 15, // API directo sin navegador ni captcha (~1-2 s)
  };
  const estimacionSegundos = (() => {
    const fs = planActivo?.fuentes ?? [];
    if (!fs.length) return 60;
    return Math.max(...fs.map((f) => SEGUNDOS_FUENTE[f] ?? 60));
  })();

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitos = cedula.replace(/\D/g, "");
    if (requiereCedula && (digitos.length < 3 || digitos.length > 15)) {
      Swal.fire("Cédula inválida", "Debe tener entre 3 y 15 dígitos", "warning");
      return;
    }
    // Con formato 900123456-7 se descarta el DV. Si son solo dígitos, se
    // asume que el usuario ya ingresó el NIT base sin DV.
    const nitNorm = nit.trim().replace(/-\s*\d\s*$/, "").replace(/\D/g, "");
    if (requiereNit && (nitNorm.length < 6 || nitNorm.length > 15)) {
      Swal.fire("NIT inválido", "Ingrese el NIT sin dígito de verificación", "warning");
      return;
    }
    // Sin planes elegibles no hay nada que consultar (la tarjeta de plan ya
    // lo explica, pero el botón puede quedar habilitado).
    if (!(cupo?.planes?.length)) {
      Swal.fire("Sin plan activo", "Su empresa no tiene planes con cupo disponible. Contacte a Integra Logística.", "warning");
      return;
    }
    // La elección de plan es OBLIGATORIA (abrir el acordeón del plan).
    if (!planAbierto || !planActivo) {
      Swal.fire("Elija un plan", "Abra el plan con el que desea consultar.", "warning");
      return;
    }
    // El cupo pudo agotarse mientras el acordeón estaba abierto.
    if (!planActivo.ilimitado && (planActivo.cupo_disponible ?? 0) <= 0) {
      Swal.fire("Sin cupo", `El plan ${planActivo.nombre} no tiene consultas disponibles.`, "warning");
      return;
    }
    // Placa: requerida si el plan incluye runt o simit (consultas de vehículo).
    let placaNorm: string | undefined;
    let propietarioNorm: string | undefined;
    let nombresNorm: string | undefined;
    let apellidosNorm: string | undefined;
    if (requierePlaca) {
      placaNorm = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (!/^[A-Z]{3}\d{2}[\dA-Z]$|^[A-Z]{2}\d{4}$/.test(placaNorm)) {
        Swal.fire("Placa inválida", "Use el formato AAA123 (o AAA12A para moto)", "warning");
        return;
      }
    }
    if (requierePropietario) {
      // Cédula del propietario (solo runt): OPCIONAL (vacía = el conductor es
      // el dueño).
      const prop = cedulaPropietario.replace(/\D/g, "");
      if (prop && (prop.length < 3 || prop.length > 15)) {
        Swal.fire("Cédula de propietario inválida", "Debe tener entre 3 y 15 dígitos (o déjela vacía si el conductor es el propietario)", "warning");
        return;
      }
      propietarioNorm = prop || undefined;
    }
    // Nombres/apellidos (solo procuraduria): OBLIGATORIOS — el captcha de la
    // PGN pregunta por el nombre de la persona consultada.
    if (requiereNombres) {
      nombresNorm = nombres.trim();
      apellidosNorm = apellidos.trim();
      if (nombresNorm.length < 2 || apellidosNorm.length < 2) {
        Swal.fire(
          "Faltan los nombres",
          "El plan requiere los nombres y apellidos completos de la persona a consultar.",
          "warning"
        );
        return;
      }
    }
    setConsultando(true);
    setEstudioNuevo(null);
    try {
      const estudio = await crearEstudio(requiereCedula ? digitos : undefined, undefined, planAbierto, placaNorm, propietarioNorm, nombresNorm, apellidosNorm, requiereNit ? nitNorm : undefined);
      playNotificationSound(); // la consulta terminó
      setEstudioNuevo(estudio);
      // Mismo criterio del backend (2026-09-01): la consulta NO se cobra solo
      // si >51% de las fuentes corridas fallaron.
      const corridas = Object.values(estudio.fuentes ?? {}).filter(
        (f: any) => f?.estado && f.estado !== "DESHABILITADA"
      );
      const fallidas = corridas.filter((f: any) => f.estado === "NO_DISPONIBLE" || f.estado === "ERROR");
      const sinCobro = corridas.length === 0 || fallidas.length / corridas.length > 0.51;
      let titulo = "Consulta completada";
      let icono: "success" | "warning" | "error" = "success";
      if (estudio.estado === "COMPLETADA_CON_ADVERTENCIAS") {
        titulo = "Completada con advertencias"; icono = "warning";
      } else if (estudio.estado === "PARCIAL") {
        titulo = sinCobro
          ? "Parcial: la mayoría de las fuentes falló (no se cobra)"
          : "Parcial: una fuente no respondió";
        icono = "warning";
      } else if (estudio.estado === "ERROR") {
        titulo = "Sin resultados (no se cobra)"; icono = "error";
      }
      Swal.fire({
        title: titulo,
        text:
          estudio.estado === "ERROR"
            ? "Las fuentes fallaron. La consulta no tiene costo — intente de nuevo en unos minutos."
            : `Persona: ${estudio.nombre_consultado || "no identificada"}${estudio.placa ? ` · Placa ${estudio.placa}` : ""} · Consulta ${estudio.consulta_id}`,
        icon: icono,
        timer: estudio.estado === "ERROR" ? 9000 : 5000,
      });
      cargarPortal();
    } catch (e: any) {
      playNotificationSound(); // también terminó (con error): avisar igual
      Swal.fire("No se pudo consultar", mensajeError(e), "error");
    } finally {
      setConsultando(false);
    }
  };

  const abrirPdf = async (consultaId: string) => {
    try {
      const blob = await descargarPdfEstudio(consultaId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      Swal.fire("No se pudo abrir el PDF", mensajeError(e), "error");
    }
  };

  // ── Estado visual de una consulta ───────────────────────────────────────
  const claseEstado = (estado: string) =>
    estado === "COMPLETADA" ? "PS-verde" : estado === "ERROR" ? "PS-rojo" : "PS-ambar";
  const textoEstado = (estado: string) =>
    ({
      COMPLETADA: "Completada",
      COMPLETADA_CON_ADVERTENCIAS: "Con advertencias",
      PARCIAL: "Parcial",
      ERROR: "Sin resultados",
      EN_PROGRESO: "En progreso",
    }[estado] ?? estado);

  // ══════════════════ PANTALLA 1: LOGIN ══════════════════
  if (!sesion) {
    return (
      <div className="PS-login-fondo">
        <form className="PS-login-caja" onSubmit={entrar}>
          <div className="PS-login-logo">🛡️</div>
          <h1>Consultas de Seguridad</h1>
          <p className="PS-login-sub">Ingrese con el correo de su empresa</p>
          <input
            type="email" placeholder="correo@empresa.com" value={correo}
            onChange={(e) => setCorreo(e.target.value)} required autoFocus
          />
          <input
            type="password" placeholder="Contraseña" value={clave}
            onChange={(e) => setClave(e.target.value)} required
          />
          {errorLogin && <p className="PS-login-error">{errorLogin}</p>}
          <button type="submit" disabled={entrando}>
            {entrando ? <ClipLoader size={16} color="#fff" /> : "Ingresar"}
          </button>
          <p className="PS-login-pie">Servicio de Integra Logística</p>
        </form>
      </div>
    );
  }

  // ══════════════════ PANTALLA 2: PORTAL ══════════════════

  return (
    <div className="PS-pagina">
      {/* Header de la app (mismo patrón que AdminSeguridad): barra a ANCHO
          COMPLETO; hamburguesa en móvil para el menú del usuario. */}
      <header className="AS-header-app PS-header-app">
        <div className="AS-header-inner PS-header-inner">
          <button className="AS-brand" onClick={() => router.push("/")} title="Volver al inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="AS-brandName">Integr<span className="AS-brandAccent">App</span></span>
          </button>

          <div className="PS-header-info">
            <span className="PS-header-titulo">Consultas de Seguridad</span>
            <span className="PS-header-empresa">{sesion?.empresa?.nombre ?? sesion.nombre}</span>
          </div>

          <div className="AS-userZone" ref={menuRef}>
            <button className="AS-userBtn PS-userBtn" onClick={() => setMenuAbierto(o => !o)} aria-label="Menú de usuario">
              <FaUserCircle className="AS-userIcon PS-menu-icono" />
              <div className="AS-userInfo PS-userInfo">
                <span className="AS-userName">{sesion?.nombre}</span>
                <span className="AS-userPerfil">{sesion?.empresa?.nombre ?? "Cliente"}</span>
              </div>
              <FaChevronDown className={`AS-chevron ${menuAbierto ? "AS-chevronOpen" : ""}`} />
            </button>
            {/* Hamburguesa (solo móvil): alterna el mismo menú desplegable. */}
            <button className="PS-hamburguesa" onClick={() => setMenuAbierto(o => !o)} aria-label="Abrir menú">
              <FaBars />
            </button>

            {menuAbierto && (
              <div className="AS-dropdown">
                <div className="PS-menu-encabezado">
                  <strong>{sesion?.nombre}</strong>
                  <small>{sesion?.empresa?.nombre ?? ""}</small>
                </div>
                <div className="AS-dropDivider" />
                <button className="AS-dropItem" onClick={() => { setMenuAbierto(false); router.push("/"); }}>
                  <FaArrowLeft /> Volver al inicio
                </button>
                <div className="AS-dropDivider" />
                <button className="AS-dropItem AS-dropItemDanger" onClick={() => { setMenuAbierto(false); salir(); }}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="PS-contenedor">
      <div className="PS-grid">
        {/* ── Consulta ── */}
        <section className="PS-tarjeta PS-consulta">
          <h2><FaSearch /> Nueva consulta</h2>
          <p className="PS-ayuda">Abra el plan con el que desea consultar y diligencie los datos que pide.</p>
          {/* Acordeón por plan: el formulario pide los campos que ESE plan
              requiere (cédula siempre; placa solo si incluye la fuente runt) */}
          {(cupo?.planes?.length ?? 0) > 0 ? (
            <div className="PS-acordeon">
              {cupo!.planes!.map((p) => {
                const abierto = planAbierto === p.plan_id;
                const pidePlaca = p.fuentes?.some((f) => f === "runt" || f === "simit");
                const pidePropietario = p.fuentes?.includes("runt");
                const pideNombres = p.fuentes?.some(
                  (f) => f === "procuraduria" || f === "rama_judicial"
                );
                const pideNit = p.fuentes?.some((f) => f === "ofac_nit" || f === "bdme_nit" || f === "rues");
                const pideCedula = p.fuentes?.some(
                  (f) => f !== "ofac_nit" && f !== "bdme_nit" && f !== "rama_judicial" && f !== "rues"
                );
                return (
                  <div key={p.plan_id} className={`PS-acordeon-item ${abierto ? "PS-acordeon-abierto" : ""}`}>
                    <button
                      type="button"
                      className="PS-acordeon-cab"
                      onClick={() => setPlanAbierto(abierto ? null : p.plan_id)}
                      disabled={consultando}
                      aria-expanded={abierto}
                    >
                      <span className="PS-acordeon-titulo">
                        <strong>{p.nombre}</strong>
                        <small>
                          {p.fuentes.map(nombreFuente).join(" + ")}
                          {" · "}
                          {p.ilimitado
                            ? "sin límite"
                            : `quedan ${p.cupo_disponible ?? 0} · ${pesosColombianos(p.precio_por_estudio)}`}
                        </small>
                      </span>
                      <FaChevronDown className={`PS-chevron ${abierto ? "PS-chevron-arriba" : ""}`} />
                    </button>
                    {abierto && (
                      <form onSubmit={consultar} className="PS-acordeon-cuerpo">
                        {pideCedula && <div className="PS-input-icono">
                          <FaIdCard />
                          <input
                            inputMode="numeric" pattern="[0-9]*" placeholder="Cédula" value={cedula}
                            onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                            maxLength={15} disabled={consultando} autoFocus
                          />
                        </div>}
                        {pideNit && (
                          <div className="PS-input-icono">
                            <FaIdCard />
                            <input
                              inputMode="numeric" pattern="[0-9]*" placeholder="NIT sin dígito de verificación"
                              value={nit} onChange={(e) => setNit(e.target.value.replace(/\D/g, ""))}
                              maxLength={15} disabled={consultando} autoFocus={!pideCedula}
                            />
                          </div>
                        )}
                        {pideNombres && (
                          <>
                            <div className="PS-input-icono">
                              <FaUserCircle />
                              <input
                                placeholder="Nombres completos" value={nombres}
                                onChange={(e) => setNombres(e.target.value)}
                                maxLength={60} disabled={consultando} autoCapitalize="characters"
                              />
                            </div>
                            <div className="PS-input-icono">
                              <FaUserCircle />
                              <input
                                placeholder="Apellidos completos" value={apellidos}
                                onChange={(e) => setApellidos(e.target.value)}
                                maxLength={60} disabled={consultando} autoCapitalize="characters"
                              />
                            </div>
                          </>
                        )}
                        {pidePlaca && (
                          <div className="PS-input-icono">
                            <FaCarSide />
                            <input
                              placeholder="Placa del vehículo" value={placa}
                              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                              maxLength={6} autoCapitalize="characters" disabled={consultando}
                            />
                          </div>
                        )}
                        {pidePropietario && (
                          <div className="PS-input-icono">
                            <FaUserCircle />
                            <input
                              inputMode="numeric" pattern="[0-9]*"
                              placeholder="Cédula del propietario (vacía si es el conductor)"
                              value={cedulaPropietario}
                              onChange={(e) => setCedulaPropietario(e.target.value.replace(/\D/g, ""))}
                              maxLength={15} disabled={consultando}
                            />
                          </div>
                        )}
                        {pidePlaca && !pidePropietario && (
                          <p className="PS-ayuda" style={{ marginTop: 8 }}>
                            La fuente SIMIT consulta los comparendos y multas de la
                            placa ante el SIMIT (no requiere cédula del propietario).
                          </p>
                        )}
                        <button
                          type="submit" className="PS-boton-primario"
                          disabled={
                            consultando || (pideCedula && !cedula) || (pideNit && !nit)
                            || (pideNombres && (nombres.trim().length < 2 || apellidos.trim().length < 2))
                          }
                        >
                          {consultando ? <><ClipLoader size={14} color="#fff" /> Consultando…</> : "Consultar"}
                        </button>
                        {pideNombres && (
                          <p className="PS-ayuda" style={{ marginTop: 8 }}>
                            La Procuraduría valida la consulta preguntando por el nombre de la
                            persona: diligencie sus <strong>nombres y apellidos sin tildes</strong> tal
                            como aparecen en su cédula.
                          </p>
                        )}
                        {pidePropietario && (
                          <p className="PS-ayuda" style={{ marginTop: 8 }}>
                            La fuente RUNT consulta el vehículo por placa + cédula de su propietario.
                            Si el conductor no es el dueño, diligencie la cédula del propietario para
                            que la validación del vehículo salga en este mismo informe.
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="PS-cupo-sin-plan">
              Su empresa no tiene un plan activo. Contacte a Integra Logística para activar su servicio.
            </p>
          )}
          {consultando && (
            <div className="PS-investigando">
              <Lottie
                animationData={animationDetective}
                loop
                autoplay
                style={{ width: 190, height: 190, margin: "0 auto" }}
              />
              <p className="PS-investigando-mensaje">{mensajesConsulta[indiceMensaje]}</p>
              <p className="PS-investigando-sub">
                Las fuentes del plan se consultan en paralelo: esto puede tomar
                de 3 a {estimacionSegundos} segundos (según la fuente más lenta). No cierre la ventana.
              </p>
            </div>
          )}

          {estudioNuevo && (
            <div className={`PS-resultado ${claseEstado(estudioNuevo.estado)}`}>
              <div className="PS-resultado-cab">
                <strong>{estudioNuevo.nombre_consultado || "Persona no identificada"}</strong>
                <span className="PS-badge">{textoEstado(estudioNuevo.estado)}</span>
              </div>
              <div className="PS-resultado-datos">
                <span>Cédula {estudioNuevo.cedula}</span>
                {estudioNuevo.placa && <span>Placa {estudioNuevo.placa}</span>}
                {estudioNuevo.vehiculos?.[0] && !estudioNuevo.vehiculos[0].propietario_es_evaluado && (
                  <span>Propietario del vehículo: cédula distinta a la evaluada (ver PDF)</span>
                )}
                <span>{fechaHoraColombia(estudioNuevo.creado_en)}</span>
                {/* Badges SOLO de las fuentes que CORRIERON (las del plan): una
                    DESHABILITADA no se consultó ni se cobró — no se muestra. */}
                {(() => {
                  const f = estudioNuevo.fuentes ?? {};
                  const corrio = (x?: { estado?: string | null }) =>
                    !!x?.estado && x.estado !== "DESHABILITADA";
                  return (
                    <>
                      {corrio(f.procuraduria) && (
                        <span>Procuraduría: {
                          f.procuraduria!.no_registra === true ? "✅ Sin anotaciones"
                          : f.procuraduria!.no_registra === false ? "⛔ Registra anotaciones"
                          : "⚠️ Ver PDF"}
                        </span>
                      )}
                      {corrio(f.contraloria) && (
                        <span>Contraloría: {
                          f.contraloria!.no_registra === true ? "✅ Sin responsabilidad fiscal"
                          : f.contraloria!.no_registra === false ? "⛔ Reportado como responsable fiscal"
                          : "⚠️ Ver PDF"}
                        </span>
                      )}
                      {corrio(f.policia) && (
                        <span>Policía: {
                          f.policia!.no_registra === true ? "✅ Sin antecedentes"
                          : f.policia!.no_registra === false ? "⛔ Requerido por autoridad judicial"
                          : "⚠️ Ver PDF"}
                        </span>
                      )}
                      {corrio(f.manifiestos_rndc) && (
                        <span>RNDC: {f.manifiestos_rndc!.total ?? 0} viaje(s)</span>
                      )}
                      {(() => {
                        const runt = f.runt;
                        if (!corrio(runt)) return null;
                        if (runt!.no_registra === true) return <span>RUNT: 🔍 Placa sin información</span>;
                        if (runt!.no_registra === false) return <span>RUNT: ⚠️ Cédula no es del propietario activo</span>;
                        if (runt!.soat?.vigente === true) return <span>RUNT: ✅ SOAT vigente (vence {runt!.soat.fecha_fin_vigencia})</span>;
                        if (runt!.soat?.vigente === false) return <span>RUNT: ⛔ SOAT vencido</span>;
                        const marca = runt!.datos_vehiculo?.marca;
                        return <span>RUNT: {marca ? `🚗 ${marca}` : "⚠️ Ver PDF"}</span>;
                      })()}
                      {(() => {
                        const simit = f.simit;
                        if (!corrio(simit)) return null;
                  const aPagar = simit.total_a_pagar ?? 0;
                  if (aPagar > 0) {
                    const n = (simit.total_comparendos ?? 0) + (simit.total_multas ?? 0);
                    return <span>SIMIT: ⛔ Saldo exigible ${aPagar.toLocaleString("es-CO")} ({n} registro(s))</span>;
                  }
                  if ((simit.total_comparendos ?? 0) > 0 || (simit.total_multas ?? 0) > 0) {
                    return <span>SIMIT: ⚠️ Sin saldo exigible (registra antecedentes históricos)</span>;
                  }
                  return <span>SIMIT: ✅ Sin comparendos ni multas</span>;
                      })()}
                      {(() => {
                        const sena = f.sena;
                        if (!corrio(sena)) return null;
                        const total = sena.total_certificados ?? 0;
                        return <span>SENA: 🎓 {total > 0 ? `${total} certificado(s) de formación` : "Sin certificados registrados"}</span>;
                      })()}
                      {(() => {
                        const rues = f.rues;
                        if (!corrio(rues)) return null;
                        if (rues!.no_registra === true) return <span>RUES: 🔍 NIT sin registro mercantil</span>;
                        const est = (rues!.estado_matricula ?? "").toUpperCase();
                        if (est === "ACTIVA") return <span>RUES: ✅ Matrícula mercantil activa</span>;
                        return <span>RUES: ⛔ Matrícula {est || "con estado distinto de activa"}</span>;
                      })()}
                    </>
                  );
                })()}
              </div>
              {estudioNuevo.pdf && (
                <button className="PS-boton-pdf" onClick={() => abrirPdf(estudioNuevo.consulta_id)}>
                  <FaFilePdf /> Descargar informe PDF
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── Plan / consultas ── */}
        <section className="PS-tarjeta PS-cupo">
          <h2><FaChartPie /> Sus planes</h2>
          {cupo ? (
            cupo.planes?.length ? (
              <>
                {/* Solo nombre y costo (2026-09-01, pedido del usuario): el
                    desglose de cupo/fuentes vive en el acordeón de consulta. */}
                {cupo.planes.map((p) => (
                  <div key={p.plan_id} className="PS-fuente-cupo">
                    <p className="PS-fuente-nombre">
                      {p.nombre}
                      <span className="PS-fuente-precio">{pesosColombianos(p.precio_por_estudio)}</span>
                    </p>
                  </div>
                ))}
                <p className="PS-cupo-mes">
                  Este mes: {cupo.consumo_mes.unidades} consulta(s) · {pesosColombianos(cupo.consumo_mes.cop)}
                </p>
              </>
            ) : (
              <p className="PS-cupo-sin-plan">
                Su empresa no tiene un plan activo. Contacte a Integra Logística para activar su servicio.
              </p>
            )
          ) : (
            <ClipLoader size={20} color="#0F2A43" />
          )}
        </section>
      </div>

      {/* ── Historial ── */}
      <section className="PS-tarjeta PS-historial">
        <h2><FaHistory /> Historial de consultas</h2>
        {cargandoHistorial ? (
          <ClipLoader size={20} color="#0F2A43" />
        ) : (
          <div className="PS-tabla-envoltura">
            <table className="PS-tabla">
              <thead>
                <tr>
                  <th>Fecha</th><th>Cédula</th>
                  {historial.some((h) => h.placa) && <th>Placa</th>}
                  <th>Persona</th><th>Estado</th><th>Costo</th><th>Consultó</th><th>Informe</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 && (
                  <tr><td colSpan={historial.some((h) => h.placa) ? 8 : 7} className="PS-vacio">Aún no hay consultas registradas.</td></tr>
                )}
                {historial.map((h) => (
                  <tr key={h.consulta_id}>
                    <td data-label="Fecha">{fechaHoraColombia(h.creado_en)}</td>
                    <td data-label="Cédula">{h.cedula}</td>
                    {historial.some((x) => x.placa) && (
                      <td data-label="Placa">{h.placa || "—"}</td>
                    )}
                    <td data-label="Persona">{h.nombre_consultado || "—"}</td>
                    <td data-label="Estado">
                      <span className={`PS-badge ${claseEstado(h.estado)}`}>{textoEstado(h.estado)}</span>{" "}
                      {h.canal === "api" && (
                        <span className="PS-badge PS-badge-api" title="Hecha por una integración con API key">API</span>
                      )}
                    </td>
                    <td data-label="Costo">{h.costo_cop === 0 ? "Sin costo" : pesosColombianos(h.costo_cop ?? 0)}</td>
                    <td data-label="Consultó">{h.usuario_nombre}</td>
                    <td data-label="Informe">
                      <button className="PS-boton-pdf-chico" onClick={() => abrirPdf(h.consulta_id)}>
                        <FaFilePdf /> PDF
                      </button>{" "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalHistorial > 10 && (
          <div className="PS-paginacion">
            <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
            <span>Página {pagina + 1} de {Math.ceil(totalHistorial / 10)}</span>
            <button disabled={(pagina + 1) * 10 >= totalHistorial} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
