'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaArrowLeft, FaPlus, FaTimes, FaSave, FaToggleOn, FaToggleOff, FaBell, FaPencilAlt, FaKey,
} from 'react-icons/fa';
import { obtenerUsuarios, crearUsuario, actualizarClientesUsuario, actualizarPerfilUsuario, obtenerPerfilesDisponibles, toggleActivoUsuario, actualizarNotificacionesMcUsuario, actualizarDatosUsuario } from '@/Funciones/ApiPedidos/usuarios';
import { BaseUsuario } from '@/Funciones/ApiPedidos/tipos';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const CLIENTES_DISPONIBLES = [
  { key: 'KABI', label: 'Fresenius Kabi' },
  { key: 'MEDICAL_CARE', label: 'Fresenius Medical Care' },
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

const PERFILES_FALLBACK = ['ADMIN', 'ANALISTA', 'CONDUCTOR', 'CONTROL', 'COORDINADOR', 'DESPACHADOR', 'OPERADOR', 'OPERATIVO', 'SEGURIDAD'];

const USUARIO_VACIO: BaseUsuario = {
  nombre: '', correo: '', regional: '', celular: '',
  perfil: 'OPERATIVO', usuario: '', clave: '', clientes: ['KABI'],
};

const GestionUsuariosP: React.FC = () => {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<BaseUsuario[]>([]);
  const [perfiles, setPerfiles] = useState<string[]>(PERFILES_FALLBACK);
  const [cargando, setCargando] = useState(true);
  const [guardandoCliente, setGuardandoCliente] = useState<string | null>(null);
  const [msgsCliente, setMsgsCliente] = useState<Record<string, string>>({});
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
  const [formEditar, setFormEditar] = useState({ nombre: '', correo: '', regional: '', celular: '', clave: '' });
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
  }, [router]);

  const toggleCliente = async (usuario: BaseUsuario, clienteKey: string) => {
    if (!usuario.id) return;
    const actuales = usuario.clientes || ['KABI'];
    const nuevos = actuales.includes(clienteKey)
      ? actuales.filter(c => c !== clienteKey)
      : [...actuales, clienteKey];
    if (nuevos.length === 0) {
      setMsgsCliente(m => ({ ...m, [usuario.id!]: 'Debe tener al menos un cliente.' }));
      return;
    }
    setGuardandoCliente(usuario.id);
    setMsgsCliente(m => ({ ...m, [usuario.id!]: '' }));
    try {
      await actualizarClientesUsuario(usuario.id, nuevos);
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, clientes: nuevos } : u));
      setMsgsCliente(m => ({ ...m, [usuario.id!]: '✓ Guardado' }));
      setTimeout(() => setMsgsCliente(m => ({ ...m, [usuario.id!]: '' })), 2000);
    } catch {
      setMsgsCliente(m => ({ ...m, [usuario.id!]: 'Error al guardar.' }));
    } finally {
      setGuardandoCliente(null);
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
      await actualizarPerfilUsuario(usuario.id, nuevoPerfil);
      await actualizarDatosUsuario(usuario.id, {
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

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const res = await crearUsuario({
        ...form,
        usuario: form.usuario.toUpperCase().trim(),
        nombre: form.nombre.toUpperCase().trim(),
        clave: form.perfil === 'CLIENTE_FMC' ? 'SIN_ACCESO' : form.clave,
        clientes: form.perfil === 'CLIENTE_FMC' ? [] : form.clientes,
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

      {/* ── HEADER ── */}
      <header className="GU-header">
        <div className="GU-headerInner">
          <button className="GU-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="GU-brandName">Integr<span className="GU-brandAccent">App</span></span>
          </button>
          <button className="GU-backBtn" onClick={() => router.back()}>
            <FaArrowLeft /> Volver
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
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
                    {CLIENTES_DISPONIBLES.map(c => (
                      <th key={c.key} className="GU-th-cliente">{c.label}</th>
                    ))}
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
                        </td>
                        <td>{u.regional}</td>
                        {CLIENTES_DISPONIBLES.map(c => (
                          <td key={c.key} className="GU-td-check">
                            {esSoloNotif ? null : (
                            <label className="GU-toggle">
                              <input
                                type="checkbox"
                                checked={clientesUsuario.includes(c.key)}
                                disabled={guardandoCliente === u.id || !activo}
                                onChange={() => toggleCliente(u, c.key)}
                              />
                              <span className="GU-toggleSlider" />
                            </label>
                            )}
                          </td>
                        ))}
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
                          {esSoloNotif ? null : (
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
        <div className="GU-modalOverlay" onClick={() => setModal(false)}>
          <div className="GU-modalCard" onClick={e => e.stopPropagation()}>
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
                  <input className="GU-formInput" type="text" placeholder="FUNZA" required
                    value={form.regional} onChange={e => setForm(f => ({ ...f, regional: e.target.value }))} />
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
                {form.perfil !== 'CLIENTE_FMC' && (
                <div className="GU-formGrupo GU-formGrupo--full">
                  <label className="GU-formLabel">Acceso a clientes</label>
                  <div className="GU-checkGrupo">
                    {CLIENTES_DISPONIBLES.map(c => (
                      <label key={c.key} className="GU-checkItem">
                        <input
                          type="checkbox"
                          checked={(form.clientes || []).includes(c.key)}
                          onChange={() => {
                            const actuales = form.clientes || [];
                            const nuevos = actuales.includes(c.key)
                              ? actuales.filter(x => x !== c.key)
                              : [...actuales, c.key];
                            if (nuevos.length > 0) setForm(f => ({ ...f, clientes: nuevos }));
                          }}
                        />
                        {c.label}
                      </label>
                    ))}
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
        <div className="GU-modalOverlay" onClick={() => setModalEditar(null)}>
          <div className="GU-modalCard" onClick={e => e.stopPropagation()}>
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
                  <label className="GU-formLabel">Regional *</label>
                  <input className="GU-formInput" type="text" required
                    value={formEditar.regional}
                    onChange={e => setFormEditar(f => ({ ...f, regional: e.target.value }))} />
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
        <div className="GU-modalOverlay" onClick={() => setModalReset(null)}>
          <div className="GU-modalCard GU-modalCard--sm" onClick={e => e.stopPropagation()}>
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
        <div className="GU-modalOverlay" onClick={() => setModalClavePerfil(null)}>
          <div className="GU-modalCard GU-modalCard--sm" onClick={e => e.stopPropagation()}>
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
        <div className="GU-modalOverlay" onClick={() => setModalNotifMc(null)}>
          <div className="GU-modalCard GU-modalCard--sm" onClick={e => e.stopPropagation()}>
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
    </div>
  );
};

export default GestionUsuariosP;
