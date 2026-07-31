'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaSearch, FaFileExcel, FaCalendarAlt, FaTimes, FaPlus, FaTrash, FaSave,
  FaPaperPlane, FaCheck, FaUndo, FaBan, FaMoneyBillWave, FaEdit, FaEye, FaWallet,
} from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import Swal from 'sweetalert2';
import {
  listarActivos, obtenerDetalleActivo, buscarPedidos, crearSolicitud, editarSolicitud,
  enviarAprobacion, aprobarSolicitud, devolverSolicitud, rechazarSolicitud,
  registrarPago, anularSolicitud, exportarExcel, marcarTramiteVulcano,
  getTiposCosto, getBancos, getTiposCuenta, getClientes,
  type OtroCosto, type CostoConcepto, type ResultadoBusquedaPedidos, type PedidoEncontrado,
} from '@/Funciones/ApiPedidos/otrosCostos';
import './estilos.css';

const PERFILES_PERMITIDOS = ['ADMIN', 'OPERATIVO', 'COORDINADOR', 'CONTROL', 'FINANCIERO', 'ANALISTA'];
const LIMITE_COORDINADOR = 500000;

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
  datos_bancarios: { banco: string; tipo_cuenta: string; numero_cuenta: string; cedula_titular: string; nombre_titular: string };
  conductor: { nombre: string; telefono: string };
  observaciones: string;
}

const formVacio = (): FormState => ({
  pedido_vulcano_original: '',
  pedido_encontrado: true,
  motivo_no_encontrado: '',
  datos_servicio: { cliente: '', centro_distribucion: '', fecha_servicio: '', piezas: 0, peso_real: 0, tipo_vehiculo: '', placa: '', municipio_destino: '', departamento_destino: '', transportador: '', manifiesto: '' },
  costos: [{ tipo_costo: '', concepto: '', descripcion: '', valor: 0 }],
  datos_bancarios: { banco: '', tipo_cuenta: '', numero_cuenta: '', cedula_titular: '', nombre_titular: '' },
  conductor: { nombre: '', telefono: '' },
  observaciones: '',
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
  const [bancos, setBancos] = useState<string[]>([]);
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

  // Modal
  const [modalMode, setModalMode] = useState<'detalle' | 'form' | null>(null);
  const [detalle, setDetalle] = useState<OtroCosto | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [busqueda, setBusqueda] = useState<ResultadoBusquedaPedidos | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = useState(false);

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
        skip,
        limit,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      Swal.fire('Error', e?.detail || 'No se pudo cargar el listado', 'error');
    } finally {
      setCargando(false);
    }
  }, [usuario, perfil, fEstado, fFechaIni, fFechaFin, fPedido, fPlaca, fManifiesto, fCliente, skip]);

  // ── Permisos (frontend; el backend vuelve a validar) ─────────────────────
  const puedeCrear = perfil === 'ADMIN' || perfil === 'OPERATIVO';
  const puedePagar = perfil === 'ADMIN' || perfil === 'FINANCIERO';
  const puedeAnular = perfil === 'ADMIN';
  const puedeAprobar = (valor: number) =>
    perfil === 'ADMIN' || perfil === 'CONTROL' || (perfil === 'COORDINADOR' && valor <= LIMITE_COORDINADOR);
  const puedeRevision = perfil === 'ADMIN' || perfil === 'CONTROL' || perfil === 'COORDINADOR';
  const puedeMarcarTramite = perfil === 'ADMIN' || perfil === 'ANALISTA';
  const puedeEditar = (it: OtroCosto) =>
    (perfil === 'ADMIN' || (perfil === 'OPERATIVO' && it.usuario_registro === usuario))
    && ['borrador', 'devuelto', 'pendiente_aprobacion'].includes(it.estado);

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
      Swal.fire('Error', e?.detail || 'Error en la búsqueda', 'error');
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

  // ── Costos ─────────────────────────────────────────────────────────────────
  const valorTotal = form.costos.reduce((a, c) => a + (Number(c.valor) || 0), 0);

  const updateCosto = (i: number, campo: keyof CostoConcepto, value: any) => {
    setForm((f) => {
      const costos = [...f.costos];
      costos[i] = { ...costos[i], [campo]: campo === 'valor' ? Number(value) || 0 : value };
      return { ...f, costos };
    });
  };
  const addCosto = () => setForm((f) => ({ ...f, costos: [...f.costos, { tipo_costo: '', concepto: '', descripcion: '', valor: 0 }] }));
  const removeCosto = (i: number) => setForm((f) => ({ ...f, costos: f.costos.length > 1 ? f.costos.filter((_, idx) => idx !== i) : f.costos }));

  // ── Abrir modales ──────────────────────────────────────────────────────────
  const abrirDetalle = async (it: OtroCosto) => {
    try {
      const d = await obtenerDetalleActivo(it.consecutivo!, usuario);
      setDetalle(d);
      setModalMode('detalle');
    } catch (e: any) {
      Swal.fire('Error', e?.detail || 'No se pudo cargar el detalle', 'error');
    }
  };

  const abrirNuevo = () => {
    setForm(formVacio());
    setBusqueda(null);
    setSeleccionados(new Set());
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
        costos: d.costos.length ? d.costos : [{ tipo_costo: '', concepto: '', descripcion: '', valor: 0 }],
        datos_bancarios: d.datos_bancarios,
        conductor: d.conductor,
        observaciones: d.observaciones,
      });
      setBusqueda(null);
      setSeleccionados(new Set());
      setModalMode('form');
    } catch (e: any) {
      Swal.fire('Error', e?.detail || 'No se pudo cargar para editar', 'error');
    }
  };

  const cerrarModal = () => { setModalMode(null); setDetalle(null); };

  // ── Guardar (crear/editar) ──────────────────────────────────────────────────
  const validarForm = (enviar: boolean): string | null => {
    if (!form.pedido_vulcano_original.trim()) return 'El pedido de Vulcano es obligatorio.';
    if (contarPedidos(form.pedido_vulcano_original) > 1) return 'Solo se permite un pedido de Vulcano por solicitud (una planilla).';
    if (enviar && !form.datos_servicio.manifiesto.trim()) return 'El manifiesto es obligatorio.';
    if (!form.pedido_encontrado && !form.datos_servicio.placa.trim()) return 'La placa es obligatoria cuando el pedido no se encuentra.';
    if (form.costos.length === 0) return 'Agregue al menos un concepto de costo.';
    for (const c of form.costos) {
      if (!c.tipo_costo) return 'Cada concepto debe tener tipo de costo.';
      if (c.tipo_costo === 'Otro' && !c.concepto.trim()) return 'Cuando el tipo es "Otro" debe indicar el concepto.';
      if (!c.concepto.trim()) return 'El concepto es obligatorio.';
      if (!c.descripcion.trim()) return 'La descripción es obligatoria.';
      if (!(Number(c.valor) > 0)) return 'El valor de cada costo debe ser mayor que cero.';
    }
    if (!form.datos_bancarios.banco) return 'El banco es obligatorio.';
    if (!form.datos_bancarios.numero_cuenta.trim()) return 'El número de cuenta es obligatorio.';
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
        observaciones: form.observaciones,
      };
      if (form.consecutivo) {
        await editarSolicitud({ ...payload, consecutivo: form.consecutivo });
        Swal.fire('✅ Guardado', 'Solicitud actualizada', 'success');
      } else {
        const res: any = await crearSolicitud(payload);
        if (res.posible_duplicado) {
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
      Swal.fire('Error', e?.detail || 'No se pudo guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── Acciones de flujo ──────────────────────────────────────────────────────
  const accion = async (
    fn: () => Promise<any>, it: OtroCosto, titulo: string, texto: string,
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
      await fn();
      Swal.fire('✅ Listo', 'Acción realizada', 'success');
      cerrarModal();
      cargarListado();
    } catch (e: any) {
      Swal.fire('Error', e?.detail || 'No se pudo realizar la acción', 'error');
    }
  };

  const onEnviar = (it: OtroCosto) => accion(() => enviarAprobacion(it.consecutivo!, usuario), it, '¿Enviar a aprobación?', `<b>${it.consecutivo}</b> quedará pendiente de aprobación.`);
  const onAprobar = (it: OtroCosto) => accion(() => aprobarSolicitud(it.consecutivo!, usuario), it, '¿Aprobar solicitud?', `<b>${it.consecutivo}</b> por ${formatMoney(it.valor_total)}.`, 'text', 'Observación (opcional)');
  const onDevolver = (it: OtroCosto) => accion(() => devolverSolicitud(it.consecutivo!, usuario), it, '¿Devolver solicitud?', `<b>${it.consecutivo}</b> volverá al creador para corrección.`, 'textarea', 'Motivo de devolución', true);
  const onRechazar = (it: OtroCosto) => accion(() => rechazarSolicitud(it.consecutivo!, usuario), it, '¿Rechazar solicitud?', `<b>${it.consecutivo}</b> será rechazada.`, 'textarea', 'Motivo de rechazo', true);
  const onAnular = (it: OtroCosto) => accion(() => anularSolicitud(it.consecutivo!, usuario), it, '¿Anular solicitud?', `<b>${it.consecutivo}</b> será anulada y movida a anulados.`, 'textarea', 'Motivo de anulación', true);

  const onTramiteVulcano = (it: OtroCosto) => {
    const marcarOk = it.tramite_vulcano !== 'ok';
    accion(
      () => marcarTramiteVulcano(it.consecutivo!, usuario, marcarOk ? 'ok' : 'pendiente'),
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
        Swal.fire('Error', e?.detail || 'No se pudo registrar el pago', 'error');
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

  const paginas = Math.ceil(total / limit) || 1;
  const paginaActual = Math.floor(skip / limit) + 1;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="OC-layout">
      <NavMedicalCare paginaActual={'otroscostos' as any} />

      <main className="OC-main">
        <div className="OC-header">
          <div>
            <h1 className="OC-title">Otros Costos</h1>
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
              <option value="borrador">Borrador</option>
              <option value="pendiente_aprobacion">Pendiente</option>
              <option value="devuelto">Devuelto</option>
              <option value="rechazado">Rechazado</option>
              <option value="aprobado">Aprobado</option>
              <option value="pagado">Pagado</option>
              <option value="anulado">Anulado</option>
            </select>
            <button className="OC-btn OC-btnPrimary" onClick={() => { setSkip(0); cargarListado(); }}><FaSearch /> Buscar</button>
          </div>
          <div className="OC-filtroGroup">
            <input className="OC-input" style={{ maxWidth: '160px' }} placeholder="Pedido" value={fPedido} onChange={(e) => setFPedido(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '120px' }} placeholder="Placa" value={fPlaca} onChange={(e) => setFPlaca(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '140px' }} placeholder="Manifiesto" value={fManifiesto} onChange={(e) => setFManifiesto(e.target.value)} />
            <input className="OC-input" style={{ maxWidth: '180px' }} placeholder="Cliente" value={fCliente} onChange={(e) => setFCliente(e.target.value)} />
            <button className="OC-btn OC-btnExcel" onClick={onExportExcel}><FaFileExcel /> Excel</button>
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
                  <th>Consecutivo</th><th>Fecha</th><th>Pedido Vulcano</th><th>Cliente</th>
                  <th>Placa</th><th>Manifiesto</th><th>Tipo Costo</th><th>Valor Total</th>
                  <th>Estado</th><th>Creado por</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={11} className="OC-empty">No se encontraron solicitudes</td></tr>
                ) : items.map((it) => (
                  <tr key={it._id}>
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
                      {puedeMarcarTramite && it.estado === 'aprobado' && <button className="OC-btnAction" title={it.tramite_vulcano === 'ok' ? 'Revertir trámite Vulcano' : 'Marcar trámite Vulcano OK'} style={{ background: it.tramite_vulcano === 'ok' ? '#6b7280' : '#0d9488' }} onClick={() => onTramiteVulcano(it)}>{it.tramite_vulcano === 'ok' ? <FaUndo /> : <FaCheck />}</button>}
                      {puedePagar && it.estado === 'aprobado' && it.tramite_vulcano === 'ok' && <button className="OC-btnAction" title="Registrar pago" style={{ background: '#1d4ed8' }} onClick={() => onPagar(it)}><FaMoneyBillWave /></button>}
                    </td>
                  </tr>
                ))}
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
              <Campo label="Manifiesto" v={detalle.manifiesto || detalle.datos_servicio?.manifiesto} />
            </div>

            <div className="OC-modalSection">Conceptos del costo</div>
            <div className="OC-tableContainer" style={{ boxShadow: 'none' }}>
              <table className="OC-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Tipo</th><th>Concepto</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {(detalle.costos || []).map((c, i) => (
                    <tr key={i}><td>{c.tipo_costo}</td><td>{c.concepto}</td><td>{c.descripcion}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(c.valor)}</td></tr>
                  ))}
                  <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 800, color: '#005f56' }}>{formatMoney(detalle.valor_total)}</td></tr>
                </tbody>
              </table>
            </div>
            {detalle.observaciones && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}><b>Observaciones:</b> {detalle.observaciones}</div>}

            <div className="OC-modalSection">Información bancaria</div>
            <div className="OC-modalGrid">
              <Campo label="Banco" v={detalle.datos_bancarios?.banco} />
              <Campo label="Tipo cuenta" v={detalle.datos_bancarios?.tipo_cuenta} />
              <Campo label="Número cuenta" v={detalle.datos_bancarios?.numero_cuenta} />
              <Campo label="Cédula titular" v={detalle.datos_bancarios?.cedula_titular} />
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
              {puedeRevision && detalle.estado === 'pendiente_aprobacion' && <button className="OC-btn OC-btnGhost" style={{ color: '#c2410c' }} onClick={() => onDevolver(detalle)}><FaUndo /> Devolver</button>}
              {puedeRevision && ['pendiente_aprobacion', 'devuelto'].includes(detalle.estado) && <button className="OC-btn OC-btnGhost" style={{ color: '#b91c1c' }} onClick={() => onRechazar(detalle)}><FaBan /> Rechazar</button>}
              {puedeMarcarTramite && detalle.estado === 'aprobado' && <button className="OC-btn OC-btnPrimary" style={{ background: detalle.tramite_vulcano === 'ok' ? '#6b7280' : '#0d9488' }} onClick={() => onTramiteVulcano(detalle)}>{detalle.tramite_vulcano === 'ok' ? <><FaUndo /> Revertir trámite</> : <><FaCheck /> Trámite Vulcano OK</>}</button>}
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
                  <input className="OC-input" style={{ marginTop: '0.4rem' }} placeholder="Motivo por el cual se continúa sin el pedido (obligatorio)" value={form.motivo_no_encontrado} onChange={(e) => setForm({ ...form, motivo_no_encontrado: e.target.value })} />
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
              <FieldText label="Centro distribución" value={form.datos_servicio.centro_distribucion} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, centro_distribucion: v } })} />
              <FieldText label="Fecha servicio" type="date" value={form.datos_servicio.fecha_servicio} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, fecha_servicio: v } })} />
              <FieldText label="Piezas" type="number" value={String(form.datos_servicio.piezas)} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, piezas: Number(v) || 0 } })} />
              <FieldText label="Peso real" type="number" value={String(form.datos_servicio.peso_real)} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, peso_real: Number(v) || 0 } })} />
              <FieldText label="Tipo vehículo" value={form.datos_servicio.tipo_vehiculo} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, tipo_vehiculo: v } })} />
              <FieldText label="Placa" value={form.datos_servicio.placa} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, placa: v } })} />
              <FieldText label="Municipio destino" value={form.datos_servicio.municipio_destino} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, municipio_destino: v } })} />
              <FieldText label="Departamento destino" value={form.datos_servicio.departamento_destino} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, departamento_destino: v } })} />
              <FieldText label="Transportador / proveedor" value={form.datos_servicio.transportador} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, transportador: v } })} />
              <FieldText label="Manifiesto" value={form.datos_servicio.manifiesto} onChange={(v) => setForm({ ...form, datos_servicio: { ...form.datos_servicio, manifiesto: v } })} />
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
                  <label className="OC-label">Concepto *</label>
                  <input className="OC-input" value={c.concepto} onChange={(e) => updateCosto(i, 'concepto', e.target.value)} />
                </div>
                <div className="OC-field">
                  <label className="OC-label">Valor *</label>
                  <input className="OC-input" type="number" value={c.valor || ''} onChange={(e) => updateCosto(i, 'valor', e.target.value)} />
                </div>
                <button className="OC-btnAction" title="Quitar" style={{ background: '#dc2626', alignSelf: 'end' }} onClick={() => removeCosto(i)}><FaTrash /></button>
                <div className="OC-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="OC-label">Descripción *</label>
                  <textarea className="OC-textarea" rows={2} value={c.descripcion} onChange={(e) => updateCosto(i, 'descripcion', e.target.value)} />
                </div>
              </div>
            ))}
            <button className="OC-btn OC-btnGhost OC-costAdd" onClick={addCosto}><FaPlus /> Agregar concepto</button>
            <div className="OC-resumen">
              <span>Valor total</span>
              <span className="OC-resumenTotal">{formatMoney(valorTotal)}</span>
            </div>
            <div className="OC-field" style={{ marginTop: '0.5rem' }}>
              <label className="OC-label">Observaciones</label>
              <textarea className="OC-textarea" rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>

            {/* Sección 3: bancario */}
            <div className="OC-modalSection">3. Información bancaria</div>
            <div className="OC-formGrid">
              <div className="OC-field">
                <label className="OC-label">Banco *</label>
                <select className="OC-select" value={form.datos_bancarios.banco} onChange={(e) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, banco: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="OC-field">
                <label className="OC-label">Tipo de cuenta</label>
                <select className="OC-select" value={form.datos_bancarios.tipo_cuenta} onChange={(e) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, tipo_cuenta: e.target.value } })}>
                  <option value="">Seleccione...</option>
                  {tiposCuenta.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <FieldText label="Número de cuenta *" value={form.datos_bancarios.numero_cuenta} onChange={(v) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, numero_cuenta: v } })} />
              <FieldText label="Cédula del titular *" value={form.datos_bancarios.cedula_titular} onChange={(v) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, cedula_titular: v } })} />
              <FieldText label="Nombre del titular *" value={form.datos_bancarios.nombre_titular} onChange={(v) => setForm({ ...form, datos_bancarios: { ...form.datos_bancarios, nombre_titular: v } })} />
              <FieldText label="Nombre del conductor *" value={form.conductor.nombre} onChange={(v) => setForm({ ...form, conductor: { ...form.conductor, nombre: v } })} />
              <FieldText label="Teléfono del conductor" value={form.conductor.telefono} onChange={(v) => setForm({ ...form, conductor: { ...form.conductor, telefono: v } })} />
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
const Campo = ({ label, v }: { label: string; v: any }) => (
  <div className="OC-modalField">
    <span className="OC-modalLabel">{label}</span>
    <span className="OC-modalValue">{v === undefined || v === null || v === '' ? '-' : v}</span>
  </div>
);

const FieldText = ({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div className="OC-field">
    <label className="OC-label">{label}</label>
    <input className="OC-input" type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default OtrosCostosP;
