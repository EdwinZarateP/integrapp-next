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

  // Mensajes rotativos mientras corre la consulta (acompañan al detective).
  const mensajesConsulta = [
    "Investigando en Manifiestos RNDC…",
    "Revisando antecedentes en Procuraduría…",
    "Consultando antecedentes judiciales en la Policía…",
    "Cruzando fuentes y verificando datos…",
    "Casi listo: preparando su informe…",
  ];
  const [indiceMensaje, setIndiceMensaje] = useState(0);
  useEffect(() => {
    if (!consultando) return;
    setIndiceMensaje(0);
    const rotador = setInterval(() => {
      setIndiceMensaje((i) => (i + 1) % mensajesConsulta.length);
    }, 4000);
    return () => clearInterval(rotador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultando]);

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

  const nombreFuente = (f: string) =>
    f === "manifiestos_rndc" ? "Manifiestos RNDC"
    : f === "procuraduria" ? "Procuraduría"
    : f === "policia" ? "Antecedentes Policía"
    : f === "runt" ? "Vehículo RUNT"
    : f;

  const planActivo = cupo?.planes?.find((p) => p.plan_id === planAbierto) ?? null;
  const requierePlaca = planActivo?.fuentes?.includes("runt") ?? false;

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitos = cedula.replace(/\D/g, "");
    if (digitos.length < 3 || digitos.length > 15) {
      Swal.fire("Cédula inválida", "Debe tener entre 3 y 15 dígitos", "warning");
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
    // Placa: requerida SOLO si el plan incluye la fuente runt.
    let placaNorm: string | undefined;
    let propietarioNorm: string | undefined;
    if (requierePlaca) {
      placaNorm = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (!/^[A-Z]{3}\d{2}[\dA-Z]$|^[A-Z]{2}\d{4}$/.test(placaNorm)) {
        Swal.fire("Placa inválida", "Use el formato AAA123 (o AAA12A para moto)", "warning");
        return;
      }
      // Cédula del propietario: OPCIONAL (vacía = el conductor es el dueño).
      const prop = cedulaPropietario.replace(/\D/g, "");
      if (prop && (prop.length < 3 || prop.length > 15)) {
        Swal.fire("Cédula de propietario inválida", "Debe tener entre 3 y 15 dígitos (o déjela vacía si el conductor es el propietario)", "warning");
        return;
      }
      propietarioNorm = prop || undefined;
    }
    setConsultando(true);
    setEstudioNuevo(null);
    try {
      const estudio = await crearEstudio(digitos, undefined, planAbierto, placaNorm, propietarioNorm);
      setEstudioNuevo(estudio);
      let titulo = "Consulta completada";
      let icono: "success" | "warning" | "error" = "success";
      if (estudio.estado === "COMPLETADA_CON_ADVERTENCIAS") {
        titulo = "Completada con advertencias"; icono = "warning";
      } else if (estudio.estado === "PARCIAL") {
        titulo = "Parcial: una fuente no respondió"; icono = "warning";
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
                const pidePlaca = p.fuentes?.includes("runt");
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
                        <div className="PS-input-icono">
                          <FaIdCard />
                          <input
                            inputMode="numeric" placeholder="Cédula" value={cedula}
                            onChange={(e) => setCedula(e.target.value)} disabled={consultando} autoFocus
                          />
                        </div>
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
                        {pidePlaca && (
                          <div className="PS-input-icono">
                            <FaUserCircle />
                            <input
                              inputMode="numeric"
                              placeholder="Cédula del propietario (vacía si es el conductor)"
                              value={cedulaPropietario}
                              onChange={(e) => setCedulaPropietario(e.target.value)}
                              maxLength={15} disabled={consultando}
                            />
                          </div>
                        )}
                        <button type="submit" className="PS-boton-primario" disabled={consultando || !cedula}>
                          {consultando ? <><ClipLoader size={14} color="#fff" /> Consultando…</> : "Consultar"}
                        </button>
                        {pidePlaca && (
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
                Esto puede tomar de 3 a 60 segundos. No cierre la ventana.
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
                <span>{new Date(estudioNuevo.creado_en).toLocaleString("es-CO")}</span>
                <span>Procuraduría: {
                  estudioNuevo.fuentes?.procuraduria?.no_registra === true ? "✅ Sin anotaciones"
                  : estudioNuevo.fuentes?.procuraduria?.no_registra === false ? "⛔ Registra anotaciones"
                  : estudioNuevo.fuentes?.procuraduria ? "⚠️ Ver PDF"
                  : "No disponible"}
                </span>
                <span>Policía: {
                  estudioNuevo.fuentes?.policia?.no_registra === true ? "✅ Sin antecedentes"
                  : estudioNuevo.fuentes?.policia?.no_registra === false ? "⛔ Requerido por autoridad judicial"
                  : estudioNuevo.fuentes?.policia ? "⚠️ Ver PDF"
                  : "No disponible"}
                </span>
                <span>RNDC: {estudioNuevo.fuentes?.manifiestos_rndc?.total ?? 0} viaje(s)</span>
                {(() => {
                  const runt = estudioNuevo.fuentes?.runt;
                  if (!runt) return null;
                  if (runt.no_registra === true) return <span>RUNT: 🔍 Placa sin información</span>;
                  if (runt.no_registra === false) return <span>RUNT: ⚠️ Cédula no es del propietario activo</span>;
                  if (runt.soat?.vigente === true) return <span>RUNT: ✅ SOAT vigente (vence {runt.soat.fecha_fin_vigencia})</span>;
                  if (runt.soat?.vigente === false) return <span>RUNT: ⛔ SOAT vencido</span>;
                  const marca = runt.datos_vehiculo?.marca;
                  return <span>RUNT: {marca ? `🚗 ${marca}` : "⚠️ Ver PDF"}</span>;
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
                {cupo.planes.map((p) => {
                  const pct = !p.ilimitado && p.cupo_autorizado && p.cupo_autorizado > 0
                    ? Math.min(100, (p.cupo_consumido / p.cupo_autorizado) * 100) : 0;
                  return (
                    <div key={p.plan_id} className="PS-fuente-cupo">
                      <p className="PS-fuente-nombre">
                        {p.nombre}
                        <span className="PS-fuente-precio">{pesosColombianos(p.precio_por_estudio)}</span>
                      </p>
                      <small style={{ color: "#57606a" }}>{p.fuentes.map(nombreFuente).join(" + ")}</small>
                      {p.ilimitado ? (
                        <p className="PS-cupo-texto PS-cupo-ilimitado">Sin límite</p>
                      ) : (
                        <>
                          <div className="PS-barra"><div className="PS-barra-llena" style={{ width: `${pct}%` }} /></div>
                          <p className="PS-cupo-texto">
                            Quedan <strong>{p.cupo_disponible ?? 0}</strong> de {p.cupo_autorizado}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
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
                    <td data-label="Fecha">{new Date(h.creado_en).toLocaleString("es-CO")}</td>
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
                      </button>
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
