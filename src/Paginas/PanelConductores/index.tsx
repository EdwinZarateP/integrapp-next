'use client';
import React, { useState, useEffect, useContext } from 'react';
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  FaCar, FaClipboardList, FaFileUpload, FaCheckCircle,
  FaUserCircle, FaBars, FaEdit, FaTrashAlt, FaEye, FaExclamationTriangle, FaClock, FaTimesCircle, FaTruck
} from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import Datos from '@/Componentes/Datos';
import CargaDocumento from '@/Componentes/CargaDocumento';
import VerDocumento from '@/Componentes/VerDocumento';
import { ContextoApp } from "@/Contexto/index";
import { obtenerVehiculoPorPlaca } from '@/Funciones/ObtenerInfoPlaca';
import { endpoints, tiposMapping } from '@/Funciones/documentConstants';
import "./estilos.css";

/* --- CONFIGURACIÓN --- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const normalizeKey = (key: string) => key.trim().toLowerCase();

interface DocumentoItem {
  nombre: string;
  progreso: number;
  url?: string | string[];
}
interface SeccionDocumentos {
  subtitulo: string;
  items: DocumentoItem[];
}

const initialSecciones: SeccionDocumentos[] = [
    {
      subtitulo: "1. Documentos del Vehículo",
      items: [
        { nombre: "Tarjeta de Propiedad", progreso: 0 },
        { nombre: "soat", progreso: 0 },
        { nombre: "Fotos", progreso: 0 },
        { nombre: "Revisión Tecnomecánica", progreso: 0 },
        { nombre: "Tarjeta de Remolque", progreso: 0 },
        { nombre: "Póliza de Responsabilidad Civil", progreso: 0 },
      ]
    },
    {
        subtitulo: "2. Documentos del Conductor",
        items: [
          { nombre: "Documento de Identidad del Conductor", progreso: 0 },
          { nombre: "Licencia de Conducción Vigente", progreso: 0 },
          { nombre: "Planilla de EPS y ARL", progreso: 0 },
          { nombre: "Foto Conductor", progreso: 0 },
          { nombre: "Certificación Bancaria Conductor", progreso: 0 },
        ]
    },
    {
        subtitulo: "3. Documentos del Tenedor",
        items: [
          { nombre: "Documento de Identidad del Tenedor", progreso: 0 },
          { nombre: "Certificación Bancaria Tenedor", progreso: 0 },
          { nombre: "Documento que lo acredite como Tenedor", progreso: 0 },
          { nombre: "RUT Tenedor", progreso: 0 }
        ]
    },
    {
        subtitulo: "4. Documentos del Propietario",
        items: [
          { nombre: "Documento de Identidad del Propietario", progreso: 0 },
          { nombre: "Certificación Bancaria Propietario", progreso: 0 },
          { nombre: "RUT Propietario", progreso: 0 }
        ]
    }
];

const calculateSectionProgress = (items: DocumentoItem[]) => {
    if (items.length === 0) return 0;
    const completed = items.filter(i => i.progreso === 100).length;
    return Math.round((completed / items.length) * 100);
};

const getOverallDocumentProgress = (secciones: SeccionDocumentos[]) => {
  let totalItems = 0;
  let completed = 0;
  secciones.forEach(section => {
    totalItems += section.items.length;
    section.items.forEach((item) => {
      if (item.progreso === 100) completed++;
    });
  });
  return totalItems === 0 ? 0 : Math.round((completed / totalItems) * 100);
};

/* Construye las secciones de documentos (con progreso/url) a partir de un vehículo.
   Reutilizada por el flujo de edición (selectedPlate) y por el modal "Ver mis datos". */
const construirSeccionesDesdeVehiculo = (vehiculo: any): SeccionDocumentos[] => {
  const limpias: SeccionDocumentos[] = JSON.parse(JSON.stringify(initialSecciones));
  return limpias.map((sec: SeccionDocumentos) => ({
    ...sec,
    items: sec.items.map((item: DocumentoItem) => {
      const field = tiposMapping[normalizeKey(item.nombre)] || "";
      if (field && vehiculo[field]) {
        let valor = vehiculo[field];
        if (Array.isArray(valor)) {
          valor = valor.filter((url: any) =>
            url && url !== "null" && url !== "undefined" &&
            typeof url === 'string' && url.trim() !== ""
          );
          if (valor.length === 0) return { ...item, progreso: 0, url: undefined };
        }
        return { ...item, progreso: 100, url: valor };
      }
      return { ...item, progreso: 0, url: undefined };
    })
  }));
};

/* Secciones de datos básicos (label + key del documento en BD) que se muestran
   en el modal "Ver mis datos" de un vehículo aprobado. */
const SECCIONES_DATOS: { titulo: string; campos: { label: string; key: string }[] }[] = [
  {
    titulo: "Vehículo",
    campos: [
      { label: "Placa", key: "placa" },
      { label: "Modelo", key: "vehModelo" },
      { label: "Marca", key: "vehMarca" },
      { label: "Línea", key: "vehLinea" },
      { label: "Color", key: "vehColor" },
      { label: "Tipo Carrocería", key: "vehTipoCarroceria" },
      { label: "Repotenciado", key: "vehRepotenciado" },
      { label: "Año Repotenciación", key: "vehAno" },
      { label: "Empresa Satelital", key: "vehEmpresaSat" },
    ],
  },
  {
    titulo: "Conductor",
    campos: [
      { label: "Nombres", key: "condNombres" },
      { label: "Cédula", key: "condCedulaCiudadania" },
      { label: "Celular", key: "condCelular" },
      { label: "Correo", key: "condCorreo" },
      { label: "Dirección", key: "condDireccion" },
      { label: "Ciudad", key: "condCiudad" },
      { label: "EPS", key: "condEps" },
      { label: "ARL", key: "condArl" },
      { label: "No. Licencia", key: "condNoLicencia" },
      { label: "Vence Licencia", key: "condFechaVencimientoLic" },
      { label: "Categoría", key: "condCategoriaLic" },
      { label: "Grupo Sanguíneo", key: "condGrupoSanguineo" },
    ],
  },
  {
    titulo: "Propietario",
    campos: [
      { label: "Nombre/Razón", key: "propNombre" },
      { label: "Documento", key: "propDocumento" },
      { label: "Correo", key: "propCorreo" },
      { label: "Celular", key: "propCelular" },
      { label: "Dirección", key: "propDireccion" },
      { label: "Ciudad", key: "propCiudad" },
    ],
  },
  {
    titulo: "Tenedor",
    campos: [
      { label: "Nombre/Razón", key: "tenedNombre" },
      { label: "Documento", key: "tenedDocumento" },
      { label: "Correo", key: "tenedCorreo" },
      { label: "Celular", key: "tenedCelular" },
      { label: "Ciudad", key: "tenedCiudad" },
    ],
  },
  {
    titulo: "Remolque",
    campos: [
      { label: "Placa Remolque", key: "RemolPlaca" },
      { label: "Modelo", key: "RemolModelo" },
      { label: "Clase/config", key: "RemolClase" },
      { label: "Tipo Carrocería", key: "RemolTipoCarroceria" },
      { label: "Alto (m)", key: "RemolAlto" },
      { label: "Largo (m)", key: "RemolLargo" },
      { label: "Ancho (m)", key: "RemolAncho" },
    ],
  },
];

const formatoValorDato = (v: any): string => {
  if (v == null || v === "") return "-";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};

/* --- BARRA SUPERIOR --- */
const BarraConductor: React.FC = () => {
  const router = useRouter();
  const primerNombreCookie = Cookies.get("conductorPrimerNombre");
  const [menuAbierto, setMenuAbierto] = useState(false);

  const obtenerNombreMostrar = () => {
    if (primerNombreCookie) {
      return primerNombreCookie.toUpperCase();
    }
    return "CONDUCTOR";
  };

  const irInicio = () => { router.push("/"); };

  const cerrarSesion = () => {
    Cookies.remove("conductorCorreo");
    Cookies.remove("conductorClave");
    Cookies.remove("conductorId");
    Cookies.remove("conductorPerfil");
    Cookies.remove("conductorPrimerNombre");

    router.replace("/LoginConductores");
  };

  return (
    <div className="barra-superior" onClick={() => menuAbierto && setMenuAbierto(false)}>
      <div className="barra-izquierda" onClick={irInicio} title="Volver al inicio">
        <img src={logo.src} alt="Logo" className="barra-logo" />
        <span className="barra-marca">
          Integr<span className="barra-marca-acento">App</span>
        </span>
      </div>
      <div className="barra-derecha">
        <div className="barra-usuario">
            <FaUserCircle size={20} />
            {obtenerNombreMostrar()}
        </div>
        <div className="hamburguesa-container">
          <FaBars size={24} onClick={(e) => { e.stopPropagation(); setMenuAbierto(!menuAbierto); }} />
          {menuAbierto && (
            <div className="menu-desplegable" onClick={(e) => e.stopPropagation()}>
              <button onClick={cerrarSesion} className="btn-cerrar-sesion">Cerrar Sesión</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* --- COMPONENTE PRINCIPAL --- */
const PanelConductoresVista: React.FC = () => {
  const router = useRouter();

  const idUsuario = Cookies.get('conductorId') || Cookies.get('tenedorIntegrapp') || '';
  useEffect(() => {
    if (!idUsuario) {
        Swal.fire({
            icon: 'warning', title: 'Acceso Denegado', text: 'Debes iniciar sesión.',
            timer: 2000, showConfirmButton: false
        }).then(() => { router.replace("/LoginConductores"); });
    }
  }, [idUsuario, router]);

  if (!idUsuario) return null;

  const almacenVariables = useContext(ContextoApp);
  if (!almacenVariables) throw new Error("Contexto no disponible");
  const { verDocumento, setVerDocumento } = almacenVariables;

  const [currentStep, setCurrentStep] = useState<number>(1);

  const [vehicles, setVehicles] = useState<string[]>([]);
  const [vehiculosRechazados, setVehiculosRechazados] = useState<any[]>([]);
  const [vehiculosEnRevision, setVehiculosEnRevision] = useState<any[]>([]);
  const [vehiculosAprobados, setVehiculosAprobados] = useState<any[]>([]);

  const [secciones, setSecciones] = useState<SeccionDocumentos[]>(() => JSON.parse(JSON.stringify(initialSecciones)));

  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [newPlate, setNewPlate] = useState<string>("");
  const [datosValidos, setDatosValidos] = useState<boolean>(false);
  const [cedulaConductor, setCedulaConductor] = useState<string>("");
  const [visibleSeccion, setVisibleSeccion] = useState<number | null>(null);
  const [selectedDocumento, setSelectedDocumento] = useState<any>(null);
  const [verDocumentoInfo, setVerDocumentoInfo] = useState<any>(null);

  // Modal "Ver mis datos" (vehículo aprobado, solo lectura)
  const [verPlaca, setVerPlaca] = useState<string | null>(null);
  const [verDatos, setVerDatos] = useState<any>(null);
  const [verSecciones, setVerSecciones] = useState<SeccionDocumentos[]>([]);
  const [verCargando, setVerCargando] = useState(false);

  useEffect(() => { if (idUsuario) cargarDatosIniciales(); }, [idUsuario]);

  const cargarDatosIniciales = async () => {
      await fetchVehiculosUsuario();
  };

  const fetchVehiculosUsuario = async () => {
    try {
      const response = await fetch(`${API_BASE}/vehiculos/obtener-vehiculos?id_usuario=${idUsuario}`);

      if (response.status === 404) {
          setVehicles([]);
          setVehiculosRechazados([]);
          setVehiculosEnRevision([]);
          setVehiculosAprobados([]);
          return;
      }

      const data = await response.json();

      if (data.vehiculos && Array.isArray(data.vehiculos)) {

        const pendientes = data.vehiculos
            .filter((v: any) => v.estadoIntegra === 'registro_incompleto' && (!v.observaciones || v.observaciones.trim() === ""))
            .map((v: any) => v.placa);

        const rechazados = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'devuelto' ||
            (v.estadoIntegra === 'registro_incompleto' && v.observaciones && v.observaciones.trim() !== "")
        );

        const revision = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'completado_revision' || v.estadoIntegra === 'en_revision'
        );

        const aprobados = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'aprobado'
        );

        setVehicles(pendientes);
        setVehiculosRechazados(rechazados);
        setVehiculosEnRevision(revision);
        setVehiculosAprobados(aprobados);

      } else {
          setVehicles([]);
          setVehiculosRechazados([]);
          setVehiculosEnRevision([]);
          setVehiculosAprobados([]);
      }
    } catch (error) { console.error("Error fetching vehiculos", error); }
  };

  const handleCreateVehicle = async () => {
    const placaCreada = newPlate.trim().toUpperCase();
    if (!placaCreada) return Swal.fire("Error", "Ingrese una placa válida", "error");
    if (!/^[A-Z0-9]{1,7}$/.test(placaCreada)) {
      return Swal.fire("Placa inválida", "La placa debe tener máximo 7 caracteres (solo letras y números, en cualquier orden).", "warning");
    }

    try {
      const formData = new FormData();
      formData.append("id_usuario", idUsuario);
      formData.append("placa", placaCreada);

      const response = await fetch(`${API_BASE}/vehiculos/crear`, { method: "POST", body: formData });
      const data = await response.json();

      if (response.ok) {
        Swal.fire({
            icon: 'success',
            title: "Éxito",
            text: "Vehículo creado correctamente",
            timer: 1500,
            showConfirmButton: false
        });
        await fetchVehiculosUsuario();
        setSelectedPlate(placaCreada);
        setNewPlate("");
        setCurrentStep(2);
      } else {
          Swal.fire("Error", data.detail || "Error al crear", "error");
      }
    } catch (error) { Swal.fire("Error", "Error de conexión", "error"); }
  };

  useEffect(() => {
    const cargarInfo = async () => {
      if (!selectedPlate) {
          setSecciones(JSON.parse(JSON.stringify(initialSecciones)));
          return;
      }

      const seccionesLimpias = JSON.parse(JSON.stringify(initialSecciones));

      try {
        const data = await obtenerVehiculoPorPlaca(selectedPlate);
        if (data && data.data) {
          setSecciones(construirSeccionesDesdeVehiculo(data.data));
        } else {
           setSecciones(seccionesLimpias);
        }
      } catch (error) {
          console.error(error);
          setSecciones(seccionesLimpias);
      }
    };
    cargarInfo();
  }, [selectedPlate]);

  /* --- Modal "Ver mis datos" (vehículo aprobado, solo lectura) --- */
  const abrirVer = async (placa: string) => {
    setVerPlaca(placa);
    setVerCargando(true);
    setVerDatos(null);
    setVerSecciones([]);
    try {
      const data = await obtenerVehiculoPorPlaca(placa);
      if (data && data.data) {
        setVerDatos(data.data);
        setVerSecciones(construirSeccionesDesdeVehiculo(data.data));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setVerCargando(false);
    }
  };

  const cerrarVer = () => {
    setVerPlaca(null);
    setVerDatos(null);
    setVerSecciones([]);
  };

  // Abre el/los documento(s) en pestaña nueva (solo lectura: sin opción de eliminar).
  const verDocUrl = (url: any) => {
    const urls = Array.isArray(url) ? url.filter(Boolean) : (url ? [url] : []);
    urls.forEach((u: string) => window.open(u, "_blank", "noopener"));
  };

  const changeStep = (step: number) => {
    if (step === 4 && vehiculosRechazados.length === 0) return;
    if ((step === 2 || step === 3) && !selectedPlate && currentStep !== 4) {
        Swal.fire("Atención", "Debe seleccionar o crear una placa primero en el paso 1.", "warning");
        return;
    }
    if (step === 3 && currentStep === 2 && !datosValidos) {
       Swal.fire("Formulario Incompleto", "Por favor diligencie todos los campos obligatorios.", "warning");
       return;
    }
    setCurrentStep(step);
  };

  const toggleSeccion = (idx: number) => setVisibleSeccion(visibleSeccion === idx ? null : idx);

  const handleOpenDoc = (sIdx: number, iIdx: number, name: string) => {
    const endpoint = endpoints[normalizeKey(name)];
    if(endpoint) setSelectedDocumento({ sectionIndex: sIdx, itemIndex: iIdx, documentName: name, endpoint });
    else Swal.fire("Error", "Configuración de documento no encontrada", "error");
  };

  const eliminarDocumento = async (sectionIdx: number, itemIdx: number) => {
      const item = secciones[sectionIdx]?.items[itemIdx];
      const tipo = tiposMapping[normalizeKey(item?.nombre)] || "";
      if (!item || !tipo || !selectedPlate) return;

      const confirmacion = await Swal.fire({
        title: '¿Eliminar documento?',
        text: "Tendrás que cargarlo de nuevo. Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar'
      });
      if (!confirmacion.isConfirmed) return;

      try {
        if (tipo === "fotos") {
          const urls = Array.isArray(item.url) ? item.url : (item.url ? [item.url] : []);
          for (const rawUrl of urls) {
            const urlLimpia = String(rawUrl).split("?")[0];
            await fetch(`${API_BASE}/vehiculos/eliminar-foto?placa=${selectedPlate}&url=${encodeURIComponent(urlLimpia)}`, { method: "DELETE" });
          }
        } else {
          const res = await fetch(`${API_BASE}/vehiculos/eliminar-documento?placa=${selectedPlate}&tipo=${tipo}`, { method: "DELETE" });
          if (!res.ok) throw new Error("El servidor no pudo eliminar el documento.");
        }
        const newSec = JSON.parse(JSON.stringify(secciones));
        newSec[sectionIdx].items[itemIdx].progreso = 0;
        newSec[sectionIdx].items[itemIdx].url = undefined;
        setSecciones(newSec);
        Swal.fire('Borrado', 'El documento ha sido eliminado.', 'success');
      } catch (error: any) {
        Swal.fire('Error', error?.message || 'No se pudo eliminar el documento.', 'error');
      }
  };

  const handleFinalizar = async () => {
      if (!cedulaConductor) return Swal.fire("Error", "No se ha capturado la cédula del conductor.", "error");
      const progreso = getOverallDocumentProgress(secciones);
      if (progreso < 100) return Swal.fire("Incompleto", "Faltan documentos por cargar.", "warning");

      try {
        Swal.fire({
            title: 'Finalizando...',
            text: 'Enviando a revisión y notificando al equipo de seguridad.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const nombreCookie = Cookies.get("conductorNombre");
        const rawUsuario = Cookies.get("conductorUsuario") || "";

        let nombreParaEnviar = "Conductor";

        if (nombreCookie && nombreCookie !== "undefined") {
            nombreParaEnviar = decodeURIComponent(nombreCookie);
        } else if (rawUsuario) {
            nombreParaEnviar = rawUsuario.split('@')[0];
        }

        nombreParaEnviar = nombreParaEnviar.toUpperCase().trim();

        const formData = new FormData();
        formData.append("placa", selectedPlate || "");
        formData.append("nuevo_estado", "completado_revision");
        formData.append("usuario_id", idUsuario);
        formData.append("nombre_conductor", nombreParaEnviar);

        const response = await fetch(`${API_BASE}/vehiculos/actualizar-estado`, { method: "PUT", body: formData });

        if (!response.ok) throw new Error("Error al actualizar estado");

        Swal.fire(
            "¡Enviado a Revisión!",
            "El equipo de Seguridad ha sido notificado y revisará tus documentos pronto.",
            "success"
        ).then(() => {
              setSelectedPlate(null);
              setCurrentStep(1);
              fetchVehiculosUsuario();
        });

      } catch (error) {
          console.error(error);
          Swal.fire("Error", "No se pudo finalizar el proceso. Intenta nuevamente.", "error");
      }
  };

  return (
    <div className="bg-conductor">
      <BarraConductor />
      <button
        className="banner-disponibilidad"
        onClick={() => router.push("/Disponibilidad")}
        title="Ofrecerme como disponible para hoy"
      >
        <span className="banner-disponibilidad-icono"><FaTruck /></span>
        <span className="banner-disponibilidad-texto">
          <strong>Ofrecer mi disponibilidad para hoy</strong>
          <small>Avísanos que estás listo para operar</small>
        </span>
        <span className="banner-disponibilidad-flecha">▸</span>
      </button>
      <div className="layout-conductor">
        <div className="sidebar-conductor">
          {[1, 2, 3].map(step => (
            <button key={step} className={`btn-sidebar-step ${currentStep === step ? "active" : ""}`} onClick={() => changeStep(step)}>
                <div className="step-indicator">{step}</div>
                <span>
                    {step === 1 && "Crear/Seleccionar"}
                    {step === 2 && "Datos Básicos"}
                    {step === 3 && "Documentación"}
                </span>
            </button>
          ))}

          <button
            className={`btn-sidebar-step btn-rechazados ${currentStep === 4 ? "active" : ""} ${vehiculosRechazados.length === 0 ? "disabled" : ""}`}
            onClick={() => changeStep(4)}
            disabled={vehiculosRechazados.length === 0}
            style={{ marginTop: '20px', border: '2px solid #e74c3c', color: vehiculosRechazados.length === 0 ? '#ccc' : '#c0392b' }}
          >
              <div className="step-indicator" style={{ backgroundColor: vehiculosRechazados.length === 0 ? '#eee' : '#e74c3c', color: 'white' }}><FaExclamationTriangle /></div>
              <span>Vehículos Rechazados ({vehiculosRechazados.length})</span>
          </button>
        </div>

        <div className="contenido-conductor-container">
          {/* PASO 1 */}
          {currentStep === 1 && (
            <div className="step-content fade-in">
              <div className="step-header">
                <h2><FaCar /> Gestión de Vehículo</h2>
                <p>Crea una nueva placa o continúa con una pendiente.</p>
              </div>
              <div className="panel-creacion">
                <div className="input-group-crear">
                    <input type="text" placeholder="Ej: ABC1234" value={newPlate} onChange={(e) => setNewPlate(e.target.value)} className="input-moderno"/>
                    <button className="btn-moderno-accion" onClick={handleCreateVehicle}>Crear Placa</button>
                </div>

                <div style={{marginTop: '30px', display:'flex', flexDirection:'column', gap:'20px'}}>

                    {/* SECCIÓN 1: PENDIENTES */}
                    <div className="seccion-lista-vehiculos">
                        <h4 style={{textAlign:'left', color:'#555', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>
                            <FaClipboardList /> Continuar Registro (Pendientes)
                        </h4>
                        {vehicles.length === 0 ? (
                            <p style={{color: '#999', fontStyle:'italic', padding:'10px'}}>No tienes vehículos pendientes.</p>
                        ) : (
                                <div className="lista-vehiculos-grid">
                                    {vehicles.map((placaItem, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setSelectedPlate(placaItem);
                                            setCurrentStep(2);
                                        }}
                                        className="btn-seleccion-vehiculo"
                                    >
                                        <FaCar /> {placaItem}
                                    </button>
                                    ))}
                                </div>
                        )}
                    </div>

                    {/* SECCIÓN 2: DEVUELTOS / RECHAZADOS */}
                    {vehiculosRechazados.length > 0 && (
                        <div className="seccion-lista-vehiculos" style={{backgroundColor: '#fff5f5', padding: '15px', borderRadius: '8px', border: '1px solid #ffcccc'}}>
                            <h4 style={{textAlign:'left', color:'#c0392b', borderBottom:'1px solid #ffcccc', paddingBottom:'5px'}}>
                                    <FaTimesCircle /> Vehículos Devueltos (Requieren Corrección)
                            </h4>
                            <div className="lista-vehiculos-grid">
                                {vehiculosRechazados.map((veh, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                            setSelectedPlate(veh.placa);
                                            changeStep(4);
                                    }}
                                    className="btn-seleccion-vehiculo btn-rechazado-item"
                                    style={{borderColor: '#e74c3c', color: '#c0392b', backgroundColor: '#fff'}}
                                >
                                    <FaExclamationTriangle /> {veh.placa}
                                </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECCIÓN 3: APROBADOS */}
                    {vehiculosAprobados.length > 0 && (
                        <div className="seccion-lista-vehiculos" style={{backgroundColor: '#d4edda', padding: '15px', borderRadius: '8px', border: '1px solid #c3e6cb'}}>
                            <h4 style={{textAlign:'left', color:'#155724', borderBottom:'1px solid #c3e6cb', paddingBottom:'5px'}}>
                                    <FaCheckCircle /> Vehículos Aprobados
                            </h4>
                            <div className="lista-vehiculos-grid">
                                {vehiculosAprobados.map((veh, idx) => (
                                <div
                                    key={idx}
                                    className="vehiculo-aprobado-card"
                                    style={{
                                        padding: '10px',
                                        borderRadius:'5px',
                                        backgroundColor: 'white',
                                        border: '1px solid #c3e6cb',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        color: '#155724', fontWeight: 'bold'
                                    }}
                                >
                                    <FaCheckCircle /> {veh.placa}
                                    <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: '#155724', marginLeft: 'auto'}}>Aprobado para operar</span>
                                    <button
                                        className="btn-ver-mis-datos"
                                        onClick={() => abrirVer(veh.placa)}
                                        title="Ver los datos que cargaste"
                                    >
                                        <FaEye /> Ver mis datos
                                    </button>
                                </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECCIÓN 4: EN REVISIÓN */}
                    {vehiculosEnRevision.length > 0 && (
                        <div className="seccion-lista-vehiculos" style={{backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '8px', border: '1px solid #bbdefb'}}>
                            <h4 style={{textAlign:'left', color:'#1976d2', borderBottom:'1px solid #bbdefb', paddingBottom:'5px'}}>
                                    <FaClock /> Vehículos en Revisión
                            </h4>
                            <div className="lista-vehiculos-grid">
                                {vehiculosEnRevision.map((veh, idx) => (
                                <div
                                    key={idx}
                                    className="vehiculo-revision-card"
                                    style={{
                                        padding: '10px',
                                        marginTop: "10px",
                                        borderRadius:'5px',
                                        backgroundColor: 'white',
                                        border: '1px solid #90caf9',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        color: '#1565c0', fontWeight: 'bold'
                                    }}
                                >
                                    <FaClock /> {veh.placa}
                                    <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: '#555', marginLeft: 'auto'}}>Esperando aprobación...</span>
                                </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
              </div>
            </div>
          )}

          {/* PASO 2 */}
          {currentStep === 2 && (
            <div className="step-content fade-in">
                <div className="step-header">
                <h2><FaClipboardList /> Información Detallada</h2>
                <p>Diligencia el formulario para la placa <strong>{selectedPlate}</strong>.</p>
              </div>
              {selectedPlate ? (
                <div className="contenedor-formulario-fijo">
                    <Datos
                        placa={selectedPlate}
                        onValidChange={setDatosValidos}
                        onCedulaConductorChange={setCedulaConductor}
                        onSavedSuccess={() => changeStep(3)}
                    />
                </div>
              ) : ( <div className="alert-box">Seleccione un vehículo en el Paso 1.</div> )}
            </div>
          )}

          {/* PASO 3 */}
          {currentStep === 3 && (
            <div className="step-content fade-in">
                <div className="step-header">
                <h2><FaFileUpload /> Carga de Documentos</h2>
                <div className="progreso-header">
                    <span>Avance Total: {getOverallDocumentProgress(secciones)}%</span>
                    <div className="barra-progreso-bg">
                        <div className="barra-progreso-fill" style={{width: `${getOverallDocumentProgress(secciones)}%`}}></div>
                    </div>
                </div>
              </div>
              {selectedPlate ? (
                <div className="lista-documentos-container">
                    {secciones.map((seccion, idx) => (
                        <div key={idx} className="seccion-doc-card">
                            <div className="seccion-header" onClick={() => toggleSeccion(idx)}>
                                <h4>{seccion.subtitulo} <span style={{fontSize:'0.8rem', color: '#666'}}>({calculateSectionProgress(seccion.items)}%)</span></h4>
                                <span>{visibleSeccion === idx ? "▼" : "▶"}</span>
                            </div>
                            {visibleSeccion === idx && (
                                <div className="seccion-body">
                                    {seccion.items.map((item, iIdx) => (
                                        <div key={iIdx} className="doc-item-row">
                                            <span className="doc-name">{item.progreso === 100 && <FaCheckCircle className="text-success"/>} {item.nombre}</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {item.progreso < 100 ? (
                                                    <button
                                                        className="btn-doc-action upload"
                                                        onClick={() => handleOpenDoc(idx, iIdx, item.nombre)}
                                                    >
                                                        Cargar
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            className="btn-doc-action view"
                                                            title="Ver documento"
                                                            onClick={() => {
                                                                const urlsParaVer = Array.isArray(item.url) ? item.url : [item.url as string];
                                                                setVerDocumentoInfo({ sectionIndex: idx, itemIndex: iIdx, urls: urlsParaVer });
                                                                setVerDocumento(true);
                                                            }}
                                                        >
                                                            <FaEye /> Ver
                                                        </button>
                                                        <button
                                                            className="btn-doc-action delete"
                                                            title="Eliminar documento"
                                                            onClick={() => eliminarDocumento(idx, iIdx)}
                                                        >
                                                            <FaTrashAlt />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <button className="btn-finalizar" onClick={handleFinalizar}>Finalizar Registro</button>
                </div>
              ) : ( <div className="alert-box">Seleccione un vehículo en el Paso 1.</div> )}
            </div>
          )}

          {/* PASO 4 (RECHAZADOS) */}
          {currentStep === 4 && (
             <div className="step-content fade-in">
                 <div className="step-header" style={{borderBottomColor: '#e74c3c'}}>
                    <h2 style={{color: '#c0392b'}}><FaExclamationTriangle /> Edición de Vehículos Rechazados</h2>
                    <p>Estos vehículos requieren correcciones según las observaciones.</p>
                  </div>
                 {vehiculosRechazados.length > 0 ? (
                    <div className="lista-rechazados" style={{marginTop:'20px'}}>
                        {vehiculosRechazados.map((veh, idx) => (
                            <div key={idx} className="card-rechazado">
                                <div className="info-rechazado">
                                    <div className="placa-rechazada-header">
                                        <strong>{veh.placa}</strong>
                                    </div>
                                    <p className="observacion-texto">"{veh.observaciones}"</p>
                                </div>
                                <button
                                    className="btn-corregir"
                                    onClick={() => {
                                        setSelectedPlate(veh.placa);
                                        changeStep(3);
                                    }}
                                >
                                    <FaEdit /> Corregir Documentos
                                </button>
                            </div>
                        ))}
                    </div>
                 ) : (
                     <div className="alert-box">No hay vehículos rechazados por el momento.</div>
                 )}
             </div>
          )}
        </div>
      </div>

      {/* MODALES */}
      {selectedDocumento && selectedPlate && (
        <CargaDocumento
          documentName={selectedDocumento.documentName}
          endpoint={selectedDocumento.endpoint}
          placa={selectedPlate}
          onClose={() => setSelectedDocumento(null)}
          onUploadSuccess={(result: string | string[]) => {
             const newSec = JSON.parse(JSON.stringify(secciones));
             const item = newSec[selectedDocumento.sectionIndex].items[selectedDocumento.itemIndex];

             item.progreso = 100;

             if (normalizeKey(item.nombre) === 'fotos') {
                if (Array.isArray(item.url)) {
                    if (typeof result === 'string') item.url.push(result);
                    else item.url = [...item.url, ...result];
                } else if (typeof item.url === 'string') {
                    if (typeof result === 'string') item.url = [item.url, result];
                    else item.url = [item.url, ...result];
                } else {
                    item.url = Array.isArray(result) ? result : [result];
                }
             } else {
                 item.url = result;
             }

             setSecciones(newSec);
             setSelectedDocumento(null);
          }}
        />
      )}

      {verDocumentoInfo && verDocumento && (
         <VerDocumento
            urls={verDocumentoInfo.urls}
            placa={selectedPlate || ""}
            onClose={() => { setVerDocumentoInfo(null); setVerDocumento(false); }}

onDeleteSuccess={(urlAEliminar: any) => {
    const newSec = JSON.parse(JSON.stringify(secciones));
    const item = newSec[verDocumentoInfo.sectionIndex].items[verDocumentoInfo.itemIndex];

    const normalize = (u: any) => {
        if (!u) return "";
        if (typeof u !== 'string') return String(u);
        try { return decodeURIComponent(u).trim(); } catch { return u.trim(); }
    };

    const targetUrl = normalize(urlAEliminar);

    if (Array.isArray(item.url)) {
        const nuevasUrls = item.url.filter((u: any) => {
            const valor = normalize(u);
            const esBasura = !u || valor === "" || valor === "null" || valor === "undefined";
            const esLaBorrada = valor === targetUrl;
            return !esBasura && !esLaBorrada;
        });
        item.url = nuevasUrls;
        if (nuevasUrls.length === 0) {
            item.progreso = 0;
            item.url = undefined;
            setVerDocumento(false);
            setVerDocumentoInfo(null);
        } else {
            setVerDocumentoInfo({ ...verDocumentoInfo, urls: nuevasUrls });
        }
    } else {
        item.progreso = 0;
        item.url = undefined;
        setVerDocumento(false);
        setVerDocumentoInfo(null);
    }
    setSecciones(newSec);
    Swal.fire('Listo', 'Documento eliminado y lista actualizada.', 'success');
}}
         />
      )}

      {/* MODAL "VER MIS DATOS" (vehículo aprobado, solo lectura) */}
      {verPlaca && (
        <div className="vermisdatos-overlay" onClick={cerrarVer}>
          <div className="vermisdatos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vermisdatos-header">
              <h3><FaCar /> Datos del vehículo <strong>{verPlaca}</strong></h3>
              <button className="vermisdatos-cerrar" onClick={cerrarVer} title="Cerrar">✕</button>
            </div>

            <div className="vermisdatos-body">
              {verCargando ? (
                <p className="vermisdatos-cargando">Cargando datos…</p>
              ) : verDatos ? (
                <>
                  {SECCIONES_DATOS.map((sec) => {
                    const conValor = sec.campos.filter(
                      (c) => verDatos[c.key] != null && verDatos[c.key] !== ""
                    );
                    if (conValor.length === 0) return null;
                    return (
                      <div key={sec.titulo} className="vermisdatos-seccion">
                        <h4>{sec.titulo}</h4>
                        <div className="vermisdatos-grid">
                          {conValor.map((c) => (
                            <div key={c.key} className="vermisdatos-campo">
                              <span className="vermisdatos-label">{c.label}</span>
                              <span className="vermisdatos-valor">{formatoValorDato(verDatos[c.key])}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="vermisdatos-seccion">
                    <h4>Documentos cargados</h4>
                    <div className="vermisdocs-lista">
                      {verSecciones.flatMap((sec, sIdx) =>
                        sec.items.map((item, iIdx) => (
                          <div key={`${sIdx}-${iIdx}`} className="vermisdocs-item">
                            <span className="vermisdocs-nombre">
                              {item.progreso === 100
                                ? <FaCheckCircle className="text-success" />
                                : <FaTimesCircle className="vermisdocs-falta-icon" />}
                              {" "}{item.nombre}
                            </span>
                            {item.progreso === 100 ? (
                              <button
                                className="btn-doc-action view"
                                onClick={() => verDocUrl(item.url)}
                                title="Ver documento en pestaña nueva"
                              >
                                <FaEye /> Ver
                              </button>
                            ) : (
                              <span className="vermisdocs-falta">No cargado</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="vermisdatos-cargando">No se pudieron cargar los datos del vehículo.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelConductoresVista;
