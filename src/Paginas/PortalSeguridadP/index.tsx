"use client";

/* Portal CLIENTE de Estudios de Seguridad: la empresa cliente entra con su
   correo y clave, ve su plan, consulta una cédula, descarga el PDF del
   informe y revisa su historial. Independiente de la Torre de Control. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { ClipLoader } from "react-spinners";
import Lottie from "lottie-react";
import animationDetective from "@/Imagenes/AnimationDetective.json";
import {
  FaSearch, FaFilePdf, FaSignOutAlt, FaHistory, FaIdCard, FaChartPie,
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
  // El usuario elige OBLIGATORIAMENTE un plan; sus fuentes van implícitas.
  const [planElegido, setPlanElegido] = useState<string | null>(null);

  const nombreFuente = (f: string) =>
    f === "manifiestos_rndc" ? "Manifiestos RNDC" : f === "procuraduria" ? "Procuraduría" : f;

  // Preseleccionar el primer plan al cargar el cupo (uno solo = sin elección).
  useEffect(() => {
    if (cupo?.planes?.length && !planElegido) setPlanElegido(cupo.planes[0].plan_id);
  }, [cupo?.planes]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // La elección de plan es OBLIGATORIA.
    if (!planElegido) {
      Swal.fire("Elija un plan", "Seleccione con qué plan realizar esta consulta.", "warning");
      return;
    }
    setConsultando(true);
    setEstudioNuevo(null);
    try {
      const estudio = await crearEstudio(digitos, undefined, planElegido);
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
            : `Persona: ${estudio.nombre_consultado || "no identificada"} · Consulta ${estudio.consulta_id}`,
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
    <div className="PS-contenedor">
      <header className="PS-header">
        <div>
          <h1>Consultas de Seguridad</h1>
          <p>{sesion?.empresa?.nombre ?? sesion.nombre}</p>
        </div>
        <div className="PS-header-derecha">
          <span className="PS-usuario">{sesion?.nombre}</span>
          <button className="PS-boton-salir" onClick={salir} title="Cerrar sesión">
            <FaSignOutAlt /> Salir
          </button>
        </div>
      </header>

      <div className="PS-grid">
        {/* ── Consulta ── */}
        <section className="PS-tarjeta PS-consulta">
          <h2><FaSearch /> Nueva consulta</h2>
          <p className="PS-ayuda">Escriba la cédula y elija con qué plan consultar.</p>
          {/* Plan con el que se cobra esta consulta (sus fuentes van implícitas) */}
          {(cupo?.planes?.length ?? 0) > 0 && (
            <div className="PS-selector-plan">
              <label className="PS-plan-label">
                <FaChartPie style={{ marginRight: 6, color: "#0F2A43" }} />
                Plan para esta consulta
              </label>
              <div className="PS-opciones-plan">
                {cupo!.planes!.map((p) => (
                  <label
                    key={p.plan_id}
                    className={`PS-check-plan ${planElegido === p.plan_id ? "PS-plan-activo" : ""}`}
                  >
                    <input
                      type="radio" name="ps-plan" checked={planElegido === p.plan_id}
                      onChange={() => setPlanElegido(p.plan_id)} disabled={consultando}
                    />
                    <span>
                      <strong>{p.nombre}</strong>
                      <small>
                        {p.fuentes.map(nombreFuente).join(" + ")}
                        {" · "}
                        {p.ilimitado
                          ? "sin límite"
                          : `quedan ${p.cupo_disponible ?? 0} · ${pesosColombianos(p.precio_por_estudio)}`}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={consultar} className="PS-form-consulta">
            <div className="PS-input-icono">
              <FaIdCard />
              <input
                inputMode="numeric" placeholder="Cédula" value={cedula}
                onChange={(e) => setCedula(e.target.value)} disabled={consultando}
              />
            </div>
            <button type="submit" className="PS-boton-primario" disabled={consultando || !cedula}>
              {consultando ? <><ClipLoader size={14} color="#fff" /> Consultando…</> : "Consultar"}
            </button>
          </form>
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
                <span>{new Date(estudioNuevo.creado_en).toLocaleString("es-CO")}</span>
                <span>Procuraduría: {
                  estudioNuevo.fuentes?.procuraduria?.no_registra === true ? "✅ Sin anotaciones"
                  : estudioNuevo.fuentes?.procuraduria?.no_registra === false ? "⛔ Registra anotaciones"
                  : estudioNuevo.fuentes?.procuraduria ? "⚠️ Ver PDF"
                  : "No disponible"}
                </span>
                <span>RNDC: {estudioNuevo.fuentes?.manifiestos_rndc?.total ?? 0} viaje(s)</span>
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
          <table className="PS-tabla">
            <thead>
              <tr>
                <th>Fecha</th><th>Cédula</th><th>Persona</th><th>Estado</th><th>Consultó</th><th>Informe</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && (
                <tr><td colSpan={6} className="PS-vacio">Aún no hay consultas registradas.</td></tr>
              )}
              {historial.map((h) => (
                <tr key={h.consulta_id}>
                  <td>{new Date(h.creado_en).toLocaleString("es-CO")}</td>
                  <td>{h.cedula}</td>
                  <td>{h.nombre_consultado || "—"}</td>
                  <td><span className={`PS-badge ${claseEstado(h.estado)}`}>{textoEstado(h.estado)}</span></td>
                  <td>{h.usuario_nombre}</td>
                  <td>
                    <button className="PS-boton-pdf-chico" onClick={() => abrirPdf(h.consulta_id)}>
                      <FaFilePdf /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  );
}
