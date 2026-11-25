/**
 * Hogar de cada perfil (2026-11-25).
 *
 * El mapa de "a dónde vuelve cada perfil" vivía inline en ModulosP y se
 * necesitaba en más sitios (guards de los módulos que salieron del portal
 * Medical Care, LoginUsuarios). Única fuente a partir de acá.
 *
 * Los perfiles MULTI-MÓDULO (ADMIN, ANALISTA, COORDINADOR, CONTROL,
 * OPERATIVO, DESPACHADOR, SEGURIDAD…) tienen por hogar el hub /Modulos.
 */
import Cookies from "js-cookie";

const HOGAR_POR_PERFIL: Record<string, string> = {
  FINANCIERO: "/EleccionFinanciero",
  VISUALIZADOR: "/indicadores",
  CLIENTE_ESTUDIOS: "/PortalSeguridad",
  CLIENTE: "/indicadores/mis-clientes",
  PADRINO: "/revision",
};

export function hogarPorPerfil(): string {
  const perfil = (Cookies.get("perfilPedidosCookie") || "").toUpperCase();
  if (HOGAR_POR_PERFIL[perfil]) return HOGAR_POR_PERFIL[perfil];
  const cliente = Cookies.get("clientePedidosCookie") || "";
  if (cliente === "SEGURIDAD") return "/revision";
  if (cliente === "ADMIN_SEGURIDAD") return "/AdminSeguridad";
  return "/Modulos";
}

/**
 * ¿El PERFIL (sin importar la cookie de portal activa) es micro-portal?
 * Úsalo para deciding si alguien ve la Torre de Control: un ADMIN dentro de
 * /revision (cookie SEGURIDAD) NO es micro-portal — su hogar es el hub.
 */
export function esPerfilMicroPortal(): boolean {
  const perfil = (Cookies.get("perfilPedidosCookie") || "").toUpperCase();
  return Boolean(HOGAR_POR_PERFIL[perfil]);
}
