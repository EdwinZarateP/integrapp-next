'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaArrowLeft, FaPlus, FaTimes, FaSave,
} from 'react-icons/fa';
import { obtenerUsuarios, crearUsuario, actualizarClientesUsuario } from '@/Funciones/ApiPedidos/usuarios';
import { BaseUsuario } from '@/Funciones/ApiPedidos/tipos';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const CLIENTES_DISPONIBLES = [
  { key: 'KABI', label: 'Fresenius Kabi' },
  { key: 'MEDICAL_CARE', label: 'Fresenius Medical Care' },
];

const PERFILES = ['ADMIN', 'OPERATIVO', 'SEGURIDAD', 'CONDUCTOR'];

const USUARIO_VACIO: BaseUsuario = {
  nombre: '', correo: '', regional: '', celular: '',
  perfil: 'OPERATIVO', usuario: '', clave: '', clientes: ['KABI'],
};

const GestionUsuariosP: React.FC = () => {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<BaseUsuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoCliente, setGuardandoCliente] = useState<string | null>(null);
  const [msgsCliente, setMsgsCliente] = useState<Record<string, string>>({});
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<BaseUsuario>(USUARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const perfil = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    if (!usuario || perfil !== 'ADMIN') { router.replace('/LoginUsuario'); return; }
    obtenerUsuarios()
      .then(data => setUsuarios(data))
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
                    <th>Perfil</th>
                    <th>Regional</th>
                    {CLIENTES_DISPONIBLES.map(c => (
                      <th key={c.key} className="GU-th-cliente">{c.label}</th>
                    ))}
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const clientesUsuario = u.clientes || ['KABI'];
                    return (
                      <tr key={u.id} className="GU-fila">
                        <td className="GU-td-usuario">{u.usuario}</td>
                        <td>{u.nombre}</td>
                        <td><span className="GU-badge">{u.perfil}</span></td>
                        <td>{u.regional}</td>
                        {CLIENTES_DISPONIBLES.map(c => (
                          <td key={c.key} className="GU-td-check">
                            <label className="GU-toggle">
                              <input
                                type="checkbox"
                                checked={clientesUsuario.includes(c.key)}
                                disabled={guardandoCliente === u.id}
                                onChange={() => toggleCliente(u, c.key)}
                              />
                              <span className="GU-toggleSlider" />
                            </label>
                          </td>
                        ))}
                        <td className={`GU-td-msg ${msgsCliente[u.id || '']?.startsWith('✓') ? 'GU-td-msg--ok' : msgsCliente[u.id || ''] ? 'GU-td-msg--err' : ''}`}>
                          {guardandoCliente === u.id ? 'Guardando…' : msgsCliente[u.id || ''] || ''}
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
                  <label className="GU-formLabel">Contraseña *</label>
                  <input className="GU-formInput" type="text" placeholder="Contraseña inicial" required
                    value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Perfil *</label>
                  <select className="GU-formInput" required
                    value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}>
                    {PERFILES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Regional *</label>
                  <input className="GU-formInput" type="text" placeholder="FUNZA" required
                    value={form.regional} onChange={e => setForm(f => ({ ...f, regional: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Correo</label>
                  <input className="GU-formInput" type="email" placeholder="correo@ejemplo.com"
                    value={form.correo || ''} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
                </div>
                <div className="GU-formGrupo">
                  <label className="GU-formLabel">Celular</label>
                  <input className="GU-formInput" type="text" placeholder="3001234567"
                    value={form.celular || ''} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} />
                </div>
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
    </div>
  );
};

export default GestionUsuariosP;
