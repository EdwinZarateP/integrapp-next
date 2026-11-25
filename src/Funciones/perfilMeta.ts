/**
 * Matriz de perfiles de la app (2026-11-25) — metadatos para que crear
 * usuarios sea entendible: cada perfil tiene grupo, etiqueta amable,
 * descripción de a qué da acceso y flag `sin_acceso` (no ingresa a la app).
 *
 * Espejo del `PERFILES_META` de `integrappi/rutas/baseusuarios.py`; el
 * formulario intenta `GET /baseusuarios/perfiles-meta` y si falla usa este
 * fallback local (mismo patrón best-effort de PERFILES_FALLBACK).
 */

export type PerfilMeta = {
  perfil: string;
  grupo: string;
  etiqueta: string;
  descripcion: string;
  /** Alcances cortos para chips del panel explicativo. */
  puede?: string[];
  /** El perfil NO ingresa a la aplicación (solo notificaciones). */
  sin_acceso?: boolean;
};

export const PERFIL_META: PerfilMeta[] = [
  // ── OPERACIÓN ──
  { perfil: 'OPERATIVO', grupo: 'OPERACIÓN', etiqueta: 'Operativo',
    descripcion: 'Operación multi-módulo: Solicitud de Vehículos, Otros Costos (crea), Cuentas por Placa, Citas y Novedades OT.',
    puede: ['Solicitud de Vehículos', 'Otros Costos (crea)', 'Cuentas por Placa', 'Portal Mis Indicadores'] },
  { perfil: 'COORDINADOR', grupo: 'OPERACIÓN', etiqueta: 'Coordinador',
    descripcion: 'Supervisa la operación: aprueba planillas ≤7% y Otros Costos ≤ $500.000 dentro de su alcance de clientes.',
    puede: ['Todo lo del Operativo', 'Aprobaciones (con alcance)'] },
  { perfil: 'CONTROL', grupo: 'OPERACIÓN', etiqueta: 'Control',
    descripcion: 'Control total de aprobaciones (planillas >7%, uso <50%, Otros Costos > $500.000) y edición de tarifarios.',
    puede: ['Todas las aprobaciones', 'Tarifarios (edita)'] },
  { perfil: 'DESPACHADOR', grupo: 'OPERACIÓN', etiqueta: 'Despachador',
    descripcion: 'Despacho en Pedidos Kabi: carga y edita pedidos; crea Otros Costos y Cuentas por Placa.',
    puede: ['Pedidos Kabi', 'Otros Costos (crea)', 'Cuentas por Placa'] },
  { perfil: 'OPERADOR', grupo: 'OPERACIÓN', etiqueta: 'Operador (Pedidos)',
    descripcion: 'Operación del portal Kabi — gestión de pedidos por regional (carga, edición, autorización). No confundir con Operativo.',
    puede: ['Pedidos Kabi (su regional)'] },
  // ── ANÁLISIS ──
  { perfil: 'ANALISTA', grupo: 'ANÁLISIS', etiqueta: 'Analista',
    descripcion: 'Trámite Vulcano de Otros Costos, aprueba planillas PREAPROBADAS, ve todos los históricos e indicadores.',
    puede: ['Otros Costos (trámite)', 'Históricos', 'Portal Mis Indicadores'] },
  { perfil: 'VISUALIZADOR', grupo: 'ANÁLISIS', etiqueta: 'Visualizador',
    descripcion: 'Solo lectura: dashboards de indicadores, portal de clientes e históricos.',
    puede: ['Indicadores (lectura)', 'Históricos (lectura)'] },
  // ── FINANZAS ──
  { perfil: 'FINANCIERO', grupo: 'FINANZAS', etiqueta: 'Financiero',
    descripcion: 'Paga Otros Costos (con trámite OK), carga archivo bancario, Módulo Financiero e informe de Estado de Vehículos.',
    puede: ['Otros Costos (paga)', 'Módulo Financiero'] },
  // ── CLIENTES ──
  { perfil: 'CLIENTE', grupo: 'CLIENTES', etiqueta: 'Cliente externo',
    descripcion: 'Portal «Mis Indicadores»: ve SOLO los dashboards de los clientes que se le asignen.',
    puede: ['Portal Mis Indicadores (asignado)'] },
  // ── SEGURIDAD ──
  { perfil: 'SEGURIDAD', grupo: 'SEGURIDAD', etiqueta: 'Seguridad',
    descripcion: 'Portal de revisión En Ruta: aprueba vehículos, gestiona estudios y cuentas de conductores.',
    puede: ['Portal Seguridad (/revision)'] },
  { perfil: 'PADRINO', grupo: 'SEGURIDAD', etiqueta: 'Padrino',
    descripcion: 'Vista simplificada de Seguridad: SOLO impersonar placas para cargar documentos. Se asigna normalmente como ADICIONAL a otro perfil.',
    puede: ['Seguridad (solo carga de docs)'] },
  { perfil: 'CLIENTE_ESTUDIOS', grupo: 'SEGURIDAD', etiqueta: 'Empresa de estudios',
    descripcion: 'Empresa externa de estudios de seguridad: consulta los estudios publicados de su empresa.',
    puede: ['Portal de estudios'] },
  // ── SOLO NOTIFICACIONES ──
  { perfil: 'CLIENTE_FMC', grupo: 'SOLO NOTIFICACIONES', etiqueta: 'Solo notificaciones',
    descripcion: 'NO ingresa a la aplicación: solo recibe notificaciones WhatsApp de Medical Care. Se crea sin clave.',
    puede: ['Notificaciones WhatsApp'], sin_acceso: true },
  // ── ADMINISTRACIÓN ──
  { perfil: 'ADMIN', grupo: 'ADMINISTRACIÓN', etiqueta: 'Administrador',
    descripcion: 'Acceso total: gestión de usuarios, todos los módulos, aprobaciones y configuración.',
    puede: ['Todo'] },
  // ── LEGADO ──
  { perfil: 'CONDUCTOR', grupo: 'LEGADO', etiqueta: 'Conductor (legado)',
    descripcion: 'PERFIL LEGADO — no crear cuentas nuevas: los conductores se registran solos en el portal En Ruta.',
    puede: [], sin_acceso: true },
];

export const metaDe = (perfil: string, meta: PerfilMeta[] = PERFIL_META): PerfilMeta | undefined =>
  meta.find(m => m.perfil === perfil.toUpperCase());

/** Orden de los grupos en los selects (LEGADO siempre al final). */
export const ORDEN_GRUPOS = [
  'OPERACIÓN', 'ANÁLISIS', 'FINANZAS', 'CLIENTES', 'SEGURIDAD',
  'SOLO NOTIFICACIONES', 'ADMINISTRACIÓN', 'LEGADO',
];

/**
 * Agrupa una lista de perfiles (p. ej. la de /perfiles-disponibles) según la
 * meta, en el orden de ORDEN_GRUPOS. Los perfiles sin meta van al grupo
 * «SIN CLASIFICAR» (al final). `excluirLegado` quita el grupo LEGADO — para
 * el formulario de NUEVO usuario (no se crean cuentas nuevas de legado).
 */
export const agruparPerfiles = (
  perfiles: string[],
  meta: PerfilMeta[] = PERFIL_META,
  opts?: { excluirLegado?: boolean },
): { grupo: string; perfiles: { perfil: string; etiqueta: string; sin_acceso?: boolean }[] }[] => {
  const porGrupo = new Map<string, { perfil: string; etiqueta: string; sin_acceso?: boolean }[]>();
  for (const p of perfiles) {
    const m = metaDe(p, meta);
    const grupo = m?.grupo ?? 'SIN CLASIFICAR';
    if (opts?.excluirLegado && grupo === 'LEGADO') continue;
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, []);
    porGrupo.get(grupo)!.push({ perfil: p, etiqueta: m ? `${m.etiqueta} (${p})` : p, sin_acceso: m?.sin_acceso });
  }
  const grupos = [...porGrupo.entries()].map(([grupo, perfilesGrupo]) => ({ grupo, perfiles: perfilesGrupo }));
  grupos.sort((a, b) => {
    const ia = ORDEN_GRUPOS.indexOf(a.grupo);
    const ib = ORDEN_GRUPOS.indexOf(b.grupo);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return grupos;
};
