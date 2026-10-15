/**
 * Dibujo de EJEMPLO de cada ángulo de foto del vehículo (2026-10-14, pedido
 * del usuario: «mostrar un dibujo de ejemplo para cada foto»). Son SVG inline
 * (sin assets) de un camión de caja en los 4 ángulos exigidos — frontal,
 * lateral izquierda, lateral derecha y posterior — con la vista esperada
 * resaltada y una flecha indicando desde dónde pararse.
 *
 * Uso: <EjemploFotoVehiculo tipo="frontal" /> (o lateral_izq | lateral_der |
 * posterior). El título lo pone quien lo incruste (el ítem del paso 3 ya
 * tiene su nombre).
 */
export type AnguloFotoVehiculo = 'frontal' | 'lateral_izq' | 'lateral_der' | 'posterior';

const ANGULOS: AnguloFotoVehiculo[] = ['frontal', 'lateral_izq', 'lateral_der', 'posterior'];

export const esAnguloFoto = (v: any): v is AnguloFotoVehiculo =>
  ANGULOS.includes(v as AnguloFotoVehiculo);

/** Etiqueta corta del ángulo (coincide con el backend). */
export const ETIQUETA_ANGULO: Record<AnguloFotoVehiculo, string> = {
  frontal: 'Frontal',
  lateral_izq: 'Lateral Izquierda',
  lateral_der: 'Lateral Derecha',
  posterior: 'Posterior',
};

const TRAZO = '#5d6d7e';
const RELLENO = '#f4f7f9';
const ACENTO = '#2c5f9e';

/* Lateral (base para izq/der): cabina + zona de carga, dos ejes. */
const Lateral = ({ espejo }: { espejo?: boolean }) => (
  <g transform={espejo ? 'translate(220,0) scale(-1,1)' : undefined}>
    {/* caja de carga */}
    <rect x="58" y="26" width="128" height="78" rx="4" fill={RELLENO} stroke={TRAZO} strokeWidth="3" />
    <line x1="58" y1="50" x2="186" y2="50" stroke={TRAZO} strokeWidth="1.4" opacity="0.5" />
    <line x1="58" y1="72" x2="186" y2="72" stroke={TRAZO} strokeWidth="1.4" opacity="0.5" />
    {/* cabina */}
    <path d="M20 104 V52 q0-8 8-10 l22-6 v68 z" fill={RELLENO} stroke={TRAZO} strokeWidth="3" />
    <path d="M26 50 l18-5 v14 h-18 z" fill="#dbe6f0" stroke={TRAZO} strokeWidth="2" />
    {/* chasis + defensas */}
    <rect x="14" y="104" width="184" height="8" rx="3" fill={RELLENO} stroke={TRAZO} strokeWidth="2.5" />
    {/* ejes */}
    <circle cx="52" cy="120" r="13" fill="#fff" stroke={TRAZO} strokeWidth="3" />
    <circle cx="52" cy="120" r="4" fill={TRAZO} />
    <circle cx="158" cy="120" r="13" fill="#fff" stroke={TRAZO} strokeWidth="3" />
    <circle cx="158" cy="120" r="4" fill={TRAZO} />
    {/* piso/estrella del piso */}
    <line x1="6" y1="134" x2="210" y2="134" stroke={TRAZO} strokeWidth="1.6" strokeDasharray="3 5" opacity="0.6" />
  </g>
);

/* Frontal: cabina con parabrisas grande de dos paños, parrilla, espejos
   laterales, faros y bumper — lo que hace reconocible la cara del camión. */
const Frontal = () => (
  <g>
    {/* luces marcadoras superiores */}
    <rect x="88" y="16" width="10" height="5" rx="1.5" fill="#fdf3d0" stroke={TRAZO} strokeWidth="1.5" />
    <rect x="105" y="16" width="10" height="5" rx="1.5" fill="#fdf3d0" stroke={TRAZO} strokeWidth="1.5" />
    <rect x="122" y="16" width="10" height="5" rx="1.5" fill="#fdf3d0" stroke={TRAZO} strokeWidth="1.5" />
    {/* cabina */}
    <rect x="56" y="22" width="108" height="66" rx="9" fill={RELLENO} stroke={TRAZO} strokeWidth="3" />
    {/* parabrisas de DOS paños con pilar central */}
    <rect x="66" y="29" width="40" height="26" rx="3" fill="#dbe6f0" stroke={TRAZO} strokeWidth="2" />
    <rect x="114" y="29" width="40" height="26" rx="3" fill="#dbe6f0" stroke={TRAZO} strokeWidth="2" />
    <line x1="110" y1="29" x2="110" y2="55" stroke={TRAZO} strokeWidth="2.5" />
    {/* espejos laterales (sobresalen de la cabina) */}
    <line x1="56" y1="34" x2="44" y2="34" stroke={TRAZO} strokeWidth="2.5" />
    <rect x="38" y="30" width="6" height="17" rx="2" fill="#dbe6f0" stroke={TRAZO} strokeWidth="2" />
    <line x1="164" y1="34" x2="176" y2="34" stroke={TRAZO} strokeWidth="2.5" />
    <rect x="176" y="30" width="6" height="17" rx="2" fill="#dbe6f0" stroke={TRAZO} strokeWidth="2" />
    {/* parrilla con rejilla */}
    <rect x="76" y="62" width="68" height="14" rx="3" fill="#eaf0f5" stroke={TRAZO} strokeWidth="2" />
    <line x1="80" y1="67" x2="140" y2="67" stroke={TRAZO} strokeWidth="1.4" opacity="0.6" />
    <line x1="80" y1="72" x2="140" y2="72" stroke={TRAZO} strokeWidth="1.4" opacity="0.6" />
    {/* faros a los costados de la parrilla */}
    <rect x="60" y="62" width="12" height="11" rx="3" fill="#fdf3d0" stroke={TRAZO} strokeWidth="2" />
    <rect x="148" y="62" width="12" height="11" rx="3" fill="#fdf3d0" stroke={TRAZO} strokeWidth="2" />
    {/* bumper */}
    <rect x="48" y="86" width="124" height="18" rx="5" fill="#e2e9ef" stroke={TRAZO} strokeWidth="2.5" />
    {/* llantas: medio ocultas tras el bumper — solo su parte baja asoma
       (círculos completos leían como vista lateral) */}
    <circle cx="78" cy="102" r="13" fill="#fff" stroke={TRAZO} strokeWidth="3" />
    <circle cx="78" cy="102" r="4" fill={TRAZO} />
    <circle cx="142" cy="102" r="13" fill="#fff" stroke={TRAZO} strokeWidth="3" />
    <circle cx="142" cy="102" r="4" fill={TRAZO} />
    <rect x="48" y="86" width="124" height="16" rx="5" fill="#e2e9ef" stroke="none" />
    <line x1="42" y1="122" x2="178" y2="122" stroke={TRAZO} strokeWidth="1.6" strokeDasharray="3 5" opacity="0.6" />
  </g>
);

/* Posterior: la CAJA de carga de puertas traseras con su sello central, las
   BARRAS DE SEGURO verticales, luces traseras rojas, patios (guardabarros)
   y placa — la firma visual de la parte de atrás de un camión de carga. */
const Posterior = () => (
  <g>
    {/* luces marcadoras superiores */}
    <rect x="82" y="12" width="9" height="5" rx="1.5" fill="#fdf3d0" stroke={TRAZO} strokeWidth="1.5" />
    <rect x="106" y="12" width="9" height="5" rx="1.5" fill="#fdf3d0" stroke={TRAZO} strokeWidth="1.5" />
    <rect x="130" y="12" width="9" height="5" rx="1.5" fill="#fdf3d0" stroke={TRAZO} strokeWidth="1.5" />
    {/* caja de carga (ocupa TODO el ancho: no hay cabina atrás) */}
    <rect x="48" y="18" width="124" height="88" rx="4" fill={RELLENO} stroke={TRAZO} strokeWidth="3" />
    {/* sello central de las DOS puertas */}
    <line x1="110" y1="20" x2="110" y2="104" stroke={TRAZO} strokeWidth="3" />
    {/* bisagras de los bordes */}
    <line x1="56" y1="26" x2="56" y2="98" stroke={TRAZO} strokeWidth="1.4" opacity="0.5" />
    <line x1="164" y1="26" x2="164" y2="98" stroke={TRAZO} strokeWidth="1.4" opacity="0.5" />
    {/* BARRAS DE SEGURO verticales con sus manijas (una por puerta) */}
    <line x1="74" y1="24" x2="74" y2="100" stroke={TRAZO} strokeWidth="2.5" />
    <line x1="146" y1="24" x2="146" y2="100" stroke={TRAZO} strokeWidth="2.5" />
    <line x1="74" y1="58" x2="64" y2="58" stroke={TRAZO} strokeWidth="3" />
    <line x1="146" y1="58" x2="156" y2="58" stroke={TRAZO} strokeWidth="3" />
    {/* luces traseras ROJAS verticales */}
    <rect x="52" y="94" width="12" height="16" rx="3" fill="#f5c1bd" stroke={TRAZO} strokeWidth="2" />
    <rect x="156" y="94" width="12" height="16" rx="3" fill="#f5c1bd" stroke={TRAZO} strokeWidth="2" />
    {/* bumper trasero */}
    <rect x="42" y="112" width="136" height="11" rx="4" fill="#e2e9ef" stroke={TRAZO} strokeWidth="2.5" />
    {/* placa */}
    <rect x="99" y="113" width="22" height="9" rx="1.5" fill="#fff" stroke={TRAZO} strokeWidth="1.6" />
    {/* patios (guardabarros) bajo el bumper, con las llantas asomando DENTRO */}
    <path d="M62 124 v8 a10 9 0 0 0 20 0 v-8" fill="#eaf0f5" stroke={TRAZO} strokeWidth="2" />
    <path d="M138 124 v8 a10 9 0 0 0 20 0 v-8" fill="#eaf0f5" stroke={TRAZO} strokeWidth="2" />
    <circle cx="72" cy="134" r="7" fill="#fff" stroke={TRAZO} strokeWidth="2.5" />
    <circle cx="72" cy="134" r="2.5" fill={TRAZO} />
    <circle cx="148" cy="134" r="7" fill="#fff" stroke={TRAZO} strokeWidth="2.5" />
    <circle cx="148" cy="134" r="2.5" fill={TRAZO} />
  </g>
);

/* Flecha que indica de dónde tomar la foto (apunta hacia el vehículo). */
const Flecha = ({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) => (
  <g stroke={ACENTO} strokeWidth="4" fill="none" strokeLinecap="round">
    <line x1={x} y1={y} x2={x + dx} y2={y + dy} />
    <polyline
      points={`${x + dx},${y + dy} ${x + dx + (dx > 0 ? -9 : dx < 0 ? 9 : 0) + (dy > 0 ? 0 : 0)},${y + dy + (dy > 0 ? -9 : dy < 0 ? 9 : 0)}`}
      strokeWidth="3"
    />
  </g>
);

const EjemploFotoVehiculo: React.FC<{ tipo: AnguloFotoVehiculo; ancho?: number }> = ({ tipo, ancho = 190 }) => (
  <svg
    viewBox="0 0 220 158"
    width={ancho}
    style={{ display: 'block', maxWidth: '100%' }}
    role="img"
    aria-label={`Ejemplo: foto ${ETIQUETA_ANGULO[tipo]} del vehículo`}
  >
    {tipo === 'frontal' && <><Frontal /><Flecha x={14} y={62} dx={26} dy={0} /></>}
    {tipo === 'lateral_izq' && <><Lateral espejo /><Flecha x={110} y={8} dx={0} dy={14} /></>}
    {tipo === 'lateral_der' && <><Lateral /><Flecha x={110} y={8} dx={0} dy={14} /></>}
    {tipo === 'posterior' && <><Posterior /><Flecha x={12} y={62} dx={22} dy={0} /></>}
  </svg>
);

export default EjemploFotoVehiculo;
