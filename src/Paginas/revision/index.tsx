'use client';
import React, { useEffect, useState, useMemo } from "react";
import Cookies from "js-cookie";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { FaSearch, FaTimes } from "react-icons/fa";
import BarraSuperiorSeguridad from "@/Componentes/Barra";
import PestanasBandeja from "./componentes/PestanasBandeja";
import ListaVehiculos from "./componentes/ListaVehiculos";
import PanelDetalle from "./componentes/PanelDetalle";
import { Vehiculo, PestanaBandeja } from "./tipos";
import "./estilos.css";

const BANDEJAS_VALIDAS: PestanaBandeja[] = ["pendientes", "revision", "aprobados", "inactivos"];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * /revision — bandeja de trabajo de Seguridad: pestañas por estado con
 * contador, lista compacta y panel lateral de detalle con acciones
 * (Aprobar / Devolver / Inactivar / Reactivar). El diseño anterior era una
 * lista de acordeones de 900 líneas (2026-08-27 → rediseño bandeja+panel).
 */
const RevisionVehiculos: React.FC = () => {
  const router = useRouter();

  const [vehiculosPendientes, setVehiculosPendientes] = useState<Vehiculo[]>([]);
  const [vehiculosRevision, setVehiculosRevision] = useState<Vehiculo[]>([]);
  const [vehiculosInactivos, setVehiculosInactivos] = useState<Vehiculo[]>([]);
  const [vehiculosAprobados, setVehiculosAprobados] = useState<Vehiculo[]>([]);

  const [pestanaActiva, setPestanaActiva] = useState<PestanaBandeja>("revision");
  const [seleccionado, setSeleccionado] = useState<Vehiculo | null>(null);

  /* --- ESTADO EN LA URL (query param) ----------------------------------
     /revision?bandeja=aprobados — misma convención de /PanelConductores:
     sobrevive al refresh (F5), se puede compartir y marcar. */
  const searchParams = useSearchParams();
  const urlSincronizada = React.useRef(false);

  // Restaurar la bandeja desde la URL al montar.
  useEffect(() => {
    urlSincronizada.current = true;
    const bandejaUrl = searchParams.get("bandeja") as PestanaBandeja | null;
    if (bandejaUrl && BANDEJAS_VALIDAS.includes(bandejaUrl)) setPestanaActiva(bandejaUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Espejo de la bandeja activa en la URL (replace: no ensucia el historial).
  useEffect(() => {
    if (!urlSincronizada.current) return; // No pisar la restauración inicial.
    router.replace(`/revision?bandeja=${pestanaActiva}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaActiva]);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAprobadosEnVuelo, setBusquedaAprobadosEnVuelo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const vehiclesPerPage = 20;

  /* ---------------------------------------------------------------- */
  /* CARGA                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const idUsuario = Cookies.get("seguridadId");
    if (!idUsuario) {
      console.warn("Acceso denegado: Credenciales no encontradas.");
      router.push("/LoginUsuario");
    } else {
      cargarBandejas(idUsuario);
    }
  }, [router]);

  const cargarBandejas = async (idUsuario: string) => {
    try {
      const res = await axios.get<{ message: string; vehicles: Vehiculo[] }>(
        `${API_BASE}/vehiculos/obtener-vehiculos-incompletos`,
        { params: { id_usuario: idUsuario } }
      );
      const list = res.data.vehicles || [];
      setVehiculosPendientes(list.filter(v => v.estadoIntegra === "registro_incompleto"));
      setVehiculosRevision(list.filter(v => v.estadoIntegra === "completado_revision" || v.estadoIntegra === "en_revision"));
      setVehiculosInactivos(list.filter(v => v.estadoIntegra === "inactivo"));
    } catch (error) {
      console.error("Error al cargar bandejas:", error);
    }
  };

  const fetchAprobados = async (query: string) => {
    try {
      const res = await axios.get<{ vehiculos: Vehiculo[] }>(
        `${API_BASE}/vehiculos/obtener-aprobados-paginados`,
        { params: { search: query, limit: 10 } }
      );
      setVehiculosAprobados(res.data.vehiculos || []);
    } catch (error) {
      console.error("Error buscando aprobados:", error);
    }
  };

  // Aprobados se consulta al backend (paginado + búsqueda) al entrar a la pestaña.
  useEffect(() => {
    if (pestanaActiva === "aprobados") fetchAprobados(busquedaAprobadosEnVuelo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaActiva, busquedaAprobadosEnVuelo]);

  /* ---------------------------------------------------------------- */
  /* BÚSQUEDA Y PAGINACIÓN                                            */
  /* ---------------------------------------------------------------- */

  const filtrarLocales = (lista: Vehiculo[]) => {
    if (!busqueda) return lista;
    const q = busqueda.toLowerCase();
    return lista.filter(veh =>
      veh.placa?.toLowerCase().includes(q) ||
      veh.condCedulaCiudadania?.toString().toLowerCase().includes(q)
    );
  };

  const listaActiva = useMemo(() => {
    if (pestanaActiva === "pendientes") return filtrarLocales(vehiculosPendientes);
    if (pestanaActiva === "inactivos") return filtrarLocales(vehiculosInactivos);
    if (pestanaActiva === "aprobados") return vehiculosAprobados;
    return filtrarLocales(vehiculosRevision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaActiva, busqueda, vehiculosPendientes, vehiculosRevision, vehiculosInactivos, vehiculosAprobados]);

  // Paginación solo para "En revisión" (la bandeja más larga).
  const totalPages = pestanaActiva === "revision" ? Math.ceil(listaActiva.length / vehiclesPerPage) : 1;
  const paginaActual = useMemo(() => {
    if (pestanaActiva !== "revision") return listaActiva;
    const inicio = (currentPage - 1) * vehiclesPerPage;
    return listaActiva.slice(inicio, inicio + vehiclesPerPage);
  }, [listaActiva, currentPage, pestanaActiva, vehiclesPerPage]);

  useEffect(() => { setCurrentPage(1); }, [pestanaActiva, busqueda, busquedaAprobadosEnVuelo]);

  /* ---------------------------------------------------------------- */
  /* ACCIONES                                                         */
  /* ---------------------------------------------------------------- */

  // Tras aprobar/devolver/inactivar/reactivar: recargar todo y re-seleccionar.
  const alCambiar = async (_mensaje: string) => {
    setSeleccionado(null);
    await cargarBandejas(Cookies.get("seguridadId") || "");
    if (pestanaActiva === "aprobados") await fetchAprobados(busquedaAprobadosEnVuelo);
  };

  const contadores: Record<PestanaBandeja, number> = {
    pendientes: vehiculosPendientes.length,
    revision: vehiculosRevision.length,
    aprobados: vehiculosAprobados.length,
    inactivos: vehiculosInactivos.length,
  };

  const ejecutarBusquedaAprobados = () => setBusquedaAprobadosEnVuelo(busqueda.trim());

  return (
    <div>
      <BarraSuperiorSeguridad />
      <div className="rev-layout">
        {/* BANDEJA */}
        <div className="rev-bandeja">
          <div className="rev-toolbar">
            <div className="rev-busqueda">
              <FaSearch className="rev-busqueda-icono" aria-hidden="true" />
              <input
                type="text"
                className="rev-input-busqueda"
                placeholder={pestanaActiva === "aprobados" ? "Buscar en la base por placa o cédula…" : "Filtrar por placa o cédula…"}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && pestanaActiva === 'aprobados') ejecutarBusquedaAprobados(); }}
              />
              {busqueda && (
                <button
                  className="rev-btn-clear"
                  title="Limpiar"
                  onClick={() => { setBusqueda(""); if (pestanaActiva === 'aprobados') setBusquedaAprobadosEnVuelo(""); }}
                >
                  <FaTimes />
                </button>
              )}
              {pestanaActiva === "aprobados" && (
                <button className="rev-btn-buscar" onClick={ejecutarBusquedaAprobados}>
                  Buscar
                </button>
              )}
            </div>
          </div>

          <PestanasBandeja activa={pestanaActiva} contadores={contadores} onCambiar={p => { setPestanaActiva(p); setSeleccionado(null); }} />

          <ListaVehiculos
            vehiculos={paginaActual}
            seleccionadoId={seleccionado?._id}
            onSeleccionar={setSeleccionado}
            vacioTexto={pestanaActiva === 'aprobados' ? 'No se encontraron vehículos aprobados.' : 'No hay vehículos en esta bandeja.'}
          />

          {totalPages > 1 && (
            <div className="paginacion-contenedor">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Ant</button>
              <span>{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Sig</button>
            </div>
          )}
        </div>

        {/* PANEL DE DETALLE */}
        {seleccionado && (
          <PanelDetalle
            veh={seleccionado}
            onClose={() => setSeleccionado(null)}
            alCambiar={alCambiar}
          />
        )}
      </div>
    </div>
  );
};

export default RevisionVehiculos;
