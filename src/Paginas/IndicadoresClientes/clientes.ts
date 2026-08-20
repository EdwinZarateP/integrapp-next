// archivo: Paginas/IndicadoresClientes/clientes.ts
// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE CLIENTES del módulo de indicadores /indicadores/clientes.
//
// Para AGREGAR un cliente nuevo:
//   1. Agregá un objeto a este array.
//   2. Creá su ruta en src/app/indicadores/clientes/<id>/page.tsx usando
//      <DashboardCliente clienteId="<id>" /> (ver los que ya existen).
//
// Campos:
//   id     → slug de la ruta: /indicadores/clientes/<id> (kebab-case, sin espacios)
//   nombre → nombre visible (tooltip del botón y título del dashboard del cliente)
//   logo   → URL pública del logo (PNG/SVG). Google Cloud Storage, CDN o import
//            local — mientras sea URL accesible desde el navegador.
//   fuente → SOLO documentación (el backend aún no la usa). De dónde saldrán los
//            datos de este cliente:
//              'postgres' = informe_guias_tms (como el viejo OT)
//              'mongo'    = las 3 colecciones de Costo de Operación
//                           (pedidos_completados / pedidos_medical_historico /
//                            historico_otros_costos)
// ─────────────────────────────────────────────────────────────────────────────

export type FuenteDatosCliente = 'postgres' | 'mongo';

export type ClienteIndicadores = {
  id: string;
  nombre: string;
  logo: string;
  fuente: FuenteDatosCliente;
};

export const CLIENTES: ClienteIndicadores[] = [
  {
    id: 'fresenius-kabi',
    nombre: 'Fresenius Kabi',
    logo: 'https://storage.googleapis.com/integrapp/Imagenes/logo%20kabi.png',
    fuente: 'postgres',
  },
  {
    id: 'fresenius-medical-care',
    nombre: 'Fresenius Medical Care',
    logo: 'https://storage.googleapis.com/integrapp/Imagenes/logo%20medical.svg',
    fuente: 'mongo',
  },
];

export const obtenerCliente = (id: string): ClienteIndicadores | undefined =>
  CLIENTES.find(c => c.id === id);
