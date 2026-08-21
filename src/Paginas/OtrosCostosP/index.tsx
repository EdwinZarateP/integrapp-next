'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaSearch, FaFileExcel, FaCalendarAlt, FaTimes, FaPlus, FaTrash, FaSave,
  FaPaperPlane, FaCheck, FaUndo, FaBan, FaMoneyBillWave, FaEdit, FaEye, FaWallet,
  FaFileUpload, FaUniversity,
} from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import Swal from 'sweetalert2';
import {
  listarActivos, obtenerDetalleActivo, buscarPedidos, crearSolicitud, editarSolicitud,
  enviarAprobacion, aprobarSolicitud, devolverSolicitud, rechazarSolicitud,
  registrarPago, anularSolicitud, exportarExcel, marcarTramiteVulcano,
  getTiposCosto, getBancos, getTiposCuenta, getClientes,
  exportarPago, importarPago, verificarManifiesto, listarPagables,
  type OtroCosto, type CostoConcepto, type ResultadoBusquedaPedidos, type PedidoEncontrado, type BancoCatalogo,
} from '@/Funciones/ApiPedidos/otrosCostos';
import './estilos.css';

const PERFILES_PERMITIDOS = ['ADMIN', 'OPERATIVO', 'DESPACHADOR', 'COORDINADOR', 'CONTROL', 'FINANCIERO', 'ANALISTA'];
const PERFILES_GLOBALES_OC = ['ADMIN', 'ANALISTA', 'COORDINADOR', 'CONTROL']; // ven todo + dropdown de regional
const LIMITE_COORDINADOR = 500000;
const LIMITE_VALOR_TOTAL = 5000000; // valor total máximo permitido por solicitud

// Bandeja de estados visibles en el dropdown de filtro según el perfil. Se alinea
// con el scope del backend: cada perfil solo ve/filtra los estados de SU bandeja.
const BANDEJA_POR_PERFIL: Record<string, string[]> = {
  ADMIN: ['borrador', 'pendiente_aprobacion', 'devuelto', 'rechazado', 'aprobado', 'pagado', 'anulado'],
  CONTROL: ['pendiente_aprobacion'],
  COORDINADOR: ['pendiente_aprobacion'],
  ANALISTA: ['aprobado'],
  FINANCIERO: ['aprobado'],
  OPERATIVO: ['borrador', 'devuelto', 'pendiente_aprobacion', 'aprobado', 'rechazado'],
  DESPACHADOR: ['borrador', 'devuelto', 'pendiente_aprobacion', 'aprobado', 'rechazado'],
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador', pendiente_aprobacion: 'Pendiente', devuelto: 'Devuelto',
  rechazado: 'Rechazado', aprobado: 'Aprobado', pagado: 'Pagado', anulado: 'Anulado',
};

// Extrae el mensaje de error de una respuesta axios/FastAPI. FastAPI devuelve
// {detail: "..."} para HTTPException, pero para 422 de validación de pydantic
// devuelve {detail: [{loc, msg, type}, ...]} (un array). Esto lo formatea legible.
const extraerErrorApi = (e: any, fallback = 'Ocurrió un error'): string => {
  const d = e?.response?.data?.detail ?? e?.detail;
  if (!d) return e?.message || fallback;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map((x: any) => {
      const campo = Array.isArray(x?.loc) ? x.loc.filter((p: any) => p !== 'body').join('.') : '';
      return campo ? `${campo}: ${x?.msg}` : (x?.msg || JSON.stringify(x));
    }).join(' • ');
  }
  return String(d);
};

// Opciones permitidas en el formulario de Otros Costos.
const TIPOS_VEHICULO_OC = ['CARRY', 'NHR', 'TURBO', 'NIES', 'SENCILLO', 'PATINETA', 'TRACTOMULA'];
const CENTROS_DISTRIBUCION_OC = ['JUAN MINA', 'YUMBO', 'BUCARAMANGA', 'GIRARDOTA', 'FUNZA'];

// Una solicitud = una planilla = un solo pedido de Vulcano. Cuenta cuántos vienen en el texto.
const contarPedidos = (texto: string): number =>
  (texto || '').split(/[,;\-/]/).map((s) => s.trim()).filter(Boolean).length;

const hoyCol = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const formatFecha = (val: any): string => {
  if (!val) return '-';
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else { s = String(val).trim(); if (s && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(val);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
};

const formatMoney = (v: any) => `$${Number(v || 0).toLocaleString('es-CO')}`;

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    borrador: 'OC-est-borrador',
    pendiente_aprobacion: 'OC-est-pendiente',
    devuelto: 'OC-est-devuelto',
    rechazado: 'OC-est-rechazado',
    aprobado: 'OC-est-aprobado',
    pagado: 'OC-est-pagado',
    anulado: 'OC-est-anulado',
  };
  const label: Record<string, string> = {
    borrador: 'Borrador', pendiente_aprobacion: 'Pendiente', devuelto: 'Devuelto',
    rechazado: 'Rechazado', aprobado: 'Aprobado', pagado: 'Pagado', anulado: 'Anulado',
  };
  return <span className={`OC-estadoBadge ${map[estado] || 'OC-est-borrador'}`}>{label[estado] || estado}</span>;
};

interface FormState {
  consecutivo?: string;
  pedido_vulcano_original: string;
  pedido_encontrado: boolean;
  motivo_no_encontrado: string;
  datos_servicio: {
    cliente: string; centro_distribucion: string; fecha_servicio: string;
    piezas: number; peso_real: number; tipo_vehiculo: string; placa: string;
    municipio_destino: string; departamento_destino: string; transportador: string; manifiesto: string;
  };
  costos: CostoConcepto[];
  datos_bancarios: { banco: string; tipo_cuenta: string; numero_cuenta: string; tipo_id_titular: string; cedula_titular: string; nombre_titular: string };
  conductor: { nombre: string; telefono: string };
}

const formVacio = (): FormState => ({
  pedido_vulcano_original: '',
  pedido_encontrado: true,
  motivo_no_encontrado: '',
  datos_servicio: { cliente: '', centro_distribucion: '', fecha_servicio: '', piezas: 0, peso_real: 0, tipo_vehiculo: '', placa: '', municipio_destino: '', departamento_destino: '', transportador: '', manifiesto: '' },
  costos: [{ tipo_costo: '', descripcion: '', valor: 0 }],
  datos_bancarios: { banco: '', tipo_cuenta: '', numero_cuenta: '', tipo_id_titular: 'CC', cedula_titular: '', nombre_titular: '' },
  conductor: { nombre: '', telefono: '' },
});

const OtrosCostosP: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [cargando, setCargando] = useState(true);
  const [items, setItems] = useState<OtroCosto[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 25;

  // Enums
  const [tiposCosto, setTiposCosto] = useState<string[]>([]);
  const [bancos, setBancos] = useState<BancoCatalogo[]>([]);
  const [tiposCuenta, setTiposCuenta] = useState<string[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);

  // Filtros
  const [fEstado, setFEstado] = useState('');
  const [fFechaIni, setFFechaIni] = useState('');
  const [fFechaFin, setFFechaFin] = useState('');
  const [fPedido, setFPedido] = useState('');
  const [fPlaca, setFPlaca] = useState('');
  const [fManifiesto, setFManifiesto] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [fRegional, setFRegional] = useState('');

  // Modal
  const [modalMode, setModalMode] = useState<'detalle' | 'form' | null>(null);
  const [detalle, setDetalle] = useState<OtroCosto | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [motivoDevolucion, setMotivoDevolucion] = useState('');  // último motivo de devolución, para mostrarlo al editar
  const [busqueda, setBusqueda] = useState<ResultadoBusquedaPedidos | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = useState(false);

  // Selección de consecutivos para el archivo bancario (FINANCIERO/ADMIN)
  const [selPago, setSelPago] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  // ── Acceso ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (!PERFILES_PERMITIDOS.includes(p)) { router.replace('/MedicalCare'); return; }
    setUsuario(u);
    setPerfil(p);
    getTiposCosto().then(setTiposCosto).catch(() => {});
    getBancos().then(setBancos).catch(() => {});
    getTiposCuenta().then(setTiposCuenta).catch(() => {});
    getClientes().then(setClientes).catch(() => {});
    cargarListado(u, p);
  }, [router]);

  const cargarListado = useCallback(async (u?: string, p?: string) => {
    const usr = u ?? usuario;
    const per = p ?? perfil;
    if (!usr) return;
    setCargando(true);
    try {
      const data = await listarActivos({
        usuario: usr,
        estado: fEstado || undefined,
        fecha_inicio: fFechaIni || undefined,
        fecha_fin: fFechaFin || undefined,
        pedido: fPedido || undefined,
        placa: fPlaca || undefined,
        manifiesto: fManifiesto || undefined,
        cliente: fCliente || undefined,
        regional: PERFILES_GLOBALES_OC.includes(per) ? (fRegional || undefined) : undefined,
        skip,
        limit,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo cargar el listado'), 'error');
    } finally {
      setCargando(false);
    }
  }, [usuario, perfil, fEstado, fFechaIni, fFechaFin, fPedido, fPlaca, fManifiesto, fCliente, fRegional, skip]);

  // ── Permisos (frontend; el backend vuelve a validar) ─────────────────────
  const puedeCrear = perfil === 'ADMIN' || perfil === 'OPERATIVO' || perfil === 'DESPACHADOR';
  const puedePagar = perfil === 'ADMIN' || perfil === 'FINANCIERO';
  const puedeAnular = perfil === 'ADMIN';
  const puedeAprobar = (valor: number) =>
    perfil === 'ADMIN' || perfil === 'CONTROL' || (perfil === 'COORDINADOR' && valor <= LIMITE_COORDINADOR);
  const puedeRevision = perfil === 'ADMIN' || perfil === 'CONTROL' || perfil === 'COORDINADOR';
  const puedeMarcarTramite = perfil === 'ADMIN' || perfil === 'ANALISTA';
  // Devolver: Control/Coordinador/Admin desde pendiente; Analista/Financiero/Admin desde aprobado.
  // Devolver: Control/Coordinador desde pendiente; Financiero/Admin desde aprobado;
  // Analista solo desde aprobado CON trámite pendiente (una vez marca OK, pasa a Financiero).
  const puedeDevolver = (it: OtroCosto) =>
    (puedeRevision && it.estado === 'pendiente_aprobacion') ||
    ((perfil === 'FINANCIERO' || perfil === 'ADMIN') && it.estado === 'aprobado') ||
    (perfil === 'ANALISTA' && it.estado === 'aprobado' && it.tramite_vulcano !== 'ok');
  // Rechazar: solo desde pendiente_aprobacion (no en devuelto, que ya es del operativo).
  const puedeRechazar = (it: OtroCosto) => puedeRevision && it.estado === 'pendiente_aprobacion';
  // El operativo solo puede editar sus solicitudes en borrador o devueltas.
  // Una vez enviada a aprobación (pendiente_aprobacion) ya no le corresponde
  // editarla: el siguiente paso del flujo es el aprobador. El ADMIN sí puede
  // editar (salvo en estados cerrados aprobado/pagado/anulado).
  const puedeEditar = (it: OtroCosto) =>
    perfil === 'ADMIN'
      ? !['aprobado', 'pagado', 'anulado'].includes(it.estado)
      : ((perfil === 'OPERATIVO' || perfil === 'DESPACHADOR') && it.usuario_registro === usuario && ['borrador', 'devuelto'].includes(it.estado));

  // ── Búsqueda de pedidos ────────────────────────────────────────────────────
  const handleBuscarPedidos = async () => {
    if (!form.pedido_vulcano_original.trim()) {
      Swal.fire('Atención', 'Ingrese el pedido de Vulcano', 'warning');
      return;
    }
    if (contarPedidos(form.pedido_vulcano_original) > 1) {
      Swal.fire('Atención', 'Solo se permite un pedido de Vulcano por solicitud (una planilla).', 'warning');
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarPedidos(usuario, form.pedido_vulcano_original);
      setBusqueda(res);
      const selInicial = new Set(res.pedidos_encontrados.map((p) => p._id_origen));
      setSeleccionados(selInicial);
      // Reemplaza los datos del servicio: llena si hay encontrados, limpia si no hay (para edición manual.
      aplicarSeleccionados(res.pedidos_encontrados, selInicial, res);
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'Error en la búsqueda'), 'error');
    } finally {
      setBuscando(false);
    }
  };

  const aplicarSeleccionados = (encontrados: PedidoEncontrado[], sel: Set<string>, res?: ResultadoBusquedaPedidos) => {
    const data = res ?? busqueda;
    const elegidos = (data?.pedidos_encontrados || encontrados).filter((p) => sel.has(p._id_origen));
    const primero = elegidos[0];
    // Cada nueva búsqueda/selección REEMPLAZA los datos del servicio (no mezcla con valores previos).
    // Así, al buscar un pedido no encontrado los campos quedan limpios para diligenciarlos manualmente.
    setForm((f) => ({
      ...f,
      pedido_encontrado: elegidos.length > 0,
      datos_servicio: {
        cliente: primero?.cliente || '',
        centro_distribucion: primero?.centro_distribucion || '',
        fecha_servicio: primero?.fecha_servicio?.slice(0, 10) || '',
        piezas: elegidos.reduce((a, p) => a + Number(p.piezas || 0), 0),
        peso_real: elegidos.reduce((a, p) => a + Number(p.peso_real || 0), 0),
        tipo_vehiculo: primero?.tipo_vehiculo || '',
        placa: primero?.placa || '',
        municipio_destino: primero?.municipio_destino || '',
        departamento_destino: primero?.departamento_destino || '',
        transportador: primero?.transportador || '',
        manifiesto: primero?.manifiesto || '',
      },
    }));
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      aplicarSeleccionados([], next);
      setForm((f) => ({ ...f, pedido_encontrado: next.size > 0 }));
      return next;
    });
  };

  // ── Advertencia de manifiesto ya usado (contra histórico/anulados) ─────────
  // Consulta el histórico al salir del campo Manifiesto: un manifiesto pagado no
  // debe volver a usarse en una nueva solicitud (avisa, no bloquea).
  const advertirManifiesto = async (manifiesto: string) => {
    const m = (manifiesto || '').trim();
    if (!m) return;
    try {
      const res = await verificarManifiesto(usuario, m);
      if (res.ya_usado) {
        const detalle = res.usos.map((u) =>
          `<li><b>${u.consecutivo}</b> (${u.origen === 'historico' ? 'pagada' : u.origen}, ${u.fecha_pago ? `pago ${u.fecha_pago.slice(0, 10)}` : 'sin fecha de pago'})</li>`,
        ).join('');
        Swal.fire({
          title: '⚠️ Manifiesto ya utilizado',
          html: `El manifiesto <b>${m}</b> ya tiene solicitudes en el histórico. Un manifiesto no debe reutilizarse:<ul style="text-align:left;margin-top:0.5rem">${detalle}</ul>Verifique el número o cancele si es un duplicado.`,
          icon: 'warning',
          confirmButtonColor: '#005f56',
          confirmButtonText: 'Entendido',
        });
      }
    } catch { /* silencioso: la advertencia no bloquea la edición */ }
  };

  // ── Costos ─────────────────────────────────────────────────────────────────
  const valorTotal = form.costos.reduce((a, c) => a + (Number(c.valor) || 0), 0);

  const updateCosto = (i: number, campo: keyof CostoConcepto, value: any) => {
    setForm((f) => {
      const costos = [...f.costos];
      costos[i] = { ...costos[i], [campo]: campo === 'valor' ? Number(value) || 0 : value };
      return { ...f, costos };
    });
  };
  const addCosto = () => setForm((f) => ({ ...f, costos: [...f.costos, { tipo_costo: '', descripcion: '', valor: 0 }] }));
  const removeCosto = (i: number) => setForm((f) => ({ ...f, costos: f.costos.length > 1 ? f.costos.filter((_, idx) => idx !== i) : f.costos }));

  // ── Abrir modales ──────────────────────────────────────────────────────────
  const abrirDetalle = async (it: OtroCosto) => {
    try {
      const d = await obtenerDetalleActivo(it.consecutivo!, usuario);
      setDetalle(d);
      setModalMode('detalle');
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo cargar el detalle'), 'error');
    }
  };

  const abrirNuevo = () => {
    setForm(formVacio());
    setBusqueda(null);
    setSeleccionados(new Set());
    setMotivoDevolucion('');
    setModalMode('form');
  };

  const abrirEditar = async (it: OtroCosto) => {
    try {
      const d = await obtenerDetalleActivo(it.consecutivo!, usuario);
      setForm({
        consecutivo: d.consecutivo,
        pedido_vulcano_original: d.pedido_vulcano_original,
        pedido_encontrado: d.pedido_encontrado,
        motivo_no_encontrado: d.motivo_no_encontrado,
        datos_servicio: { ...d.datos_servicio, fecha_servicio: d.datos_servicio.fecha_servicio || '' },
        costos: d.costos.length ? d.costos : [{ tipo_costo: '', descripcion: '', valor: 0 }],
        datos_bancarios: { ...d.datos_bancarios, tipo_id_titular: d.datos_bancarios?.tipo_id_titular || 'CC' },
        conductor: d.conductor,
      });
      // Motivo de la última devolución (para que el operativo vea por qué la devolvieron al editar).
      const ultDev = (d.historial_movimientos || []).slice().reverse().find((m: any) => m.accion === 'devolucion');
      setMotivoDevolucion(ultDev?.observacion || '');
      setDetalle(d);  // disponibiliza el estado actual (ej. 'devuelto') en el modal de edición
      setBusqueda(null);
      setSeleccionados(new Set());
      setModalMode('form');
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo cargar para editar'), 'error');
    }
  };

  const cerrarModal = () => { setModalMode(null); setDetalle(null); setMotivoDevolucion(''); };

  // ── Guardar (crear/editar) ──────────────────────────────────────────────────
  const validarForm = (enviar: boolean): string | null => {
    if (!form.pedido_vulcano_original.trim()) return 'El pedido de Vulcano es obligatorio.';
    if (contarPedidos(form.pedido_vulcano_original) > 1) return 'Solo se permite un pedido de Vulcano por solicitud (una planilla).';
    if (enviar && !form.datos_servicio.manifiesto.trim()) return 'El manifiesto es obligatorio.';
    if (!form.pedido_encontrado && !form.datos_servicio.placa.trim()) return 'La placa es obligatoria cuando el pedido no se encuentra.';
    if (form.costos.length === 0) return 'Agregue al menos un concepto de costo.';
    for (const c of form.costos) {
      if (!c.tipo_costo) return 'Cada concepto debe tener tipo de costo.';
      if (!c.descripcion.trim()) return 'La descripción es obligatoria.';
      if (!(Number(c.valor) > 0)) return 'El valor de cada costo debe ser mayor que cero.';
    }
    const totalCostos = form.costos.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    if (totalCostos > LIMITE_VALOR_TOTAL) return `El valor total (${formatMoney(totalCostos)}) supera el máximo permitido (${formatMoney(LIMITE_VALOR_TOTAL)}).`;
    if (!form.datos_bancarios.banco) return 'El banco es obligatorio.';
    if (!form.datos_bancarios.numero_cuenta.trim()) return 'El número de cuenta es obligatorio.';
    if (!['CC', 'NIT'].includes(form.datos_bancarios.tipo_id_titular)) return 'El tipo de identificación del titular debe ser CC o NIT.';
    if (!form.datos_bancarios.cedula_titular.trim()) return 'La cédula del titular es obligatoria.';
    if (!form.datos_bancarios.nombre_titular.trim()) return 'El nombre del titular es obligatorio.';
    if (!form.conductor.nombre.trim()) return 'El nombre del conductor es obligatorio.';
    return null;
  };

  const guardar = async (enviar: boolean) => {
    const err = validarForm(enviar);
    if (err) { Swal.fire('Validación', err, 'warning'); return; }
    setGuardando(true);
    try {
      const payload = {
        usuario,
        enviar,
        pedido_vulcano_original: form.pedido_vulcano_original,
        pedidos_normalizados: busqueda?.pedidos_normalizados || [],
        pedido_encontrado: form.pedido_encontrado,
        motivo_no_encontrado: form.motivo_no_encontrado,
        datos_servicio: form.datos_servicio,
        costos: form.costos,
        datos_bancarios: form.datos_bancarios,
        conductor: form.conductor,
      };
      if (form.consecutivo) {
        await editarSolicitud({ ...payload, consecutivo: form.consecutivo });
        if (enviar) {
          Swal.fire('✅ Enviada', `Solicitud ${form.consecutivo} enviada a aprobación`, 'success');
        } else {
          Swal.fire('✅ Guardado', 'Solicitud actualizada', 'success');
        }
      } else {
        const res: any = await crearSolicitud(payload);
        if (res.manifiesto_ya_usado) {
          const usos = (res.usos_manifiesto || []).map((u: any) =>
            `<li><b>${u.consecutivo}</b> (${u.origen === 'historico' ? 'pagada' : u.origen})</li>`,
          ).join('');
          Swal.fire({
            title: '⚠️ Manifiesto ya utilizado',
            html: `Se guardó como <b>${res.consecutivo}</b>, pero el manifiesto <b>${form.datos_servicio.manifiesto}</b> ya fue usado en:<ul style="text-align:left;margin-top:0.5rem">${usos}</ul>Un manifiesto no debe reutilizarse; verifique o anule esta solicitud.`,
            icon: 'warning',
          });
        } else if (res.posible_duplicado) {
          Swal.fire({
            title: '⚠️ Posible duplicado',
            html: `Se guardó como <b>${res.consecutivo}</b>, pero existen solicitudes similares recientes. Verifique.`,
            icon: 'warning',
          });
        } else {
          Swal.fire('✅ Creada', `Solicitud ${res.consecutivo} creada`, 'success');
        }
      }
      cerrarModal();
      cargarListado();
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo guardar'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── Acciones de flujo ──────────────────────────────────────────────────────
  const accion = async (
    fn: (obs: string) => Promise<any>, it: OtroCosto, titulo: string, texto: string,
    input?: 'text' | 'textarea', inputLabel?: string, required?: boolean,
  ) => {
    const cfg: any = {
      title: titulo, html: texto, icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#005f56', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, continuar', cancelButtonText: 'Cancelar',
    };
    if (input) {
      cfg.input = input;
      cfg.inputPlaceholder = inputLabel || '';
      if (required) cfg.inputValidator = (v: string) => (!v || !v.trim()) && 'Este campo es obligatorio';
    }
    const r = await Swal.fire(cfg);
    if (!r.isConfirmed) return;
    const obs = typeof r.value === 'string' ? r.value : '';
    Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      await fn(obs);
      Swal.fire('✅ Listo', 'Acción realizada', 'success');
      cerrarModal();
      cargarListado();
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo realizar la acción'), 'error');
    }
  };

  const onEnviar = (it: OtroCosto) => accion(() => enviarAprobacion(it.consecutivo!, usuario), it, '¿Enviar a aprobación?', `<b>${it.consecutivo}</b> quedará pendiente de aprobación.`);
  const onAprobar = (it: OtroCosto) => accion((obs) => aprobarSolicitud(it.consecutivo!, usuario, obs), it, '¿Aprobar solicitud?', `<b>${it.consecutivo}</b> por ${formatMoney(it.valor_total)}.`, 'text', 'Observación (opcional)');
  const onDevolver = (it: OtroCosto) => accion((obs) => devolverSolicitud(it.consecutivo!, usuario, obs), it, '¿Devolver solicitud?', `<b>${it.consecutivo}</b> volverá al creador para corrección.`, 'textarea', 'Motivo de devolución', true);
  const onRechazar = (it: OtroCosto) => accion((obs) => rechazarSolicitud(it.consecutivo!, usuario, obs), it, '¿Rechazar solicitud?', `<b>${it.consecutivo}</b> será rechazada.`, 'textarea', 'Motivo de rechazo', true);
  const onAnular = (it: OtroCosto) => accion((obs) => anularSolicitud(it.consecutivo!, usuario, obs), it, '¿Anular solicitud?', `<b>${it.consecutivo}</b> será anulada y movida a anulados.`, 'textarea', 'Motivo de anulación', true);

  const onTramiteVulcano = (it: OtroCosto) => {
    const marcarOk = it.tramite_vulcano !== 'ok';
    accion(
      (obs) => marcarTramiteVulcano(it.consecutivo!, usuario, marcarOk ? 'ok' : 'pendiente', obs),
      it,
      marcarOk ? '¿Marcar trámite Vulcano OK?' : '¿Revertir trámite Vulcano?',
      `<b>${it.consecutivo}</b> ${marcarOk ? 'quedará con trámite Vulcano OK y Financiero podrá pagarlo.' : 'volverá a pendiente de trámite; Financiero no podrá pagarlo.'}`,
      'text', 'Observación (opcional)',
    );
  };

  const onPagar = (it: OtroCosto) => {
    Swal.fire({
      title: 'Registrar pago',
      html: `<div style="text-align:left">${formatMoney(it.valor_total)} — <b>${it.consecutivo}</b></div>`,
      icon: 'question', showCancelButton: true,
      confirmButtonColor: '#1d4ed8', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Registrar pago', cancelButtonText: 'Cancelar',
      input: 'text', inputPlaceholder: 'Referencia / comprobante (opcional)',
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        await registrarPago({ consecutivo: it.consecutivo!, usuario, referencia: typeof r.value === 'string' ? r.value : '' });
        Swal.fire('✅ Pagado', 'Pago registrado y movido al histórico', 'success');
        cerrarModal();
        cargarListado();
      } catch (e: any) {
        Swal.fire('Error', extraerErrorApi(e, 'No se pudo registrar el pago'), 'error');
      }
    });
  };

  const onExportExcel = async () => {
    Swal.fire({ title: 'Generando Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const blob = await exportarExcel({
        usuario,
        estado: fEstado || undefined,
        fecha_inicio: fFechaIni || undefined,
        fecha_fin: fFechaFin || undefined,
        pedido: fPedido || undefined,
        placa: fPlaca || undefined,
        manifiesto: fManifiesto || undefined,
        cliente: fCliente || undefined,
        regional: PERFILES_GLOBALES_OC.includes(perfil) ? (fRegional || undefined) : undefined,
        origen: 'activos',
      });
      const url = window.URL.createObjectURL(blob as unknown as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `otros_costos_${hoyCol()}.xlsx`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      Swal.fire('✅ Listo', 'Excel generado', 'success');
    } catch (e: any) {
      Swal.fire('Error', 'No se pudo generar el Excel', 'error');
    }
  };

  // ── Archivo plano bancario (FINANCIERO/ADMIN) ─────────────────────────────
  const puedeArchivoBancario = perfil === 'ADMIN' || perfil === 'FINANCIERO';

  const toggleSelPago = (consecutivo: string) => {
    setSelPago((prev) => {
      const next = new Set(prev);
      if (next.has(consecutivo)) next.delete(consecutivo); else next.add(consecutivo);
      return next;
    });
  };

  // Marca/desmarca los pagables de la página visible (el checkbox de la cabecera).
  const pagablesPagina = items.filter((it) => it.estado === 'aprobado' && it.tramite_vulcano === 'ok' && it.consecutivo);
  const todosPaginaSeleccionados = pagablesPagina.length > 0
    && pagablesPagina.every((it) => it.consecutivo && selPago.has(it.consecutivo));
  const togglePagina = () => {
    setSelPago((prev) => {
      const next = new Set(prev);
      if (todosPaginaSeleccionados) {
        pagablesPagina.forEach((it) => it.consecutivo && next.delete(it.consecutivo));
      } else {
        pagablesPagina.forEach((it) => it.consecutivo && next.add(it.consecutivo));
      }
      return next;
    });
  };

  // "Seleccionar todos": trae del backend TODOS los pagables que cumplen los
  // filtros (aunque estén en otras páginas) y los marca de una vez.
  const [seleccionandoTodos, setSeleccionandoTodos] = useState(false);
  const onSeleccionarTodos = async () => {
    if (selPago.size > 0) {
      Swal.fire({
        title: '¿Limpiar selección?',
        text: `Ya hay ${selPago.size} consecutivo(s) seleccionado(s). ¿Reemplazar la selección actual con todos los pagables?`,
        icon: 'question', showCancelButton: true,
        confirmButtonColor: '#005f56', cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, seleccionar todos', cancelButtonText: 'Cancelar',
      }).then(async (r) => {
        if (r.isConfirmed) await cargarSeleccionTodos();
      });
      return;
    }
    await cargarSeleccionTodos();
  };
  const cargarSeleccionTodos = async () => {
    setSeleccionandoTodos(true);
    try {
      const res = await listarPagables(usuario, {
        fecha_inicio: fFechaIni || undefined,
        fecha_fin: fFechaFin || undefined,
        pedido: fPedido || undefined,
        placa: fPlaca || undefined,
        manifiesto: fManifiesto || undefined,
        cliente: fCliente || undefined,
        regional: PERFILES_GLOBALES_OC.includes(perfil) ? (fRegional || undefined) : undefined,
      });
      if (res.total === 0) {
        Swal.fire('Atención', 'No hay solicitudes aprobadas con trámite Vulcano OK con los filtros actuales.', 'warning');
        return;
      }
      setSelPago(new Set(res.consecutivos));
      Swal.fire(
        '✅ Seleccionados',
        `${res.total} solicitudes listas para pago (${formatMoney(res.valor_total)}). Puede revisar otras páginas: la selección se mantiene.`,
        'success',
      );
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo cargar la lista de pagables'), 'error');
    } finally {
      setSeleccionandoTodos(false);
    }
  };

  const onExportPago = async () => {
    if (selPago.size === 0) {
      Swal.fire('Atención', 'Seleccione al menos un consecutivo con el checkbox para generar el archivo de pago.', 'warning');
      return;
    }
    Swal.fire({ title: 'Generando archivo de pago...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const blob = await exportarPago(usuario, Array.from(selPago));
      const url = window.URL.createObjectURL(blob as unknown as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `pago_otros_costos_${hoyCol()}.xlsx`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      Swal.fire('✅ Listo', 'Archivo de pago generado. Las columnas "Valor Despues Retenciones" y "Referencia" van en blanco; se diligencian y luego se sube el mismo archivo para registrar los pagos.', 'success');
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo generar el archivo de pago'), 'error');
    }
  };

  const onImportarPago = async (file: File) => {
    setImportando(true);
    Swal.fire({ title: 'Procesando archivo bancario...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await importarPago(usuario, file);
      const okHtml = (res.procesadas || []).map((p) =>
        `<li>✅ <b>${p.consecutivo}</b> → pagada (${p.referencia_bancaria || 'sin referencia'}${p.valor_despues_retenciones != null ? ` · tras retenciones: ${formatMoney(p.valor_despues_retenciones)}` : ''})</li>`,
      ).join('');
      const errHtml = (res.errores || []).map((p) =>
        `<li>❌ <b>${p.consecutivo}</b>: ${p.detalle}</li>`,
      ).join('');
      Swal.fire({
        title: 'Archivo procesado',
        html: `<div style="text-align:left">${okHtml ? `<b>Pagadas:</b><ul>${okHtml}</ul>` : ''}${errHtml ? `<b style="color:#b91c1c">Con error:</b><ul style="color:#b91c1c">${errHtml}</ul>` : ''}`,
        icon: (res.errores || []).length ? 'warning' : 'success',
      });
      setSelPago(new Set());
      cargarListado();
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo procesar el archivo'), 'error');
    } finally {
      setImportando(false);
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
    }
  };

  const paginas = Math.ceil(total / limit) || 1;
  const paginaActual = Math.floor(skip / limit) + 1;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="OC-layout">
      <NavMedicalCare paginaActual={'otroscostos' as any} />

      <main className="OC-main">
        <div className="OC-header">
          <div>
            <span className="OC-subtitle">{total} solicitud{total !== 1 ? 'es' : ''}</span>
          </div>
          {puedeCrear && <button className="OC-btn OC-btnNew" onClick={abrirNuevo}><FaPlus /> Nueva solicitud</button>}
        </div>

        {/* Filtros */}
        <div className="OC-filtros">
          <div className="OC-filtroGroup">
            <FaCalendarAlt className="OC-filtroIcon" />
            <label>Desde</label>
            <input type="date" className="OC-dateInput" style={{ width: 'auto' }} value={fFechaIni} onChange={(e) => setFFechaIni(e.target.value)} />
            <label>Hasta</label>
            <input type="date" className="OC-dateInput" style={{ width: 'auto' }} value={fFechaFin} onChange={(e) => setFFechaFin(e.target.value)} />
            <label>Estado</label>
            <select className="OC-select" style={{ width: 'auto' }} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
              <option value="">Todos</option>
              {(BANDEJA_POR_PERFIL[perfil] ?? Object.keys(ESTADO_LABEL)).map((e) => (
                <option key={e} value={e}>{ESTADO_LABEL[e] ?? e}</option>
              ))}
            </select>
            {PERFILES_GLOBALES_OC.includes(perfil) && (
              <select className="OC-select" style={{ width: 'auto' }} value={fRegional} onChange={(e) => setFRegional(e.target.value)}>
                <option value="">Todas las regionales</option>
                {CENTROS_DISTRIBUCION_OC.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input className="OC-input" style={{ maxWidth: '160px' }} placeholder="Pedido" value={fPedido} onChange={(e) => setFPedido(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '120px' }} placeholder="Placa" value={fPlaca} onChange={(e) => setFPlaca(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '140px' }} placeholder="Manifiesto" value={fManifiesto} onChange={(e) => setFManifiesto(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '180px' }} placeholder="Cliente" value={fCliente} onChange={(e) => setFCliente(e.target.value)} />
            <button className="OC-btn OC-btnPrimary" onClick={() => { setSkip(0); cargarListado(); }}><FaSearch /> Buscar</button>
            <button className="OC-btn OC-btnExcel" onClick={onExportExcel}><FaFileExcel /> Excel</button>
            {puedeArchivoBancario && (
              <>
                <button
                  className="OC-btn OC-btnExcel" style={{ background: '#1d4ed8' }}
                  onClick={onSeleccionarTodos}
                  disabled={seleccionandoTodos}
                  title="Marca TODAS las solicitudes listas para pago que cumplen los filtros (incluye las de otras páginas)"
                >
                  <FaCheck /> {seleccionandoTodos ? 'Seleccionando...' : 'Seleccionar todos'}
                </button>
                {selPago.size > 0 && (
                  <button
                    className="OC-btn OC-btnExcel" style={{ background: '#6b7280' }}
                    onClick={() => setSelPago(new Set())}
                    title="Limpia la selección de consecutivos"
                  >
                    <FaTimes /> Limpiar ({selPago.size})
                  </button>
                )}
                <button className="OC-btn OC-btnExcel" style={{ background: '#1d4ed8' }} onClick={onExportPago} title="Genera el archivo plano bancario de los consecutivos seleccionados (aprobados + trámite OK)">
                  <FaUniversity /> Archivo pago {selPago.size > 0 ? `(${selPago.size})` : ''}
                </button>
                <button
                  className="OC-btn OC-btnExcel" style={{ background: '#0d9488' }}
                  onClick={() => inputArchivoRef.current?.click()}
                  disabled={importando}
                  title="Sube el archivo bancario con Valor Despues Retenciones y Referencia diligenciados: registra los pagos y pasa las solicitudes al histórico"
                >
                  <FaFileUpload /> Subir pago
                </button>
                <input
                  ref={inputArchivoRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportarPago(f); }}
                />
              </>
            )}
          </div>
        </div>

        {cargando ? (
          <div className="OC-loading"><div className="OC-spinner" /><span>Cargando...</span></div>
        ) : items.length === 0 ? (
          <div className="OC-emptyState">
            <FaWallet />
            <h3>No hay solicitudes</h3>
            <p>{perfil === 'FINANCIERO' ? 'No hay solicitudes aprobadas pendientes de pago.' : 'Cree una nueva solicitud de otro costo para comenzar.'}</p>
          </div>
        ) : (
          <div className="OC-tableContainer">
            <table className="OC-table">
              <thead>
                <tr>
                  {puedeArchivoBancario && (
                    <th style={{ width: '34px' }} title="Seleccionar los pagables de esta página">
                      <input
                        type="checkbox"
                        checked={todosPaginaSeleccionados}
                        onChange={togglePagina}
                        disabled={pagablesPagina.length === 0}
                      />
                    </th>
                  )}
                  <th>Consecutivo</th><th>Fecha</th><th>Pedido Vulcano</th><th>Cliente</th>
                  <th>Placa</th><th>Manifiesto</th><th>Tipo Costo</th><th>Valor Total</th>
                  <th>Estado</th><th>Creado por</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={puedeArchivoBancario ? 12 : 11} className="OC-empty">No se encontraron solicitudes</td></tr>
                ) : items.map((it) => {
                  const pagable = it.estado === 'aprobado' && it.tramite_vulcano === 'ok';
                  return (
                  <tr key={it._id}>
                    {puedeArchivoBancario && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          disabled={!pagable}
                          checked={!!it.consecutivo && selPago.has(it.consecutivo)}
                          onChange={() => it.consecutivo && toggleSelPago(it.consecutivo)}
                          title={pagable ? 'Seleccionar para el archivo de pago' : 'Solo aprobadas con trámite Vulcano OK'}
                        />
                      </td>
                    )}
                    <td className="OC-cellMono"><button className="OC-consecutivoLink" onClick={() => abrirDetalle(it)}>{it.consecutivo}</button></td>
                    <td style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatFecha(it.created_at)}</td>
                    <td className="OC-truncate" style={{ color: '#2563eb', fontWeight: 600 }} title={it.pedido_vulcano_original}>{it.pedido_vulcano_original || '-'}</td>
                    <td className="OC-truncate" title={it.datos_servicio?.cliente}>{it.datos_servicio?.cliente || '-'}</td>
                    <td>{it.datos_servicio?.placa || '-'}</td>
                    <td>{it.manifiesto || it.datos_servicio?.manifiesto || '-'}</td>
                    <td className="OC-truncate" title={(it.costos || []).map((c) => c.tipo_costo).join(', ')}>
                      {(it.costos || []).map((c) => c.tipo_costo).join(', ') || '-'}
                    </td>
                    <td style={{ fontWeight: 700, color: '#005f56' }}>{formatMoney(it.valor_total)}</td>
                    <td>{estadoBadge(it.estado)}</td>
                    <td>{it.creado_por?.usuario || it.usuario_registro || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="OC-btnAction" title="Detalle" style={{ background: '#334155' }} onClick={() => abrirDetalle(it)}><FaEye /></button>
                      {puedeEditar(it) && <button className="OC-btnAction" title="Editar" style={{ background: '#2563eb' }} onClick={() => abrirEditar(it)}><FaEdit /></button>}
                      {puedeMarcarTramite && it.estado === 'aprobado' && it.tramite_vulcano !== 'ok' && <button className="OC-btnAction" title="Marcar trámite Vulcano OK" style={{ background: '#0d9488' }} onClick={() => onTramiteVulcano(it)}><FaCheck /></button>}
                      {perfil === 'ADMIN' && it.estado === 'aprobado' && it.tramite_vulcano === 'ok' && <button className="OC-btnAction" title="Revertir trámite Vulcano" style={{ background: '#6b7280' }} onClick={() => onTramiteVulcano(it)}><FaUndo /></button>}
                      {puedePagar && it.estado === 'aprobado' && it.tramite_vulcano === 'ok' && <button className="OC-btnAction" title="Registrar pago" style={{ background: '#1d4ed8' }} onClick={() => onPagar(it)}><FaMoneyBillWave /></button>}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="OC-pagination">
              <span className="OC-paginationInfo">
                Página {paginaActual} de {paginas} · {total} registro{total !== 1 ? 's' : ''}
              </span>
              <div className="OC-filtroGroup">
                <button className="OC-btn OC-btnGhost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>Anterior</button>
                <button className="OC-btn OC-btnGhost" disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)}>Siguiente</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="OC-footer">
        <div className="OC-footerInner">
          <div className="OC-footerBrand"><Image src={logo} alt="Integra" height={28} /><span>Integra Cadena de Servicios S.A.S.</span></div>
          <span className="OC-footerCopy">© {new Date().getFullYear()} Integra</span>
        </div>
      </footer>

      {/* ── Modal detalle + acciones ── */}
      {modalMode === 'detalle' && detalle && (
        <div className="OC-modalOverlay"
          onMouseDown={(e) => setMouseDownOnBackdrop(e.target === e.currentTarget)}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop) cerrarModal(); }}
        >
          <div className="OC-modalBox" onClick={(e) => e.stopPropagation()}>
            <div className="OC-modalHeader">
              <div>
                <h2 className="OC-modalTitle">{detalle.consecutivo}</h2>
                <div className="OC-modalSubtitle">
                  {detalle.pedido_vulcano_original} · {formatMoney(detalle.valor_total)} · {estadoBadge(detalle.estado)}
                </div>
              </div>
              <button className="OC-modalClose" onClick={cerrarModal}><FaTimes /></button>
            </div>

            <div className="OC-modalSection">Información del pedido y servicio</div>
            <div className="OC-modalGrid">
              <Campo label="Pedido Vulcano" v={detalle.pedido_encontrado ? `✓ ${detalle.pedido_vulcano_original}` : `⚠ No encontrado — ${detalle.pedido_vulcano_original}`} />
              <Campo label="Cliente" v={detalle.datos_servicio?.cliente} />
              <Campo label="Centro distribución" v={detalle.datos_servicio?.centro_distribucion} />
              <Campo label="Fecha servicio" v={detalle.datos_servicio?.fecha_servicio ? formatFecha(detalle.datos_servicio.fecha_servicio) : '-'} />
              <Campo label="Piezas" v={detalle.datos_servicio?.piezas} />
              <Campo label="Peso real" v={Number(detalle.datos_servicio?.peso_real || 0).toLocaleString('es-CO')} />
              <Campo label="Tipo vehículo" v={detalle.datos_servicio?.tipo_vehiculo} />
              <Campo label="Placa" v={detalle.datos_servicio?.placa} />
              <Campo label="Municipio destino" v={detalle.datos_servicio?.municipio_destino} />
              <Campo label="Departamento" v={detalle.datos_servicio?.departamento_destino} />
              <Campo label="Transportador" v={detalle.datos_servicio?.transportador} />
              <Campo label="Manifiesto" destacado v={detalle.manifiesto || detalle.datos_servicio?.manifiesto} />
            </div>

            <div className="OC-modalSection">Conceptos del costo</div>
            <div className="OC-tableContainer" style={{ boxShadow: 'none' }}>
              <table className="OC-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Tipo</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {(detalle.costos || []).map((c, i) => (
                    <tr key={i}><td>{c.tipo_costo}</td><td>{c.descripcion}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(c.valor)}</td></tr>
                  ))}
                  <tr><td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 800, color: '#005f56' }}>{formatMoney(detalle.valor_total)}</td></tr>
                </tbody>
              </table>
            </div>
            {detalle.observaciones && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}><b>Observaciones:</b> {detalle.observaciones}</div>}

            <div className="OC-modalSection">Información bancaria</div>
            <div className="OC-modalGrid">
              <Campo label="Banco" v={detalle.datos_bancarios?.banco} />
              <Campo label="Tipo cuenta" v={detalle.datos_bancarios?.tipo_cuenta} />
              <Campo label="Número cuenta" v={detalle.datos_bancarios?.numero_cuenta} />
              <Campo label="Tipo ID titular" v={detalle.datos_bancarios?.tipo_id_titular} />
              <Campo label={detalle.datos_bancarios?.tipo_id_titular === 'NIT' ? 'NIT titular' : 'Cédula titular'} v={detalle.datos_bancarios?.cedula_titular} />
              <Campo label="Nombre titular" v={detalle.datos_bancarios?.nombre_titular} />
              <Campo label="Conductor" v={detalle.conductor?.nombre} />
              <Campo label="Teléfono conductor" v={detalle.conductor?.telefono} />
            </div>

            {(detalle.aprobacion?.usuario || detalle.pago?.usuario) && (
              <>
                <div className="OC-modalSection">Aprobación / Pago</div>
                <div className="OC-modalGrid">
                  <Campo label="Aprobado por" v={detalle.aprobacion?.usuario} />
                  <Campo label="Rol aprobación" v={detalle.aprobacion?.rol} />
                  <Campo label="Fecha aprobación" v={detalle.aprobacion?.fecha ? formatFecha(detalle.aprobacion.fecha) : '-'} />
                  <Campo label="Pagado por" v={detalle.pago?.usuario} />
                  <Campo label="Fecha pago" v={detalle.pago?.fecha_pago ? formatFecha(detalle.pago.fecha_pago) : '-'} />
                  <Campo label="Referencia" v={detalle.pago?.referencia} />
                  <Campo label="Valor tras retenciones" v={detalle.valor_despues_retenciones != null ? formatMoney(detalle.valor_despues_retenciones) : (detalle.pago?.valor_despues_retenciones != null ? formatMoney(detalle.pago.valor_despues_retenciones) : '-')} />
                  <Campo label="Trámite Vulcano" v={detalle.tramite_vulcano === 'ok' ? 'OK' : (detalle.tramite_vulcano === 'pendiente' ? 'Pendiente' : '-')} />
                  <Campo label="Tramitado por" v={detalle.tramite_vulcano_info?.usuario} />
                </div>
              </>
            )}

            <div className="OC-modalSection">Trazabilidad</div>
            <div className="OC-timeline">
              {(detalle.historial_movimientos || []).slice().reverse().map((m, i) => (
                <div className="OC-timelineItem" key={i}>
                  <span className="OC-timelineDot" />
                  <div>
                    <span className="OC-timelineAccion">{m.accion.replace(/_/g, ' ')}</span>
                    {m.estado_nuevo ? ` → ${m.estado_nuevo}` : ''}
                    <div className="OC-timelineMeta">{m.nombre_usuario || m.usuario} ({m.rol}) · {formatFecha(m.fecha)} {m.ip ? `· IP ${m.ip}` : ''}</div>
                    {m.observacion && <div className="OC-timelineMeta">“{m.observacion}”</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones según rol/estado */}
            <div className="OC-actions">
              {puedeEditar(detalle) && <button className="OC-btn OC-btnGhost" onClick={() => { cerrarModal(); abrirEditar(detalle); }}><FaEdit /> Editar</button>}
              {puedeCrear && ['borrador', 'devuelto'].includes(detalle.estado) && <button className="OC-btn OC-btnPrimary" onClick={() => onEnviar(detalle)}><FaPaperPlane /> Enviar a aprobación</button>}
              {puedeAprobar(detalle.valor_total) && detalle.estado === 'pendiente_aprobacion' && <button className="OC-btn OC-btnPrimary" style={{ background: '#16a34a' }} onClick={() => onAprobar(detalle)}><FaCheck /> Aprobar</button>}
              {puedeDevolver(detalle) && <button className="OC-btn OC-btnGhost" style={{ color: '#c2410c' }} onClick={() => onDevolver(detalle)}><FaUndo /> Devolver</button>}
              {puedeRechazar(detalle) && <button className="OC-btn OC-btnGhost" style={{ color: '#b91c1c' }} onClick={() => onRechazar(detalle)}><FaBan /> Rechazar</button>}
              {/* Trámite Vulcano: marcar OK lo ve el analista/admin; revertir solo el ADMIN
                  (una vez OK, la solicitud ya pasó a la bandeja de Financiero y el analista no debe tocarla). */}
              {puedeMarcarTramite && detalle.estado === 'aprobado' && detalle.tramite_vulcano !== 'ok' && (
                <button className="OC-btn OC-btnPrimary" style={{ background: '#0d9488' }} onClick={() => onTramiteVulcano(detalle)}><FaCheck /> Trámite Vulcano OK</button>
              )}
              {perfil === 'ADMIN' && detalle.estado === 'aprobado' && detalle.tramite_vulcano === 'ok' && (
                <button className="OC-btn OC-btnGhost" onClick={() => onTramiteVulcano(detalle)}><FaUndo /> Revertir trámite</button>
              )}
              {puedePagar && detalle.estado === 'aprobado' && detalle.tramite_vulcano === 'ok' && <button className="OC-btn OC-btnNew" onClick={() => onPagar(detalle)}><FaMoneyBillWave /> Registrar pago</button>}
              {puedeAnular && detalle.estado !== 'anulado' && detalle.estado !== 'pagado' && <button className="OC-btn OC-btnGhost" style={{ color: '#b91c1c' }} onClick={() => onAnular(detalle)}><FaBan /> Anular</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear / editar ── */}
      {modalMode === 'form' && (
        <div className="OC-modalOverlay"
          onMouseDown={(e) => setMouseDownOnBackdrop(e.target === e.currentTarget)}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop) cerrarModal(); }}
        >
          <div className="OC-modalBox" onClick={(e) => e.stopPropagation()}>
            <div className="OC-modalHeader">
              <div>
                <h2 className="OC-modalTitle">{form.consecutivo ? `Editar ${form.consecutivo}` : 'Nueva solicitud de otro costo'}</h2>
                <div className="OC-modalSubtitle">Complete la información del costo</div>
              </div>
              <button className="OC-modalClose" onClick={cerrarModal}><FaTimes /></button>
            </div>

            {/* Motivo de devolución visible para el operativo al corregir */}
            {motivoDevolucion && detalle?.estado === 'devuelto' && (
              <div className="OC-warn" style={{ marginBottom: '0.75rem' }}>
                <b>Devolución:</b> {motivoDevolucion}
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Corrija lo indicado y vuelva a enviar.</div>
              </div>
            )}

            {/* Sección 1: pedido y servicio */}
            <div className="OC-modalSection">1. Pedido de Vulcano y servicio</div>
            <div className="OC-field" style={{ marginBottom: '0.5rem' }}>
              <label className="OC-label">Pedido de Vulcano</label>
              <div className="OC-filtroGroup" style={{ paddingLeft: 0 }}>
                <input className="OC-input" placeholder="Ej: 00120795" value={form.pedido_vulcano_original} onChange={(e) => setForm({ ...form, pedido_vulcano_original: e.target.value })} />
                <button className="OC-btn OC-btnPrimary" onClick={handleBuscarPedidos} disabled={buscando}><FaSearch /> {buscando ? 'Buscando...' : 'Buscar'}</button>
              </div>
            </div>

            {busqueda && (
              <div className="OC-resultBox">
                {busqueda.pedidos_encontrados.length > 0 ? (
                  <>
                    <div className="OC-resultFound">✓ Pedido encontrado</div>
                    <table className="OC-table" style={{ minWidth: 0, marginTop: '0.4rem' }}>
                      <thead><tr><th></th><th>Pedido</th><th>Cliente</th><th>Destino</th><th>Placa</th><th>Piezas</th><th>Peso</th></tr></thead>
                      <tbody>
                        {busqueda.pedidos_encontrados.map((p) => (
                          <tr key={p._id_origen}>
                            <td><input type="checkbox" checked={seleccionados.has(p._id_origen)} onChange={() => toggleSeleccion(p._id_origen)} /></td>
                            <td className="OC-cellMono">{p.pedido_vulcano}</td>
                            <td>{p.cliente}</td>
                            <td>{p.municipio_destino}</td>
                            <td>{p.placa}</td>
                            <td>{p.piezas}</td>
                            <td>{Number(p.peso_real || 0).toLocaleString('es-CO')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <div className="OC-resultNotFound">⚠ Ningún pedido encontrado. Debe diligenciar los campos manualmente.</div>}
                {busqueda.pedidos_no_encontrados.length > 0 && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#b91c1c' }}>No encontrados: {busqueda.pedidos_no_encontrados.join(', ')}</div>
                )}
                {busqueda.advertencia_servicios_diferentes && (
                  <div className="OC-warn">⚠ Los pedidos encontrados difieren en: {Object.keys(busqueda.diferencias).join(', ')}. Verifique que sean del mismo servicio.</div>
                )}
                {!form.pedido_encontrado && (
                  <input className="OC-input" style={{ marginTop: '0.4rem' }} placeholder="Motivo por el cual se continúa sin el pedido (obligatorio)" value={form.motivo_no_encontrado} onChange={(e) => setForm({ ...form, motivo_no_encontrado: e.target.value.toUpperCase() })} />
                )}
              </div>
            )}

            <div className="OC-formGrid" style={{ marginTop: '0.5rem' }}>
              <div className="OC-field">
                <label className="OC-label">Cliente</label>
                <select className="OC-select" value={form.datos_servicio.cliente} onChange={(e) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, cliente: e.target.value } })}>
                  <option value="">Seleccione un cliente...</option>
                  {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
                  {form.datos_servicio.cliente && !clientes.includes(form.datos_servicio.cliente) && (
                    <option value={form.datos_servicio.cliente}>{form.datos_servicio.cliente}</option>
                  )}
                </select>
              </div>
              <div className="OC-field">
                <label className="OC-label">Centro distribución</label>
                <select className="OC-select" value={form.datos_servicio.centro_distribucion} onChange={(e) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, centro_distribucion: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  {CENTROS_DISTRIBUCION_OC.map((c) => <option key={c} value={c}>{c}</option>)}
                  {form.datos_servicio.centro_distribucion && !CENTROS_DISTRIBUCION_OC.includes(form.datos_servicio.centro_distribucion) && (
                    <option value={form.datos_servicio.centro_distribucion}>{form.datos_servicio.centro_distribucion}</option>
                  )}
                </select>
              </div>
              <FieldText label="Fecha servicio" type="date" value={form.datos_servicio.fecha_servicio} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, fecha_servicio: v } })} />
              <FieldText label="Piezas" type="number" value={String(form.datos_servicio.piezas)} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, piezas: Number(v) || 0 } })} />
              <FieldText label="Peso real" type="number" value={String(form.datos_servicio.peso_real)} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, peso_real: Number(v) || 0 } })} />
              <div className="OC-field">
                <label className="OC-label">Tipo vehículo</label>
                <select className="OC-select" value={form.datos_servicio.tipo_vehiculo} onChange={(e) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, tipo_vehiculo: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  {TIPOS_VEHICULO_OC.map((t) => <option key={t} value={t}>{t}</option>)}
                  {form.datos_servicio.tipo_vehiculo && !TIPOS_VEHICULO_OC.includes(form.datos_servicio.tipo_vehiculo) && (
                    <option value={form.datos_servicio.tipo_vehiculo}>{form.datos_servicio.tipo_vehiculo}</option>
                  )}
                </select>
              </div>
              <FieldText label="Placa" mayusculas value={form.datos_servicio.placa} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, placa: v } })} />
              <FieldText label="Municipio destino" mayusculas value={form.datos_servicio.municipio_destino} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, municipio_destino: v } })} />
              <FieldText label="Departamento destino" mayusculas value={form.datos_servicio.departamento_destino} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, departamento_destino: v } })} />
              <FieldText label="Transportador / proveedor" mayusculas value={form.datos_servicio.transportador} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, transportador: v } })} />
              <FieldText label="Manifiesto" destacado value={form.datos_servicio.manifiesto} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, manifiesto: v } })} onBlur={() => advertirManifiesto(form.datos_servicio.manifiesto)} maxLength={15} soloNumeros />
            </div>

            {/* Sección 2: costos */}
            <div className="OC-modalSection">2. Información del otro costo</div>
            {form.costos.map((c, i) => (
              <div className="OC-costRow" key={i}>
                <div className="OC-field">
                  <label className="OC-label">Tipo de costo *</label>
                  <select className="OC-select" value={c.tipo_costo} onChange={(e) => updateCosto(i, 'tipo_costo', e.target.value)}>
                    <option value="">Seleccione...</option>
                    {tiposCosto.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="OC-field">
                  <label className="OC-label">Valor *</label>
                  <input className="OC-input" type="number" min={0} max={LIMITE_VALOR_TOTAL} value={c.valor || ''} onChange={(e) => {
                    const v = e.target.value;
                    updateCosto(i, 'valor', v === '' ? '' : Math.min(Number(v), LIMITE_VALOR_TOTAL));
                  }} onWheel={(e) => e.currentTarget.blur()} />
                </div>
                <button className="OC-btnAction" title="Quitar" style={{ background: '#dc2626', alignSelf: 'end' }} onClick={() => removeCosto(i)}><FaTrash /></button>
                <div className="OC-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="OC-label">Descripción *</label>
                  <textarea className="OC-textarea" rows={2} value={c.descripcion} onChange={(e) => updateCosto(i, 'descripcion', e.target.value.toUpperCase())} />
                </div>
              </div>
            ))}
            <button className="OC-btn OC-btnGhost OC-costAdd" onClick={addCosto}><FaPlus /> Agregar concepto</button>
            <div className="OC-resumen">
              <span>Valor total</span>
              <span className="OC-resumenTotal">{formatMoney(valorTotal)}</span>
            </div>
            {/* Sección 3: bancario */}
            <div className="OC-modalSection">3. Información bancaria</div>
            <div className="OC-formGrid">
              <div className="OC-field">
                <label className="OC-label">Banco *</label>
                <select className="OC-select" value={form.datos_bancarios.banco} onChange={(e) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, banco: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  {bancos.map((b) => <option key={b.nombre} value={b.nombre}>{b.nombre}</option>)}
                  {form.datos_bancarios.banco && !bancos.some((b) => b.nombre === form.datos_bancarios.banco) && (
                    <option value={form.datos_bancarios.banco}>{form.datos_bancarios.banco}</option>
                  )}
                </select>
              </div>
              <div className="OC-field">
                <label className="OC-label">Tipo de cuenta</label>
                <select className="OC-select" value={form.datos_bancarios.tipo_cuenta} onChange={(e) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, tipo_cuenta: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  {tiposCuenta.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <FieldText label="Número de cuenta *" soloNumeros value={form.datos_bancarios.numero_cuenta} onChange={(v) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, numero_cuenta: v } })} />
              <div className="OC-field">
                <label className="OC-label">Tipo de identificación del titular *</label>
                <select className="OC-select" value={form.datos_bancarios.tipo_id_titular} onChange={(e) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, tipo_id_titular: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>
              <FieldText label={form.datos_bancarios.tipo_id_titular === 'NIT' ? 'NIT del titular *' : 'Cédula del titular *'} soloNumeros value={form.datos_bancarios.cedula_titular} onChange={(v) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, cedula_titular: v } })} />
              <FieldText label="Nombre del titular *" mayusculas value={form.datos_bancarios.nombre_titular} onChange={(v) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, nombre_titular: v } })} />
              <FieldText label="Nombre del conductor *" mayusculas value={form.conductor.nombre} onChange={(v) => setForm({ ...form, conductor: { ...form.conductor, nombre: v } })} />
              <FieldText label="Teléfono del conductor" soloNumeros value={form.conductor.telefono} onChange={(v) => setForm({ ...form, conductor: { ...form.conductor, telefono: v } })} />
            </div>

            <div className="OC-actions">
              <button className="OC-btn OC-btnGhost" onClick={cerrarModal}>Cancelar</button>
              {puedeCrear && <button className="OC-btn OC-btnGhost" style={{ color: '#005f56' }} disabled={guardando} onClick={() => guardar(false)}><FaSave /> Guardar borrador</button>}
              {puedeCrear && <button className="OC-btn OC-btnPrimary" disabled={guardando} onClick={() => guardar(true)}><FaPaperPlane /> Guardar y enviar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Subcomponentes de formulario ──────────────────────────────────────────────
const Campo = ({ label, v, destacado }: { label: string; v: any; destacado?: boolean }) => (
  <div className="OC-modalField">
    <span className="OC-modalLabel" style={destacado ? { fontWeight: 700, color: '#b45309' } : undefined}>{label}</span>
    <span
      className="OC-modalValue"
      style={destacado ? { backgroundColor: '#fff8e1', border: '2px solid #f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.18)', fontWeight: 700, borderRadius: '4px', padding: '0.15rem 0.4rem' } : undefined}
    >
      {v === undefined || v === null || v === '' ? '-' : v}
    </span>
  </div>
);

const FieldText = ({ label, value, onChange, onBlur, type, maxLength, soloNumeros, mayusculas, destacado }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string; maxLength?: number; soloNumeros?: boolean; mayusculas?: boolean; destacado?: boolean }) => {
  const aplicar = (raw: string) => {
    let v = soloNumeros ? raw.replace(/\D/g, '') : raw;
    if (mayusculas) v = v.toUpperCase();
    if (maxLength !== undefined) v = v.slice(0, maxLength);
    onChange(v);
  };
  return (
    <div className="OC-field">
      <label className="OC-label" style={destacado ? { fontWeight: 700, color: '#b45309' } : undefined}>{label}</label>
      <input
        className="OC-input"
        type={type || 'text'}
        value={value}
        maxLength={maxLength}
        onChange={(e) => aplicar(e.target.value)}
        onBlur={onBlur}
        onWheel={(e) => { if (type === 'number') e.currentTarget.blur(); }}
        style={destacado ? { backgroundColor: '#fff8e1', border: '2px solid #f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.18)', fontWeight: 700 } : undefined}
      />
    </div>
  );
};

export default OtrosCostosP;
