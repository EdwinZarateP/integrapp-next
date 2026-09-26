"use client";

/* Portal CLIENTE de Estudios de Seguridad — rediseño 2026-09-25 (patrón
   dash-board.tusdatos.co): sidebar fija a la izquierda con los MÓDULOS, top
   bar con breadcrumb y consultas disponibles, tarjetas blancas sobre fondo
   gris claro y acento teal. Toda la lógica (planes, cascada de nombres,
   completar fuentes, drill-down de pendientes) se conserva intacta. */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Swal from "sweetalert2";
import { ClipLoader } from "react-spinners";
import Lottie from "lottie-react";
import animationDetective from "@/Imagenes/AnimationDetective.json";
import logoSeguriDatia from "@/Imagenes/LogoSeguriDatia.png";
import {
  FaSearch, FaFilePdf, FaSignOutAlt, FaHistory, FaIdCard, FaChartPie,
  FaUserCircle, FaChevronDown, FaBars, FaCarSide, FaRedoAlt,
  FaTimes, FaHome, FaKey, FaEye, FaEyeSlash,
} from "react-icons/fa";
import {
  CupoCliente,
  EstudioDetalle,
  EstudioResumen,
  ProgresoEstudio,
  buscarPersona,
  cambiarClave,
  completarEstudio,
  descargarPdfEstudio,
  haySesionCliente,
  iniciarEstudio,
  listarEstudios,
  loginCliente,
  cerrarSesionCliente,
  mensajeError,
  obtenerCupo,
  obtenerProgreso,
  pesosColombianos,
  recuperarConfirmar,
  recuperarSolicitar,
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

// "2026-09" → "sept 2026" (mes corto en español, determinista: el Intl de
// cada navegador puede devolver "sep" o "sept" según el ICU).
const nombrePeriodo = (periodo?: string): string => {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return periodo ?? "";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  const [anio, mes] = periodo.split("-");
  return `${meses[parseInt(mes, 10) - 1]} ${anio}`;
};

// Input de clave para los Swal, con el "ojito" para mostrar/ocultar lo
// escrito (pedido 2026-09-25). HTML plano: dentro de un Swal no hay React.
const INPUT_CLAVE_SWAL = (id: string, placeholder: string, autocomplete = "new-password") =>
  `<div class="PSX-input-clave">` +
  `<input id="${id}" type="password" placeholder="${placeholder}" class="swal2-input" autocomplete="${autocomplete}">` +
  `<button type="button" class="PSX-ojito" title="Mostrar u ocultar la clave" ` +
  `onclick="var i=this.parentNode.querySelector('input'); i.type = i.type==='password' ? 'text' : 'password'; ` +
  `this.textContent = i.type==='password' ? '👁' : '🙈';">👁</button>` +
  `</div>`;

type Vista = "panel" | "consulta" | "historial";

// Slug de URL de cada módulo (patrón /AdminSeguridad: carpeta estática por
// vista para que el F5 aterrice en el módulo; el replaceState espeja).
const RUTA_VISTA: Record<Vista, string> = {
  panel: "panel",
  consulta: "nueva-consulta",
  historial: "historial",
};

export default function PortalSeguridadP({ vistaInicial = "panel" }: { vistaInicial?: Vista }) {
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

  // Módulo activo de la sidebar (patrón tusdatos: navegación por módulos).
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [menuLateralAbierto, setMenuLateralAbierto] = useState(false);

  // ── Módulo en la URL (patrón /AdminSeguridad): replaceState NATIVO (no
  // router.replace: la navegación del App Router re-suspende el Suspense y
  // el módulo parpadea). Cada módulo tiene su carpeta estática
  // (/PortalSeguridad/panel, /nueva-consulta, /historial) para que el F5
  // aterrice en el módulo correcto; la raíz sigue siendo el panel. */
  useEffect(() => {
    const base = window.location.pathname
      .replace(/\/(panel|nueva-consulta|historial)\/?$/, "")
      .replace(/\/+$/, "");
    window.history.replaceState(
      window.history.state, "", `${base}/${RUTA_VISTA[vista]}${window.location.search}`
    );
  }, [vista]);

  // Login (pantalla 1) o portal (pantalla 2)
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
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

  useEffect(() => {
    if (sesion) cargarPortal();
  }, [sesion, cargarPortal]);

  // Cerrar el menú del avatar al hacer click fuera (patrón tusdatos).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  // ── Cambio de clave (menú del avatar, 2026-09-25) ─────────────────────
  const abrirCambiarClave = async () => {
    setMenuAbierto(false);
    const { value: valores } = await Swal.fire({
      title: "Cambiar contraseña",
      html:
        INPUT_CLAVE_SWAL("swal-clave-actual", "Clave actual", "current-password") +
        INPUT_CLAVE_SWAL("swal-clave-nueva", "Clave nueva (mínimo 6 caracteres)") +
        INPUT_CLAVE_SWAL("swal-clave-conf", "Confirmar clave nueva"),
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Cambiar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#00A5B5",
      preConfirm: () => ({
        actual: (document.getElementById("swal-clave-actual") as HTMLInputElement).value,
        nueva: (document.getElementById("swal-clave-nueva") as HTMLInputElement).value,
        confirmacion: (document.getElementById("swal-clave-conf") as HTMLInputElement).value,
      }),
    });
    if (!valores) return;
    if (!valores.actual || !valores.nueva) {
      Swal.fire("Faltan datos", "Diligencie la clave actual y la nueva.", "warning");
      return;
    }
    if (valores.nueva !== valores.confirmacion) {
      Swal.fire("Las claves no coinciden", "La confirmación no coincide con la clave nueva.", "warning");
      return;
    }
    try {
      await cambiarClave(valores.actual, valores.nueva);
      Swal.fire("Contraseña actualizada", "Use su nueva clave la próxima vez que ingrese.", "success");
    } catch (e: any) {
      Swal.fire("No se pudo cambiar", mensajeError(e), "error");
    }
  };

  // ── Olvidé mi contraseña (login, 2026-09-25) ──────────────────────────
  // Dos pasos: correo → código de 6 dígitos por email → clave nueva.
  const abrirOlvideClave = async () => {
    const { value: correoRec } = await Swal.fire({
      title: "¿Olvidó su contraseña?",
      text: "Enviaremos un código de 6 dígitos al correo de su cuenta.",
      input: "email",
      inputPlaceholder: "correo@empresa.com",
      showCancelButton: true,
      confirmButtonText: "Enviar código",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#00A5B5",
    });
    if (!correoRec) return;
    try {
      await recuperarSolicitar(correoRec);
    } catch (e: any) {
      Swal.fire("Error", mensajeError(e), "error");
      return;
    }
    const { value: paso2 } = await Swal.fire({
      title: "Ingrese el código",
      html:
        `<p class="PSX-swal-texto">Enviamos un código a <b>${correoRec}</b> (vence en 15 minutos).</p>` +
        '<input id="swal-codigo" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" class="swal2-input">' +
        INPUT_CLAVE_SWAL("swal-clave-nueva", "Clave nueva (mínimo 6 caracteres)"),
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Restablecer",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#00A5B5",
      preConfirm: () => ({
        codigo: (document.getElementById("swal-codigo") as HTMLInputElement).value.trim(),
        nueva: (document.getElementById("swal-clave-nueva") as HTMLInputElement).value,
      }),
    });
    if (!paso2?.codigo) return;
    if (!paso2.nueva || paso2.nueva.length < 6) {
      Swal.fire("Clave inválida", "La clave nueva debe tener al menos 6 caracteres.", "warning");
      return;
    }
    try {
      await recuperarConfirmar(correoRec, paso2.codigo, paso2.nueva);
      Swal.fire("Contraseña restablecida", "Ya puede ingresar con su nueva clave.", "success");
      setCorreo(correoRec);
    } catch (e: any) {
      Swal.fire("No se pudo restablecer", mensajeError(e), "error");
    }
  };

  // ── CONSULTA ────────────────────────────────────────────────────────────
  // El plan se elige ABRRIENDO su acordeón: el formulario pide los campos que
  // ESE plan requiere (cédula siempre; placa solo si incluye la fuente runt).
  const [planAbierto, setPlanAbierto] = useState<string | null>(null);
  const [placa, setPlaca] = useState("");
  // Cédula del PROPIETARIO del vehículo (solo runt): el RUNT valida contra el
  // dueño ACTIVO de la placa, que muchas veces no es el conductor evaluado.
  const [cedulaPropietario, setCedulaPropietario] = useState("");
  // (2026-09-25) Los nombres/apellidos de la persona evaluada ya NO se piden:
  // el backend los detecta solo (memoria de personas → situación militar →
  // SISCONMP) para el captcha de la PGN y la búsqueda por nombre de la Rama
  // Judicial. Las integraciones API siguen pudiendo enviarlos.
  const [nit, setNit] = useState("");
  // Fecha de EXPEDICIÓN de la cédula (DD/MM/AAAA): la exige el portal de
  // inhabilidades de la Ley 1918 (valida el par cédula + fecha).
  const [fechaExpedicion, setFechaExpedicion] = useState("");
  // Memoria de personas (2026-09-25): si la empresa ya consultó esta cédula,
  // el onBlur del campo autollena la fecha de expedición (los nombres ya no
  // se piden — el backend los detecta solo) y muestra el aviso del historial.
  // ⚠️ SIN indicador de "buscando": un párrafo que aparece en el onBlur MOVÍA
  // el botón Consultar entre el mousedown y el mouseup → el primer clic no
  // llegaba a disparar el submit (había que dar clic dos veces). El aviso
  // solo se pinta cuando la respuesta llega (asincrónico, tras el click).
  const [personaMemoria, setPersonaMemoria] = useState<number | null>(null);
  const [cedulaMemoria, setCedulaMemoria] = useState("");

  // Autollenado por onBlur de la cédula (patrón OtrosCostos: autollenado
  // bancario por onBlur de placa). Silencioso ante fallos: si el endpoint no
  // responde, el usuario diligencia a mano como siempre.
  const autollenarPersona = async () => {
    const digitos = cedula.replace(/\D/g, "");
    if (digitos.length < 3) {
      setPersonaMemoria(null);
      setCedulaMemoria("");
      return;
    }
    // Evitar re-consultar la misma cédula al salir del campo varias veces.
    if (digitos === cedulaMemoria) return;
    try {
      const p = await buscarPersona(digitos);
      if (p.encontrada) {
        // Solo campos VACÍOS: nunca pisar lo que el usuario ya escribió.
        if (!fechaExpedicion.trim() && p.fecha_expedicion)
          setFechaExpedicion(p.fecha_expedicion);
        setPersonaMemoria(p.total_consultas || 0);
        setCedulaMemoria(digitos);
      } else {
        setPersonaMemoria(null);
        setCedulaMemoria("");
      }
    } catch {
      // Best-effort: sin memoria se sigue consultando igual.
    }
  };

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
    : f === "delitos_sexuales" ? "Inhabilidades Ley 1918 (delitos contra menores)"
    : f === "policia" ? "Antecedentes Policía"
    : f === "runt" ? "Vehículo RUNT"
    : f === "simit" ? "Comparendos SIMIT"
    : f === "sena" ? "Formación SENA"
    : f === "sisconmp" ? "Capacitaciones Mercancías Peligrosas (SISCONMP)"
    : f === "ofac" ? "OFAC personas (cédula)"
    : f === "ofac_nit" ? "OFAC empresas (NIT)"
    : f === "onu_ue" ? "ONU/UE — Sanciones internacionales (cédula)"
    : f === "bdme" ? "BDME personas (cédula)"
    : f === "bdme_nit" ? "BDME empresas (NIT)"
    : f === "rama_judicial" ? "Rama Judicial (procesos por nombre)"
    : f === "rues" ? "RUES — Registro Mercantil (NIT)"
    : f === "situacion_militar" ? "Situación militar (libreta militar)"
    : f;

  const planActivo = cupo?.planes?.find((p) => p.plan_id === planAbierto) ?? null;
  const mensajePorFuente: Record<string, string> = {
    manifiestos_rndc: "Investigando en Manifiestos RNDC…",
    procuraduria: "Revisando antecedentes en Procuraduría…",
    contraloria: "Consultando antecedentes fiscales en la Contraloría…",
    delitos_sexuales: "Consultando inhabilidades (Ley 1918) en la Policía…",
    policia: "Consultando antecedentes judiciales en la Policía…",
    runt: "Consultando información del vehículo en RUNT…",
    simit: "Revisando comparendos en SIMIT…",
    sena: "Consultando formación en el SENA…",
    sisconmp: "Consultando capacitaciones de Mercancías Peligrosas…",
    ofac: "Cruzando la persona con listas OFAC…",
    ofac_nit: "Cruzando la empresa con listas OFAC…",
    onu_ue: "Cruzando la persona con listas ONU y Unión Europea…",
    bdme: "Consultando la persona en BDME…",
    bdme_nit: "Consultando la empresa en BDME…",
    rama_judicial: "Buscando procesos en la Rama Judicial…",
    rues: "Verificando la matrícula mercantil en el RUES…",
    situacion_militar: "Consultando la situación militar (libreta)…",
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
  // (2026-09-25) Los nombres de la persona ya NO se piden en el formulario:
  // el backend los detecta solo (memoria → situación militar → SISCONMP)
  // para el captcha de la PGN y la búsqueda por nombre de la Rama Judicial.
  const requiereNit = planActivo?.fuentes?.some((f) => f === "ofac_nit" || f === "bdme_nit" || f === "rues") ?? false;
  // Inhabilidades Ley 1918: el portal de la DIJIN valida el par cédula +
  // fecha de EXPEDICIÓN del documento.
  const requiereFechaExp = planActivo?.fuentes?.includes("delitos_sexuales") ?? false;
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
    delitos_sexuales: 110, // reCAPTCHA v2 (solve 10-60 s) + página de resultado
    policia: 110,
    runt: 75,
    simit: 20,
    sena: 70, // portal rápido (~5 s) + solve del captcha de imagen (10-60 s)
    sisconmp: 40, // portal MVC rápido; el reCAPTCHA v3 lo resuelve la propia página
    ofac: 15, // dataset oficial indexado; la primera descarga puede tardar
    ofac_nit: 15,
    onu_ue: 25, // datasets ONU (~2 MB) + UE (~25 MB); luego queda en memoria 6 h
    bdme: 120,
    bdme_nit: 120,
    rama_judicial: 90,
    rues: 15, // API directo sin navegador ni captcha (~1-2 s)
    situacion_militar: 15, // API directo del Ejército (~1-2 s, $0)
  };
  const estimacionSegundos = (() => {
    const fs = planActivo?.fuentes ?? [];
    if (!fs.length) return 60;
    return Math.max(...fs.map((f) => SEGUNDOS_FUENTE[f] ?? 60));
  })();

  // ── Consulta con BARRA DE PROGRESO (2026-09-25) ────────────────────────
  // POST /iniciar (devuelve el consulta_id al instante) + polling del
  // progreso real por fuente. Si el progreso falla (404 mientras prepara o
  // reinicio de instancia) se sigue sondeando hasta el guard de 8 min.
  const [progreso, setProgreso] = useState<ProgresoEstudio | null>(null);
  const esperar = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const ejecutarConsulta = async (nombresArg?: string, apellidosArg?: string): Promise<EstudioDetalle> => {
    // Normalizaciones (mismas reglas que las validaciones de consultar()).
    const placaN = requierePlaca ? placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : undefined;
    const propN = requierePropietario ? (cedulaPropietario.replace(/\D/g, "") || undefined) : undefined;
    const nitN = requiereNit ? nit.trim().replace(/-\s*\d\s*$/, "").replace(/\D/g, "") : undefined;
    const fechaN = requiereFechaExp ? fechaExpedicion.trim() : undefined;
    const inicio = await iniciarEstudio(
      requiereCedula ? cedula.replace(/\D/g, "") : undefined,
      undefined, planAbierto ?? undefined, placaN, propN,
      nombresArg, apellidosArg,
      nitN, fechaN,
    );
    const t0 = Date.now();
    for (;;) {
      await esperar(1500);
      try {
        const p = await obtenerProgreso(inicio.consulta_id);
        setProgreso(p);
        if (p.estudio) return p.estudio;
      } catch {
        // Progreso aún no disponible (cascada de nombres) o caído: seguir.
      }
      if (Date.now() - t0 > 8 * 60 * 1000) {
        throw new Error("La consulta está tardando más de lo esperado. Revise el historial en unos minutos: el informe quedará allí.");
      }
    }
  };

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
    // Fecha de expedición de la cédula (solo delitos_sexuales, Ley 1918):
    // OBLIGATORIA — el portal de la DIJIN valida el par cédula + fecha.
    let fechaExpNorm: string | undefined;
    if (requiereFechaExp) {
      fechaExpNorm = fechaExpedicion.trim();
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaExpNorm)) {
        Swal.fire(
          "Fecha de expedición inválida",
          "El plan incluye la consulta de inhabilidades (Ley 1918): ingrese la fecha de expedición de la cédula en formato DD/MM/AAAA.",
          "warning"
        );
        return;
      }
    }
    setConsultando(true);
    setEstudioNuevo(null);
    setProgreso(null);
    try {
      // Nombres/apellidos SIN enviar: el backend los detecta solo (2026-09-25).
      const estudio = await ejecutarConsulta();
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
      // Escape hatch (2026-09-25): la autodetección de nombres falló (p. ej.
      // cédula de MUJER sin libreta ni cursos MP y sin memoria previa) y el
      // plan exige nombres (rama_judicial busca por nombre). El dato lo tiene
      // la propia usuaria: se le pide UNA sola vez y queda en la memoria.
      const detalle = typeof e?.response?.data?.detail === "string" ? e.response.data.detail : "";
      if (e?.response?.status === 422 && detalle.includes("nombres y apellidos completos")) {
        const { value: f } = await Swal.fire({
          title: "Necesitamos los nombres",
          html:
            '<p class="PSX-swal-texto">No fue posible obtenerlos automáticamente para esta cédula ' +
            '(sin registro en las fuentes oficiales). Ingréselos una sola vez: quedan guardados ' +
            'para las futuras consultas de su empresa.</p>' +
            '<input id="swal-nombres" placeholder="Nombres completos (sin tildes)" class="swal2-input" maxlength="60">' +
            '<input id="swal-apellidos" placeholder="Apellidos completos (sin tildes)" class="swal2-input" maxlength="60">',
          focusConfirm: false,
          showCancelButton: true,
          confirmButtonText: "Consultar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#00A5B5",
          preConfirm: () => ({
            nombres: (document.getElementById("swal-nombres") as HTMLInputElement).value.trim(),
            apellidos: (document.getElementById("swal-apellidos") as HTMLInputElement).value.trim(),
          }),
        });
        if (f?.nombres && f?.apellidos) {
          try {
            const estudio = await ejecutarConsulta(f.nombres, f.apellidos);
            playNotificationSound();
            setEstudioNuevo(estudio);
            Swal.fire({
              title: "Consulta completada",
              text: `Persona: ${estudio.nombre_consultado || "no identificada"} · Consulta ${estudio.consulta_id}`,
              icon: estudio.estado === "COMPLETADA" ? "success" : "warning",
              timer: 5000,
            });
            cargarPortal();
            return;
          } catch (e2: any) {
            playNotificationSound();
            Swal.fire("No se pudo consultar", mensajeError(e2), "error");
            return;
          }
        }
        playNotificationSound();
        Swal.fire("Consulta cancelada", "Sin los nombres no es posible consultar este plan.", "info");
        return;
      }
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

  // ── Completar fuentes pendientes (2026-09-25) ───────────────────────────
  // Un estudio PARCIAL/ERROR dejó fuentes sin respuesta: este botón re-consulta
  // SOLO las que faltaron (sin costo) y re-emite el PDF con el mismo consulta_id.
  const [completando, setCompletando] = useState<string | null>(null);
  // Fila del historial con el detalle de fuentes pendientes desplegado
  // (drill-down tipo tabla dinámica, 2026-09-25).
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);

  const fuentesPendientes = (e: EstudioDetalle | null | undefined): string[] =>
    Object.entries(e?.fuentes ?? {})
      .filter(([, f]) => f?.estado === "NO_DISPONIBLE" || f?.estado === "ERROR")
      .map(([clave]) => clave);

  const completarConsulta = async (consultaId: string, estudioDetalle?: EstudioDetalle | null) => {
    const pendientes = fuentesPendientes(estudioDetalle);
    const confirmacion = await Swal.fire({
      title: "Completar fuentes pendientes",
      html: pendientes.length
        ? `Se volverán a consultar <strong>${pendientes.map(nombreFuente).join(", ")}</strong> y el informe se re-emite completo.<br/><small>Si la consulta original quedó <strong>sin costo</strong> (la mayoría de las fuentes falló), al completarla se cobra el valor del plan.</small>`
        : `Se volverán a consultar las fuentes que no respondieron y el informe se re-emite completo.<br/><small>Si la consulta original quedó <strong>sin costo</strong> (la mayoría de las fuentes falló), al completarla se cobra el valor del plan.</small>`,
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Completar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#00A5B5",
    });
    if (!confirmacion.isConfirmed) return;
    setCompletando(consultaId);
    try {
      const estudio = await completarEstudio(consultaId);
      playNotificationSound();
      if (estudioDetalle) setEstudioNuevo(estudio); // actualizar la tarjeta de resultado
      const quedan = fuentesPendientes(estudio);
      const cobrado = (estudio as any).cobrado === true;
      Swal.fire({
        title: quedan.length
          ? "Consulta actualizada (quedan fuentes sin respuesta)"
          : "Consulta completada",
        text: `Estado: ${textoEstado(estudio.estado)} · Informe PDF re-emitido (${estudio.consulta_id})${cobrado ? " · Se cobró el valor del plan" : ""}`,
        icon: quedan.length ? "warning" : "success",
        timer: 7000,
      });
      cargarPortal();
    } catch (e: any) {
      playNotificationSound();
      Swal.fire("No se pudo completar", mensajeError(e), "error");
    } finally {
      setCompletando(null);
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

  // Iniciales del avatar (patrón tusdatos: círculo teal con 2 letras).
  const iniciales = (sesion?.nombre || "U")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  // Consultas disponibles totales (para el pill del topbar): suma de los
  // planes con tope; cualquier plan sin tope = ∞.
  const consultasDisponibles = (() => {
    const planes = cupo?.planes ?? [];
    if (!planes.length) return null;
    if (planes.some((p) => p.ilimitado)) return null; // sin límite
    return planes.reduce((acc, p) => acc + (p.cupo_disponible ?? 0), 0);
  })();

  // ══════════════════ PANTALLA 1: LOGIN ══════════════════
  if (!sesion) {
    return (
      <div className="PSX-login">
        <div className="PSX-login-ilustracion">
          <Image src={logoSeguriDatia} alt="seguriDatia" height={52} priority />
          <h2>Consultas de seguridad para su equipo</h2>
          <p>
            Antecedentes, vehículo, sanciones y formación en un solo informe,
            desde fuentes oficiales.
          </p>
          <ul>
            <li>14 fuentes públicas consolidadas</li>
            <li>Informe PDF con evidencias de consulta</li>
            <li>Historial y completado automático</li>
          </ul>
        </div>
        <form className="PSX-login-caja" onSubmit={entrar}>
          <h1>Bienvenido</h1>
          <p className="PSX-login-sub">Ingrese con el correo de su empresa</p>
          <label className="PSX-campo">
            <span>Correo electrónico</span>
            <input
              type="email" placeholder="correo@empresa.com" value={correo}
              onChange={(e) => setCorreo(e.target.value)} required autoFocus
            />
          </label>
          <label className="PSX-campo">
            <span>Contraseña</span>
            <div className="PSX-input-clave">
              <input
                type={mostrarClave ? "text" : "password"} placeholder="••••••••" value={clave}
                onChange={(e) => setClave(e.target.value)} required
              />
              <button
                type="button" className="PSX-ojito"
                onClick={() => setMostrarClave((o) => !o)}
                title={mostrarClave ? "Ocultar la clave" : "Mostrar la clave"}
                aria-label={mostrarClave ? "Ocultar la clave" : "Mostrar la clave"}
              >
                {mostrarClave ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>
          {errorLogin && <p className="PSX-login-error">{errorLogin}</p>}
          <button type="submit" className="PSX-boton-primario" disabled={entrando}>
            {entrando ? <><ClipLoader size={16} color="#fff" /> Ingresando…</> : "Ingresar"}
          </button>
          <button type="button" className="PSX-login-olvide" onClick={abrirOlvideClave}>
            ¿Olvidó su contraseña?
          </button>
          <p className="PSX-login-pie">seguriDatia · un servicio de Integra Logística</p>
        </form>
      </div>
    );
  }

  // ══════════════════ PANTALLA 2: PORTAL (sidebar + módulos) ══════════════════

  const navItems: { id: Vista; etiqueta: string; icono: JSX.Element }[] = [
    { id: "panel", etiqueta: "Panel", icono: <FaChartPie /> },
    { id: "consulta", etiqueta: "Nueva consulta", icono: <FaSearch /> },
    { id: "historial", etiqueta: "Historial de consultas", icono: <FaHistory /> },
  ];

  const sidebar = (
    <aside className="PSX-sidebar" ref={menuRef}>
      <div className="PSX-sidebar-logo">
        <Image src={logoSeguriDatia} alt="seguriDatia" height={38} priority />
      </div>
      <nav className="PSX-sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`PSX-nav-item ${vista === item.id ? "PSX-nav-activo" : ""}`}
            onClick={() => { setVista(item.id); setMenuLateralAbierto(false); }}
          >
            {item.icono}
            <span>{item.etiqueta}</span>
          </button>
        ))}
      </nav>
      <div className="PSX-sidebar-pie">
        <div className="PSX-sidebar-usuario">
          <div className="PSX-avatar">{iniciales}</div>
          <div className="PSX-sidebar-usuario-datos">
            <strong>{sesion?.nombre}</strong>
            <small>{sesion?.empresa?.nombre ?? "Cliente"}</small>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="PSX-app">
      {/* Desktop: sidebar fija; móvil (≤900px): drawer con overlay. */}
      <div className="PSX-sidebar-escritorio">
        {sidebar}
      </div>
      {menuLateralAbierto && (
        <>
          <div className="PSX-overlay" onClick={() => setMenuLateralAbierto(false)} />
          <div className="PSX-sidebar-movil">
            <button className="PSX-sidebar-cerrar" onClick={() => setMenuLateralAbierto(false)} aria-label="Cerrar menú">
              <FaTimes />
            </button>
            {sidebar}
          </div>
        </>
      )}

      <div className="PSX-cuerpo">
        {/* Top bar: breadcrumb + consultas disponibles + hamburguesa móvil. */}
        <header className="PSX-topbar">
          <button className="PSX-hamburguesa" onClick={() => setMenuLateralAbierto(true)} aria-label="Abrir menú">
            <FaBars />
          </button>
          <div className="PSX-miga">
            <span className="PSX-miga-inicio">Inicio</span>
            <span className="PSX-miga-sep">/</span>
            <span className="PSX-miga-actual">
              {vista === "panel" ? "Panel" : vista === "consulta" ? "Nueva consulta" : "Historial de consultas"}
            </span>
          </div>
          <div className="PSX-topbar-derecha">
            {consultasDisponibles !== null && (
              <span className="PSX-pill-cupo" title="Consultas disponibles en sus planes">
                Consultas disponibles: <strong>{consultasDisponibles.toLocaleString("es-CO")}</strong>
              </span>
            )}
            {consultasDisponibles === null && cupo?.planes?.length ? (
              <span className="PSX-pill-cupo">Consultas disponibles: <strong>Sin límite</strong></span>
            ) : null}
            {/* Menú de usuario: click en el avatar de iniciales (patrón tusdatos). */}
            <div className="PSX-avatar-zona" ref={menuRef}>
              <button
                className="PSX-avatar-boton"
                onClick={() => setMenuAbierto((o) => !o)}
                aria-label="Menú de usuario"
                aria-expanded={menuAbierto}
              >
                <span className="PSX-avatar PSX-avatar-topbar">{iniciales}</span>
                <FaChevronDown className={`PSX-chevron ${menuAbierto ? "PSX-chevron-arriba" : ""}`} />
              </button>
              {menuAbierto && (
                <div className="PSX-avatar-menu">
                  <div className="PSX-avatar-menu-cab">
                    <strong>{sesion?.nombre}</strong>
                    <small>{sesion?.empresa?.nombre ?? ""}</small>
                  </div>
                  <button
                    className="PSX-avatar-item"
                    onClick={() => { setMenuAbierto(false); router.push("/"); }}
                  >
                    <FaHome /> Volver al inicio
                  </button>
                  <button className="PSX-avatar-item" onClick={abrirCambiarClave}>
                    <FaKey /> Cambiar contraseña
                  </button>
                  <button
                    className="PSX-avatar-item PSX-avatar-item-rojo"
                    onClick={() => { setMenuAbierto(false); salir(); }}
                  >
                    <FaSignOutAlt /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="PSX-contenido">
          {/* ════════ MÓDULO: PANEL ════════ */}
          {vista === "panel" && (
            <>
              <div className="PSX-encabezado">
                <h1><span>¡Hola!</span> Un resumen de su actividad</h1>
              </div>
              <div className="PSX-kpis">
                <div className="PSX-kpi">
                  <p className="PSX-kpi-label">Consultas disponibles</p>
                  <p className="PSX-kpi-numero">
                    {cupo
                      ? (consultasDisponibles !== null
                          ? consultasDisponibles.toLocaleString("es-CO")
                          : (cupo.planes?.length ? "Sin límite" : "0"))
                      : "—"}
                  </p>
                  <p className="PSX-kpi-sub">
                    {cupo?.planes?.length
                      ? `en ${cupo.planes.length} plan${cupo.planes.length === 1 ? "" : "es"}`
                      : "sin planes activos"}
                  </p>
                </div>
                <div className="PSX-kpi">
                  <p className="PSX-kpi-label">Consultas este mes</p>
                  <p className="PSX-kpi-numero">{cupo?.consumo_mes?.unidades ?? 0}</p>
                  <p className="PSX-kpi-sub">{pesosColombianos(cupo?.consumo_mes?.cop ?? 0)} · {nombrePeriodo(cupo?.consumo_mes?.periodo)}</p>
                </div>
                <div className="PSX-kpi">
                  <p className="PSX-kpi-label">Total consultas registradas</p>
                  <p className="PSX-kpi-numero">{totalHistorial.toLocaleString("es-CO")}</p>
                  <p className="PSX-kpi-sub">en el historial de su empresa</p>
                </div>
              </div>

              <div className="PSX-panel-planes">
                <div className="PSX-tarjeta-cab">
                  <h2>Sus planes</h2>
                  <button className="PSX-boton-primario PSX-boton-chico" onClick={() => setVista("consulta")}>
                    <FaSearch /> Nueva consulta
                  </button>
                </div>
                {cupo?.planes?.length ? (
                  <div className="PSX-plan-lista">
                    {cupo.planes.map((p) => {
                      const consumido = p.cupo_consumido ?? 0;
                      const autorizado = p.cupo_autorizado;
                      const pct = autorizado ? Math.min(100, Math.round((consumido / autorizado) * 100)) : null;
                      return (
                        <div key={p.plan_id} className="PSX-plan">
                          <div className="PSX-plan-cab">
                            <div>
                              <strong>{p.nombre}</strong>
                              <small>{p.fuentes.map(nombreFuente).join(" · ")}</small>
                            </div>
                            <span className="PSX-plan-precio">{pesosColombianos(p.precio_por_estudio)} / consulta</span>
                          </div>
                          <div className="PSX-plan-barra">
                            {pct !== null ? (
                              <>
                                <div className="PSX-barra-pista"><div className="PSX-barra-relleno" style={{ width: `${pct}%` }} /></div>
                                <small>{consumido} de {autorizado?.toLocaleString("es-CO")} usadas{pct !== null ? ` · ${pct}%` : ""}</small>
                              </>
                            ) : (
                              <small className="PSX-plan-sin-tope">Sin límite de consultas · {consumido} usadas</small>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="PSX-sin-plan">
                    Su empresa no tiene un plan activo. Contacte a Integra Logística para activar su servicio.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ════════ MÓDULO: NUEVA CONSULTA ════════ */}
          {vista === "consulta" && (
            <section className="PSX-tarjeta PSX-consulta">
              <div className="PSX-tarjeta-cab">
                <h2>¿Con qué plan desea consultar?</h2>
              </div>
              {/* Acordeón por plan: el formulario pide los campos que ESE plan
                  requiere (cédula siempre; placa solo si incluye la fuente runt) */}
              {(cupo?.planes?.length ?? 0) > 0 ? (
                <div className="PSX-acordeon">
                  {cupo!.planes!.map((p) => {
                    const abierto = planAbierto === p.plan_id;
                    const pidePlaca = p.fuentes?.some((f) => f === "runt" || f === "simit");
                    const pidePropietario = p.fuentes?.includes("runt");
                    const pideNit = p.fuentes?.some((f) => f === "ofac_nit" || f === "bdme_nit" || f === "rues");
                    const pideFechaExp = p.fuentes?.includes("delitos_sexuales");
                    const pideCedula = p.fuentes?.some(
                      (f) => f !== "ofac_nit" && f !== "bdme_nit" && f !== "rama_judicial" && f !== "rues"
                    );
                    return (
                      <div key={p.plan_id} className={`PSX-acordeon-item ${abierto ? "PSX-acordeon-abierto" : ""}`}>
                        <button
                          type="button"
                          className="PSX-acordeon-cab"
                          onClick={() => setPlanAbierto(abierto ? null : p.plan_id)}
                          disabled={consultando}
                          aria-expanded={abierto}
                        >
                          <span className="PSX-acordeon-titulo">
                            <strong>{p.nombre}</strong>
                            <small>
                              {p.fuentes.map(nombreFuente).join(" + ")}
                              {" · "}
                              {p.ilimitado
                                ? "sin límite"
                                : `quedan ${p.cupo_disponible ?? 0} · ${pesosColombianos(p.precio_por_estudio)}`}
                            </small>
                          </span>
                          <FaChevronDown className={`PSX-chevron ${abierto ? "PSX-chevron-arriba" : ""}`} />
                        </button>
                        {abierto && (
                          <form onSubmit={consultar} className="PSX-acordeon-cuerpo">
                            {pideCedula && (
                              <label className="PSX-campo">
                                <span>Cédula</span>
                                <div className="PSX-input-icono">
                                  <FaIdCard />
                                  <input
                                    inputMode="numeric" pattern="[0-9]*" placeholder="Número a consultar" value={cedula}
                                    onChange={(e) => {
                                      setCedula(e.target.value.replace(/\D/g, ""));
                                      // Cédula editada a mano = memoria previa ya no aplica.
                                      if (personaMemoria) {
                                        setPersonaMemoria(null);
                                        setCedulaMemoria("");
                                      }
                                    }}
                                    onBlur={autollenarPersona}
                                    maxLength={15} disabled={consultando} autoFocus
                                  />
                                </div>
                              </label>
                            )}
                            {pideCedula && personaMemoria !== null && (
                              <p className="PSX-ayuda-exito">
                                ✅ Persona consultada antes por su empresa
                                {personaMemoria > 0
                                  ? ` (${personaMemoria} ${personaMemoria === 1 ? "consulta" : "consultas"})`
                                  : ""}
                                {" "}— la fecha de expedición conocida se autocompleta.
                              </p>
                            )}
                            {pideNit && (
                              <label className="PSX-campo">
                                <span>NIT (sin dígito de verificación)</span>
                                <div className="PSX-input-icono">
                                  <FaIdCard />
                                  <input
                                    inputMode="numeric" pattern="[0-9]*" placeholder="Número a consultar"
                                    value={nit} onChange={(e) => setNit(e.target.value.replace(/\D/g, ""))}
                                    maxLength={15} disabled={consultando} autoFocus={!pideCedula}
                                  />
                                </div>
                              </label>
                            )}
                            {pideFechaExp && (
                              <label className="PSX-campo">
                                <span>Fecha de expedición de la cédula (DD/MM/AAAA)</span>
                                <div className="PSX-input-icono">
                                  <FaIdCard />
                                  <input
                                    placeholder="dd/mm/aaaa"
                                    value={fechaExpedicion}
                                    onChange={(e) => setFechaExpedicion(e.target.value)}
                                    maxLength={10} disabled={consultando}
                                  />
                                </div>
                                <small className="PSX-campo-ayuda">
                                  La consulta de inhabilidades (Ley 1918) valida la cédula con su
                                  fecha de expedición, tal como aparece en el documento.
                                </small>
                              </label>
                            )}
                            {pidePlaca && (
                              <label className="PSX-campo">
                                <span>Placa del vehículo</span>
                                <div className="PSX-input-icono">
                                  <FaCarSide />
                                  <input
                                    placeholder="AAA123" value={placa}
                                    onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                                    maxLength={6} autoCapitalize="characters" disabled={consultando}
                                  />
                                </div>
                              </label>
                            )}
                            {pidePropietario && (
                              <label className="PSX-campo">
                                <span>Cédula del propietario <em>(vacía si es el conductor)</em></span>
                                <div className="PSX-input-icono">
                                  <FaUserCircle />
                                  <input
                                    inputMode="numeric" pattern="[0-9]*" placeholder="Opcional"
                                    value={cedulaPropietario}
                                    onChange={(e) => setCedulaPropietario(e.target.value.replace(/\D/g, ""))}
                                    maxLength={15} disabled={consultando}
                                  />
                                </div>
                                <small className="PSX-campo-ayuda">
                                  La fuente RUNT consulta el vehículo por placa + cédula de su propietario.
                                  Si el conductor no es el dueño, diligencie la cédula del propietario para
                                  que la validación del vehículo salga en este mismo informe.
                                </small>
                              </label>
                            )}
                            {pidePlaca && !pidePropietario && (
                              <p className="PSX-campo-ayuda">
                                La fuente SIMIT consulta los comparendos y multas de la
                                placa (no requiere cédula del propietario).
                              </p>
                            )}
                            <button
                              type="submit" className="PSX-boton-primario PSX-boton-full"
                              disabled={
                                consultando || (pideCedula && !cedula) || (pideNit && !nit)
                                || (pideFechaExp && fechaExpedicion.trim().length < 10)
                              }
                            >
                              {consultando ? <><ClipLoader size={14} color="#fff" /> Consultando…</> : "Generar informe"}
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="PSX-sin-plan">
                  Su empresa no tiene un plan activo. Contacte a Integra Logística para activar su servicio.
                </p>
              )}
              {consultando && (
                <div className="PSX-investigando">
                  <Lottie
                    animationData={animationDetective}
                    loop
                    autoplay
                    style={{ width: 190, height: 190, margin: "0 auto" }}
                  />
                  <p className="PSX-investigando-mensaje">{mensajesConsulta[indiceMensaje]}</p>
                  {progreso && (
                    <div className="PSX-progreso">
                      <div className="PSX-progreso-cifras">
                        <span><strong>{progreso.hechas}</strong> de {progreso.total} fuentes completadas</span>
                        <strong className="PSX-progreso-pct">{progreso.pct}%</strong>
                      </div>
                      <div className="PSX-barra-pista PSX-progreso-barra">
                        <div
                          className="PSX-barra-relleno"
                          style={{ width: `${progreso.pct}%`, transition: "width 0.5s ease" }}
                        />
                      </div>
                      <ul className="PSX-progreso-lista">
                        {Object.entries(progreso.fuentes).map(([f, est]) => (
                          <li
                            key={f}
                            className={
                              est == null ? "PSX-progreso-pendiente"
                              : est === "EXITO" || est === "ADVERTENCIA" ? "PSX-progreso-ok"
                              : "PSX-progreso-fallo"
                            }
                          >
                            {est == null ? "⏳" : est === "EXITO" || est === "ADVERTENCIA" ? "✓" : "✕"}{" "}
                            {nombreFuente(f)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="PSX-investigando-sub">
                    Las fuentes del plan se consultan en paralelo: esto puede tomar
                    de 3 a {estimacionSegundos} segundos (según la fuente más lenta). Si cierra la
                    ventana, la consulta termina igual y quedará en su historial.
                  </p>
                </div>
              )}

              {estudioNuevo && (
                <div className={`PSX-resultado ${claseEstado(estudioNuevo.estado)}`}>
                  <div className="PSX-resultado-cab">
                    <strong>{estudioNuevo.nombre_consultado || "Persona no identificada"}</strong>
                    <span className="PSX-badge">{textoEstado(estudioNuevo.estado)}</span>
                  </div>
                  <div className="PSX-resultado-datos">
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
                          {corrio(f.delitos_sexuales) && (
                            <span>Ley 1918: {
                              f.delitos_sexuales!.no_registra === true ? "✅ Sin inhabilidad (delitos contra menores)"
                              : f.delitos_sexuales!.no_registra === false ? "⛔ REGISTRA INHABILIDAD — revisar"
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
                            if (runt!.soat?.vigente === true) return <span>RUNT: ✅ SOAT vigente (vence {runt!.soat.fecha_fin_vigencia}){runt!.rtm?.vigente === false ? ` · ⛔ RTM vencida` : ""}</span>;
                            if (runt!.soat?.vigente === false) return <span>RUNT: ⛔ SOAT vencido</span>;
                            if (runt!.rtm?.vigente === false) return <span>RUNT: ⛔ RTM vencida (revisión técnico-mecánica)</span>;
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
                            const sis = f.sisconmp;
                            if (!corrio(sis)) return null;
                            const total = sis!.total_capacitaciones ?? 0;
                            if (total === 0) return <span>SISCONMP: 🔍 Sin capacitaciones de Mercancías Peligrosas registradas</span>;
                            const hayVigente = (sis!.capacitaciones ?? []).some((c) => c.vigente === true);
                            const hayVencida = (sis!.capacitaciones ?? []).some((c) => c.vigente === false);
                            if (hayVigente) return <span>SISCONMP: ✅ {total} capacitación(es) MP (alguna vigente)</span>;
                            if (hayVencida) return <span>SISCONMP: ⛔ {total} capacitación(es) MP — ninguna vigente (vencidas)</span>;
                            return <span>SISCONMP: 🎓 {total} capacitación(es) MP (vigencia no reportada)</span>;
                          })()}
                          {(() => {
                            const onuUe = f.onu_ue;
                            if (!corrio(onuUe)) return null;
                            if (onuUe!.aplica) return <span>ONU/UE: ⛔ Coincidencia en listas de sanciones (revisar)</span>;
                            const faltantes = onuUe!.listas_no_disponibles ?? [];
                            return <span>ONU/UE: ✅ Sin coincidencias{faltantes.length ? ` (${faltantes.join(", ")} no disponible)` : ""}</span>;
                          })()}
                          {(() => {
                            const rues = f.rues;
                            if (!corrio(rues)) return null;
                            if (rues!.no_registra === true) return <span>RUES: 🔍 NIT sin registro mercantil</span>;
                            const est = (rues!.estado_matricula ?? "").toUpperCase();
                            if (est === "ACTIVA") return <span>RUES: ✅ Matrícula mercantil activa</span>;
                            return <span>RUES: ⛔ Matrícula {est || "con estado distinto de activa"}</span>;
                          })()}
                          {(() => {
                            const sm = f.situacion_militar;
                            if (!corrio(sm)) return null;
                            if (sm!.no_registra === true) return <span>Libreta: 🔍 Sin registro de situación militar</span>;
                            const estadoLibreta = sm!.estado_tarjeta_militar || "";
                            if (sm!.estado === "ADVERTENCIA") return <span>Libreta: ⛔ Situación sin definir — {estadoLibreta}</span>;
                            return <span>Libreta: ✅ {estadoLibreta || "Ver informe"}</span>;
                          })()}
                        </>
                      );
                    })()}
                  </div>
                  <div className="PSX-resultado-acciones">
                    {estudioNuevo.pdf && (
                      <button className="PSX-boton-primario" onClick={() => abrirPdf(estudioNuevo.consulta_id)}>
                        <FaFilePdf /> Descargar informe PDF
                      </button>
                    )}
                    {fuentesPendientes(estudioNuevo).length > 0 && (
                      <button
                        className="PSX-boton-secundario"
                        disabled={completando === estudioNuevo.consulta_id}
                        onClick={() => completarConsulta(estudioNuevo.consulta_id, estudioNuevo)}
                      >
                        {completando === estudioNuevo.consulta_id
                          ? <><ClipLoader size={14} color="#fff" /> Completando…</>
                          : <><FaRedoAlt /> Completar fuentes pendientes</>}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ════════ MÓDULO: HISTORIAL ════════ */}
          {vista === "historial" && (
            <section className="PSX-tarjeta PSX-historial">
              <div className="PSX-tarjeta-cab">
                <h2>Historial de consultas</h2>
                <span className="PSX-pill-cupo">{totalHistorial.toLocaleString("es-CO")} en total</span>
              </div>
              {cargandoHistorial ? (
                <ClipLoader size={20} color="#00A5B5" />
              ) : (
                <div className="PSX-tabla-envoltura">
                  <table className="PSX-tabla">
                    <thead>
                      <tr>
                        <th>Fecha</th><th>Cédula</th>
                        {historial.some((h) => h.placa) && <th>Placa</th>}
                        <th>Persona</th><th>Estado</th><th>Pendientes</th><th>Costo</th><th>Consultó</th><th>Informe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.length === 0 && (
                        <tr><td colSpan={historial.some((h) => h.placa) ? 9 : 8} className="PSX-vacio">Aún no hay consultas registradas.</td></tr>
                      )}
                      {historial.map((h) => {
                        const pendientes = h.fuentes_pendientes ?? [];
                        const expandida = detalleAbierto === h.consulta_id;
                        const columnas = historial.some((x) => x.placa) ? 9 : 8;
                        return (
                          <Fragment key={h.consulta_id}>
                            <tr
                              className={pendientes.length ? "PSX-fila-expandible" : undefined}
                              onClick={() => setDetalleAbierto(expandida ? null : h.consulta_id)}
                            >
                              <td data-label="Fecha">{fechaHoraColombia(h.creado_en)}</td>
                              <td data-label="Cédula">{h.cedula}</td>
                              {historial.some((x) => x.placa) && (
                                <td data-label="Placa">{h.placa || "—"}</td>
                              )}
                              <td data-label="Persona">{h.nombre_consultado || "—"}</td>
                              <td data-label="Estado">
                                <span className={`PSX-badge ${claseEstado(h.estado)}`}>{textoEstado(h.estado)}</span>{" "}
                                {h.canal === "api" && (
                                  <span className="PSX-badge PSX-badge-api" title="Hecha por una integración con API key">API</span>
                                )}
                              </td>
                              <td data-label="Pendientes">
                                {pendientes.length ? (
                                  <>
                                    <span className="PSX-badge PSX-badge-pendientes" title="Haga clic en la fila para ver las fuentes pendientes">
                                      {pendientes.length} <FaChevronDown className={`PSX-chevron-pend ${expandida ? "PSX-chevron-pend-arriba" : ""}`} />
                                    </span>{" "}
                                    <button
                                      className="PSX-boton-recargar"
                                      disabled={completando === h.consulta_id}
                                      title="Volver a consultar las fuentes pendientes y re-emitir el informe"
                                      aria-label="Completar fuentes pendientes"
                                      onClick={(e) => { e.stopPropagation(); completarConsulta(h.consulta_id); }}
                                    >
                                      {completando === h.consulta_id
                                        ? <ClipLoader size={10} color="#35506b" />
                                        : <FaRedoAlt />}
                                    </button>
                                  </>
                                ) : (
                                  <span className="PSX-texto-suave">—</span>
                                )}
                              </td>
                              <td data-label="Costo">{h.costo_cop === 0 ? "Sin costo" : pesosColombianos(h.costo_cop ?? 0)}</td>
                              <td data-label="Consultó">{h.usuario_nombre}</td>
                              <td data-label="Informe">
                                <button
                                  className="PSX-boton-tabla"
                                  onClick={(e) => { e.stopPropagation(); abrirPdf(h.consulta_id); }}
                                >
                                  <FaFilePdf /> PDF
                                </button>
                              </td>
                            </tr>
                            {expandida && (
                              <tr key={`${h.consulta_id}-detalle`} className="PSX-fila-detalle">
                                <td colSpan={columnas}>
                                  {pendientes.length ? (
                                    <div className="PSX-detalle-pendientes">
                                      <strong>Fuentes sin respuesta en esta consulta:</strong>
                                      <ul className="PSX-detalle-lista">
                                        {pendientes.map((f) => (
                                          <li key={f}>{nombreFuente(f)}</li>
                                        ))}
                                      </ul>
                                      <p className="PSX-campo-ayuda" style={{ marginTop: 8, marginBottom: 0 }}>
                                        Puede volver a consultarlas con el botón ↻ junto al número de
                                        pendientes. Si la consulta original quedó sin costo (la mayoría de las
                                        fuentes falló), al completarla se cobra el valor del plan.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="PSX-detalle-pendientes">
                                      Todas las fuentes consultadas en esta consulta respondieron.
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {totalHistorial > 10 && (
                <div className="PSX-paginacion">
                  <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
                  <span>Página {pagina + 1} de {Math.ceil(totalHistorial / 10)}</span>
                  <button disabled={(pagina + 1) * 10 >= totalHistorial} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
