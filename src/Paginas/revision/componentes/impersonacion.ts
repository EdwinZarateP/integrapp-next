/**
 * Impersonación de Seguridad (Modo Seguridad) — helper compartido.
 *
 * Lo usan el módulo de alta (/revision/alta) y el panel de detalle de las
 * bandejas (/revision): entra al panel DEL conductor vía login-como sin
 * conocer su clave. TODAS las mutaciones que haga Seguridad en esa sesión
 * viajan con editado_por = su nombre y quedan trazadas en la bitácora
 * auditoriaVehiculo del backend con via=impersonacion.
 */
import axios from "axios";
import Swal from "sweetalert2";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Router mínimo que necesitamos (el de next/navigation lo cumple). */
interface Navegador { push: (url: string) => void }

export const nombreSeguridad = () => Cookies.get("seguridadNombre") || "Seguridad";

/**
 * Monta la sesión del conductor impersonado (cookies conductor*) y navega a
 * su panel. El Swal de carga se cierra ANTES de navegar: la navegación de
 * Next es client-side (no desmonta el overlay, que vive fuera de React) y
 * quedaba pegado "Ingresando al panel…".
 */
export function montarSesionImpersonada(data: any, router: Navegador) {
  Swal.close();
  const u = data.usuario;
  Cookies.set('conductorCorreo', u.correo, { expires: 30 });
  Cookies.set('conductorId', u.id, { expires: 30 });
  Cookies.set('conductorPerfil', u.perfil, { expires: 30 });
  if (u.primerNombre) Cookies.set('conductorPrimerNombre', u.primerNombre, { expires: 30 });
  // Marca de impersonación: el panel la usa para el popup «Modo Seguridad»,
  // el perfil del header y para enviar editado_por en TODAS las mutaciones.
  Cookies.set('conductorImpersonadoPor', data.impersonado_por || nombreSeguridad(), { expires: 30 });
  if (data.politicas_pendientes) {
    Cookies.set('conductorPoliticasPendientes', '1', { expires: 30 });
  } else {
    Cookies.remove('conductorPoliticasPendientes');
  }
  router.push('/PanelConductores');
}

/**
 * Entra al panel del conductor con cuenta {idCuenta} (dueño de la ficha:
 * idUsuario del vehículo, o la cuenta creada/buscarda en el alta).
 * Muestra el error del backend (p. ej. 403 en stubs pendientes de invitación).
 */
export async function abrirPanelComoConductor(idCuenta: string, router: Navegador) {
  try {
    Swal.fire({ title: "Ingresando al panel...", didOpen: () => Swal.showLoading() });
    const res = await axios.post(`${API_BASE}/conductores/login-como/${idCuenta}`, {
      solicitante: nombreSeguridad(),
    });
    montarSesionImpersonada(res.data, router);
  } catch (err: any) {
    Swal.fire("No se pudo entrar", err?.response?.data?.detail || "Error de conexión.", "error");
  }
}
