'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaPlus, FaTimes, FaSave, FaToggleOn, FaToggleOff, FaBell, FaPencilAlt, FaKey, FaFilter, FaUsers,
} from 'react-icons/fa';
import { obtenerUsuarios, crearUsuario, actualizarClientesSiscore, obtenerClientesSiscore, ClienteSiscore, actualizarClientesAprobacion, actualizarPerfilUsuario, actualizarPerfilesAdicionales, obtenerPerfilesDisponibles, toggleActivoUsuario, actualizarNotificacionesMcUsuario, actualizarDatosUsuario } from '@/Funciones/ApiPedidos/usuarios';
import { getClientes, getClientesCompletos, crearClienteOc, cambiarEstadoClienteOc, ClienteOtroCosto } from '@/Funciones/ApiPedidos/otrosCostos';
import { listarEmpresasCobro } from '@/Funciones/ApiPedidos/seguridadCobro';
import { BaseUsuario } from '@/Funciones/ApiPedidos/tipos';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const REGIONALES = [
  'FUNZA',
  'CELTA',
  'CALI',
  'BUENAVENTURA',
  'MEDELLIN',
  'BUCARAMANGA',
  'BARRANQUILLA',
];

const NOTIFICACIONES_MC = [
  {
    key: 'retraso_operacion',
    label: 'Retraso Operación',
    desc: 'Recibe el Excel completo: ocupación de rutas y V3 sin paciente.',
  },
  {
    key: 'sin_cruce',
    label: 'Sin Cruce',
    desc: 'Recibe solo los pedidos V3 que no tienen un paciente asignado.',
  },
];

const PERFILES_FALLBACK = ['ADMIN', 'ANALISTA', 'CLIENTE_ESTUDIOS', 'CONDUCTOR', 'CONTROL', 'COORDINADOR', 'DESPACHADOR', 'FINANCIERO', 'OPERADOR', 'OPERATIVO', 'SEGURIDAD', 'VISUALIZADOR'];

const USUARIO_VACIO: BaseUsuario = {
  nombre: '', correo: '', regional: '', celular: '',
  perfil: 'OPERATIVO', usuario: '', clave: '', clientes: [], clientes_siscore: [],
};

const GestionUsuariosP: React.FC = () => {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<BaseUsuario[]>([]);
  const [perfiles, setPerfiles] = useState<string[]>(PERFILES_FALLBACK);
  const [cargando, setCargando] = useState(true);
  const [guardandoCliente, setGuardandoCliente] = useState<string | null>(null);
  const [msgsCliente, setMsgsCliente] = useState<Record<string, string>>({});
  // (2026-10-29) Asignación de clientes por NIT (catálogo clientes_siscore),
  // aplicable a CUALQUIER perfil — reemplaza los toggles KABI/MEDICAL_CARE.
  const [clientesSiscore, setClientesSiscore] = useState<ClienteSiscore[]>([]);
  const [modalClientes, setModalClientes] = useState<BaseUsuario | null>(null);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [filtroClientes, setFiltroClientes] = useState('');
  const [guardandoClientes, setGuardandoClientes] = useState(false);
  const [errorClientes, setErrorClientes] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [guardandoNotifMc, setGuardandoNotifMc] = useState<string | null>(null);
  const [msgsNotifMc, setMsgsNotifMc] = useState<Record<string, string>>({});
  const [modalNotifMc, setModalNotifMc] = useState<BaseUsuario | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<BaseUsuario>(USUARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [modalEditar, setModalEditar] = useState<BaseUsuario | null>(null);
  const [formEditar, setFormEditar] = useState({ nombre: '', correo: '', regional: '', celular: '', clave: '', usuario: '' });
  const [guardandoEditar, setGuardandoEditar] = useState(false);
  const [errorEditar, setErrorEditar] = useState('');
  const [modalReset, setModalReset] = useState<BaseUsuario | null>(null);
  const [formReset, setFormReset] = useState({ nuevaClave: '', confirmarClave: '' });
  const [guardandoReset, setGuardandoReset] = useState(false);
  const [errorReset, setErrorReset] = useState('');
  const [modalClavePerfil, setModalClavePerfil] = useState<{ usuario: BaseUsuario; nuevoPerfil: string } | null>(null);
  const [clavePerfil, setClavePerfil] = useState('');
  const [guardandoClavePerfil, setGuardandoClavePerfil] = useState(false);
  const [errorClavePerfil, setErrorClavePerfil] = useState('');
  // Empresas del módulo de Estudios de Seguridad (selector cuando perfil=CLIENTE_ESTUDIOS)
  const [empresasSeguridad, setEmpresasSeguridad] = useState<{ id: string; nombre: string }[]>([]);
  // Alcance de aprobación por cliente (Otros Costos, perfiles COORDINADOR/CONTROL)
  const [clientesOc, setClientesOc] = useState<string[]>([]);
  // Administración del catálogo de clientes de Otros Costos (2026-10-21)
  const [clientesOcAdmin, setClientesOcAdmin] = useState<ClienteOtroCosto[]>([]);
  const [nuevoClienteOc, setNuevoClienteOc] = useState({ nombre: '', nit: '' });
  const [guardandoClienteOc, setGuardandoClienteOc] = useState(false);
  const [msgClienteOc, setMsgClienteOc] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [toggleandoClienteOc, setToggleandoClienteOc] = useState<string | null>(null);
  const [modalAlcance, setModalAlcance] = useState<BaseUsuario | null>(null);
  const [alcanceSel, setAlcanceSel] = useState<string[]>([]);
  const [alcanceTodos, setAlcanceTodos] = useState(true);
  const [guardandoAlcance, setGuardandoAlcance] = useState(false);
  const [errorAlcance, setErrorAlcance] = useState('');

  useEffect(() => {
    const perfil = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    if (!usuario || perfil !== 'ADMIN') { router.replace('/LoginUsuario'); return; }
    Promise.all([obtenerUsuarios(), obtenerPerfilesDisponibles()])
      .then(([users, prfs]) => {
        setUsuarios(users);
        if (prfs.length > 0) setPerfiles(prfs);
      })
      .finally(() => setCargando(false));
    // Empresas de Seguridad para el selector (best-effort: si falla, el
    // selector quedará vacío y el backend rechazará con 422 explicativo).
    listarEmpresasCobro()
      .then(emps => setEmpresasSeguridad(emps.map(e => ({ id: e.id, nombre: e.nombre }))))
      .catch(() => {});
    // Catálogo de clientes de Otros Costos (best-effort: si falla, el modal de
    // alcance quedará sin opciones hasta recargar).
    getClientes()
      .then(setClientesOc)
      .catch(() => {});
    // (2026-10-29) Catálogo clientes_siscore: alimenta el selector de clientes
    // asignables a cualquier perfil.
    obtenerClientesSiscore()
      .then(setClientesSiscore)
      .catch(() => {});
    // Apartado de administración del catálogo (crear/deshabilitar clientes).
    getClientesCompletos()
      .then(setClientesOcAdmin)
      .catch(() => {});
  }, [router]);

  // ── Asignación de clientes (clientes_siscore) — cualquier perfil ───────────
  // (2026-10-29) Reemplaza los toggles KABI/MEDICAL_CARE: el desplegable toma
  // los clientes del catálogo clientes_siscore y guarda NITs; el backend deriva
  // los portales clásicos (clientes) de esa asignación.
  const abrirClientes = (u: BaseUsuario) => {
    setModalClientes(u);
    setErrorClientes('');
    setFiltroClientes('');
    setClientesSel(u.clientes_siscore || []);
  };

  const toggleClienteSiscore = (nit: string) => {
    setErrorClientes('');
    setClientesSel(prev => (prev.includes(nit) ? prev.filter(c => c !== nit) : [...prev, nit]));
  };

  const guardarClientes = async () => {
    if (!modalClientes?.id) return;
    setGuardandoClientes(true);
    setErrorClientes('');
    try {
      const res = await actualizarClientesSiscore(modalClientes.id, clientesSel);
      setUsuarios(prev => prev.map(u => u.id === modalClientes.id
        ? { ...u, clientes_siscore: res.clientes_siscore, clientes: res.clientes } : u));
      setModalClientes(null);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErrorClientes(typeof d === 'string' ? d : 'Error al guardar los clientes.');
    } finally {
      setGuardandoClientes(false);
    }
  };

  const clientesFiltrados = () => {
    const f = filtroClientes.trim().toLowerCase();
    if (!f) return clientesSiscore;
    return clientesSiscore.filter(c =>
      (c.entidad || '').toLowerCase().includes(f)
      || (c.razon || '').toLowerCase().includes(f)
      || (c.nit || '').toLowerCase().includes(f)
    );
  };

  // ── Apartado: catálogo de clientes de Otros Costos (2026-10-21) ────────────
  const crearClienteOcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = nuevoClienteOc.nombre.trim();
    if (!nombre) return;
    setGuardandoClienteOc(true);
    setMsgClienteOc(null);
    try {
      const creado = await crearClienteOc(nombre, nuevoClienteOc.nit.trim());
      // Refrescar el catálogo completo (orden alfabético del backend) y el de
      // nombres que consume el modal de alcance.
      setClientesOcAdmin(await getClientesCompletos());
      getClientes().then(setClientesOc).catch(() => {});
      setNuevoClienteOc({ nombre: '', nit: '' });
      setMsgClienteOc({ tipo: 'ok', texto: `✓ Cliente «${creado.nombre}» creado.` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsgClienteOc({ tipo: 'error', texto: msg || 'Error al crear el cliente.' });
    } finally {
      setGuardandoClienteOc(false);
    }
  };

  const toggleClienteOc = async (c: ClienteOtroCosto) => {
    setToggleandoClienteOc(c.id);
    setMsgClienteOc(null);
    try {
      await cambiarEstadoClienteOc(c.id, !c.activo);
      setClientesOcAdmin(prev => prev.map(x => x.id === c.id ? { ...x, activo: !c.activo } : x));
      // El dropdown del formulario solo ofrece activos: refrescar también el
      // catálogo de nombres del modal de alcance.
      getClientes().then(setClientesOc).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsgClienteOc({ tipo: 'error', texto: msg || 'Error al cambiar el estado.' });
    } finally {
      setToggleandoClienteOc(null);
    }
  };

  // ── Alcance de aprobación (Otros Costos) ───────────────────────────────────
  // Mismas reglas del backend: [] = TODOS; los nombres se guardan normalizados
  // (MAYÚSCULAS sin acentos), así que la comparación local también normaliza.
  const normClienteOc = (s: string): string =>
    s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

  const abrirAlcance = (u: BaseUsuario) => {
    setModalAlcance(u);
    setErrorAlcance('');
    const sel = (u.clientes_aprobacion || []).map(normClienteOc).filter(Boolean);
    setAlcanceTodos(sel.length === 0 || sel.includes('TODOS'));
    setAlcanceSel(sel.includes('TODOS') ? [] : sel);
  };

  const toggleAlcanceTodos = () => {
    setErrorAlcance('');
    const nuevo = !alcanceTodos;
    setAlcanceTodos(nuevo);
    if (nuevo) setAlcanceSel([]);
  };

  const toggleAlcanceCliente = (nombre: string) => {
    setErrorAlcance('');
    const n = normClienteOc(nombre);
    setAlcanceSel(prev => (prev.includes(n) ? prev.filter(c => c !== n) : [...prev, n]));
  };

  const guardarAlcance = async () => {
    if (!modalAlcance?.id) return;
    setGuardandoAlcance(true);
    setErrorAlcance('');
    try {
      const lista = alcanceTodos || alcanceSel.length === 0 ? [] : alcanceSel;
      await actualizarClientesAprobacion(modalAlcance.id, lista);
      setUsuarios(prev => prev.map(u => u.id === modalAlcance.id ? { ...u, clientes_aprobacion: lista } : u));
      setModalAlcance(null);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErrorAlcance(typeof d === 'string' ? d : 'Error al guardar el alcance.');
    } finally {
      setGuardandoAlcance(false);
    }
  };

  const cambiarPerfil = async (usuario: BaseUsuario, nuevoPerfil: string, eraClienteFmc = false) => {
    if (!usuario.id || nuevoPerfil === usuario.perfil) return;

    // Si viene de CLIENTE_FMC a un perfil que requiere acceso, pedir clave
    if (eraClienteFmc && nuevoPerfil !== 'CLIENTE_FMC') {
      setModalClavePerfil({ usuario, nuevoPerfil });
      setClavePerfil('');
      setErrorClavePerfil('');
      return;
    }

    setGuardandoPerfil(usuario.id);
    try {
      await actualizarPerfilUsuario(usuario.id, nuevoPerfil);
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, perfil: nuevoPerfil } : u));
    } catch {
      setUsuarios(prev => [...prev]);
    } finally {
      setGuardandoPerfil(null);
    }
  };

  // (2026-10-15) Perfil ADICIONAL PADRINO: el usuario conserva su perfil
  // principal y GANA la entrada al portal de Seguridad en modo simplificado.
  // Solo aplica a perfiles que no sean SEGURIDAD/ADMIN/PADRINO (redundante).
  const togglePadrinoAdicional = async (usuario: BaseUsuario) => {
    if (!usuario.id) return;
    const tiene = (usuario.perfiles_adicionales || []).map(p => p.toUpperCase()).includes('PADRINO');
    const nuevos = tiene ? [] : ['PADRINO'];
    setGuardandoPerfil(usuario.id); // reutiliza el estado de "guardando perfil"
    try {
      const res = await actualizarPerfilesAdicionales(usuario.id, nuevos);
      setUsuarios(prev => prev.map(u => u.id === usuario.id
        ? { ...u, perfiles_adicionales: res.perfiles_adicionales } : u));
    } catch {
      setUsuarios(prev => [...prev]);
    } finally {
      setGuardandoPerfil(null);
    }
  };

  const confirmarCambioPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalClavePerfil) return;
    setErrorClavePerfil('');

    if (clavePerfil.length < 4) {
      setErrorClavePerfil('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setGuardandoClavePerfil(true);
    try {
      const { usuario, nuevoPerfil } = modalClavePerfil;
      await actualizarPerfilUsuario(usuario.id!, nuevoPerfil);
      await actualizarDatosUsuario(usuario.id!, {
        nombre: usuario.nombre,
        correo: usuario.correo || undefined,
        regional: usuario.regional,
        celular: usuario.celular || undefined,
        clave: clavePerfil,
      });
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, perfil: nuevoPerfil } : u));
      setModalClavePerfil(null);
    } catch {
      setErrorClavePerfil('Error al cambiar el perfil.');
    } finally {
      setGuardandoClavePerfil(false);
    }
  };

  const toggleActivo = async (u: BaseUsuario) => {
    if (!u.id) return;
    const nuevoEstado = !(u.activo ?? true);
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const ok = window.confirm(`¿Deseas ${accion} al usuario "${u.usuario}"?`);
    if (!ok) return;
    setToggling(u.id);
    try {
      await toggleActivoUsuario(u.id, nuevoEstado);
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: nuevoEstado } : x));
    } catch {
      alert(`Error al ${accion} el usuario.`);
    } finally {
      setToggling(null);
    }
  };

  const toggleNotifMc = async (usuario: BaseUsuario, notifKey: string) => {
    if (!usuario.id) return;
    const actuales = usuario.notificaciones_mc || [];
    const nuevas = actuales.includes(notifKey)
      ? actuales.filter(n => n !== notifKey)
      : [...actuales, notifKey];
    setGuardandoNotifMc(usuario.id);
    setMsgsNotifMc(m => ({ ...m, [usuario.id!]: '' }));
    try {
      await actualizarNotificacionesMcUsuario(usuario.id, nuevas);
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, notificaciones_mc: nuevas } : u));
      setModalNotifMc(prev => prev?.id === usuario.id ? { ...prev, notificaciones_mc: nuevas } as BaseUsuario : prev);
      setMsgsNotifMc(m => ({ ...m, [usuario.id!]: '✓ Guardado' }));
      setTimeout(() => setMsgsNotifMc(m => ({ ...m, [usuario.id!]: '' })), 2000);
    } catch {
      setMsgsNotifMc(m => ({ ...m, [usuario.id!]: 'Error al guardar' }));
    } finally {
      setGuardandoNotifMc(null);
    }
  };

  const abrirEditar = (u: BaseUsuario) => {
    setFormEditar({
      nombre:   u.nombre || '',
      correo:   u.correo || '',
      regional: u.regional || '',
      celular:  u.celular || '',
      clave:    '',
      usuario:  u.usuario || '',
    });
    setErrorEditar('');
    setModalEditar(u);
  };

  const guardarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar?.id) return;
    setErrorEditar('');
    setGuardandoEditar(true);
    try {
      const res = await actualizarDatosUsuario(modalEditar.id, {
        nombre:   formEditar.nombre,
        correo:   formEditar.correo || undefined,
        regional: formEditar.regional,
        celular:  formEditar.celular || undefined,
        clave:    formEditar.clave || undefined,
        usuario:  formEditar.usuario || undefined,
      });
      setUsuarios(prev => prev.map(u => u.id === modalEditar.id ? { ...u, ...res.usuario } : u));
      setModalEditar(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorEditar(msg || 'Error al guardar.');
    } finally {
      setGuardandoEditar(false);
    }
  };

  const guardarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalReset?.id) return;
    setErrorReset('');

    if (formReset.nuevaClave.length < 4) {
      setErrorReset('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (formReset.nuevaClave !== formReset.confirmarClave) {
      setErrorReset('Las contraseñas no coinciden.');
      return;
    }

    setGuardandoReset(true);
    try {
      await actualizarDatosUsuario(modalReset.id, {
        nombre: modalReset.nombre,
        correo: modalReset.correo || undefined,
        regional: modalReset.regional,
        celular: modalReset.celular || undefined,
        clave: formReset.nuevaClave,
      });
      setModalReset(null);
      setFormReset({ nuevaClave: '', confirmarClave: '' });
    } catch {
      setErrorReset('Error al cambiar la contraseña.');
    } finally {
      setGuardandoReset(false);
    }
  };

  const abrirModal = () => {
    setForm(USUARIO_VACIO);
    setError('');
    setModal(true);
  };

  const cerrarAlClickFondo = (e: React.MouseEvent<HTMLDivElement>, cerrar: () => void) => {
    if (e.target === e.currentTarget) cerrar();
  };

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // (2026-10-29) El perfil CLIENTE (portal Mis Indicadores) necesita al
    // menos un cliente asignado; el resto puede quedar sin asignación y
    // editarse luego con el botón «Clientes» de la fila.
    if (form.perfil === 'CLIENTE' && (form.clientes_siscore || []).length === 0) {
      setError('Selecciona al menos un cliente para el perfil CLIENTE.');
      return;
    }
    if (form.perfil === 'CLIENTE_ESTUDIOS' && !form.empresa_id_seguridad) {
      setError('Selecciona la empresa de Estudios de Seguridad a la que pertenece el usuario.');
      return;
    }
    setGuardando(true);
    try {
      const res = await crearUsuario({
        ...form,
        usuario: form.usuario.toUpperCase().trim(),
        nombre: form.nombre.toUpperCase().trim(),
        clave: form.perfil === 'CLIENTE_FMC' ? 'SIN_ACCESO' : form.clave,
        // CLIENTE_FMC/CLIENTE_ESTUDIOS no usan portales ni asignación.
        clientes_siscore: form.perfil === 'CLIENTE_FMC' || form.perfil === 'CLIENTE_ESTUDIOS' ? [] : (form.clientes_siscore || []),
        clientes: [],
      });
      setUsuarios(prev => [...prev, res.usuario]);
      setModal(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Error al crear el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="GU-layout">
      <NavMedicalCare paginaActual="usuarios" />

      <main className="GU-main">
        <div className="GU-contenedor">
          <div className="GU-seccionHeader">
            <div>
              <h1 className="GU-titulo">Gestión de Usuarios</h1>
              <p className="GU-subtitulo">Crea usuarios y asigna los portales a los que cada uno tiene acceso.</p>
            </div>
            <button className="GU-btnNuevo" onClick={abrirModal}>
              <FaPlus /> Nuevo usuario
            </button>
          </div>

          {cargando ? (
            <div className="GU-loading">Cargando usuarios…</div>
          ) : (
            <div className="GU-tabla-wrap">
              <table className="GU-tabla">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Perfil</th>
                    <th>Regional</th>
                    <th className="GU-th-clientes">Clientes</th>
                    <th className="GU-th-alcance-oc">Alcance OC</th>
                    <th className="GU-th-notif-mc">Notif. MC</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const clientesUsuario = u.clientes || ['KABI'];
                    const activo = u.activo ?? true;
                    const esSoloNotif = u.perfil === 'CLIENTE_FMC';
                    return (
                      <tr key={u.id} className={`GU-fila${activo ? '' : ' GU-fila--inactiva'}`}>
                        <td className="GU-td-usuario">{u.usuario}</td>
                        <td>{u.nombre}</td>
                        <td className="GU-td-correo">{u.correo || ''}</td>
                        <td>
                          <select
                            className={`GU-select-perfil${esSoloNotif ? ' GU-select-perfil--notif' : ''}`}
                            value={u.perfil}
                            disabled={guardandoPerfil === u.id || !activo}
                            onChange={e => cambiarPerfil(u, e.target.value, esSoloNotif)}
                          >
                            {perfiles.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          {/* (2026-10-15) Perfil ADICIONAL: operativo/analista/…
                              que TAMBIÉN es Padrino (portal Seguridad simplificado). */}
                          {activo && !['SEGURIDAD', 'ADMIN', 'PADRINO'].includes(u.perfil) && (
                            <label className="GU-padrino-adicional" title="Agrega el portal de Seguridad en modo Padrino: puede entrar a /revision a cargar documentos y datos de las placas, sin autorizar nada. Su perfil principal no cambia.">
                              <input
                                type="checkbox"
                                checked={(u.perfiles_adicionales || []).map(p => p.toUpperCase()).includes('PADRINO')}
                                disabled={guardandoPerfil === u.id}
                                onChange={() => togglePadrinoAdicional(u)}
                              />
                              <span>+ Padrino</span>
                            </label>
                          )}
                        </td>
                        <td>{u.regional}</td>
                        {/* (2026-10-29) Clientes asignables (catálogo clientes_siscore):
                            reemplaza los toggles KABI/MEDICAL_CARE. El botón abre el
                            modal multi-selección; válido para CUALQUIER perfil. */}
                        <td className="GU-td-alcance-oc">
                          <button
                            className={`GU-btn-alcance-oc${(u.clientes_siscore || []).length > 0 ? ' GU-btn-alcance-oc--restringido' : ''}`}
                            title="Clientes que el usuario puede ver (definen también sus portales Kabi / Medical Care)"
                            disabled={!activo}
                            onClick={() => abrirClientes(u)}
                          >
                            <FaUsers />
                            <span>
                              {(u.clientes_siscore || []).length === 0
                                ? '—'
                                : `${u.clientes_siscore!.length} cliente${u.clientes_siscore!.length === 1 ? '' : 's'}`}
                            </span>
                          </button>
                        </td>
                        <td className="GU-td-alcance-oc">
                          {u.perfil === 'COORDINADOR' || u.perfil === 'CONTROL' ? (
                            <button
                              className={`GU-btn-alcance-oc${(u.clientes_aprobacion || []).length > 0 ? ' GU-btn-alcance-oc--restringido' : ''}`}
                              title="Alcance de aprobación por cliente (Otros Costos)"
                              disabled={!activo}
                              onClick={() => abrirAlcance(u)}
                            >
                              <FaFilter />
                              <span>
                                {(u.clientes_aprobacion || []).length === 0
                                  ? 'TODOS'
                                  : `${u.clientes_aprobacion!.length} cliente${u.clientes_aprobacion!.length === 1 ? '' : 's'}`}
                              </span>
                            </button>
                          ) : '—'}
                        </td>
                        <td className="GU-td-notif-mc">
                          {clientesUsuario.includes('MEDICAL_CARE') || esSoloNotif ? (
                            <button
                              className={`GU-btn-notif-mc${(u.notificaciones_mc || []).length > 0 ? ' GU-btn-notif-mc--activa' : ''}`}
                              title="Editar notificaciones Medical Care"
                              disabled={!activo}
                              onClick={() => setModalNotifMc(u)}
                            >
                              <FaBell />
                              {(u.notificaciones_mc || []).length > 0 && (
                                <span className="GU-notif-mc-badge">{(u.notificaciones_mc || []).length}</span>
                              )}
                            </button>
                          ) : null}
                        </td>
                        <td className={`GU-td-msg ${msgsCliente[u.id || '']?.startsWith('✓') ? 'GU-td-msg--ok' : msgsCliente[u.id || ''] ? 'GU-td-msg--err' : ''}`}>
                          {guardandoCliente === u.id ? 'Guardando…' : msgsCliente[u.id || ''] || ''}
                        </td>
                        <td className="GU-td-acciones">
                          {esSoloNotif ? (
                            <>
                            <button
                              className="GU-btn-editar"
                              title="Editar datos del usuario"
                              onClick={() => abrirEditar(u)}
                            >
                              <FaPencilAlt />
                            </button>
                            <button
                              className={activo ? 'GU-btn-desactivar' : 'GU-btn-activar'}
                              title={activo ? 'Desactivar usuario' : 'Activar usuario'}
                              disabled={toggling === u.id}
                              onClick={() => toggleActivo(u)}
                            >
                              {toggling === u.id ? '…' : activo ? <FaToggleOn /> : <FaToggleOff />}
                            </button>
                            </>
                          ) : (
                            <>
                            <button
                              className="GU-btn-reset"
                              title="Resetear contraseña"
                              disabled={!activo}
                              onClick={() => { setModalReset(u); setFormReset({ nuevaClave: '', confirmarClave: '' }); setErrorReset(''); }}
                            >
                              <FaKey />
                            </button>
                            <button
                              className="GU-btn-editar"
                              title="Editar datos del usuario"
                              onClick={() => abrirEditar(u)}
                            >
                              <FaPencilAlt />
                            </button>
                            <button
                              className={activo ? 'GU-btn-desactivar' : 'GU-btn-activar'}
                              title={activo ? 'Desactivar usuario' : 'Activar usuario'}
                              disabled={toggling === u.id}
                              onClick={() => toggleActivo(u)}
                            >
                              {toggling === u.id ? '…' : activo ? <FaToggleOn /> : <FaToggleOff />}
                            </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ APARTADO: CLIENTES DE OTROS COSTOS (2026-10-21) ═════════════
              Catálogo que alimenta el campo «Cliente» del formulario de
              Otros Costos: crear con NIT + nombre y habilitar/deshabilitar. */}
          <section className="GU-clioc">
            <div className="GU-clioc-header">
              <div>
                <h2 className="GU-clioc-titulo">Clientes — Otros Costos</h2>
                <p className="GU-clioc-sub">
                  Catálogo del campo «Cliente» del formulario de Otros Costos. Al deshabilitar
                  un cliente sale del formulario, pero el histórico y los alcances de aprobación
                  asignados no se pierden.
                </p>
              </div>
            </div>

            <form className="GU-clioc-form" onSubmit={crearClienteOcSubmit}>
              <input
                type="text"
                className="GU-clioc-input GU-clioc-input--nit"
                placeholder="NIT (opcional)"
                value={nuevoClienteOc.nit}
                onChange={e => setNuevoClienteOc(v => ({ ...v, nit: e.target.value }))}
                disabled={guardandoClienteOc}
              />
              <input
                type="text"
                className="GU-clioc-input"
                placeholder="Nombre del cliente *"
                value={nuevoClienteOc.nombre}
                onChange={e => setNuevoClienteOc(v => ({ ...v, nombre: e.target.value }))}
                disabled={guardandoClienteOc}
              />
              <button type="submit" className="GU-clioc-btn" disabled={guardandoClienteOc || !nuevoClienteOc.nombre.trim()}>
                <FaPlus /> {guardandoClienteOc ? 'Creando…' : 'Crear cliente'}
              </button>
            </form>
            {msgClienteOc && (
              <p className={`GU-clioc-msg GU-clioc-msg--${msgClienteOc.tipo}`}>{msgClienteOc.texto}</p>
            )}

            <div className="GU-clioc-tabla-wrap">
              <table className="GU-clioc-tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>NIT</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientesOcAdmin.length === 0 && (
                    <tr><td colSpan={4} className="GU-clioc-vacio">Sin clientes en el catálogo.</td></tr>
                  )}
                  {clientesOcAdmin.map(c => (
                    <tr key={c.id} className={c.activo ? '' : 'GU-clioc-fila--inactiva'}>
                      <td className="GU-clioc-td-nombre">{c.nombre}</td>
                      <td className="GU-clioc-td-nit">{c.nit || '—'}</td>
                      <td>
                        <span className={`GU-clioc-chip GU-clioc-chip--${c.activo ? 'activo' : 'inactivo'}`}>
                          {c.activo ? 'Activo' : 'Deshabilitado'}
                        </span>
                      </td>
                      <td className="GU-clioc-td-accion">
                        <button
                          type="button"
                          className={`GU-clioc-toggle GU-clioc-toggle--${c.activo ? 'off' : 'on'}`}
                          title={c.activo ? 'Deshabilitar (sale del formulario de Otros Costos)' : 'Volver a habilitar'}
                          disabled={toggleandoClienteOc === c.id}
                          onClick={() => toggleClienteOc(c)}
                        >
                          {toggleandoClienteOc === c.id ? '…' : c.activo ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="GU-footer">
        <div className="GU-footerInner">
          <div className="GU-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="GU-footerLinks">
            <a href="tel:+573125443396" className="GU-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="GU-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="GU-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="GU-footerCopy">© {new Date().getFullYear()} Integra — Torre de Control</span>
        </div>
      </footer>

      {/* ══ MODAL: NUEVO USUARIO ══ */}
      {modal && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModal(false))}>
          <div className="GU-modalCard" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <h3 className="GU-modalTitulo">Nuevo usuario</h3>
              <button className="GU-modalCerrar" onClick={() => setModal(false)}><FaTimes /></button>
            </div>

            <form className="GU-modalForm" onSubmit={guardarUsuario}>
              <div className="GU-formGrid">
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Nombre completo *</label>
                  <input className="GU-formInput" type="text" placeholder="JUAN PÉREZ" required
                    value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Usuario *</label>
                  <input className="GU-formInput GU-formInput--upper" type="text" placeholder="JPEREZ" required
                    value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Perfil *</label>
                  <select className="GU-formInput" required
                    value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}>
                    {perfiles.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {/* (2026-10-15) Perfil adicional: crear ya con acceso Padrino. */}
                  {!['SEGURIDAD', 'ADMIN', 'PADRINO', 'CLIENTE_FMC', 'CLIENTE_ESTUDIOS'].includes(form.perfil) && (
                    <label className="GU-padrino-adicional" title="Podrá entrar además al portal de Seguridad en modo Padrino (cargar documentos y datos, sin autorizar nada).">
                      <input
                        type="checkbox"
                        checked={(form.perfiles_adicionales || []).includes('PADRINO')}
                        onChange={e => setForm(f => ({
                          ...f,
                          perfiles_adicionales: e.target.checked ? ['PADRINO'] : [],
                        }))}
                      />
                      <span>+ Padrino (portal Seguridad simplificado)</span>
                    </label>
                  )}
                </div>
                {form.perfil !== 'CLIENTE_FMC' && (
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Contraseña *</label>
                  <input className="GU-formInput" type="text" placeholder="Contraseña inicial" required
                    value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} />
                </div>
                )}
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Regional *</label>
                  <select className="GU-formInput" required
                    value={form.regional} onChange={e => setForm(f => ({ ...f, regional: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Correo {form.perfil === 'CLIENTE_FMC' && '*'}</label>
                  <input className="GU-formInput" type="email" placeholder="correo@ejemplo.com"
                    required={form.perfil === 'CLIENTE_FMC'}
                    value={form.correo || ''} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Celular</label>
                  <input className="GU-formInput" type="text" placeholder="3001234567"
                    value={form.celular || ''} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} />
                </div>
                {form.perfil === 'CLIENTE_ESTUDIOS' && (
                <>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Empresa de Estudios de Seguridad *</label>
                  <select className="GU-formInput" required
                    value={form.empresa_id_seguridad || ''}
                    onChange={e => setForm(f => ({ ...f, empresa_id_seguridad: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {empresasSeguridad.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Rol en Seguridad</label>
                  <select className="GU-formInput"
                    value={form.rol_seguridad || 'CONSULTADOR'}
                    onChange={e => setForm(f => ({ ...f, rol_seguridad: e.target.value }))}>
                    <option value="CONSULTADOR">CONSULTADOR (consulta)</option>
                    <option value="ADMIN_EMPRESA">ADMIN_EMPRESA (administra su empresa)</option>
                  </select>
                </div>
                </>
                )}
                {form.perfil !== 'CLIENTE_FMC' && form.perfil !== 'CLIENTE_ESTUDIOS' && (
                <div className="GU-formGrupo GU-formGrupo--full">
                  <label className="GU-formLabel">
                    Clientes {form.perfil === 'CLIENTE' ? '*' : ''}
                    <span className="GU-formLabel--opcional"> (catálogo clientes_siscore — definen sus portales y tableros)</span>
                  </label>
                  <div className="GU-alcance-lista GU-alcance-lista--form">
                    {clientesSiscore.length === 0 && (
                      <p className="GU-notif-mc-opcion-desc">No se pudo cargar el catálogo clientes_siscore; recargue la página.</p>
                    )}
                    {clientesSiscore.map(c => {
                      const checked = (form.clientes_siscore || []).includes(c.nit);
                      return (
                        <label key={c.id} className={`GU-notif-mc-opcion${checked ? ' GU-notif-mc-opcion--activa' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setForm(f => ({
                              ...f,
                              clientes_siscore: checked
                                ? (f.clientes_siscore || []).filter(n => n !== c.nit)
                                : [...(f.clientes_siscore || []), c.nit],
                            }))}
                          />
                          <div className="GU-notif-mc-opcion-info">
                            <span className="GU-notif-mc-opcion-label">{c.razon || c.entidad}</span>
                            <span className="GU-notif-mc-opcion-desc">{c.entidad} — NIT {c.nit}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>

              {error && <p className="GU-formError">{error}</p>}

              <div className="GU-modalFooter">
                <button type="button" className="GU-btnCancelar" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="GU-btnGuardar" disabled={guardando}>
                  <FaSave /> {guardando ? 'Guardando…' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ══ MODAL: EDITAR USUARIO ══ */}
      {modalEditar && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModalEditar(null))}>
          <div className="GU-modalCard" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <div>
                <h3 className="GU-modalTitulo">Editar usuario</h3>
                <p className="GU-modal-sub">{modalEditar.usuario}</p>
              </div>
              <button className="GU-modalCerrar" onClick={() => setModalEditar(null)}><FaTimes /></button>
            </div>
            <form className="GU-modalForm" onSubmit={guardarEditar}>
              <div className="GU-formGrid">
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Nombre completo *</label>
                  <input className="GU-formInput" type="text" required
                    value={formEditar.nombre}
                    onChange={e => setFormEditar(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Usuario *</label>
                  <input className="GU-formInput GU-formInput--upper" type="text" required
                    value={formEditar.usuario}
                    onChange={e => setFormEditar(f => ({ ...f, usuario: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Regional *</label>
                  <select className="GU-formInput" required
                    value={formEditar.regional}
                    onChange={e => setFormEditar(f => ({ ...f, regional: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Correo</label>
                  <input className="GU-formInput" type="email" placeholder="correo@ejemplo.com"
                    value={formEditar.correo}
                    onChange={e => setFormEditar(f => ({ ...f, correo: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Celular</label>
                  <input className="GU-formInput" type="text" placeholder="3001234567"
                    value={formEditar.celular}
                    onChange={e => setFormEditar(f => ({ ...f, celular: e.target.value }))} />
                </div>
                <div className="GU-formGrupo GU-formGrupo--full">
                  <label className="GU-formLabel">Nueva contraseña <span className="GU-formLabel--opcional">(dejar vacío para no cambiarla)</span></label>
                  <input className="GU-formInput" type="text" placeholder="Nueva contraseña"
                    value={formEditar.clave}
                    onChange={e => setFormEditar(f => ({ ...f, clave: e.target.value }))} />
                </div>
              </div>
              {errorEditar && <p className="GU-formError">{errorEditar}</p>}
              <div className="GU-modalFooter">
                <button type="button" className="GU-btnCancelar" onClick={() => setModalEditar(null)}>Cancelar</button>
                <button type="submit" className="GU-btnGuardar" disabled={guardandoEditar}>
                  <FaSave /> {guardandoEditar ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: RESETEAR CONTRASEÑA ══ */}
      {modalReset && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModalReset(null))}>
          <div className="GU-modalCard GU-modalCard--sm" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <div>
                <h3 className="GU-modalTitulo"><FaKey style={{ marginRight: 8, color: '#b45309' }} />Resetear contraseña</h3>
                <p className="GU-modal-sub">{modalReset.nombre} ({modalReset.usuario})</p>
              </div>
              <button className="GU-modalCerrar" onClick={() => setModalReset(null)}><FaTimes /></button>
            </div>
            <form className="GU-modalForm" onSubmit={guardarReset}>
              <div className="GU-formGrid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Nueva contraseña *</label>
                  <input className="GU-formInput" type="text" placeholder="Nueva contraseña"
                    value={formReset.nuevaClave}
                    onChange={e => setFormReset(f => ({ ...f, nuevaClave: e.target.value }))}
                    required autoFocus />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Confirmar contraseña *</label>
                  <input className="GU-formInput" type="text" placeholder="Repetir contraseña"
                    value={formReset.confirmarClave}
                    onChange={e => setFormReset(f => ({ ...f, confirmarClave: e.target.value }))}
                    required />
                </div>
              </div>
              {errorReset && <p className="GU-formError">{errorReset}</p>}
              <div className="GU-modalFooter">
                <button type="button" className="GU-btnCancelar" onClick={() => setModalReset(null)}>Cancelar</button>
                <button type="submit" className="GU-btnGuardar" disabled={guardandoReset}>
                  <FaSave /> {guardandoReset ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: CLAVE AL CAMBIAR PERFIL ══ */}
      {modalClavePerfil && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModalClavePerfil(null))}>
          <div className="GU-modalCard GU-modalCard--sm" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <div>
                <h3 className="GU-modalTitulo">Asignar contraseña</h3>
                <p className="GU-modal-sub">Al cambiar de <strong>CLIENTE_FMC</strong> a <strong>{modalClavePerfil.nuevoPerfil}</strong> se requiere una contraseña para el acceso al sistema.</p>
              </div>
              <button className="GU-modalCerrar" onClick={() => { setModalClavePerfil(null); setUsuarios(prev => [...prev]); }}><FaTimes /></button>
            </div>
            <form className="GU-modalForm" onSubmit={confirmarCambioPerfil}>
              <div className="GU-formGrid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Nueva contraseña *</label>
                  <input className="GU-formInput" type="text" placeholder="Contraseña de acceso"
                    value={clavePerfil}
                    onChange={e => setClavePerfil(e.target.value)}
                    required autoFocus />
                </div>
              </div>
              {errorClavePerfil && <p className="GU-formError">{errorClavePerfil}</p>}
              <div className="GU-modalFooter">
                <button type="button" className="GU-btnCancelar" onClick={() => { setModalClavePerfil(null); setUsuarios(prev => [...prev]); }}>Cancelar</button>
                <button type="submit" className="GU-btnGuardar" disabled={guardandoClavePerfil}>
                  <FaSave /> {guardandoClavePerfil ? 'Guardando…' : 'Confirmar cambio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: NOTIFICACIONES MC ══ */}
      {modalNotifMc && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModalNotifMc(null))}>
          <div className="GU-modalCard GU-modalCard--sm" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <div>
                <h3 className="GU-modalTitulo"><FaBell style={{ marginRight: 8, color: '#004d40' }} />Notificaciones MC</h3>
                <p className="GU-modal-sub">{modalNotifMc.nombre}</p>
              </div>
              <button className="GU-modalCerrar" onClick={() => setModalNotifMc(null)}><FaTimes /></button>
            </div>
            <div className="GU-notif-mc-body">
              {NOTIFICACIONES_MC.map(n => {
                const checked = (modalNotifMc.notificaciones_mc || []).includes(n.key);
                const saving = guardandoNotifMc === modalNotifMc.id;
                return (
                  <label
                    key={n.key}
                    className={`GU-notif-mc-opcion${checked ? ' GU-notif-mc-opcion--activa' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() => toggleNotifMc(modalNotifMc, n.key)}
                    />
                    <div className="GU-notif-mc-opcion-info">
                      <span className="GU-notif-mc-opcion-label">{n.label}</span>
                      <span className="GU-notif-mc-opcion-desc">{n.desc}</span>
                    </div>
                  </label>
                );
              })}
              {msgsNotifMc[modalNotifMc.id || ''] && (
                <p className={`GU-notif-mc-feedback${msgsNotifMc[modalNotifMc.id || ''].startsWith('✓') ? '--ok' : '--err'}`}>
                  {msgsNotifMc[modalNotifMc.id || '']}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CLIENTES ASIGNADOS (clientes_siscore) ══
          (2026-10-29) Reemplaza los toggles KABI/MEDICAL_CARE: asigna qué
          clientes puede ver el usuario, tomados del catálogo clientes_siscore.
          Aplica a CUALQUIER perfil; el backend deriva los portales clásicos. */}
      {modalClientes && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModalClientes(null))}>
          <div className="GU-modalCard GU-modalCard--sm" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <div>
                <h3 className="GU-modalTitulo"><FaUsers style={{ marginRight: 8, color: '#004d40' }} />Clientes asignados</h3>
                <p className="GU-modal-sub">{modalClientes.nombre} ({modalClientes.perfil})</p>
              </div>
              <button className="GU-modalCerrar" onClick={() => setModalClientes(null)}><FaTimes /></button>
            </div>
            <div className="GU-alcance-body">
              {modalClientes.clientes_siscore == null && (
                <p className="GU-notif-mc-opcion-desc">
                  Este usuario es anterior a la asignación por cliente y aún usa los portales clásicos
                  ({(modalClientes.clientes || []).join(', ') || 'ninguno'}). Al guardar, la lista de abajo pasa a ser la fuente de verdad.
                </p>
              )}
              <input
                type="text"
                className="GU-formInput"
                placeholder="Buscar cliente (nombre, razón social o NIT)…"
                value={filtroClientes}
                onChange={e => setFiltroClientes(e.target.value)}
                disabled={guardandoClientes}
              />
              <div className="GU-alcance-lista">
                {clientesSiscore.length === 0 && (
                  <p className="GU-notif-mc-opcion-desc">No se pudo cargar el catálogo clientes_siscore; recargue la página.</p>
                )}
                {clientesFiltrados().map(c => {
                  const checked = clientesSel.includes(c.nit);
                  return (
                    <label key={c.id} className={`GU-notif-mc-opcion${checked ? ' GU-notif-mc-opcion--activa' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={guardandoClientes}
                        onChange={() => toggleClienteSiscore(c.nit)}
                      />
                      <div className="GU-notif-mc-opcion-info">
                        <span className="GU-notif-mc-opcion-label">{c.razon || c.entidad}</span>
                        <span className="GU-notif-mc-opcion-desc">{c.entidad} — NIT {c.nit}</span>
                      </div>
                    </label>
                  );
                })}
                {clientesSiscore.length > 0 && clientesFiltrados().length === 0 && (
                  <p className="GU-notif-mc-opcion-desc">Ningún cliente coincide con «{filtroClientes}».</p>
                )}
              </div>
              {clientesSel.length > 0 && (
                <p className="GU-notif-mc-opcion-desc">{clientesSel.length} cliente(s) seleccionado(s).</p>
              )}
              {errorClientes && <p className="GU-notif-mc-feedback--err">{errorClientes}</p>}
              <div className="GU-alcance-acciones">
                <button className="GU-btnCancelar" onClick={() => setModalClientes(null)} disabled={guardandoClientes}>
                  Cancelar
                </button>
                <button className="GU-btnGuardar" onClick={guardarClientes} disabled={guardandoClientes}>
                  <FaSave /> {guardandoClientes ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: ALCANCE DE APROBACIÓN (OTROS COSTOS) ══ */}
      {modalAlcance && (
        <div className="GU-modalOverlay" onMouseDown={(e) => cerrarAlClickFondo(e, () => setModalAlcance(null))}>
          <div className="GU-modalCard GU-modalCard--sm" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="GU-modalHeader">
              <div>
                <h3 className="GU-modalTitulo"><FaFilter style={{ marginRight: 8, color: '#004d40' }} />Alcance de aprobación — Otros Costos</h3>
                <p className="GU-modal-sub">{modalAlcance.nombre} ({modalAlcance.perfil})</p>
              </div>
              <button className="GU-modalCerrar" onClick={() => setModalAlcance(null)}><FaTimes /></button>
            </div>
            <div className="GU-alcance-body">
              <label className={`GU-notif-mc-opcion${alcanceTodos ? ' GU-notif-mc-opcion--activa' : ''}`}>
                <input
                  type="checkbox"
                  checked={alcanceTodos || alcanceSel.length === 0}
                  disabled={guardandoAlcance}
                  onChange={toggleAlcanceTodos}
                />
                <div className="GU-notif-mc-opcion-info">
                  <span className="GU-notif-mc-opcion-label">TODOS</span>
                  <span className="GU-notif-mc-opcion-desc">Puede aprobar, ver y recibir notificaciones de todos los clientes.</span>
                </div>
              </label>
              <div className="GU-alcance-separador">O sólo estos clientes:</div>
              <div className="GU-alcance-lista">
                {clientesOc.length === 0 && (
                  <p className="GU-notif-mc-opcion-desc">No se pudo cargar el catálogo de clientes; recargue la página.</p>
                )}
                {clientesOc.map(nombre => {
                  const checked = !alcanceTodos && alcanceSel.includes(normClienteOc(nombre));
                  return (
                    <label key={nombre} className={`GU-notif-mc-opcion${checked ? ' GU-notif-mc-opcion--activa' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={guardandoAlcance || alcanceTodos}
                        onChange={() => toggleAlcanceCliente(nombre)}
                      />
                      <div className="GU-notif-mc-opcion-info">
                        <span className="GU-notif-mc-opcion-label">{nombre}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              {errorAlcance && <p className="GU-notif-mc-feedback--err">{errorAlcance}</p>}
              <div className="GU-alcance-acciones">
                <button className="GU-btnCancelar" onClick={() => setModalAlcance(null)} disabled={guardandoAlcance}>
                  Cancelar
                </button>
                <button className="GU-btnGuardar" onClick={guardarAlcance} disabled={guardandoAlcance}>
                  <FaSave /> {guardandoAlcance ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionUsuariosP;
