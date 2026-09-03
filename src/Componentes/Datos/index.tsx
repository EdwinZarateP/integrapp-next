'use client';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import municipios from "@/Componentes/Municipios/municipios.json";
import Swal from 'sweetalert2';
import Lottie from 'lottie-react';
import animationData from "@/Imagenes/AnimationPuntos.json";
import { calcularFigurasIguales, gemelosDocumento } from '@/Funciones/documentConstants';
import { comprimirImagen } from '@/Funciones/comprimirImagen';
import VerCaraDocumento from '@/Componentes/VerCaraDocumento';
import CamaraInterna from '@/Componentes/CamaraInterna';
import PhoneFieldCompartido from '@/Componentes/PhoneField';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// El canvas de firma (react-signature-canvas) solo se carga cuando se va a
// dibujar: baja el JS residente al entrar a la cámara en móviles con poca RAM.
const SignatureCanvas = lazy(() => import('react-signature-canvas'));

const departamentosUnicos = [...new Set(municipios.map((m: any) => m.DEPARTAMENTO))].sort() as string[];

const getCiudadesPorDepto = (depto: string) => {
  return municipios
    .filter((m: any) => m.DEPARTAMENTO === depto)
    .map((m: any) => m.CIUDAD)
    .sort() as string[];
};

// Normaliza para comparar: sin acentos, MAYÚSCULAS, sin puntuación ni espacios extra.
const normalizarNombre = (valor: string): string =>
  (valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// La cédula trae nombres que no coinciden literal con el catálogo (B/ = Barranquilla, etc.).
const ALIAS_CIUDADES: Record<string, string> = {
  "BOGOTA DC": "Bogota, D.C.",
  "BOGOTA": "Bogota, D.C.",
  "BARRANQUILLA": "Barranquilla",
  "B BAMANGA": "Barranquilla",
};

// Busca el municipio (nombre EXACTO del catálogo) a partir de un nombre leído por IA.
const buscarCiudadEnCatalogo = (ciudadLeida: string): string | null => {
  const objetivo = normalizarNombre(ciudadLeida);
  if (!objetivo) return null;
  if (ALIAS_CIUDADES[objetivo]) return ALIAS_CIUDADES[objetivo];
  const exacta = (municipios as any[]).find(m => normalizarNombre(m.CIUDAD) === objetivo);
  if (exacta) return exacta.CIUDAD;
  // Contenida: "BOGOTA D.C." o "SOACHA CUNDINAMARCA" → coincide con la del catálogo.
  const contenida = (municipios as any[]).find(
    m => objetivo.includes(normalizarNombre(m.CIUDAD)) || normalizarNombre(m.CIUDAD).includes(objetivo)
  );
  return contenida ? contenida.CIUDAD : null;
};

const buscarDepartamentoPorCiudad = (ciudad: string) => {
  if (!ciudad) return "";
  const normalizada = normalizarNombre(ciudad);
  const alias = ALIAS_CIUDADES[normalizada];
  const objetivo = normalizarNombre(alias || ciudad);
  const encontrado = (municipios as any[]).find(m => normalizarNombre(m.CIUDAD) === objetivo);
  return encontrado ? encontrado.DEPARTAMENTO : "";
};

// --- COMPONENTES UI ---
interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  options?: string[];
  disabled?: boolean;
  required?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Campo obligatorio faltante al intentar continuar: borde y etiqueta rojos. */
  error?: boolean;
}

// La rueda del mouse sobre un input numérico ENFOCADO cambia el valor sin
// querer (ej: escribes 10, scrolleas y queda 11). Se sale del campo: el
// scroll sigue scrolleando la página y el número queda como estaba.
const manejarRuedaInputNumerico = (e: React.WheelEvent<HTMLInputElement>) => {
  (e.target as HTMLInputElement).blur();
};

const InputField: React.FC<InputFieldProps> = ({ label, name, type = 'text', value, onChange, options, disabled, inputProps, required, error }) => (
  <div className={`Datos-input-container ${error ? 'Datos-input-container--error' : ''}`} data-campo={name}>
    <label>{label}{required && <span style={{ color: '#e74c3c' }}> *</span>}</label>
    {options ? (
      <select name={name} value={value} onChange={onChange} disabled={disabled}>
        <option value="">Seleccione...</option>
        {options.map((option, idx) => (
          <option key={idx} value={option}>{option}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...(inputProps || {})}
        onWheel={type === 'number' ? manejarRuedaInputNumerico : undefined}
      />
    )}
  </div>
);

const PhoneField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
}> = ({ label, name, value, onChange, disabled, required, error }) => (
  // Envoltorio local sobre el PhoneField compartido: aporta el contenedor
  // etiqueta+error del formulario Datos; la fila select+número y el catálogo
  // de regiones viven en Componentes/PhoneField (2026-08-31).
  <div className={`Datos-input-container ${error ? 'Datos-input-container--error' : ''}`} data-campo={name}>
    <label>{label}{required && <span style={{ color: '#e74c3c' }}> *</span>}</label>
    <PhoneFieldCompartido
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="Datos-phone"
      selectClassName="Datos-phone-region"
    />
  </div>
);

interface FormSectionProps {
  title: string;
  fields: {
    label: string;
    name: string;
    type?: string;
    options?: string[];
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  }[];
  formData: Record<string, string>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?: boolean;
  requiredFields?: string[];
  /** Clase de acento por figura (conductor/propietario/tenedor/vehículo). */
  className?: string;
  /** Campos obligatorios faltantes (se pintan en rojo al intentar continuar). */
  camposError?: string[];
}

const categoriasLicencia = ["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"];

// Año en curso (Colombia): tope del Año de Repotenciación — nunca futuro.
const ANIO_ACTUAL = new Date().getFullYear();

/* ── Celular con región (selector de país +57 default): el componente y el
   catálogo de regiones viven en Componentes/PhoneField (compartido desde
   2026-08-31 con /RegistroConductor). Almacenamiento: +57 → solo dígitos
   (formato histórico, ej: 3001234567); otra región → "+<código> <número>". ── */
const PHONE_FIELDS = ['condCelular', 'condCelularEmergencia', 'condCelularRef', 'propCelular', 'tenedCelular'];

/* Nombre entendible de cada celular (para el Swal y saber de quién es el
   número; el label del formulario es solo "Celular" en varias secciones). */
const ETIQUETAS_CELULAR: Record<string, string> = {
  condCelular: 'Celular del conductor',
  condCelularEmergencia: 'Celular del contacto de emergencia',
  condCelularRef: 'Celular de la referencia laboral del conductor',
  propCelular: 'Celular del propietario',
  tenedCelular: 'Celular del tenedor',
};

/* Colombia (sin prefijo): 10 dígitos. Internacional (+código): 6-13. */
const celularEsValido = (valor: string): boolean => {
  const digitos = valor.replace(/\D/g, '');
  return valor.startsWith('+')
    ? digitos.length >= 6 && digitos.length <= 13
    : digitos.length === 10;
};

/* Fechas que provienen del RUT del propietario/tenedor: NO son clon del
   conductor, así que siguen editables aunque los toggles de figura estén
   activos (el RUT se exige igual aunque las figuras coincidan). */
const RUT_FECHA_FIELDS = [
  'propFechaInicioActividad', 'propFechaExpedicionRut',
  'tenedFechaInicioActividad', 'tenedFechaExpedicionRut',
];
const gruposSanguineos = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const epsColombia = ["Sura", "Sanitas", "Compensar", "Coomeva", "Salud Total"];
const arlColombia = ["Positiva", "Sura", "Colpatria", "Bolívar", "Axa Colpatria"];
const parentescos = ["Padre", "Madre", "Hijo(a)", "Hermano(a)", "Esposo(a)", "Abuelo(a)", "Tio(a)", "Otro"];
const tiposCarroceria = ["S.R.S.","FURGON","ESTACAS","TANQUE","VOLCO","TOLVA","RECOLECTOR COMPARTADOR","PANEL","CAMABAJA","VAN","PLANCHON","PORTACONTENEDORES","PLATAFORMA","HOMIGONERO","BOTELLERO",];
const tiposCuenta = ["AHORROS", "CORRIENTE"];
const serviciosVehiculo = ["PARTICULAR", "PÚBLICO", "COMERCIAL", "ESPECIAL"];
const combustiblesVehiculo = ["GASOLINA", "DIESEL", "GNV", "HÍBRIDO", "ELÉCTRICO"];
const bancosColombia = [
  "Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco de Occidente",
  "Scotiabank Colpatria", "Banco Agrario", "Banco AV Villas", "Banco Caja Social",
  "Itaú", "Nu", "Daviplata", "Nequi", "Lulo Bank", "Banco Pichincha", "Falabella",
  "Santander", "Poppy Bank", "RappiPay",
];
const aseguradorasSoat = [
  "Sura", "Bolívar", "Solidaria", "Equidad", "Mapfre", "Axa Colpatria", "Allianz",
  "HDI Seguros", "General de Seguros", "Previsora", "Liberty", "Estado (Fasecolda)",
];

/* Acento visual por figura: cada bloque del formulario se identifica por color
   (conductor=azul, propietario=ámbar, tenedor=violeta, vehículo=verde). */
const claseSeccion = (title: string): string => {
  if (title.startsWith('Datos del propietario')) return 'Datos-form-section--propietario';
  if (title.startsWith('Datos del Tenedor')) return 'Datos-form-section--tenedor';
  if (title.startsWith('Datos del Vehiculo') || title.startsWith('Datos del Remolque')) return 'Datos-form-section--vehiculo';
  // Conductor, contacto de emergencia y referencias laborales (todo del conductor).
  return 'Datos-form-section--conductor';
};

/* Grupos de avance por figura (para las mini-barras junto al avance global).
   Cada grupo cuenta SOLO sus campos obligatorios, igual que el avance total.
   El grupo "Conductor" absorbe emergencia + referencias (todas son cond*) y
   las categorías de licencia (chips, no están en ninguna sección de fields). */
const GRUPOS_AVANCE: Array<{ etiqueta: string; titulos: string[]; extra?: string[] }> = [
  {
    etiqueta: 'Conductor',
    titulos: ['Información del Conductor', 'En Caso de Emergencia Avisar a', 'Referencias Laborales'],
    extra: ['condCategoriaLic'],
  },
  { etiqueta: 'Propietario', titulos: ['Datos del propietario'] },
  { etiqueta: 'Tenedor', titulos: ['Datos del Tenedor'] },
  { etiqueta: 'Vehículo', titulos: ['Datos del Vehiculo'] },
];

const FormSection: React.FC<FormSectionProps> = ({ title, fields, formData, handleChange, disabled = false, requiredFields, className, camposError }) => (
  <div className={`Datos-form-section ${className || ''}`.trim()}>
    <h4>{title}</h4>
    <div className="Datos-fields-container">
      {fields.map(({ label, name, type, options, inputProps }) => (
        PHONE_FIELDS.includes(name) ? (
          <PhoneField
            key={name}
            label={label}
            name={name}
            value={formData[name] || ""}
            onChange={handleChange}
            disabled={disabled && !RUT_FECHA_FIELDS.includes(name)}
            required={requiredFields?.includes(name)}
            error={camposError?.includes(name)}
          />
        ) : (
          <InputField
            key={name}
            label={label}
            name={name}
            type={type}
            value={formData[name] || ""}
            onChange={handleChange}
            options={options}
            disabled={disabled && !RUT_FECHA_FIELDS.includes(name)}
            required={requiredFields?.includes(name)}
            inputProps={inputProps}
            error={camposError?.includes(name)}
          />
        )
      ))}
    </div>
  </div>
);

/* ==========================================================================
 * LECTURA IA DE DOCUMENTOS — mapeos respuesta LLM → campos del formulario.
 * Cada entrada convierte los datos crudos del LLM a claves del formData.
 * ========================================================================== */

// Catálogo de tipos de documento del RUT (campo 25) para el select.
const tiposDocumentoRut = [
  'CÉDULA DE CIUDADANÍA', 'NIT', 'CÉDULA DE EXTRANJERÍA', 'PASAPORTE', 'TARJETA DE IDENTIDAD',
];

// Aterriza el tipo de documento leído al catálogo (viene con acentos variantes).
const normalizarTipoDocumento = (crudo: string): string => {
  const t = String(crudo).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (t.includes('NIT')) return 'NIT';
  if (t.includes('EXTRANJER')) return 'CÉDULA DE EXTRANJERÍA';
  if (t.includes('CEDULA') || t.includes('CIUDADANIA')) return 'CÉDULA DE CIUDADANÍA';
  if (t.includes('PASAPORTE')) return 'PASAPORTE';
  if (t.includes('TARJETA')) return 'TARJETA DE IDENTIDAD';
  return String(crudo).toUpperCase();
};

// Helper: mapear los campos de una persona (propietario/tenedor) desde un RUT.
// El RUT trae el nombre separado (apellidos + nombres): se guarda NOMBRES PRIMERO.
const mapearRutAPersona = (prefijo: 'prop' | 'tened', d: Record<string, any>): Record<string, string> => {
  const nuevos: Record<string, string> = {};
  const esJuridica = (d.tipo_persona || '').toUpperCase().includes('JURID');
  if (esJuridica && d.razon_social) {
    nuevos[`${prefijo}Nombre`] = d.razon_social.toUpperCase();
  } else if (d.nombres || d.apellidos) {
    // Nombres de pila primero, apellidos después (ej: "JUAN CARLOS SUAREZ ORTIZ").
    nuevos[`${prefijo}Nombre`] = [d.nombres, d.apellidos].filter(Boolean).join(' ').toUpperCase();
  }
  if (d.tipo_documento) nuevos[`${prefijo}TipoDocumento`] = normalizarTipoDocumento(d.tipo_documento);
  // Número de identificación asociado al tipo de documento: solo dígitos.
  if (d.numero_documento) nuevos[`${prefijo}Documento`] = String(d.numero_documento).replace(/\D/g, '');
  if (d.direccion) nuevos[`${prefijo}Direccion`] = d.direccion.toUpperCase();
  if (d.ciudad) {
    const ciudad = d.ciudad.toUpperCase();
    nuevos[`${prefijo}Ciudad`] = ciudad;
    nuevos[`${prefijo}DeptoCiudad`] = buscarDepartamentoPorCiudad(ciudad);
  }
  if (d.correo) nuevos[`${prefijo}Correo`] = d.correo.toUpperCase();
  if (d.telefono) nuevos[`${prefijo}Celular`] = d.telefono.replace(/\D/g, '').slice(0, 10);
  if (d.fecha_inicio_actividad) nuevos[`${prefijo}FechaInicioActividad`] = d.fecha_inicio_actividad;
  if (d.fecha_expedicion_rut) nuevos[`${prefijo}FechaExpedicionRut`] = d.fecha_expedicion_rut;
  return nuevos;
};

// Helper: cédula de ciudadanía (propietario/tenedor) → campos de la figura.
// El RUT se carga en el paso 3; en el paso 2 la cédula autollena la
// identidad: nombre, número de documento y lugar de expedición.
const mapearCedulaAPersona = (prefijo: 'prop' | 'tened', d: Record<string, any>): Record<string, string> => {
  const nuevos: Record<string, string> = {};
  const nombre = [d.nombres, d.apellidos].filter(Boolean).join(' ').toUpperCase().replace(/\s+/g, ' ').trim();
  if (nombre) nuevos[`${prefijo}Nombre`] = nombre;
  if (d.numero) {
    nuevos[`${prefijo}Documento`] = String(d.numero).replace(/\D/g, '');
    nuevos[`${prefijo}TipoDocumento`] = 'CÉDULA DE CIUDADANÍA';
  }
  // Expedición: aterrizar al catálogo para que calce con el select de ciudad
  // (y derivar el departamento, que alimenta las opciones del select).
  const ciudadLeida = d.lugar_expedicion || d.departamento_expedicion;
  if (ciudadLeida) {
    const ciudad = buscarCiudadEnCatalogo(ciudadLeida);
    if (ciudad) {
      nuevos[`${prefijo}CiudadExpDoc`] = ciudad;
      const depto = buscarDepartamentoPorCiudad(ciudad);
      if (depto) nuevos[`${prefijo}DeptoExpedida`] = depto;
    }
  }
  return nuevos;
};

// Helper: certificado bancario → campos de cuenta según prefijo.
const mapearBancario = (prefijo: 'cond' | 'prop' | 'tened', d: Record<string, any>): Record<string, string> => {
  const nuevos: Record<string, string> = {};
  if (d.banco) nuevos[`${prefijo}Banco`] = d.banco;
  if (d.tipo_cuenta) nuevos[`${prefijo}TipoCuenta`] = d.tipo_cuenta.toUpperCase().includes('AHO') ? 'AHORROS' : 'CORRIENTE';
  if (d.numero_cuenta) nuevos[`${prefijo}NumeroCuenta`] = String(d.numero_cuenta).replace(/\D/g, '');
  return nuevos;
};

// Aterriza la aseguradora leída por IA al catálogo del select (viene con
// variantes: "AXA SEGUROS S.A.", "SEGUROS BOLIVAR S.A."… sin esto el valor
// no coincide con NINGUNA opción y el select se pinta en blanco aunque el
// dato esté guardado).
const aterrizarAseguradora = (crudo: string): string => {
  const a = String(crudo).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const claves: Array<[string, string]> = [
    ['AXA', 'Axa Colpatria'], ['COLPATRIA', 'Axa Colpatria'],
    ['SURA', 'Sura'], ['MAPFRE', 'Mapfre'], ['LIBERTY', 'Liberty'],
    ['ALLIANZ', 'Allianz'], ['HDI', 'HDI Seguros'], ['EQUIDAD', 'Equidad'],
    ['SOLIDARIA', 'Solidaria'], ['BOLIVAR', 'Bolívar'], ['PREVISORA', 'Previsora'],
    ['GENERAL DE SEGUROS', 'General de Seguros'],
    ['FASECOLDA', 'Estado (Fasecolda)'], ['ESTADO', 'Estado (Fasecolda)'],
  ];
  for (const [clave, valor] of claves) {
    if (a.includes(clave)) return valor;
  }
  return String(crudo);
};

const MAPEOS_IA: Record<string, (d: Record<string, any>) => Record<string, string>> = {
  cedula: (d) => {
    const nuevos: Record<string, string> = {};
    const apellidos = (d.apellidos || '').trim();
    if (apellidos) {
      const partes = apellidos.split(/\s+/);
      nuevos.condPrimerApellido = partes[0] || '';
      nuevos.condSegundoApellido = partes.slice(1).join(' ') || '';
    }
    if (d.nombres) nuevos.condNombres = d.nombres;
    if (d.numero) nuevos.condCedulaCiudadania = d.numero;
    if (d.rh) nuevos.condGrupoSanguineo = d.rh;
    if (d.fecha_nacimiento) nuevos.condFechaNacimiento = d.fecha_nacimiento;
    if (d.fecha_expedicion) nuevos.condFechaExpedicion = d.fecha_expedicion;
    if (d.lugar_expedicion) {
      // Aterrizar al nombre EXACTO del catálogo para que el valor sea consistente.
      const ciudadCatalogo = buscarCiudadEnCatalogo(d.lugar_expedicion);
      if (ciudadCatalogo) nuevos.condExpedidaEn = ciudadCatalogo.toUpperCase();
    }
    // Sin ciudad legible: el departamento leído queda como valor de «Expedida en».
    if (!nuevos.condExpedidaEn && d.departamento_expedicion) {
      nuevos.condExpedidaEn = String(d.departamento_expedicion).toUpperCase();
    }
    return nuevos;
  },
  licencia: (d) => {
    const nuevos: Record<string, string> = {};
    if (d.numero) nuevos.condNoLicencia = d.numero;
    // Categorías: una licencia puede autorizar VARIAS (ej: C1+C2). La IA
    // devuelve la lista completa; se filtra al catálogo y se guarda separada
    // por comas. Fallback "categoria" para lecturas viejas de una sola.
    const crudo = d.categorias ?? d.categoria;
    if (crudo) {
      const texto = (Array.isArray(crudo) ? crudo.join(' ') : String(crudo)).toUpperCase();
      const cats = categoriasLicencia.filter(c => texto.includes(c));
      if (cats.length > 0) nuevos.condCategoriaLic = cats.join(',');
    }
    if (d.fecha_vencimiento) nuevos.condFechaVencimientoLic = d.fecha_vencimiento;
    if (d.cedula) nuevos.condCedulaCiudadania = d.cedula;
    return nuevos;
  },
  rut_tenedor: (d) => mapearRutAPersona('tened', d),
  rut_propietario: (d) => mapearRutAPersona('prop', d),
  cedula_tenedor: (d) => mapearCedulaAPersona('tened', d),
  cedula_propietario: (d) => mapearCedulaAPersona('prop', d),
  certificado_bancario_cond: (d) => mapearBancario('cond', d),
  certificado_bancario_tened: (d) => mapearBancario('tened', d),
  certificado_bancario_prop: (d) => mapearBancario('prop', d),
  tarjeta_propiedad: (d) => {
    const nuevos: Record<string, string> = {};
    if (d.numero_licencia_transito) nuevos.vehNoLicTransito = String(d.numero_licencia_transito).replace(/\D/g, '');
    if (d.marca) nuevos.vehMarca = d.marca.toUpperCase();
    if (d.linea) nuevos.vehLinea = d.linea.toUpperCase();
    if (d.modelo) nuevos.vehModelo = String(d.modelo).slice(0, 4);
    if (d.color) nuevos.vehColor = d.color.toUpperCase();
    if (d.clase_vehiculo) nuevos.vehClase = d.clase_vehiculo.toUpperCase();
    if (d.cilindraje) nuevos.vehCilindraje = String(d.cilindraje).replace(/\D/g, '');
    if (d.servicio) {
      // Aterrizar al catálogo del select (el valor crudo podría no coincidir).
      const s = String(d.servicio).toUpperCase();
      nuevos.vehServicio = s.includes('PARTIC') ? 'PARTICULAR'
        : (s.includes('PÚBL') || s.includes('PUBL')) ? 'PÚBLICO'
        : s.includes('COMERCIAL') ? 'COMERCIAL' : s;
    }
    if (d.combustible) {
      const c = String(d.combustible).toUpperCase();
      nuevos.vehCombustible = c.includes('GASO') ? 'GASOLINA'
        : (c.includes('DIESEL') || c.includes('ACPM')) ? 'DIESEL'
        : (c.includes('GNV') || c.includes('GAS NATURAL')) ? 'GNV'
        : (c.includes('HÍBRID') || c.includes('HIBRID')) ? 'HÍBRIDO'
        : c.includes('ELECTR') ? 'ELÉCTRICO' : c;
    }
    if (d.capacidad_pasajeros !== undefined && d.capacidad_pasajeros !== null) nuevos.vehCapPasajeros = String(d.capacidad_pasajeros);
    if (d.potencia) nuevos.vehPotencia = String(d.potencia).toUpperCase();
    if (d.vin) nuevos.vehVin = String(d.vin).toUpperCase();
    if (d.numero_chasis) nuevos.vehChasis = String(d.numero_chasis).toUpperCase();
    if (d.numero_motor) nuevos.vehMotor = String(d.numero_motor).toUpperCase();
    if (d.numero_puertas !== undefined && d.numero_puertas !== null) nuevos.vehPuertas = String(d.numero_puertas);
    if (d.fecha_matricula) nuevos.vehFechaMatricula = d.fecha_matricula;
    if (d.organismo_transito) nuevos.vehOrganismoTransito = d.organismo_transito.toUpperCase();
    if (d.blindaje) nuevos.vehBlindaje = String(d.blindaje).toUpperCase().startsWith('NO') ? 'No' : 'Sí';
    if (d.limitacion_propiedad) nuevos.vehLimitacionProp = String(d.limitacion_propiedad).toUpperCase().startsWith('NO') ? 'No' : 'Sí';
    if (d.codigo_licencia) nuevos.vehCodigoLicTransito = String(d.codigo_licencia).toUpperCase();
    if (d.propietario_nombre) nuevos.propNombre = d.propietario_nombre.toUpperCase();
    if (d.propietario_documento) nuevos.propDocumento = String(d.propietario_documento).replace(/\D/g, '');
    return nuevos;
  },
  soat: (d) => {
    const nuevos: Record<string, string> = {};
    if (d.aseguradora) nuevos.vehAseguradoraSoat = aterrizarAseguradora(d.aseguradora);
    if (d.numero_poliza) nuevos.vehPolizaSoat = String(d.numero_poliza).replace(/\D/g, '');
    if (d.fecha_vencimiento) nuevos.vehVencimientoSoat = d.fecha_vencimiento;
    return nuevos;
  },
};

// Traducción: tipo de SUBIDA (clave con que el backend guarda lecturasIA)
// → clave de MAPEOS_IA (para autollenar el formulario al montar).
const LECTURA_SUBIDA_A_MAPEO: Record<string, string> = {
  documentoIdentidadConductor: 'cedula',
  documentoIdentidadPropietario: 'cedula_propietario',
  documentoIdentidadTenedor: 'cedula_tenedor',
  rutTenedor: 'rut_tenedor',
  rutPropietario: 'rut_propietario',
  condCertificacionBancaria: 'certificado_bancario_cond',
  tenedCertificacionBancaria: 'certificado_bancario_tened',
  propCertificacionBancaria: 'certificado_bancario_prop',
  licencia: 'licencia',
  tarjetaPropiedad: 'tarjeta_propiedad',
  soat: 'soat',
};

// Traducción inversa: tipo de lectura de la tarjeta IA → tipo de SUBIDA
// canónico del backend (para guardar el archivo al leerlo).
const LECTURA_IA_A_TIPO_SUBIDA: Record<string, string> = {
  licencia: 'licencia',
  tarjeta_propiedad: 'tarjetaPropiedad',
  soat: 'soat',
  // Cédulas de propietario/tenedor: identidad en el paso 2.
  cedula_propietario: 'documentoIdentidadPropietario',
  cedula_tenedor: 'documentoIdentidadTenedor',
  // RUT: complemento (dirección, ciudad, correo, fechas, NIT) — también se
  // pueden subir en el paso 3 y su lectura se aplica aquí al montar.
  rut_tenedor: 'rutTenedor',
  rut_propietario: 'rutPropietario',
  certificado_bancario_cond: 'condCertificacionBancaria',
  certificado_bancario_tened: 'tenedCertificacionBancaria',
  certificado_bancario_prop: 'propCertificacionBancaria',
};

// Límites de subida (espejo de CargaDocumento).
const MAX_SIZE_MB_IA = 10;
const FORMATOS_ACEPTADOS_IA = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

// Botones de la tarjeta "Ahorra tiempo": tipo lectura → etiqueta y esquema backend.
// Cédulas de propietario/tenedor = identidad; RUT = complemento (dirección,
// ciudad, correo, celular, fechas, NIT). Ambos aportan; nunca pisan lo manual.
// soloPdf: documentos que SOLO se aceptan como PDF y sin cámara (el RUT se
// descarga de la DIAN, no se fotografía — una foto lo deja ilegible para la IA).
const OPCIONES_LECTURA_IA: Array<{ tipo: string; esquema: string; etiqueta: string; soloPdf?: boolean }> = [
  { tipo: 'cedula', esquema: 'cedula', etiqueta: '🪪 Cédula del conductor' },
  { tipo: 'licencia', esquema: 'licencia', etiqueta: '🎫 Licencia de conducción' },
  { tipo: 'tarjeta_propiedad', esquema: 'tarjeta_propiedad', etiqueta: '📄 Tarjeta de propiedad' },
  { tipo: 'soat', esquema: 'soat', etiqueta: '🛡️ SOAT' },
  { tipo: 'cedula_propietario', esquema: 'cedula', etiqueta: '🪪 Cédula del propietario' },
  { tipo: 'cedula_tenedor', esquema: 'cedula', etiqueta: '🪪 Cédula del tenedor' },
  { tipo: 'rut_tenedor', esquema: 'rut', etiqueta: '📊 RUT del tenedor', soloPdf: true },
  // (2026-08-31) Sin «RUT del propietario»: ese documento dejó de pedirse
  // por completo (orden del usuario).
  { tipo: 'certificado_bancario_cond', esquema: 'certificado_bancario', etiqueta: '🏦 Cert. bancario conductor' },
  { tipo: 'certificado_bancario_tened', esquema: 'certificado_bancario', etiqueta: '🏦 Cert. bancario tenedor' },
  // (2026-08-31) Sin «Cert. bancario propietario»: ese documento dejó de
  // pedirse por completo (orden del usuario).
];

/* Documentos del conductor que pueden REUTILIZARSE como documento del
   propietario/tenedor («es la misma persona», 2026-08-31 — cédula y
   certificado bancario): si el del conductor ya está cargado, el botón de la
   figura ofrece copiarlo server-side SIN gastar otra lectura de IA. */
const REUTILIZABLES_CONDUCTOR: Record<string, {
  figura: 'propietario' | 'tenedor';
  documento: 'cedula' | 'certificado_bancario';
  campoConductor: string;
  nombreDoc: string;
  femenino: boolean;
}> = {
  cedula_propietario: { figura: 'propietario', documento: 'cedula', campoConductor: 'documentoIdentidadConductor', nombreDoc: 'cédula', femenino: true },
  cedula_tenedor: { figura: 'tenedor', documento: 'cedula', campoConductor: 'documentoIdentidadConductor', nombreDoc: 'cédula', femenino: true },
  certificado_bancario_tened: { figura: 'tenedor', documento: 'certificado_bancario', campoConductor: 'condCertificacionBancaria', nombreDoc: 'certificado bancario', femenino: false },
};

interface DatosProps {
  placa: string;
  idUsuario?: string;
  /** True cuando se edita un vehículo aprobado: enviar editado_por al guardar. */
  editarAprobado?: boolean;
  onValidChange?: (isValid: boolean) => void;
  onCedulaConductorChange?: (cedula: string) => void;
  onSavedSuccess: () => void;
}

/* ── Referencias laborales ADICIONALES (2026-08-31): la referencia #1 sigue
   siendo los campos planos cond*Ref (obligatoria, compat histórico/HV) y las
   extra viven en el array `referenciasAdicionales` del vehículo. Opcionales. ── */
const MAX_REFERENCIAS_ADICIONALES = 5;
const CAMPOS_REF_ADICIONAL: Array<{ label: string; clave: string; type?: string }> = [
  { label: 'Empresa', clave: 'empresa' },
  { label: 'Celular', clave: 'celular', type: 'text' },
  { label: 'Nro. Viajes', clave: 'nroViajes', type: 'number' },
  { label: 'Años Antigüedad', clave: 'antiguedad', type: 'number' },
  { label: 'Merc. Transportada', clave: 'mercancia' },
];
const refAdicionalVacia = (): Record<string, string> => ({
  empresa: '', celular: '', departamento: '', ciudad: '', nroViajes: '', antiguedad: '', mercancia: '',
});

/* ── Remolque (opcional): la mayoría de conductores no tiene remolque, así
   que la sección solo se despliega tras marcar el checkbox «tengo remolque».
   Los campos NO son obligatorios (no están en requiredFields). ── */
const REMOL_FIELDS = ['RemolPlaca', 'RemolModelo', 'RemolClase', 'RemolTipoCarroceria', 'RemolAlto', 'RemolLargo', 'RemolAncho'];
const REMOL_TITULO = 'Datos del Remolque (Opcional)';

const Datos: React.FC<DatosProps> = ({ placa, idUsuario, editarAprobado, onValidChange, onCedulaConductorChange, onSavedSuccess }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  // Referencias laborales adicionales (opcionales): el array vive aparte del
  // formData plano y se persiste como `referenciasAdicionales` en el vehículo.
  const [refsAdicionales, setRefsAdicionales] = useState<Array<Record<string, string>>>([]);
  // Sección del remolque desplegada (checkbox «mi vehículo tiene remolque»).
  const [tieneRemolque, setTieneRemolque] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editandoFirma, setEditandoFirma] = useState(false);
  const sigCanvas = useRef<any>(null);
  // Sello de la firma electrónica (vehiculo.firmaEvidencia): fecha de la
  // última firma registrada vía /vehiculos/firmar. Null = firma histórica
  // sin sellado o aún no firmado.
  const [firmaSellada, setFirmaSellada] = useState<{ firmado_en: string; version: number } | null>(null);
  // Documentos ya guardados en el vehículo (tipo subida → URL), para los ✓.
  const [docsSubidos, setDocsSubidos] = useState<Record<string, string>>({});

  // --- Lectura de documentos con IA (cédula, RUT, bancario, licencia, etc.) ---
  const [leyendoCedula, setLeyendoCedula] = useState(false);
  const [etiquetaLecturaIA, setEtiquetaLecturaIA] = useState('');
  const [camposLecturaIA, setCamposLecturaIA] = useState<string[]>([]);
  // Input file genérico: todos los documentos pasan por aquí (la cédula del
  // conductor ya no tiene botones separados de frente/reverso).
  const [tipoLecturaPendiente, setTipoLecturaPendiente] = useState<string | null>(null);
  const inputDocumentoRef = useRef<HTMLInputElement>(null);
  // Esperando el REVERSO de un documento de dos caras (licencia/tarjeta).
  const [reversoPendiente, setReversoPendiente] = useState<{ tipo: string; esquema: string; etiqueta: string; anverso: File } | null>(null);
  // Cámara dentro de la página (getUserMedia): { etiqueta, modo } con modo
  // 'frente' (documento aún sin archivo) o 'reverso' (siguiendo el flujo de
  // dos caras). Null = cerrada.
  const [camaraAbierta, setCamaraAbierta] = useState<{ etiqueta: string; modo: 'frente' | 'reverso' } | null>(null);
  const inputReversoDocRef = useRef<HTMLInputElement>(null);

  // --- Campos obligatorios faltantes (se pintan en rojo al dar «Continuar») ---
  const [camposError, setCamposError] = useState<string[]>([]);
  // Visor de documento de dos caras (botón 👁 de la tarjeta IA): frente +
  // «Girar para ver el respaldo», sin tener que elegir la cara de antemano.
  const [verCaraIA, setVerCaraIA] = useState<{ frente: string; reverso?: string; etiqueta: string } | null>(null);
  // Se limpian solos conforme el usuario va llenando. Los celulares marcados
  // por número inválido siguen en rojo hasta que el número quede bien.
  useEffect(() => {
    setCamposError(prev => prev.filter(c => {
      const valor = formData[c] || '';
      if (!valor.trim()) return true; // sigue vacío → sigue en rojo
      if (PHONE_FIELDS.includes(c)) return !celularEsValido(valor); // válido → quitar rojo
      return false;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  // --- Autoguardado con debounce ---
  // 'inactivo' (nada pendiente) | 'guardando' | 'guardado' | 'error'
  const [estadoAutoguardado, setEstadoAutoguardado] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cargandoInicialRef = useRef(true);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const refsAdicionalesRef = useRef(refsAdicionales);
  refsAdicionalesRef.current = refsAdicionales;
  const estadoAutoguardadoRef = useRef(estadoAutoguardado);
  estadoAutoguardadoRef.current = estadoAutoguardado;

  const phoneFields = PHONE_FIELDS;

  const requiredFields = [
    'condPrimerApellido', 'condSegundoApellido', 'condNombres', 'condCedulaCiudadania', 'condExpedidaEn', 'condDireccion',
    'condCiudad', 'condCelular', 'condCorreo', 'condEps', 'condArl', 'condNoLicencia', 'condFechaVencimientoLic', 'condCategoriaLic',
    'condGrupoSanguineo', 'condNombreEmergencia', 'condCelularEmergencia', 'condParentescoEmergencia', 'condEmpresaRef', 'condCelularRef',
    'condCiudadRef', 'condNroViajesRef', 'condAntiguedadRef', 'condMercTransportada', 'propNombre', 'propDocumento', 'propCiudadExpDoc',
    'propCorreo', 'propCelular', 'propDireccion', 'propCiudad', 'tenedNombre', 'tenedDocumento', 'tenedCiudadExpDoc', 'tenedCorreo',
    'tenedCelular', 'tenedDireccion', 'tenedCiudad', 'vehModelo', 'vehMarca', 'vehTipoCarroceria', 'vehLinea', 'vehColor',
    'vehEmpresaSat', 'vehUsuarioSat', 'vehClaveSat',
    // Datos del SOAT OBLIGATORIOS (2026-08-27, orden del usuario).
    'vehAseguradoraSoat', 'vehPolizaSoat', 'vehVencimientoSoat',
    // El Año de Repotenciación es obligatorio SOLO si el vehículo fue repotenciado.
    ...(formData['vehRepotenciado'] === 'Sí' ? ['vehAno'] : []),
  ];

  const calcularAvance = () => {
    const total = requiredFields.length;
    const completados = requiredFields.filter(field => formData[field] && formData[field].trim() !== "").length;
    return Math.round((completados / total) * 100);
  };

  const isFormValid = () => {
    const camposOk = requiredFields.every((field) => formData[field] && formData[field].trim() !== "");
    return camposOk;
  };

  useEffect(() => {
    if (onValidChange) onValidChange(isFormValid());
    if (onCedulaConductorChange) onCedulaConductorChange(formData["condCedulaCiudadania"] || "");
  }, [formData, onValidChange, onCedulaConductorChange]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/vehiculos/obtener-vehiculo/${placa}`);
        if (!response.ok) throw new Error("Error al obtener la información del vehículo");
        const data = await response.json();
        if (data.data) {
          const loadedData = data.data;

          // Remolque: marcar el checkbox si ya había algún dato guardado
          // (un vehículo con placa de remolque no debe verse «sin remolque»).
          setTieneRemolque(REMOL_FIELDS.some(f => loadedData[f] != null && String(loadedData[f]).trim() !== ''));

          // Documentos ya guardados (tipo subida → URL) para los ✓ de la tarjeta IA.
          // Incluye los REVERSOS de docs de dos caras ({tipo}Reverso).
          const tiposSubidaIA = [
            'documentoIdentidadConductor',
            ...Object.values(LECTURA_IA_A_TIPO_SUBIDA),
            'documentoIdentidadConductorReverso', 'licenciaReverso', 'tarjetaPropiedadReverso',
            'documentoIdentidadPropietarioReverso', 'documentoIdentidadTenedorReverso',
          ];
          const subidos: Record<string, string> = {};
          tiposSubidaIA.forEach((tipo) => {
            const url = loadedData[tipo];
            if (typeof url === 'string' && url && url !== 'null' && url !== 'undefined') subidos[tipo] = url;
          });
          setDocsSubidos(subidos);

          // Referencias adicionales guardadas (array; tolera históricos sin él).
          const refsGuardadas = Array.isArray(loadedData.referenciasAdicionales)
            ? loadedData.referenciasAdicionales
                .filter((r: any) => r && typeof r === 'object')
                .slice(0, MAX_REFERENCIAS_ADICIONALES)
                .map((r: any) => ({ ...refAdicionalVacia(), ...Object.fromEntries(
                  Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)]),
                ) }))
            : [];
          setRefsAdicionales(refsGuardadas);

          const departamentosCalculados: Record<string, string> = {};
          const cityToDeptoMap: Record<string, string> = {
            'condCiudad': 'condDeptoCiudad', 'condCiudadRef': 'condDeptoCiudadRef',
            'propCiudadExpDoc': 'propDeptoExpedida', 'propCiudad': 'propDeptoCiudad', 'tenedCiudadExpDoc': 'tenedDeptoExpedida',
            'tenedCiudad': 'tenedDeptoCiudad'
          };
          Object.keys(cityToDeptoMap).forEach(cityField => {
             if (loadedData[cityField]) {
                departamentosCalculados[cityToDeptoMap[cityField]] = buscarDepartamentoPorCiudad(loadedData[cityField]);
             }
          });
          setFormData((prevData) => ({ ...prevData, ...loadedData, ...departamentosCalculados }));

          // Sello de la firma electrónica (si ya firmó antes con el flujo nuevo).
          const evidencia = loadedData.firmaEvidencia;
          if (evidencia && evidencia.firmado_en) {
            setFirmaSellada({ firmado_en: evidencia.firmado_en, version: evidencia.version ?? 1 });
          }

          // Datos extraídos por IA al subir documentos (paso 3): autollenar los
          // campos aún vacíos con la misma regla de no pisar lo escrito a mano.
          const lecturas = loadedData.lecturasIA || {};
          const aplicados: string[] = [];
          Object.entries(lecturas).forEach(([tipoSubida, lectura]: [string, any]) => {
            if (!lectura || !lectura.datos) return;
            const claveMapeo = LECTURA_SUBIDA_A_MAPEO[tipoSubida];
            if (!claveMapeo || !MAPEOS_IA[claveMapeo]) return;
            const nuevos = MAPEOS_IA[claveMapeo](lectura.datos);
            setFormData(prev => {
              const merged = { ...prev };
              Object.entries(nuevos).forEach(([k, v]) => {
                if (!merged[k] || merged[k] === "") merged[k] = v;
              });
              return merged;
            });
            aplicados.push(...Object.keys(nuevos));
          });
          if (aplicados.length > 0) {
            setCamposLecturaIA(prev => Array.from(new Set([...prev, ...aplicados])));
          }
        }
      } catch (error) { console.error("Error cargando la información del vehículo:", error); }
      finally {
        // La carga inicial terminó: a partir del siguiente cambio de formData
        // el autoguardado puede actuar (esto evita un guardado falso al montar).
        setTimeout(() => { cargandoInicialRef.current = false; }, 300);
      }
    };
    if (placa) fetchData();
  }, [placa]);

  // Categorías de licencia MÚLTIPLES: se guardan en condCategoriaLic separadas
  // por comas (ej: "B2,C1"), compatibles con históricos de una sola categoría.
  const toggleCategoriaLic = (cat: string) => {
    const actuales = (formData['condCategoriaLic'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const set = new Set(actuales);
    if (set.has(cat)) set.delete(cat); else set.add(cat);
    const ordenadas = categoriasLicencia.filter(c => set.has(c));
    setFormData(prev => ({ ...prev, condCategoriaLic: ordenadas.join(',') }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (PHONE_FIELDS.some(field => name.includes(field))) {
        // Celular: solo dígitos; con prefijo internacional "+<código> <número>"
        // se permiten hasta 12 dígitos, sin él (Colombia) máximo 10.
        const m = String(value).match(/^(\+\d{1,3})?\s?(\d*)$/);
        if (!m) return;
        const prefijo = m[1];
        const digitos = m[2];
        if (prefijo) {
          if (digitos.length > 12) return;
          setFormData(prev => ({ ...prev, [name]: `${prefijo} ${digitos}` }));
        } else {
          if (digitos.length > 10) return;
          setFormData(prev => ({ ...prev, [name]: digitos }));
        }
        return;
    }
    if (value !== "") {
        if (name === 'vehModelo' && parseInt(value) > 2026) return;
        // El año de repotenciación nunca puede ser futuro.
        if (name === 'vehAno' && parseInt(value) > ANIO_ACTUAL) return;
        if (name === 'condAntiguedadRef' && parseInt(value) > 30) return;
    }
    if (name.includes('Depto')) {
        let ciudadField = "";
        if (name === 'condDeptoCiudad') ciudadField = 'condCiudad';
        if (name === 'condDeptoCiudadRef') ciudadField = 'condCiudadRef';
        if (name === 'propDeptoExpedida') ciudadField = 'propCiudadExpDoc';
        if (name === 'propDeptoCiudad') ciudadField = 'propCiudad';
        if (name === 'tenedDeptoExpedida') ciudadField = 'tenedCiudadExpDoc';
        if (name === 'tenedDeptoCiudad') ciudadField = 'tenedCiudad';
        setFormData(prev => ({ ...prev, [name]: value, [ciudadField]: "" }));
    } else {
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  };

  // Aplica los datos de una lectura IA al formData respetiendo lo escrito a mano:
  // solo llena campos vacíos o previamente llenados por IA.
  const aplicarLecturaIA = (nuevos: Record<string, string>) => {
    setFormData(prev => {
      const merged = { ...prev };
      Object.entries(nuevos).forEach(([k, v]) => {
        if (!merged[k] || camposLecturaIA.includes(k)) merged[k] = v;
      });
      return merged;
    });
    setCamposLecturaIA(prev => Array.from(new Set([...prev, ...Object.keys(nuevos)])));
  };

  /**
   * Lee un documento con IA, GUARDA el archivo como documento oficial del
   * vehículo y autollena el formulario.
   * - 8 tipos de un solo archivo: `PUT /subir-documento` (sube + lee en un
   *   solo request; `lectura_ia` null = guardado pero ilegible → campos a mano).
   * - Cédula: `POST /extraer-datos-documento` (necesita frente+reverso) y
   *   luego SIEMPRE sube el frente (`extraer=false`, ya se leyó). Si la IA no
   *   logra leer (cédula azul nueva), el documento IGUAL queda guardado.
   */
  const leerDocumentoConIA = async (
    tipoLectura: string,
    esquema: string,
    archivos: File[],
    etiqueta: string
  ) => {
    const mapear = MAPEOS_IA[tipoLectura];
    if (!mapear) return;
    // Reverso OBLIGATORIO para TODOS los docs de dos caras (cédulas, licencia
    // y tarjeta de propiedad — siempre frente y reverso, sin excepciones).
    if (['cedula', 'cedula_propietario', 'cedula_tenedor', 'licencia', 'tarjeta_propiedad'].includes(tipoLectura) && archivos.length < 2) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta el reverso',
        html: `${etiqueta} tiene <b>dos caras</b> y ambas son obligatorias.<br/>Vuelve a cargar el documento: primero el FRENTE y luego el REVERSO.`,
        confirmButtonColor: '#e67e22',
      });
      return;
    }
    setLeyendoCedula(true);
    setEtiquetaLecturaIA(etiqueta);
    try {
      const tipoSubida = tipoLectura === 'cedula'
        ? 'documentoIdentidadConductor'
        : LECTURA_IA_A_TIPO_SUBIDA[tipoLectura];

      // Gemelos por figura (inferencia por dígitos; los flags persistidos de
      // históricos, si existen, viven dentro del propio formData).
      const gemelos = tipoSubida ? gemelosDocumento(tipoSubida, calcularFigurasIguales(formData)) : [];

      let datos: Record<string, any> | null = null;
      let avisos: string[] = [];
      let lecturaFallida = false;

      // Documentos de DOS caras (cédulas de conductor/propietario/tenedor,
      // licencia, tarjeta de propiedad): leer frente+reverso con IA y subir
      // el frente como documento oficial.
      const esDosCaras = ['cedula', 'cedula_propietario', 'cedula_tenedor', 'licencia', 'tarjeta_propiedad'].includes(tipoLectura);

      if (esDosCaras) {
        // 1) Lectura con IA (frente + reverso opcional).
        try {
          const body = new FormData();
          body.append('tipo', esquema);
          archivos.forEach((f, i) => body.append(i === 0 ? 'anverso' : 'reverso', f));
          if (placa) body.append('placa_vehiculo', placa);
          if (formData['condCedulaCiudadania']) body.append('cedula_conductor', formData['condCedulaCiudadania']);
          const resp = await fetch(`${API_BASE}/vehiculos/extraer-datos-documento`, { method: 'POST', body });
          const data = await resp.json().catch(() => ({}));
          // 409 = la IA determinó que NO es el documento esperado: no se guarda nada.
          if (resp.status === 409) {
            throw new Error(data.detail || 'Esto no parece ser el documento esperado.');
          }
          if (!resp.ok) throw new Error(data.detail || '');
          datos = data.datos || null;
          avisos = Array.isArray(data.avisos) ? data.avisos : [];
          if (!datos || Object.keys(datos).length === 0) lecturaFallida = true;
        } catch (error: any) {
          if (error?.message?.includes('no parece ser el documento')) {
            setLeyendoCedula(false);
            await Swal.fire({
              icon: 'error',
              title: 'Documento no válido',
              text: error.message,
              confirmButtonColor: '#d33',
            });
            return; // NO subir el archivo.
          }
          // Ilegible: se sube igual. Si el backend dejó un motivo legible
          // (ej. PDF con contraseña), viaja como aviso al Swal de resultado.
          if (error?.message) avisos = [error.message];
          lecturaFallida = true;
        }

        // 2) Subir el FRENTE como documento oficial (+ REVERSO si lo hay).
        //    La lectura de dos caras viaja con la subida (persiste en lecturasIA).
        const bodySubida = new FormData();
        bodySubida.append('archivo', archivos[0]);
        bodySubida.append('placa', placa);
        bodySubida.append('tipo', tipoSubida);
        bodySubida.append('extraer', 'false');
        if (archivos.length > 1) bodySubida.append('reverso', archivos[1]);
        if (datos) bodySubida.append('lectura_datos', JSON.stringify(datos));
        if (avisos.length) bodySubida.append('lectura_avisos', JSON.stringify(avisos));
        if (gemelos.length) bodySubida.append('replicar_en', gemelos.join(','));
        if (editarAprobado && idUsuario) bodySubida.append('editado_por', idUsuario);
        const respSubida = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body: bodySubida });
        const dataSubida = await respSubida.json().catch(() => ({}));
        if (!respSubida.ok) throw new Error(dataSubida.detail || 'No se pudo guardar el documento.');
        setDocsSubidos(prev => ({
          ...prev,
          [tipoSubida]: dataSubida.url,
          ...(dataSubida.url_reverso ? { [`${tipoSubida}Reverso`]: dataSubida.url_reverso } : {}),
        }));
      } else {
        // Un solo request: sube el archivo Y lo lee con IA.
        const body = new FormData();
        body.append('archivo', archivos[0]);
        body.append('placa', placa);
        body.append('tipo', tipoSubida);
        if (gemelos.length) body.append('replicar_en', gemelos.join(','));
        if (editarAprobado && idUsuario) body.append('editado_por', idUsuario);
        const resp = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || `No se pudo guardar ${etiqueta.toLowerCase()}.`);

        if (data.lectura_ia && data.lectura_ia.datos) {
          datos = data.lectura_ia.datos;
          avisos = Array.isArray(data.lectura_ia.avisos) ? data.lectura_ia.avisos : [];
        } else {
          lecturaFallida = true; // Guardado OK, pero la IA no pudo leerlo.
        }
        setDocsSubidos(prev => ({ ...prev, [tipoSubida]: data.url }));
      }

      if (datos && !lecturaFallida) aplicarLecturaIA(mapear(datos));

      const leidos = datos && !lecturaFallida ? Object.keys(mapear(datos)).length : 0;
      const htmlAvisos = avisos.length
        ? `<div style="text-align:left; margin-top:10px; font-size:0.9em;">${avisos.map(a => `<div>${a}</div>`).join('')}</div>`
        : '';
      // Cerrar el overlay ANTES del Swal de resultado para que la animación no
      // tape la transición (el Swal a 1060 ya queda encima del overlay a 1050,
      // pero así el resultado aparece sobre el formulario, no sobre el velo).
      setLeyendoCedula(false);
      if (leidos > 0) {
        await Swal.fire({
          icon: 'success',
          title: `${etiqueta} guardado y leído`,
          html: `Documento guardado. Llenamos <b>${leidos}</b> campo(s); revísalos y corrige lo que falte.${htmlAvisos}`,
          confirmButtonColor: '#27ae60',
        });
      } else {
        await Swal.fire({
          icon: 'warning',
          title: 'Documento guardado, pero no pudimos leerlo con IA',
          html: `El archivo quedó guardado como <b>${etiqueta}</b>.${htmlAvisos}<div style="margin-top:8px">Diligencia los campos a mano en el formulario.</div>`,
          confirmButtonColor: '#e67e22',
        });
      }
    } catch (error: any) {
      const mensaje = error?.message || '';
      Swal.fire({
        icon: 'error',
        title: mensaje.includes('no parece ser el documento') ? 'Documento no válido' : 'No pudimos guardar el documento',
        text: mensaje || 'Intenta de nuevo o cárgalo manualmente en el paso de documentos.',
        confirmButtonColor: '#d33',
      });
    } finally {
      setLeyendoCedula(false);
      if (inputDocumentoRef.current) inputDocumentoRef.current.value = '';
      setTipoLecturaPendiente(null);
    }
  };

  // Validación previa de archivo (espejo de CargaDocumento) antes de leer/subir.
  const validarArchivoIA = (archivo: File): boolean => {
    if (!FORMATOS_ACEPTADOS_IA.includes(archivo.type)) {
      Swal.fire('Formato no válido', 'Solo se aceptan imágenes (JPG/PNG) o PDF.', 'warning');
      return false;
    }
    if (archivo.size > MAX_SIZE_MB_IA * 1024 * 1024) {
      Swal.fire('Archivo muy pesado', `El archivo supera los ${MAX_SIZE_MB_IA} MB permitidos.`, 'warning');
      return false;
    }
    return true;
  };

  // Input file genérico: el usuario eligió un tipo de OPCIONES_LECTURA_IA y luego el archivo.
  const manejarSeleccionDocumento = async () => {
    const archivoOriginal = inputDocumentoRef.current?.files?.[0];
    if (!archivoOriginal || !tipoLecturaPendiente) return;
    const soloPdf = Boolean(OPCIONES_LECTURA_IA.find(o => o.tipo === tipoLecturaPendiente)?.soloPdf);
    // Comprimir apenas llega la foto: las fotos de cámara (12–50 MP) son las
    // que desbordan la memoria del navegador en móviles ("memoria
    // insuficiente"); comprimida (~1600px) baja el pico de RAM del flujo de
    // dos caras y de la subida. Ante fallo devuelve el archivo original.
    const archivo = await comprimirImagen(archivoOriginal);
    // Vaciar el input ya: no retener el original en memoria más de lo necesario.
    if (inputDocumentoRef.current) inputDocumentoRef.current.value = '';
    if (soloPdf && archivo.type !== 'application/pdf') {
      Swal.fire('Formato no válido', 'El RUT solo se puede subir en PDF (se descarga de la DIAN; no se admite foto).', 'warning');
      setTipoLecturaPendiente(null);
      return;
    }
    if (!validarArchivoIA(archivo)) {
      setTipoLecturaPendiente(null);
      return;
    }
    const opcion = OPCIONES_LECTURA_IA.find(o => o.tipo === tipoLecturaPendiente);
    if (!opcion) return;
    const etiqueta = opcion.etiqueta.replace(/^[^\s]+\s/, '');

    // Documentos de DOS caras OBLIGATORIAS (todas las cédulas, licencia y
    // tarjeta de propiedad — 2026-08-27, orden del usuario: siempre reverso):
    // tras el frente se pide el reverso inmediatamente, sin poder saltarlo.
    if (['cedula', 'cedula_propietario', 'cedula_tenedor', 'licencia', 'tarjeta_propiedad'].includes(opcion.tipo)) {
      Swal.fire({
        icon: 'info',
        title: 'Ahora el REVERSO',
        html: `El FRENTE de la ${etiqueta.toLowerCase()} está listo.<br/>Este documento tiene <b>dos caras y ambas son obligatorias</b>: selecciona ahora la foto o PDF del <b>reverso</b>.`,
        confirmButtonText: 'Elegir reverso',
        confirmButtonColor: '#2c5f9e',
        allowOutsideClick: false,
      }).then(() => {
        setReversoPendiente({ tipo: opcion.tipo, esquema: opcion.esquema, etiqueta, anverso: archivo });
        setTimeout(() => inputReversoDocRef.current?.click(), 0);
      });
      return;
    }
    leerDocumentoConIA(opcion.tipo, opcion.esquema, [archivo], etiqueta);
  };

  // Reverso del documento de dos caras elegido: leer frente+reverso juntos.
  const manejarSeleccionReversoDoc = async () => {
    const reversoOriginal = inputReversoDocRef.current?.files?.[0] || null;
    const pendiente = reversoPendiente;
    setReversoPendiente(null);
    if (inputReversoDocRef.current) inputReversoDocRef.current.value = '';
    if (!pendiente) return;
    const reverso = reversoOriginal ? await comprimirImagen(reversoOriginal) : null;
    if (reverso && !validarArchivoIA(reverso)) return;
    leerDocumentoConIA(
      pendiente.tipo,
      pendiente.esquema,
      [pendiente.anverso, reverso || undefined].filter(Boolean) as File[],
      pendiente.etiqueta
    );
  };

  /** «Es la misma persona»: copia un documento del CONDUCTOR (cédula o
   * certificado bancario) al propietario/tenedor sin gastar otra lectura de
   * IA. El backend copia el blob (frente+reverso si aplica) con nomenclatura
   * propia de la figura destino y devuelve la lectura IA del conductor; con
   * ella se autollenan los datos de la figura (respetando lo escrito a mano). */
  const reutilizarDocumentoConductor = async (
    documento: 'cedula' | 'certificado_bancario',
    figura: 'propietario' | 'tenedor',
    etiqueta: string,
  ) => {
    setLeyendoCedula(true);
    setEtiquetaLecturaIA(etiqueta);
    try {
      const body = new FormData();
      body.append('placa', placa);
      body.append('figura', figura);
      body.append('documento', documento);
      if (editarAprobado && idUsuario) body.append('editado_por', idUsuario);
      const resp = await fetch(`${API_BASE}/vehiculos/reutilizar-documento`, { method: 'PUT', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo reutilizar el documento.');

      const tipoSubida = documento === 'cedula'
        ? (figura === 'propietario' ? 'documentoIdentidadPropietario' : 'documentoIdentidadTenedor')
        : (figura === 'propietario' ? 'propCertificacionBancaria' : 'tenedCertificacionBancaria');
      setDocsSubidos(prev => ({
        ...prev,
        [tipoSubida]: data.url,
        ...(data.url_reverso ? { [`${tipoSubida}Reverso`]: data.url_reverso } : {}),
      }));

      // Autollenar los datos de la figura. Prioridad: lectura IA del
      // conductor (la devolvió el backend); si no hay, los campos del
      // formulario. Nunca pisa lo escrito a mano (regla de aplicarLecturaIA).
      const prefijo = figura === 'propietario' ? 'prop' : 'tened';
      let aplicados = 0;
      if (documento === 'cedula') {
        const mapear = MAPEOS_IA[`cedula_${figura}`];
        if (data.lectura_ia && data.lectura_ia.datos && mapear) {
          const nuevos = mapear(data.lectura_ia.datos);
          aplicarLecturaIA(nuevos);
          aplicados = Object.keys(nuevos).length;
        } else {
          // Fallback sin lectura IA: clonar los campos de identidad del conductor.
          const clones: Record<string, string> = {};
          const nombreCompleto = [
            formData['condPrimerApellido'], formData['condSegundoApellido'], formData['condNombres'],
          ].filter(Boolean).join(' ').toUpperCase().replace(/\s+/g, ' ').trim();
          if (nombreCompleto) clones[`${prefijo}Nombre`] = nombreCompleto;
          if (formData['condCedulaCiudadania']) {
            clones[`${prefijo}Documento`] = formData['condCedulaCiudadania'];
            clones[`${prefijo}TipoDocumento`] = 'CÉDULA DE CIUDADANÍA';
          }
          if (formData['condExpedidaEn']) {
            clones[`${prefijo}CiudadExpDoc`] = formData['condExpedidaEn'];
            const depto = buscarDepartamentoPorCiudad(formData['condExpedidaEn']);
            if (depto) clones[`${prefijo}DeptoExpedida`] = depto;
          }
          if (Object.keys(clones).length > 0) {
            aplicarLecturaIA(clones);
            aplicados = Object.keys(clones).length;
          }
        }
      } else {
        // Certificado bancario: lectura IA (banco/tipo/número) o clon de los
        // campos del conductor.
        const mapear = MAPEOS_IA[`certificado_bancario_${figura}`];
        if (data.lectura_ia && data.lectura_ia.datos && mapear) {
          const nuevos = mapear(data.lectura_ia.datos);
          aplicarLecturaIA(nuevos);
          aplicados = Object.keys(nuevos).length;
        } else {
          const clones: Record<string, string> = {};
          if (formData['condBanco']) clones[`${prefijo}Banco`] = formData['condBanco'];
          if (formData['condTipoCuenta']) clones[`${prefijo}TipoCuenta`] = formData['condTipoCuenta'];
          if (formData['condNumeroCuenta']) clones[`${prefijo}NumeroCuenta`] = formData['condNumeroCuenta'];
          if (Object.keys(clones).length > 0) {
            aplicarLecturaIA(clones);
            aplicados = Object.keys(clones).length;
          }
        }
      }

      const nombreDoc = documento === 'cedula' ? 'cédula' : 'certificado bancario';
      setLeyendoCedula(false);
      await Swal.fire({
        icon: 'success',
        title: 'Documento reutilizado',
        html: `Guardamos una copia como <b>${nombreDoc} del ${figura}</b> (${aplicados > 0 ? `${aplicados} campo(s) llenados` : 'sin datos para llenar — revisa el formulario'}).${data.url_reverso ? '<br/>Incluye el reverso.' : ''}`,
        confirmButtonColor: '#27ae60',
      });
    } catch (error: any) {
      setLeyendoCedula(false);
      Swal.fire({
        icon: 'error',
        title: 'No pudimos reutilizar el documento',
        text: error?.message || 'Intenta de nuevo o carga el documento de esa figura.',
        confirmButtonColor: '#d33',
      });
    }
  };

  // Al tocar un botón de documento de la tarjeta IA: elegir cómo cargar.
  // «Tomar foto» abre la cámara DENTRO de la página (getUserMedia) — en varios
  // celulares la entrada Cámara del selector de Android muere con «memoria
  // insuficiente» (la app de cámara del sistema no cabe en RAM junto a la
  // pestaña) y la foto nunca llega. «Adjuntar» abre el selector de archivos
  // (galería/PDF) tal como antes.
  const solicitarLecturaDocumento = (tipo: string) => {
    const opcion = OPCIONES_LECTURA_IA.find(o => o.tipo === tipo);
    if (!opcion) return;
    const etiqueta = opcion.etiqueta.replace(/^[^\s]+\s/, '');
    // RUT (soloPdf): directo al selector de archivos con accept PDF — se
    // descarga de la DIAN, no se fotografía; sin opción de cámara.
    if (opcion.soloPdf) {
      setTipoLecturaPendiente(tipo);
      if (inputDocumentoRef.current) inputDocumentoRef.current.accept = 'application/pdf';
      setTimeout(() => inputDocumentoRef.current?.click(), 0);
      return;
    }
    if (inputDocumentoRef.current) inputDocumentoRef.current.accept = 'image/jpeg, image/png, image/jpg, application/pdf';
    // Cédula o certificado bancario de propietario/tenedor: si el del
    // conductor ya está cargado, ofrecer reutilizarlo (misma persona) — copia
    // el archivo ya guardado y autollena SIN gastar otra lectura de IA.
    const reutilizable = REUTILIZABLES_CONDUCTOR[tipo];
    if (reutilizable && docsSubidos[reutilizable.campoConductor]) {
      const { figura, documento, nombreDoc, femenino } = reutilizable;
      Swal.fire({
        icon: 'question',
        title: etiqueta,
        html: `¿El ${figura} es la <b>misma persona</b> que el conductor?<br/><span style="font-size:0.85em; color:#5a6472">Si es así, usamos el ${nombreDoc} que ya cargaste${documento === 'cedula' ? ' (con su reverso)' : ''}: <b>sin foto ni lectura IA</b>, y llenamos sus datos automáticamente.</span>`,
        showDenyButton: true,
        showCloseButton: true,
        confirmButtonText: '♻️ Sí, es la misma persona',
        denyButtonText: `📷 No, cargar ${femenino ? 'otra' : 'otro'}`,
        confirmButtonColor: '#27ae60',
        denyButtonColor: '#2c5f9e',
        reverseButtons: true,
      }).then(async res => {
        if (res.isConfirmed) {
          await reutilizarDocumentoConductor(documento, figura, etiqueta);
        } else if (res.isDenied) {
          setTipoLecturaPendiente(tipo);
          setTimeout(() => inputDocumentoRef.current?.click(), 0);
        }
      });
      return;
    }
    Swal.fire({
      icon: 'question',
      title: `${etiqueta}`,
      html: `¿Cómo quieres cargar el documento?<br/><span style="font-size:0.85em; color:#5a6472">Si tu celular dice «memoria insuficiente» con la cámara normal, usa <b>Tomar foto</b> (cámara integrada, más liviana).</span>`,
      showDenyButton: true,
      showCloseButton: true,
      confirmButtonText: '📷 Tomar foto',
      denyButtonText: '📎 Adjuntar (galería/PDF)',
      confirmButtonColor: '#2c5f9e',
      denyButtonColor: '#7f8c8d',
      reverseButtons: true,
    }).then(res => {
      if (res.isConfirmed) {
        setTipoLecturaPendiente(tipo);
        setCamaraAbierta({ etiqueta, modo: 'frente' });
      } else if (res.isDenied) {
        setTipoLecturaPendiente(tipo);
        setTimeout(() => inputDocumentoRef.current?.click(), 0);
      } else if (res.dismiss === Swal.DismissReason.close) {
        setTipoLecturaPendiente(null);
      }
    });
  };

  // Foto tomada con la cámara integrada: sigue el MISMO camino que un archivo
  // elegido (compresión ya aplicada en la captura, ~1600px JPEG).
  const manejarCapturaCamara = async (archivo: File) => {
    const modo = camaraAbierta?.modo;
    const etiqueta = camaraAbierta?.etiqueta || '';
    setCamaraAbierta(null);
    if (modo === 'reverso' && reversoPendiente) {
      await manejarReversoElegidoCon(archivo);
      return;
    }
    // Frente: mismo tratamiento que manejarSeleccionDocumento.
    if (!validarArchivoIA(archivo)) {
      setTipoLecturaPendiente(null);
      return;
    }
    const tipo = tipoLecturaPendiente;
    if (!tipo) return;
    const opcion = OPCIONES_LECTURA_IA.find(o => o.tipo === tipo);
    if (!opcion) return;
    if (['cedula', 'cedula_propietario', 'cedula_tenedor', 'licencia', 'tarjeta_propiedad'].includes(tipo)) {
      Swal.fire({
        icon: 'info',
        title: 'Ahora el REVERSO',
        html: `El FRENTE de la ${etiqueta.toLowerCase()} está listo.<br/>Este documento tiene <b>dos caras y ambas son obligatorias</b>: toma ahora la foto del <b>reverso</b>.`,
        confirmButtonText: '📷 Tomar reverso',
        confirmButtonColor: '#2c5f9e',
        allowOutsideClick: false,
      }).then(() => {
        setReversoPendiente({ tipo: opcion.tipo, esquema: opcion.esquema, etiqueta, anverso: archivo });
        setCamaraAbierta({ etiqueta: `${etiqueta} — REVERSO`, modo: 'reverso' });
      });
      return;
    }
    leerDocumentoConIA(opcion.tipo, opcion.esquema, [archivo], etiqueta);
  };

  // Reverso llegado por cámara integrada (espejo de manejarSeleccionReversoDoc
  // pero con el File directamente, sin input).
  const manejarReversoElegidoCon = async (reverso: File) => {
    const pendiente = reversoPendiente;
    setReversoPendiente(null);
    if (!pendiente) return;
    if (!validarArchivoIA(reverso)) return;
    leerDocumentoConIA(
      pendiente.tipo,
      pendiente.esquema,
      [pendiente.anverso, reverso].filter(Boolean) as File[],
      pendiente.etiqueta
    );
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  // La fecha del backend llega ISO sin zona (naive UTC): se interpreta como
  // UTC y se muestra en hora de Colombia.
  const formatoFechaFirma = (iso: string): string => {
    try {
      return new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short',
      });
    } catch { return iso; }
  };

  /**
   * FIRMA ELECTRÓNICA con evidencia sellada (Ley 1955 art. 76 / Dec. 1499):
   * en un solo request (PUT /vehiculos/firmar) sube la imagen Y sella el
   * registro inmutable — hash SHA-256 de los datos declarados, fecha UTC,
   * IP y user-agent. Retorna la fecha ISO del sellado.
   */
  const firmarAhora = async (): Promise<string> => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      throw new Error('Dibuja tu firma antes de firmar.');
    }
    const dataURL = sigCanvas.current.getCanvas().toDataURL('image/webp');
    const blob = dataURLtoBlob(dataURL);
    const fileFirma = new File([blob], 'firma_conductor.webp', { type: 'image/webp' });
    const body = new FormData();
    body.append('archivo', fileFirma);
    body.append('placa', placa);
    if (idUsuario) body.append('id_usuario', idUsuario);
    if (editarAprobado && idUsuario) body.append('editado_por', idUsuario);

    const resp = await fetch(`${API_BASE}/vehiculos/firmar`, { method: 'PUT', body });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.detail || 'No se pudo registrar la firma.');
    if (data.url) setFormData(prev => ({ ...prev, firmaUrl: data.url }));
    if (data.firmado_en) setFirmaSellada({ firmado_en: data.firmado_en, version: data.version ?? 1 });
    return data.firmado_en || '';
  };

  // Botón «Firmar»: acto explícito e informado (qué firma y cuándo quedó sellado).
  const manejarFirmar = async () => {
    setIsLoading(true);
    try {
      const firmadoEn = await firmarAhora();
      await Swal.fire({
        icon: 'success',
        title: 'Firma registrada',
        html: `Firmaste electrónicamente el <b>${formatoFechaFirma(firmadoEn)}</b>.<br/>
               <span style="font-size:0.85em; color:#666">La firma quedó sellada con el hash de tus datos
               y la fecha exacta, como evidencia inmutable.</span>`,
        confirmButtonColor: '#27ae60',
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo firmar', text: error?.message || 'Intenta de nuevo.', confirmButtonColor: '#d33' });
    } finally {
      setIsLoading(false);
    }
  };

  const limpiarFirma = () => {
    if (sigCanvas.current) sigCanvas.current.clear();
  };

  // Campos de DOCUMENTOS que viven en el vehículo pero que ESTE formulario no
  // controla: subir-documento/eliminar-documento son sus dueños. Si se enviaran
  // (ej. el autoguardado con un valor null viejo cargado al montar), pisarían
  // con "" la URL recién subida. Nunca se mandan desde aquí.
  const CAMPOS_DOCUMENTOS_PROTEGIDOS = [
    'documentoIdentidadConductor', 'documentoIdentidadPropietario', 'documentoIdentidadTenedor',
    'licencia', 'tarjetaPropiedad', 'soat', 'revisionTecnomecanica', 'tarjetaRemolque',
    'polizaResponsabilidad', 'planillaEpsArl', 'condFoto',
    'condCertificacionBancaria', 'propCertificacionBancaria', 'tenedCertificacionBancaria',
    'documentoAcreditacionTenedor', 'rutTenedor', 'rutPropietario', 'fotos', 'firmaUrl',
    // Reversos de documentos de dos caras (mismo blindaje que sus frentes).
    'documentoIdentidadConductorReverso', 'documentoIdentidadPropietarioReverso',
    'documentoIdentidadTenedorReverso', 'licenciaReverso', 'tarjetaPropiedadReverso',
    // Sello de la firma electrónica: solo /vehiculos/firmar lo escribe.
    'firmaEvidencia',
  ];

  /**
   * Envía los datos del formulario al backend SIN interactuar con el usuario.
   * La comparten el autoguardado (debounce) y los botones (que agregan Swals).
   * Nunca envía campos de documentos (sus dueños son los endpoints de subida).
   * Retorna true si el guardado fue exitoso.
   */
  const guardarDatos = async (): Promise<boolean> => {
    const datos = formDataRef.current;
    const { firma, firmaUrl, ...restFormData } = datos;
    void firma; void firmaUrl;
    const cleanedFormData: any = Object.fromEntries(
      Object.entries(restFormData)
        .filter(([key]) => !CAMPOS_DOCUMENTOS_PROTEGIDOS.includes(key))
        .map(([key, value]) => [key, value || ""])
    );

    // Referencias adicionales: solo las que tengan algo diligenciado (empresa
    // o celular) — una tarjeta vacía no debe dejar basura en el doc. El array
    // se envía SIEMPRE (vacío incluido) para que QUITAR referencias también
    // persista; el backend iguala «vacío» con «ausente» en el diff.
    const refsLimpias = refsAdicionalesRef.current
      .map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v || '').toString().trim()])))
      .filter(r => r.empresa || r.celular);
    cleanedFormData.referenciasAdicionales = refsLimpias;

    // Los flags de figuras ya no se envían: la igualdad se infiere por dígitos
    // (los históricos que los tengan en BD siguen respetándose en el backend).
    const urlGuardado = new URL(`${API_BASE}/vehiculos/actualizar-informacion/${placa}`);
    if (editarAprobado && idUsuario) urlGuardado.searchParams.set('editado_por', idUsuario);

    try {
      const response = await fetch(urlGuardado.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedFormData),
      });
      if (!response.ok) throw new Error('Fallo al guardar');
      return true;
    } catch {
      return false;
    }
  };

  // Autoguardado: 2.5 s después de la última edición, guardar en silencio.
  useEffect(() => {
    if (cargandoInicialRef.current) return; // No disparar al montar/cargar datos.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setEstadoAutoguardado((prev) => (prev === 'error' ? prev : 'inactivo'));
    debounceRef.current = setTimeout(async () => {
      setEstadoAutoguardado('guardando');
      const ok = await guardarDatos();
      setEstadoAutoguardado(ok ? 'guardado' : 'error');
    }, 2500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, refsAdicionales]);

  // Guardado pendiente al desmontar/salir (mejor esfuerzo).
  useEffect(() => {
    return () => {
      if (debounceRef.current && estadoAutoguardadoRef.current !== 'inactivo') {
        clearTimeout(debounceRef.current);
        void guardarDatos();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Checkbox del remolque: desmarcar con datos ya diligenciados pide
   * confirmación (los campos se limpian y el autoguardado persiste el vacío). */
  const alternarRemolque = () => {
    if (!tieneRemolque) {
      setTieneRemolque(true);
      return;
    }
    const quitar = () => {
      setFormData(prev => ({ ...prev, ...Object.fromEntries(REMOL_FIELDS.map(f => [f, ''])) }));
      setTieneRemolque(false);
    };
    if (REMOL_FIELDS.some(f => (formData[f] || '').trim() !== '')) {
      Swal.fire({
        icon: 'question',
        title: 'Quitar el remolque',
        text: 'Ya diligenciaste datos del remolque: al desmarcar se borrarán.',
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        confirmButtonColor: '#c0392b',
        cancelButtonText: 'Cancelar',
      }).then(res => { if (res.isConfirmed) quitar(); });
      return;
    }
    quitar();
  };

  /** Referencias adicionales: editar un campo de la referencia N. Cambiar el
   * departamento reinicia la ciudad (dependencia depto→ciudad, como la ref #1). */
  const cambiarRefAdicional = (indice: number, clave: string, valor: string) => {
    setRefsAdicionales(prev => prev.map((r, i) => {
      if (i !== indice) return r;
      if (clave === 'antiguedad' && parseInt(valor) > 30) return r;
      const nueva = { ...r, [clave]: valor };
      if (clave === 'departamento') nueva.ciudad = '';
      return nueva;
    }));
  };

  const procesarGuardado = async (esFinalizar: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    // «Continuar» exige los obligatorios completos: los faltantes se marcan en
    // rojo y se hace scroll al primero. («Guardar Progreso» no exige nada.)
    if (esFinalizar) {
        const faltantes = requiredFields.filter(f => !formData[f] || formData[f].trim() === '');
        if (faltantes.length > 0) {
            setCamposError(faltantes);
            const primero = document.querySelector(`[data-campo="${faltantes[0]}"]`);
            if (primero) primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const etiquetas = faltantes.slice(0, 8).map(f => `<li>${etiquetaDeCampo(f)}</li>`).join('');
            const resto = faltantes.length > 8 ? `<li>… y ${faltantes.length - 8} más</li>` : '';
            Swal.fire({
                title: 'Campos obligatorios incompletos',
                html: `Te faltan <b>${faltantes.length}</b> campo(s); quedaron marcados en <b style="color:#e74c3c">rojo</b> en el formulario:<ul style="text-align:left; margin:10px 0 0; padding-left:20px;">${etiquetas}${resto}</ul>`,
                icon: 'warning',
                confirmButtonColor: '#e67e22',
            });
            return;
        }
    }
    // Celulares: los inválidos se marcan en rojo (mismo mecanismo que los
    // obligatorios faltantes) y se lista de quién es cada número.
    const celularesInvalidos = phoneFields.filter(field => (formData[field] || '') && !celularEsValido(formData[field]));
    if (celularesInvalidos.length > 0) {
        setCamposError(prev => [...new Set([...prev, ...celularesInvalidos])]);
        const primero = document.querySelector(`[data-campo="${celularesInvalidos[0]}"]`);
        if (primero) primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const etiquetas = celularesInvalidos.map(f => `<li>${ETIQUETAS_CELULAR[f] || etiquetaDeCampo(f)}</li>`).join('');
        const plural = celularesInvalidos.length > 1 ? 's' : '';
        Swal.fire({
            title: `Número${plural} incorrecto${plural}`,
            html: `Revisa el celular de:<ul style="text-align:left; margin:10px 0 0; padding-left:20px;">${etiquetas}</ul>Quedó marcado en <b style="color:#e74c3c">rojo</b> en el formulario. Colombia debe tener 10 dígitos; con otra región, elige el prefijo (+) y escribe el número local.`,
            icon: "warning",
            confirmButtonColor: '#e67e22',
        });
        return;
    }
    setIsLoading(true);

    try {
      const hasSignatureDrawn = sigCanvas.current && !sigCanvas.current.isEmpty();
      const hasSavedSignature = (formData['firmaUrl'] && formData['firmaUrl'].length > 0) || (formData['firma'] && formData['firma'].length > 0);

      if (esFinalizar && !hasSignatureDrawn && !hasSavedSignature) {
          Swal.fire("Falta la firma", "Para continuar, es OBLIGATORIO que el conductor firme.", "error");
          setIsLoading(false);
          return;
      }

      // Cancelar el autoguardado pendiente: ya se guarda acá.
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (hasSignatureDrawn) {
          // Subida + sellado en un solo acto (firma electrónica con evidencia:
          // hash de los datos, fecha UTC, IP — antes era solo subir-firma).
          try {
              await firmarAhora();
          } catch {
              throw new Error('Fallo al registrar la firma electrónica');
          }
      }

      const ok = await guardarDatos();
      if (!ok) throw new Error("Fallo al guardar los datos");
      setEstadoAutoguardado('guardado');

      if (esFinalizar) {
          Swal.fire({
            title: "¡Datos Completados!",
            text: "Información guardada. Pasando a documentos.",
            icon: "success",
            confirmButtonColor: '#27ae60'
          }).then(() => onSavedSuccess());
      } else {
          Swal.fire({
            title: "Progreso Guardado",
            text: "Datos guardados exitosamente. Puedes volver más tarde.",
            icon: "info",
            confirmButtonColor: '#3498db'
          });
      }
    } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'Error inesperado.', confirmButtonColor: '#d33' });
    } finally { setIsLoading(false); }
  };

  const sections = [
    {
      title: 'Información del Conductor',
      fields: [
        { label: 'Primer Apellido', name: 'condPrimerApellido' },
        { label: 'Segundo Apellido', name: 'condSegundoApellido' },
        { label: 'Nombres', name: 'condNombres' },
        { label: 'Cédula de Ciudadanía', name: 'condCedulaCiudadania' },
        { label: 'Fecha de Nacimiento', name: 'condFechaNacimiento', type: 'date' },
        { label: 'Expedida en (Ciudad) *', name: 'condExpedidaEn' },
        { label: 'Fecha de Expedición Cédula', name: 'condFechaExpedicion', type: 'date' },
        { label: 'Departamento (Residencia)', name: 'condDeptoCiudad', options: departamentosUnicos },
        { label: 'Ciudad (Residencia)', name: 'condCiudad', options: getCiudadesPorDepto(formData['condDeptoCiudad']) },
        { label: 'Dirección', name: 'condDireccion' },
        { label: 'Celular', name: 'condCelular', type: 'text' },
        { label: 'Correo Electrónico', name: 'condCorreo', type: 'email' },
        { label: 'EPS', name: 'condEps', options: epsColombia },
        { label: 'ARL', name: 'condArl', options: arlColombia },
        { label: 'No. Licencia', name: 'condNoLicencia', type: 'number' },
        { label: 'Fecha de Vencimiento', name: 'condFechaVencimientoLic', type: 'date' },
        { label: 'Grupo Sanguíneo RH', name: 'condGrupoSanguineo', options: gruposSanguineos },
        { label: 'Banco', name: 'condBanco', options: bancosColombia },
        { label: 'Tipo de Cuenta', name: 'condTipoCuenta', options: tiposCuenta },
        { label: 'No. de Cuenta', name: 'condNumeroCuenta', type: 'text', inputProps: { inputMode: 'numeric' as const } },
      ],
    },
    {
      title: 'En Caso de Emergencia Avisar a',
      fields: [
        { label: 'Nombre', name: 'condNombreEmergencia' },
        { label: 'Celular', name: 'condCelularEmergencia', type: 'text' },
        { label: 'Parentesco', name: 'condParentescoEmergencia', options: parentescos },
      ],
    },
    {
      title: 'Referencias Laborales',
      fields: [
        { label: 'Empresa', name: 'condEmpresaRef' },
        { label: 'Celular', name: 'condCelularRef', type: 'text' },
        { label: 'Departamento', name: 'condDeptoCiudadRef', options: departamentosUnicos },
        { label: 'Ciudad', name: 'condCiudadRef', options: getCiudadesPorDepto(formData['condDeptoCiudadRef']) },
        { label: 'Nro. Viajes', name: 'condNroViajesRef', type: 'number' },
        { label: 'Años Antigüedad', name: 'condAntiguedadRef', type: 'number', inputProps: { min: 0, max: 30 } },
        { label: 'Merc. Transportada', name: 'condMercTransportada' },
      ],
    },
    {
      title: 'Datos del propietario',
      fields: [
        { label: 'Tipo de Documento', name: 'propTipoDocumento', options: tiposDocumentoRut },
        { label: 'Nombre/Razón', name: 'propNombre' },
        { label: 'Número documento', name: 'propDocumento', type: 'number' },
        { label: 'Departamento (Expedida)', name: 'propDeptoExpedida', options: departamentosUnicos },
        { label: 'Expedida en', name: 'propCiudadExpDoc', options: getCiudadesPorDepto(formData['propDeptoExpedida']) },
        { label: 'Correo', name: 'propCorreo', type: 'email' },
        { label: 'Celular', name: 'propCelular', type: 'text' },
        { label: 'Dirección', name: 'propDireccion' },
        { label: 'Departamento', name: 'propDeptoCiudad', options: departamentosUnicos },
        { label: 'Ciudad', name: 'propCiudad', options: getCiudadesPorDepto(formData['propDeptoCiudad']) },
        { label: 'Banco', name: 'propBanco', options: bancosColombia },
        { label: 'Tipo de Cuenta', name: 'propTipoCuenta', options: tiposCuenta },
        { label: 'No. de Cuenta', name: 'propNumeroCuenta', type: 'text', inputProps: { inputMode: 'numeric' as const } },
        { label: 'Inicio de Actividad (RUT)', name: 'propFechaInicioActividad', type: 'date' },
        { label: 'Fecha Expedición RUT', name: 'propFechaExpedicionRut', type: 'date' },
      ],
    },
    {
      title: 'Datos del Tenedor',
      fields: [
        { label: 'Tipo de Documento', name: 'tenedTipoDocumento', options: tiposDocumentoRut },
        { label: 'Nombre/Razón', name: 'tenedNombre' },
        { label: 'Número documento', name: 'tenedDocumento', type: 'number' },
        { label: 'Departamento (Expedida)', name: 'tenedDeptoExpedida', options: departamentosUnicos },
        { label: 'Expedida en', name: 'tenedCiudadExpDoc', options: getCiudadesPorDepto(formData['tenedDeptoExpedida']) },
        { label: 'Correo', name: 'tenedCorreo', type: 'email' },
        { label: 'Celular', name: 'tenedCelular', type: 'text' },
        { label: 'Dirección', name: 'tenedDireccion' },
        { label: 'Departamento', name: 'tenedDeptoCiudad', options: departamentosUnicos },
        { label: 'Ciudad', name: 'tenedCiudad', options: getCiudadesPorDepto(formData['tenedDeptoCiudad']) },
        { label: 'Banco', name: 'tenedBanco', options: bancosColombia },
        { label: 'Tipo de Cuenta', name: 'tenedTipoCuenta', options: tiposCuenta },
        { label: 'No. de Cuenta', name: 'tenedNumeroCuenta', type: 'text', inputProps: { inputMode: 'numeric' as const } },
        { label: 'Inicio de Actividad (RUT)', name: 'tenedFechaInicioActividad', type: 'date' },
        { label: 'Fecha Expedición RUT', name: 'tenedFechaExpedicionRut', type: 'date' },
      ],
    },
    {
      title: 'Datos del Vehiculo',
      fields: [
        { label: 'Modelo', name: 'vehModelo', type: 'number', inputProps: { min: 1990, max: 2026 } },
        { label: 'Marca', name: 'vehMarca' },
        { label: "Tipo Carroceria", name: "vehTipoCarroceria", options: tiposCarroceria },
        { label: 'Línea', name: 'vehLinea' },
        { label: 'Color', name: 'vehColor' },
        { label: 'Nº Licencia de Tránsito', name: 'vehNoLicTransito', type: 'number' },
        { label: 'Clase de Vehículo', name: 'vehClase' },
        { label: 'Cilindraje (c.c.)', name: 'vehCilindraje', type: 'number' },
        { label: 'Servicio', name: 'vehServicio', options: serviciosVehiculo },
        { label: 'Combustible', name: 'vehCombustible', options: combustiblesVehiculo },
        { label: 'Capacidad Pasajeros', name: 'vehCapPasajeros', type: 'number', inputProps: { min: 0, max: 80 } },
        { label: 'Potencia', name: 'vehPotencia', type: 'text', inputProps: { placeholder: 'Ej: 15 HP' } },
        { label: 'VIN', name: 'vehVin' },
        { label: 'Nº Chasis', name: 'vehChasis' },
        { label: 'Nº Motor', name: 'vehMotor' },
        { label: 'Nº Puertas', name: 'vehPuertas', type: 'number', inputProps: { min: 0, max: 8 } },
        { label: 'Fecha de Matrícula', name: 'vehFechaMatricula', type: 'date' },
        { label: 'Organismo de Tránsito', name: 'vehOrganismoTransito' },
        { label: 'Blindaje', name: 'vehBlindaje', options: ["Sí", "No"] },
        { label: 'Limitación a la Propiedad', name: 'vehLimitacionProp', options: ["Sí", "No"] },
        { label: 'Código Licencia (LT)', name: 'vehCodigoLicTransito', type: 'text', inputProps: { placeholder: 'Ej: LT02004908588' } },
        { label: 'Repotenciado', name: 'vehRepotenciado', options: ["Sí", "No"] },
        { label: 'Año Repotenciacion', name: 'vehAno', type: 'number', inputProps: { min: 1990, max: ANIO_ACTUAL } },
        { label: 'Empresa Satelital', name: 'vehEmpresaSat' },
        { label: 'Usuario Satelital', name: 'vehUsuarioSat' },
        { label: 'Clave Satelital', name: 'vehClaveSat' },
        {
          label: 'Aseguradora SOAT',
          name: 'vehAseguradoraSoat',
          // Si la IA leyó una aseguradora fuera del catálogo, se agrega como
          // opción para que el select la MUESTRE (si no coincide, pinta blanco).
          options: formData['vehAseguradoraSoat'] && !aseguradorasSoat.includes(formData['vehAseguradoraSoat'])
            ? [...aseguradorasSoat, formData['vehAseguradoraSoat']]
            : aseguradorasSoat,
        },
        { label: 'Póliza SOAT', name: 'vehPolizaSoat', type: 'text', inputProps: { inputMode: 'numeric' as const } },
        { label: 'Vence SOAT', name: 'vehVencimientoSoat', type: 'date' },
      ],
    },
    {
      title: 'Datos del Remolque (Opcional)',
      fields: [
        { label: 'Placa Remolque', name: 'RemolPlaca' },
        { label: 'Modelo', name: 'RemolModelo', type: 'number' },
        { label: 'Clase/config', name: 'RemolClase' },
        { label: "Tipo Carroceria", name: "RemolTipoCarroceria", options: tiposCarroceria },
        { label: 'Alto (m)', name: 'RemolAlto', type: 'number', inputProps: { min: 1, max: 30 } },
        { label: 'Largo (m)', name: 'RemolLargo', type: 'number', inputProps: { min: 1, max: 30 } },
        { label: 'Ancho (m)', name: 'RemolAncho', type: 'number', inputProps: { min: 1, max: 30 } },
      ],
    },
  ];

  // Etiqueta legible de un campo (para el Swal de campos faltantes).
  const etiquetaDeCampo = (name: string): string => {
    if (name === 'condCategoriaLic') return 'Categorías de la licencia';
    for (const sec of sections) {
      const f = sec.fields.find(fld => fld.name === name);
      if (f) return f.label;
    }
    return name;
  };

  // Avance individual por figura: % de campos OBLIGATORIOS llenos del grupo
  // (misma regla que el avance global, para que los 4 sumen el total).
  const avancesPorGrupo = GRUPOS_AVANCE.map(grupo => {
    const campos = [
      ...(grupo.extra || []),
      ...sections
        .filter(s => grupo.titulos.includes(s.title))
        .flatMap(s => s.fields.map(f => f.name)),
    ].filter(name => requiredFields.includes(name));
    const llenos = campos.filter(f => formData[f] && formData[f].trim() !== '').length;
    return { etiqueta: grupo.etiqueta, pct: campos.length ? Math.round((llenos / campos.length) * 100) : 0 };
  });

  return (
    <div className="Datos-contenedor">
      <div className="Datos-avance-container">
        <div className="Datos-avance-fila">
          <span className="Datos-avance-texto">Avance: {calcularAvance()}%</span>
          <div className="Datos-barra-avance">
            <div className="Datos-progreso" style={{ width: `${calcularAvance()}%` }}></div>
          </div>
          {calcularAvance() < 100 && (
            <span className="Datos-avance-faltan" style={{ display: 'block', fontSize: '0.85rem', color: '#e67e22', marginTop: '6px' }}>
              Faltan {requiredFields.filter(f => !formData[f] || formData[f].trim() === '').length} campos obligatorios (*)
            </span>
          )}
          {estadoAutoguardado !== 'inactivo' && (
            <span className={`Datos-autoguardado Datos-autoguardado--${estadoAutoguardado}`}>
              {estadoAutoguardado === 'guardando' && (<><span className="Datos-autoguardado-spinner" /> Guardando…</>)}
              {estadoAutoguardado === 'guardado' && (<>✓ Guardado automático</>)}
              {estadoAutoguardado === 'error' && (<>⚠ No se pudo autoguardar — usa «Guardar Progreso»</>)}
            </span>
          )}
        </div>
      </div>

      {/* Avance individual por figura (mismos campos obligatorios que el total).
          FUERA del contenedor sticky: se oculta al hacer scroll; solo el
          avance general queda fijo arriba. */}
      <div className="Datos-avance-grupos">
        {avancesPorGrupo.map(g => (
          <div key={g.etiqueta} className="Datos-avance-grupo">
            <span className="Datos-avance-grupo-texto">
              {g.etiqueta} <b>{g.pct}%</b>
            </span>
            <div className="Datos-barra-avance Datos-barra-avance--mini">
              <div className="Datos-progreso" style={{ width: `${g.pct}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* --- LECTURA DE DOCUMENTOS CON IA (guarda el documento Y autollena) --- */}
      <div className="Datos-iaCedula">
        <div className="Datos-iaCedula-header">
          <span className="Datos-iaCedula-titulo">⚡ Ahorra tiempo</span>
          <span className="Datos-iaCedula-sub">
            Toma una foto (o sube el PDF) de un documento: lo <b>guardamos</b> y llenamos
            los campos por ti. Igual podrás revisar y editar todo. 
          </span>
        </div>
        <div className="Datos-iaCedula-acciones">
          {OPCIONES_LECTURA_IA.map(opcion => {
            const tipoSubida = opcion.tipo === 'cedula'
              ? 'documentoIdentidadConductor'
              : LECTURA_IA_A_TIPO_SUBIDA[opcion.tipo];
            // TODAS las cédulas + licencia + tarjeta: dos caras OBLIGATORIAS
            // (el ✓ exige frente y reverso).
            const dosCaras = ['cedula', 'cedula_propietario', 'cedula_tenedor', 'licencia', 'tarjeta_propiedad'].includes(opcion.tipo);
            // Dos caras obligatorias: el ✓ solo con FRENTE y REVERSO subidos.
            const listo = Boolean(
              tipoSubida && docsSubidos[tipoSubida]
              && (!dosCaras || docsSubidos[`${tipoSubida}Reverso`])
            );
            return (
              <span key={opcion.tipo} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className={`Datos-iaDoc-boton ${listo ? 'Datos-iaDoc-listo' : ''}`}
                  onClick={() => solicitarLecturaDocumento(opcion.tipo)}
                  disabled={leyendoCedula}
                  title={listo ? 'Documento cargado — toca para reemplazarlo' : (dosCaras ? 'Frente y reverso (opcional)' : undefined)}
                >
                  <span className="Datos-iaDoc-texto">{opcion.etiqueta}</span>
                  {listo && <span className="Datos-iaDoc-badge" title="Documento cargado">✓</span>}
                </button>
                {listo && (
                  <button
                    type="button"
                    className="Datos-iaDoc-ver"
                    onClick={() => {
                      setVerCaraIA({
                        frente: docsSubidos[tipoSubida],
                        reverso: docsSubidos[`${tipoSubida}Reverso`],
                        etiqueta: opcion.etiqueta.replace(/^[^\s]+\s/, ''),
                      });
                    }}
                    title={docsSubidos[`${tipoSubida}Reverso`] ? 'Ver el documento (gira al respaldo)' : 'Ver el documento subido (foto o PDF)'}
                  >
                    👁
                  </button>
                )}
              </span>
            );
          })}
          {/* Input oculto para el resto de tipos de documento (foto o PDF).
              accept explícito (no image/*): en Android reduce el procesamiento
              de la foto al volver de la cámara y evita ofrecer HEIC/WebP que la
              validación rechazaría. Los tipos soloPdf (RUT) lo estrechan a
              solo PDF desde el onClick del botón. */}
          <input
            ref={inputDocumentoRef}
            type="file"
            accept="image/jpeg, image/png, image/jpg, application/pdf"
            onChange={manejarSeleccionDocumento}
            style={{ display: 'none' }}
          />
          {/* Input oculto para el REVERSO de licencia/tarjeta de propiedad. */}
          <input
            ref={inputReversoDocRef}
            type="file"
            accept="image/jpeg, image/png, image/jpg, application/pdf"
            onChange={manejarSeleccionReversoDoc}
            style={{ display: 'none' }}
          />
        </div>
        {camposLecturaIA.length > 0 && !leyendoCedula && (
          <div className="Datos-iaCedula-ok">
            ✓ {camposLecturaIA.length} campos llenados con IA — revísalos en el formulario antes de continuar.
          </div>
        )}
      </div>

      <div className="Datos-Form-datos-generales">
        {sections.map(({ title, fields }) => (
          <div key={title}>
            {title === "Información del Conductor" && (
              (() => {
                const catsActivas = (formData['condCategoriaLic'] || '').split(',').map(s => s.trim()).filter(Boolean);
                const catsError = camposError.includes('condCategoriaLic');
                return (
                  <div
                    className={`Datos-categorias-lic ${catsError ? 'Datos-categorias-lic--error' : ''}`}
                    data-campo="condCategoriaLic"
                  >
                    <label className="Datos-categorias-lic-label">
                      Categorías de la licencia (marca TODAS las que tengas) <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
                    <div className="Datos-categorias-lic-chips">
                      {categoriasLicencia.map(cat => (
                        <label
                          key={cat}
                          className={`Datos-categoria-chip ${catsActivas.includes(cat) ? 'Datos-categoria-chip--activo' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={catsActivas.includes(cat)}
                            onChange={() => toggleCategoriaLic(cat)}
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}
            {title === REMOL_TITULO ? (
              /* Remolque: sección colapsada tras un checkbox — la mayoría de
                 conductores no tiene remolque (por eso es opcional). */
              <div className="Datos-form-section Datos-form-section--vehiculo">
                <h4>Datos del Remolque (Opcional)</h4>
                <label className="Datos-remolque-toggle">
                  <input
                    type="checkbox"
                    checked={tieneRemolque}
                    onChange={alternarRemolque}
                  />
                  Mi vehículo tiene remolque
                </label>
                {tieneRemolque && (
                  <div className="Datos-fields-container">
                    {fields.map(({ label, name, type, options, inputProps }) => (
                      <InputField
                        key={name}
                        label={label}
                        name={name}
                        type={type}
                        value={formData[name] || ""}
                        onChange={handleChange}
                        options={options}
                        inputProps={inputProps}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : fields.length > 0 && (
              <FormSection
                title={title}
                fields={fields}
                formData={formData}
                handleChange={handleChange}
                className={claseSeccion(title)}
                camposError={camposError}
                requiredFields={requiredFields}
              />
            )}
            {title === 'Referencias Laborales' && (
              <div className="Datos-refs-adicionales">
                {refsAdicionales.map((ref, indice) => (
                  <div key={`ref-adicional-${indice}`} className="Datos-ref-adicional">
                    <div className="Datos-ref-adicional-header">
                      <h4>Referencia adicional {indice + 2}</h4>
                      <button
                        type="button"
                        className="Datos-ref-adicional-quitar"
                        onClick={() => setRefsAdicionales(prev => prev.filter((_, i) => i !== indice))}
                        title="Quitar esta referencia"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                    <div className="Datos-fields-container">
                      {CAMPOS_REF_ADICIONAL.map(({ label, clave, type }) => (
                        <div key={clave} className="Datos-input-container">
                          <label>{label}</label>
                          <input
                            type={type || 'text'}
                            inputMode={clave === 'celular' || clave === 'nroViajes' || clave === 'antiguedad' ? 'numeric' : undefined}
                            value={ref[clave] || ''}
                            onChange={(e) => cambiarRefAdicional(indice, clave, e.target.value)}
                          />
                        </div>
                      ))}
                      <div className="Datos-input-container">
                        <label>Departamento</label>
                        <select
                          value={ref.departamento || ''}
                          onChange={(e) => cambiarRefAdicional(indice, 'departamento', e.target.value)}
                        >
                          <option value="">Seleccione…</option>
                          {departamentosUnicos.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="Datos-input-container">
                        <label>Ciudad</label>
                        <select
                          value={ref.ciudad || ''}
                          onChange={(e) => cambiarRefAdicional(indice, 'ciudad', e.target.value)}
                          disabled={!ref.departamento}
                        >
                          <option value="">{ref.departamento ? 'Seleccione…' : 'Elige departamento primero'}</option>
                          {getCiudadesPorDepto(ref.departamento || '').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                {refsAdicionales.length < MAX_REFERENCIAS_ADICIONALES && (
                  <button
                    type="button"
                    className="Datos-ref-agregar"
                    onClick={() => setRefsAdicionales(prev => [...prev, refAdicionalVacia()])}
                  >
                    ➕ Agregar otra referencia
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* --- SECCIÓN DE FIRMA --- */}
        <div className="Datos-form-section">
            <h4>Firma del Conductor </h4>
            {formData['firmaUrl'] && !editandoFirma ? (
                <div className="firma-existente-container" style={{textAlign: 'center', padding: '15px', border: '1px solid #27ae60', borderRadius: '8px', backgroundColor: '#e8f8f5'}}>
                    <div style={{color: '#27ae60', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem'}}>Firma Registrada Exitosamente</div>
                    {firmaSellada ? (
                      <div style={{fontSize: '0.82rem', color: '#5a6472', marginTop: '-4px', marginBottom: '10px'}}>
                        ✍️ Firmada electrónicamente el <b>{formatoFechaFirma(firmaSellada.firmado_en)}</b> — evidencia sellada (hash de tus datos + fecha exacta{firmaSellada.version > 1 ? `, firma #${firmaSellada.version}` : ''}).
                      </div>
                    ) : (
                      <div style={{fontSize: '0.82rem', color: '#8a6d3b', marginTop: '-4px', marginBottom: '10px'}}>
                        Firma histórica sin sellado electrónico — usa «Cambiar / Volver a firmar» para firmar con evidencia.
                      </div>
                    )}
                    <img src={formData['firmaUrl']} alt="Firma Conductor" style={{maxWidth: '100%', height: '150px', border: '1px dashed #ccc', marginBottom: '15px', backgroundColor: 'white'}} />
                    <div>
                        <button type="button" className="btn-cambiar-firma" onClick={() => { setEditandoFirma(true); setTimeout(() => limpiarFirma(), 100); }} style={{backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}>
                            Cambiar / Volver a firmar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="firma-nueva-container">
                    <p style={{fontSize: '0.9rem', color: '#4d4d4dff', marginBottom: '10px'}}>{formData['firmaUrl'] ? "Estas en modo edición." : "Dibuja tu firma y pulsa «Firmar»: queda sellada con la fecha exacta y el hash de tus datos (firma electrónica)."}</p>
                    <div className="signature-wrapper" style={{border: '2px dashed #ccc', borderRadius: '8px', overflow: 'hidden'}}>
                        <Suspense fallback={<div style={{height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a94a6', fontSize: '0.9rem'}}>Cargando espacio de firma…</div>}>
                            <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{className: 'signature-canvas', style: {width: '100%', height: '200px'}}} backgroundColor="white" />
                        </Suspense>
                    </div>
                    <div style={{marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        <button type="button" onClick={manejarFirmar} disabled={isLoading} style={{backgroundColor: '#2F6B3E', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}>
                            {isLoading ? 'Sellando…' : '✍️ Firmar'}
                        </button>
                        <button type="button" onClick={limpiarFirma} className="btn-limpiar-firma" style={{backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer'}}>Borrar dibujo</button>
                        {formData['firmaUrl'] && (<button type="button" onClick={() => { setEditandoFirma(false); limpiarFirma(); }} style={{backgroundColor: '#7f8c8d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer'}}>Cancelar edición</button>)}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- BOTONES DE ACCIÓN (FIXED) --- */}
      <div className="Datos-botones-flotantes">
          <button type="button" onClick={(e) => procesarGuardado(false, e)} disabled={isLoading} className="btn-guardar-progreso">
              {isLoading ? "Guardando..." : "Guardar Progreso"}
          </button>
          <button type="button" onClick={(e) => procesarGuardado(true, e)} disabled={isLoading} className="btn-guardar-finalizar">
              {isLoading ? "Procesando..." : "Continuar"}
          </button>
      </div>

      {/* --- VISOR de documento de dos caras (👁 de la tarjeta IA) --- */}
      {verCaraIA && (
        <VerCaraDocumento
          frenteUrl={verCaraIA.frente}
          reversoUrl={verCaraIA.reverso}
          etiqueta={verCaraIA.etiqueta}
          onClose={() => setVerCaraIA(null)}
        />
      )}

      {/* --- CÁMARA INTEGRADA (getUserMedia) para la tarjeta IA --- */}
      {camaraAbierta && (
        <CamaraInterna
          titulo={camaraAbierta.modo === 'reverso'
            ? `${camaraAbierta.etiqueta} — REVERSO`
            : `${camaraAbierta.etiqueta} — FRENTE`}
          onCaptura={manejarCapturaCamara}
          onCancelar={() => {
            // Cancelar el reverso tras haber tomado el frente: subir solo el frente.
            if (camaraAbierta.modo === 'reverso' && reversoPendiente) {
              const pendiente = reversoPendiente;
              setReversoPendiente(null);
              setCamaraAbierta(null);
              leerDocumentoConIA(pendiente.tipo, pendiente.esquema, [pendiente.anverso], pendiente.etiqueta);
            } else {
              setCamaraAbierta(null);
              setTipoLecturaPendiente(null);
            }
          }}
        />
      )}

      {/* --- OVERLAY: lectura IA en curso --- */}
      {leyendoCedula && (
        <div className="Datos-iaLeyendo-overlay">
          <div className="Datos-iaLeyendo-caja">
            <Lottie animationData={animationData} style={{ height: 140, width: 180, margin: 'auto' }} />
            <div className="Datos-iaLeyendo-titulo">Leyendo {etiquetaLecturaIA || 'el documento'}…</div>
            <div className="Datos-iaLeyendo-sub">Estamos guardando el archivo y extrayendo los datos</div>
            <div className="Datos-iaLeyendo-barra"><div className="Datos-iaLeyendo-barra-fill" /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Datos;
