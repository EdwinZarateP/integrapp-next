'use client';
import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import {
  FaCheckCircle, FaCopy, FaExternalLinkAlt, FaKey, FaLink, FaPlus,
  FaSearch, FaTimes, FaTruck, FaUserPlus,
} from "react-icons/fa";
import PhoneField from "@/Componentes/PhoneField";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Cuenta seleccionada como responsable de la ficha (existente o recién creada). */
interface CuentaSel {
  id: string;
  nombre: string;
  correo: string;
  perfil: string;
  placasPropias: number;
  /** Solo para cuentas recién creadas: se muestra una vez y habilita el login directo. */
  clave?: string;
}

interface CuentaLista {
  id: string;
  nombre: string;
  correo: string;
  perfil: string;
  creado_por: string;
  creado_en?: string;
  politicas_pendientes: boolean;
}

interface ResultadoBusqueda {
  id: string;
  nombre: string;
  correo: string;
  perfil: string;
  cedula: string;
  celular: string;
  activo: boolean;
  correo_verificado: boolean;
  alta_por_seguridad: boolean;
  politicas_pendientes: boolean;
  placas_propias: number;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  registro_incompleto: "En registro",
  completado_revision: "En revisión",
  aprobado: "Aprobado",
  devuelto: "Devuelto",
  inactivo: "Inactivo",
  en_actualizacion: "En actualización",
};

interface VistaAltaProps {
  /** Vuelve a las bandejas de revisión. */
  onVolver: () => void;
}

/**
 * Módulo «Alta de VEHÍCULO» de /revision (2026-10-01): lo que se da de alta
 * es la PLACA con todo lo que implica. Flujo vehículo-primero:
 *   1. Placa — se CREA al validar (borrador sin responsable): lo digitado
 *      nunca se pierde — si se sale a medias, al volver se retoma.
 *   2. Responsable — se VINCULA una cuenta existente (búsqueda por
 *      correo/cédula/nombre) o se crea una nueva con credenciales; al elegir,
 *      la placa pendiente se asigna SOLA.
 *   3. Abrir panel — siempre por impersonación (login-como): Seguridad
 *      construye la ficha; el conductor acepta sus políticas cuando entre
 *      con SU clave (Seguridad jamás las acepta por él).
 */
const VistaAlta: React.FC<VistaAltaProps> = ({ onVolver }) => {
  const router = useRouter();

  // ── Paso 1: vehículo (la placa manda). ──
  const [placa, setPlaca] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [placaError, setPlacaError] = useState("");
  /** Placa creada (borrador o ya vinculada) que espera responsable / panel. */
  const [placaPendiente, setPlacaPendiente] = useState("");
  /** La placa pendiente ya tiene responsable (auto-asignada al elegir cuenta). */
  const [vinculada, setVinculada] = useState(false);

  // ── Paso 2: responsable de la ficha. ──
  const [modoCuenta, setModoCuenta] = useState<"existente" | "nueva">("existente");
  const [cuenta, setCuenta] = useState<CuentaSel | null>(null);

  // Modo «cuenta existente»: búsqueda.
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null);

  // Modo «cuenta nueva»: SOLO correo + celular (el nombre y la cédula los
  // aporta la IA al leer los documentos en el panel, y el backend los
  // propaga a la cuenta).
  const [correo, setCorreo] = useState("");
  const [perfil, setPerfil] = useState("CONDUCTOR");
  const [celular, setCelular] = useState("");
  const [creando, setCreando] = useState(false);

  // ── Paso 3: placas vinculadas en esta sesión. ──
  const [placasCreadas, setPlacasCreadas] = useState<string[]>([]);
  /** Nombre de Seguridad (cookie de la sesión de /revision). */
  const seguridadNombre = () => Cookies.get("seguridadNombre") || "Seguridad";

  // Listado de cuentas creadas por Seguridad (sobrevive al refresco: vive en BD).
  const [cuentas, setCuentas] = useState<CuentaLista[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);

  const cargarCuentas = async () => {
    try {
      const res = await axios.get<{ cuentas: CuentaLista[] }>(
        `${API_BASE}/conductores/alta-seguridad/listar`);
      setCuentas(res.data.cuentas || []);
    } catch { setCuentas([]); }
    finally { setCargandoCuentas(false); }
  };

  useEffect(() => { cargarCuentas(); }, []);

  // ── Paso 1: la placa se CREA al validar (borrador sin responsable). ──
  const consultarPlaca = async () => {
    const limpia = placa.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,7}$/.test(limpia)) {
      setPlacaError("Placa inválida: 4 a 7 caracteres alfanuméricos.");
      setPlacaPendiente("");
      return;
    }
    setConsultando(true);
    setPlacaError("");
    try {
      const res = await axios.get<{ existe: boolean; estadoIntegra: string | null;
        duenio: { nombre: string; correo: string; perfil: string } | null;
        borrador: boolean }>(
        `${API_BASE}/vehiculos/consultar-placa/${limpia}`);
      if (res.data.existe && res.data.borrador) {
        // Borrador de un alta a medias: la placa YA existe en BD → se retoma
        // (antes esto era un error y el trabajo digitado se perdía).
        setPlacaPendiente(limpia);
        setVinculada(false);
        if (cuenta) await asignarResponsable(limpia, cuenta);
        return;
      }
      if (res.data.existe) {
        const estado = ETIQUETAS_ESTADO[res.data.estadoIntegra || ""] || res.data.estadoIntegra;
        const duenio = res.data.duenio;
        setPlacaError(
          `La placa ${limpia} ya está registrada (${estado})` +
          (duenio?.nombre ? ` — la tiene ${duenio.nombre}` : "") +
          ". No se puede dar de alta de nuevo.");
        setPlacaPendiente("");
        return;
      }
      // No existe → se crea YA como borrador: lo digitado no se pierde
      // aunque se salga del módulo antes de elegir el responsable.
      const fd = new FormData();
      fd.append("placa", limpia);
      fd.append("creado_por", seguridadNombre());
      await axios.post(`${API_BASE}/vehiculos/crear`, fd);
      setPlacaPendiente(limpia);
      setVinculada(false);
      if (cuenta) await asignarResponsable(limpia, cuenta);
    } catch (err: any) {
      setPlacaError(err?.response?.data?.detail || "No se pudo crear la placa. Intenta de nuevo.");
      setPlacaPendiente("");
    } finally {
      setConsultando(false);
    }
  };

  /** Vincula la placa pendiente a la cuenta (borrador → ficha con dueño).
   *  La llama la elección del responsable (auto) y el botón de respaldo. */
  const asignarResponsable = async (placaObjetivo: string, cuentaObjetivo: CuentaSel) => {
    try {
      const fd = new FormData();
      fd.append("id_usuario", cuentaObjetivo.id);
      fd.append("asignado_por", seguridadNombre());
      await axios.put(`${API_BASE}/vehiculos/asignar-responsable/${placaObjetivo}`, fd);
      setVinculada(true);
      setPlacasCreadas(prev => prev.includes(placaObjetivo) ? prev : [...prev, placaObjetivo]);
      return true;
    } catch (err: any) {
      Swal.fire("No se pudo vincular la placa",
        err?.response?.data?.detail || "Error de conexión.", "error");
      return false;
    }
  };

  // ── Paso 2a: buscar cuentas existentes. ──
  const buscarCuentas = async () => {
    const q = busqueda.trim();
    if (q.length < 3) {
      Swal.fire("Muy corto", "Escribe al menos 3 caracteres (correo, cédula o nombre).", "warning");
      return;
    }
    setBuscando(true);
    try {
      const res = await axios.get<{ cuentas: ResultadoBusqueda[] }>(
        `${API_BASE}/conductores/buscar`, { params: { q } });
      setResultados(res.data.cuentas || []);
    } catch {
      setResultados([]);
      Swal.fire("Error", "No se pudo buscar.", "error");
    } finally { setBuscando(false); }
  };

  const vincular = (r: ResultadoBusqueda) => {
    const sel: CuentaSel = {
      id: r.id, nombre: r.nombre, correo: r.correo,
      perfil: r.perfil, placasPropias: r.placas_propias,
    };
    setCuenta(sel);
    // La placa pendiente se asigna SOLA al elegir el responsable.
    if (placaPendiente && !vinculada) asignarResponsable(placaPendiente, sel);
  };

  // ── Paso 2b: crear cuenta nueva (credenciales una sola vez). ──
  const crearCuenta = async () => {
    if (!correo.trim().includes("@")) {
      Swal.fire("Correo obligatorio", "Escribe un correo válido del conductor.", "warning");
      return;
    }
    if (!celular.trim()) {
      Swal.fire("Celular obligatorio", "Escribe el número de celular (para notificaciones y contacto).", "warning");
      return;
    }
    setCreando(true);
    try {
      const res = await axios.post<{ clave: string; usuario: { id: string; correo: string; perfil: string } }>(
        `${API_BASE}/conductores/alta-seguridad`,
        { correo: correo.trim(), perfil, celular: celular.trim(),
          creado_por: Cookies.get("seguridadNombre") || "Seguridad" });
      const nueva: CuentaSel = {
        id: res.data.usuario.id,
        // El nombre llega después: la IA lo lee de la cédula/RUT y el
        // backend lo propaga a la cuenta (mientras tanto, mostramos el correo).
        nombre: "",
        correo: res.data.usuario.correo,
        perfil: res.data.usuario.perfil,
        placasPropias: 0,
        clave: res.data.clave,
      };
      setCuenta(nueva);
      cargarCuentas();
      // La placa pendiente se asigna SOLA: la ficha queda con dueño ya.
      if (placaPendiente && !vinculada) await asignarResponsable(placaPendiente, nueva);
      Swal.fire("Cuenta creada", "Le enviamos sus credenciales por correo y WhatsApp (si dejó celular). La clave también se muestra en pantalla por si no llegan.", "success");
    } catch (err: any) {
      Swal.fire("No se pudo crear", err?.response?.data?.detail || "Error de conexión.", "error");
    } finally {
      setCreando(false);
    }
  };

  /** Tenedor con flota: otra placa para la MISMA cuenta (se crea y se le
   *  asigna sola al validar, porque la cuenta sigue seleccionada). */
  const agregarOtraPlaca = () => {
    setPlaca("");
    setPlacaError("");
    setPlacaPendiente("");
    setVinculada(false);
    setResultados(null);
    setBusqueda("");
  };

  /** Suelta la cuenta seleccionada (elige otro responsable o crea una nueva). */
  const soltarCuenta = () => {
    setCuenta(null);
    setVinculada(false);
    setCorreo(""); setPerfil("CONDUCTOR"); setCelular("");
  };

  /** Nombre visible de la cuenta: el real si ya llegó (IA), si no el correo. */
  const nombreCuenta = (c: { nombre?: string; correo: string }) =>
    (c.nombre || "").trim() || c.correo;

  const copiarCredenciales = () => {
    if (!cuenta?.clave) return;
    const texto = `IntegrApp - Tu acceso\nUsuario: ${cuenta.correo}\nClave: ${cuenta.clave}`;
    navigator.clipboard?.writeText(texto).then(() => {
      Swal.fire({ title: "Copiado", text: "Credenciales listas para pegar en WhatsApp/correo.", timer: 1800, showConfirmButton: false, icon: "success" });
    }).catch(() => undefined);
  };

  /**
   * Abre el panel DEL conductor SIEMPRE por impersonación (login-como), sea
   * la cuenta nueva o existente: Seguridad no necesita recordar claves y
   * TODAS las mutaciones quedan trazadas con su nombre (cookie de sesión
   * impersonada + bitácora auditoriaVehiculo del backend).
   */
  const abrirPanel = async () => {
    if (!cuenta) return;
    try {
      Swal.fire({ title: "Ingresando al panel...", didOpen: () => Swal.showLoading() });
      const res = await axios.post(`${API_BASE}/conductores/login-como/${cuenta.id}`, {
        solicitante: seguridadNombre() });
      _montarSesionImpersonada(res.data);
    } catch (err: any) {
      Swal.fire("No se pudo entrar", err?.response?.data?.detail || "Error de conexión.", "error");
    }
  };

  /** Re-ingreso desde la tabla de cuentas creadas (vehículos a medias). */
  const abrirPanelCuenta = async (c: CuentaLista) => {
    try {
      Swal.fire({ title: "Ingresando al panel...", didOpen: () => Swal.showLoading() });
      const res = await axios.post(`${API_BASE}/conductores/login-como/${c.id}`, {
        solicitante: seguridadNombre() });
      _montarSesionImpersonada(res.data);
    } catch (err: any) {
      Swal.fire("No se pudo entrar", err?.response?.data?.detail || "Error de conexión.", "error");
    }
  };

  const _montarSesionImpersonada = (data: any) => {
    // El login fue exitoso: cerrar el Swal de carga ANTES de navegar —
    // la navegación de Next es client-side (no desmonta el overlay, que
    // vive fuera de React) y quedaba pegado "Ingresando al panel…".
    Swal.close();
    const u = data.usuario;
    Cookies.set('conductorCorreo', u.correo, { expires: 30 });
    Cookies.set('conductorId', u.id, { expires: 30 });
    Cookies.set('conductorPerfil', u.perfil, { expires: 30 });
    if (u.primerNombre) Cookies.set('conductorPrimerNombre', u.primerNombre, { expires: 30 });
    // Marca de impersonación: el panel la usa para el banner «Modo Seguridad»
    // y para enviar editado_por en TODAS las mutaciones (trazabilidad).
    Cookies.set('conductorImpersonadoPor', data.impersonado_por || seguridadNombre(), { expires: 30 });
    if (data.politicas_pendientes) {
      Cookies.set('conductorPoliticasPendientes', '1', { expires: 30 });
    } else {
      Cookies.remove('conductorPoliticasPendientes');
    }
    router.push('/PanelConductores');
  };

  /** Rescate: la clave mostrada se perdió (o el conductor la olvidó) →
   *  se genera una NUEVA (invalida la anterior) y se muestra una vez. */
  const regenerarClave = async (c: CuentaLista) => {
    const ok = await Swal.fire({
      title: `¿Generar nueva clave para ${c.nombre}?`,
      html: `La clave anterior de <b>${c.correo}</b> deja de funcionar.<br>La nueva se muestra una sola vez.`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Generar nueva', confirmButtonColor: '#00a5b5',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      const res = await axios.post<{ clave: string }>(
        `${API_BASE}/conductores/alta-seguridad/${c.id}/nueva-clave`);
      await Swal.fire({
        title: 'Nueva clave generada',
        html: `<div style="background:#e6f5f6;border:1px solid #00a5b5;border-radius:8px;
               padding:10px;font-size:1.3rem;font-weight:800;letter-spacing:1px;">
               ${res.data.clave}</div>
               <small>Copiala ahora: no se vuelve a mostrar.</small>`,
        confirmButtonText: 'Listo',
      });
    } catch (err: any) {
      Swal.fire('Error', err?.response?.data?.detail || 'No se pudo regenerar.', 'error');
    }
  };

  const conductorConPlaca = cuenta && cuenta.perfil !== "TENEDOR" && cuenta.placasPropias >= 1;

  return (
    <div className="revx-alta">
      {/* ── Paso 1: el vehículo (la placa manda) ── */}
      <section className="revx-tarjeta revx-alta-card">
        <div className="revx-alta-cab">
          <h2><FaTruck /> 1. Vehículo</h2>
          {placaPendiente &&
            <span className="rev-chip rev-chip--aprobado">
              <FaCheckCircle /> {placaPendiente} {vinculada ? "vinculada" : "creada"}
            </span>}
        </div>
        <p className="revx-alta-nota">
          Lo que se da de alta es el <b>vehículo</b>: al validar, la placa queda
          <b>creada de una vez</b> (borrador sin responsable) — no se pierde
          aunque salgas; al volver se retoma y sigues donde ibas. Si ya existe,
          se muestra en qué estado está y quién la tiene.
        </p>
        <div className="revx-alta-fila">
          <input
            value={placa}
            onChange={e => { setPlaca(e.target.value.toUpperCase()); setPlacaPendiente(""); setPlacaError(""); }}
            placeholder="Ej: ABC123" maxLength={7} disabled={!!placaPendiente}
          />
          {placaPendiente ? (
            <button className="revx-alta-btn-sec" onClick={() => { setPlacaPendiente(""); setPlaca(""); }}>
              <FaTimes /> Cambiar placa
            </button>
          ) : (
            <button className="revx-alta-btn-primario" onClick={consultarPlaca}
              disabled={consultando || !placa.trim()}>
              {consultando ? "Consultando…" : "Continuar"}
            </button>
          )}
        </div>
        {placaError && <p className="revx-alta-error">⚠ {placaError}</p>}
      </section>

      {/* ── Paso 2: responsable de la ficha ── */}
      <section className="revx-tarjeta revx-alta-card">
        <div className="revx-alta-cab">
          <h2>👤 2. Responsable de la ficha</h2>
          {cuenta &&
            <span className={`rev-chip ${conductorConPlaca ? "rev-chip--revision" : "rev-chip--aprobado"}`}>
              <FaLink /> {nombreCuenta(cuenta)} · {cuenta.perfil === "TENEDOR" ? "Tenedor" : "Conductor"}
            </span>}
        </div>
        {!placaPendiente ? (
          <p className="revx-alta-nota">Valida primero la placa en el paso 1.</p>
        ) : cuenta ? (
          <>
            <div className="revx-alta-cred">
              <div>
                <small>Cuenta vinculada</small>
                <strong>{cuenta.correo}</strong>
              </div>
              <div>
                <small>Perfil</small>
                <strong>{cuenta.perfil === "TENEDOR" ? "Tenedor (flota)" : "Conductor (1 placa)"}</strong>
              </div>
              {cuenta.clave && (
                <div>
                  <small>Clave (📧 enviada al conductor · una sola vez)</small>
                  <strong className="revx-alta-clave">{cuenta.clave}</strong>
                </div>
              )}
              {cuenta.clave && (
                <button className="revx-alta-btn-copiar" onClick={copiarCredenciales}>
                  <FaCopy /> Copiar credenciales
                </button>
              )}
              <button className="revx-alta-btn-copiar" onClick={soltarCuenta} style={{ marginLeft: cuenta.clave ? undefined : "auto" }}>
                <FaTimes /> Cambiar
              </button>
            </div>
            {conductorConPlaca && (
              <p className="revx-alta-aviso">
                ⚠ Esta cuenta de CONDUCTOR ya tiene {cuenta.placasPropias} placa(s) propia(s):
                el backend solo permite 1 por conductor. Para varias placas la cuenta debe ser TENEDOR.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="revx-alta-tabs">
              <button className={modoCuenta === "existente" ? "revx-alta-tab revx-alta-tab--activo" : "revx-alta-tab"}
                onClick={() => setModoCuenta("existente")}>
                Cuenta existente
              </button>
              <button className={modoCuenta === "nueva" ? "revx-alta-tab revx-alta-tab--activo" : "revx-alta-tab"}
                onClick={() => setModoCuenta("nueva")}>
                <FaUserPlus /> Crear cuenta nueva
              </button>
            </div>

            {modoCuenta === "existente" ? (
              <>
                <p className="revx-alta-nota">
                  Busca por <b>correo, cédula o nombre</b> al dueño que ya tiene cuenta
                  (tenedor que saca otro camión, placas históricas…). Se vincula la placa
                  sin crear cuentas duplicadas.
                </p>
                <div className="revx-alta-fila">
                  <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") buscarCuentas(); }}
                    placeholder="Correo, cédula o nombre" style={{ maxWidth: 340 }}
                  />
                  <button className="revx-alta-btn-primario" onClick={buscarCuentas} disabled={buscando}>
                    <FaSearch /> {buscando ? "Buscando…" : "Buscar"}
                  </button>
                </div>
                {resultados && (
                  resultados.length === 0 ? (
                    <p className="revx-alta-nota">
                      Sin resultados. Si no tiene cuenta, cámbiate a
                      <b> «Crear cuenta nueva»</b>.
                    </p>
                  ) : (
                    <table className="rev-est-tabla revx-alta-tabla">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Correo</th>
                          <th>Perfil</th>
                          <th>Cédula</th>
                          <th>Placas propias</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultados.map(r => (
                          <tr key={r.id}>
                            <td>{r.nombre}{!r.activo && <small className="revx-alta-mut"> (pendiente de activación)</small>}</td>
                            <td>{r.correo}</td>
                            <td>{r.perfil === "TENEDOR" ? "Tenedor" : "Conductor"}</td>
                            <td>{r.cedula || "—"}</td>
                            <td>{r.placas_propias}</td>
                            <td>
                              <button className="revx-alta-btn-copiar" onClick={() => vincular(r)} disabled={!r.activo}>
                                <FaLink /> Vincular
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </>
            ) : (
              <>
                <p className="revx-alta-nota">
                  Solo pedimos <b>correo y celular</b>: la clave se genera sola,
                  <b> se le envía por correo</b> y se muestra <b>una sola vez</b> en
                  pantalla por si el correo no llega.
                  El nombre, la cédula y los demás datos los lee la <b>IA</b> al
                  cargar los documentos en el panel — y llegan solos a la cuenta.
                  Él deberá aceptar las políticas al entrar por primera vez.
                </p>
                <div className="revx-alta-grid">
                  <label>
                    Correo del conductor *
                    <input value={correo} onChange={e => setCorreo(e.target.value)}
                      placeholder="conductor@correo.com" />
                  </label>
                  <label>
                    Celular (WhatsApp) *
                    <PhoneField name="celular" value={celular}
                      onChange={e => setCelular(e.target.value)} required />
                  </label>
                  <label>
                    Perfil
                    <select value={perfil} onChange={e => setPerfil(e.target.value)}>
                      <option value="CONDUCTOR">Conductor (1 placa)</option>
                      <option value="TENEDOR">Tenedor (dueño con flota)</option>
                    </select>
                  </label>
                </div>
                <button className="revx-alta-btn-primario" onClick={crearCuenta} disabled={creando}>
                  {creando ? "Creando…" : "Crear cuenta"}
                </button>
              </>
            )}
          </>
        )}
      </section>

      {/* ── Paso 3: dar de alta y cargar la información ── */}
      <section className="revx-tarjeta revx-alta-card">
        <div className="revx-alta-cab">
          <h2>📋 3. Dar de alta y cargar la información</h2>
          {placasCreadas.length > 0 &&
            <span className="rev-chip rev-chip--aprobado"><FaCheckCircle /> {placasCreadas.length} dada(s) de alta</span>}
        </div>
        {!placaPendiente && placasCreadas.length === 0 ? (
          <p className="revx-alta-nota">
            Digita la placa en el paso 1 — queda <b>creada de una vez</b> y por
            aquí verás el responsable y el acceso al panel.
          </p>
        ) : (
          <>
            {placaPendiente && (
              <p className="revx-alta-nota">
                Placa <b>{placaPendiente}</b> —{" "}
                {vinculada
                  ? <>vinculada a <b>{cuenta?.correo}</b>: lista para cargarle la información.</>
                  : cuenta
                    ? <>pendiente de vincular a <b>{cuenta.correo}</b>.</>
                    : <>creada (borrador). Elige el responsable en el paso 2.</>}
              </p>
            )}
            {placasCreadas.length > 0 && (
              <p className="revx-alta-nota">
                Placas vinculadas en esta sesión: <b>{placasCreadas.join(" · ")}</b>
              </p>
            )}
            {placaPendiente && cuenta && !vinculada && (
              <div className="revx-alta-fila">
                <button className="revx-alta-btn-primario"
                  onClick={() => asignarResponsable(placaPendiente, cuenta)}>
                  <FaLink /> Vincular responsable
                </button>
              </div>
            )}
            {cuenta && vinculada && cuenta.perfil === "TENEDOR" && (
              <div className="revx-alta-fila">
                <button className="revx-alta-btn-sec" onClick={agregarOtraPlaca}>
                  <FaPlus /> Agregar otra placa a {nombreCuenta(cuenta).split(" ")[0]}
                </button>
              </div>
            )}
            {cuenta && (
              <p className="revx-alta-nota" style={{ marginTop: 14 }}>
                Entra al panel del conductor para cargarle datos (la IA lee los
                documentos que subas) y los documentos obligatorios. Con todo al
                100% puedes darle <b>«Finalizar» aunque falte la firma</b> (es un
                acto personal del conductor): el vehículo llega a tu bandeja de
                revisión <b>con los estudios de seguridad corridos
                automáticamente</b>. La <b>firma y las políticas de datos las hace
                él</b> la primera vez que entre con su clave. Si el caso lo
                requiere (placas históricas con autorización en papel), la{" "}
                <b>Hoja de Vida Física la subes tú</b> desde la pestaña Documentos
                de la revisión. Tu sesión de Seguridad queda intacta (cookies
                separadas){" "}
                — siempre se entra <b>como</b> él por Seguridad: su clave no se
                toca y todo lo que hagas queda auditado con tu nombre.
              </p>
            )}
            {cuenta && (!placaPendiente || vinculada) && (
              <button className="revx-alta-btn-primario" onClick={abrirPanel}>
                <FaExternalLinkAlt /> Abrir panel como {nombreCuenta(cuenta).split(" ")[0]}
              </button>
            )}
          </>
        )}
      </section>

      {/* ── Cuentas creadas (viven en BD: sobreviven al refresco) ── */}
      <section className="revx-tarjeta revx-alta-card">
        <div className="revx-alta-cab">
          <h2>🗂️ Cuentas creadas por Seguridad</h2>
        </div>
        <p className="revx-alta-nota">
          La clave es del <b>conductor</b> (para que él entre al portal y acepte
          sus políticas) — <b>tú no la necesitas</b>: entra con «Abrir panel».
          Se muestra una sola vez y queda hasheada; si él la pierde, genera
          otra con <b>«Nueva clave»</b> (la anterior deja de funcionar).
        </p>
        {cargandoCuentas ? (
          <p className="revx-alta-nota">Cargando…</p>
        ) : cuentas.length === 0 ? (
          <p className="revx-alta-nota">Aún no hay cuentas creadas por Seguridad.</p>
        ) : (
          <table className="rev-est-tabla revx-alta-tabla">
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Usuario (correo)</th>
                <th>Perfil</th>
                <th>Creada por</th>
                <th>Políticas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map(c => (
                <tr key={c.id}>
                  <td>{(c.nombre || "").trim() ? c.nombre : <span className="revx-alta-mut">⏳ Lo llena la IA al leer sus docs</span>}</td>
                  <td>{c.correo}</td>
                  <td>{c.perfil === 'TENEDOR' ? 'Tenedor' : 'Conductor'}</td>
                  <td>{c.creado_por}</td>
                  <td>
                    {c.politicas_pendientes
                      ? <span className="rev-est-sem rev-est-sem--medio">Pendientes</span>
                      : <span className="rev-est-sem rev-est-sem--limpio">Aceptadas</span>}
                  </td>
                  <td className="revx-alta-acciones">
                    <button className="revx-alta-btn-copiar" onClick={() => abrirPanelCuenta(c)}>
                      <FaExternalLinkAlt /> Abrir panel
                    </button>
                    <button className="revx-alta-btn-copiar" onClick={() => regenerarClave(c)}>
                      <FaKey /> Nueva clave
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default VistaAlta;
