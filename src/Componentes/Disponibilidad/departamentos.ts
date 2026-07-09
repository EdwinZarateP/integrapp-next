// Catálogo de departamentos de Colombia para el módulo "En Ruta" (Disponibilidad).
// Los 32 departamentos están agrupados por macroregión para que el selector del
// conductor sea rápido (atajo "Toda la zona"), pero el dato que se guarda y filtra
// es el departamento exacto.
//
// ⚠️ Los nombres DEBEN coincidir exactamente con DEPARTAMENTOS_COLOMBIA del backend
// (integrappi/rutas/disponibilidad.py) para que la validación del check-in pase.

export interface GrupoRegion {
  nombre: string;
  departamentos: string[];
}

export const REGIONES_COLOMBIA: GrupoRegion[] = [
  { nombre: "Antioquia / Eje Cafetero", departamentos: ["ANTIOQUIA", "CALDAS", "RISARALDA", "QUINDÍO"] },
  { nombre: "Centro / Bogotá", departamentos: ["BOGOTÁ D.C.", "CUNDINAMARCA", "BOYACÁ"] },
  { nombre: "Valle / Pacífico", departamentos: ["VALLE DEL CAUCA", "CAUCA", "NARIÑO", "CHOCÓ"] },
  { nombre: "Caribe", departamentos: ["ATLÁNTICO", "BOLÍVAR", "MAGDALENA", "CESAR", "CÓRDOBA", "SUCRE", "LA GUAJIRA"] },
  { nombre: "Santanderes", departamentos: ["SANTANDER", "NORTE DE SANTANDER"] },
  { nombre: "Centro - Sur", departamentos: ["TOLIMA", "HUILA", "META", "CAQUETÁ"] },
  { nombre: "Oriente / Frontera", departamentos: ["ARAUCA", "CASANARE", "PUTUMAYO", "AMAZONAS", "GUAINÍA", "GUAVIARE", "VAUPÉS", "VICHADA"] },
];

// Lista plana de los 32 departamentos (para filtros de la operación).
export const DEPARTAMENTOS_TODOS: string[] = REGIONES_COLOMBIA.flatMap((g) => g.departamentos);

// Bodegas operativas (origen del vehículo). Coincide con BODEGAS_VALIDAS del backend.
export const BODEGAS = ["JUAN MINA", "YUMBO", "GIRARDOTA", "BUCARAMANGA", "FUNZA"];
