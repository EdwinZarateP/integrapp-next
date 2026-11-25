/**
 * Configuración Medical Care (/ConfigMC) — 2026-11-25, 5.ª tanda.
 *
 * Hogar definitivo de las dos funciones ADMIN/CONTROL que vivían SOLO en la
 * pantalla de botones de /MedicalCare (eliminada: la navegación vive en el
 * hub y esa pantalla era redundante):
 *   1. Causales de fusión de planillas (dropdown de Solicitud de Vehículos).
 *   2. Configuración del Sync V3 (horarios programados + on/off).
 *
 * APIs intactas: /siscore/causales* y /sync-v3/*.
 * Perfiles: ADMIN y CONTROL (mismo gate que tenía la pantalla original).
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FaFilter, FaCog, FaPlus, FaTrash, FaTimes, FaEye, FaEyeSlash, FaEdit, FaCheckCircle,
} from 'react-icons/fa';
import HeaderModulo from '@/Componentes/HeaderModulo';
import { hogarPorPerfil } from '@/Funciones/hogarPorPerfil';
import { trackAccion } from '@/Funciones/telemetriaApp';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
const PERFILES_PERMITIDOS = ['ADMIN', 'CONTROL'];

const ConfigMCP: React.FC = () => {
  const router = useRouter();
  const [perfil, setPerfil] = useState('');
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  // ── Sync V3 ──
  const [syncConfig, setSyncConfig] = useState<{ horarios: string[]; activo: boolean } | null>(null);
  const [nuevoHorario, setNuevoHorario] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);

  // ── Causales de fusión ──
  const [causales, setCausales] = useState<{ _id: string; nombre: string; activo: boolean }[]>([]);
  const [nuevaCausal, setNuevaCausal] = useState('');
  const [loadingCausales, setLoadingCausales] = useState(false);
  const [causalEditando, setCausalEditando] = useState<string | null>(null);
  const [nombreEditando, setNombreEditando] = useState('');

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '').toUpperCase();
    setPerfil(p);
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (!PERFILES_PERMITIDOS.includes(p)) { setAutorizado(false); return; }
    setAutorizado(true);
    cargarConfigSync();
    cargarCausales();
  }, [router]);

  // ── Sync V3 ──
  const cargarConfigSync = async () => {
    setLoadingConfig(true);
    try {
      const response = await fetch(`${API}/sync-v3/config`);
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios || [], activo: data.activo ?? true });
      }
    } catch (error) {
      console.error('Error al cargar config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleAgregarHorario = async () => {
    if (!nuevoHorario) return;
    try {
      const response = await fetch(`${API}/sync-v3/horarios?horario=${nuevoHorario}`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios, activo: data.activo });
        setNuevoHorario('');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al agregar horario');
      }
    } catch (error) {
      console.error('Error al agregar horario:', error);
      alert('Error al agregar horario');
    }
  };

  const handleEliminarHorario = async (horario: string) => {
    if (!confirm(`¿Eliminar el horario ${horario}?`)) return;
    try {
      const response = await fetch(`${API}/sync-v3/horarios/${horario}`, { method: 'DELETE' });
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios, activo: data.activo });
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al eliminar horario');
      }
    } catch (error) {
      console.error('Error al eliminar horario:', error);
      alert('Error al eliminar horario');
    }
  };

  const handleToggleActivo = async () => {
    if (!syncConfig) return;
    trackAccion('toggle_sync_v3');
    try {
      const response = await fetch(`${API}/sync-v3/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !syncConfig.activo }),
      });
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({ horarios: data.horarios, activo: data.activo });
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  };

  // ── Causales de fusión ──
  const cargarCausales = async () => {
    setLoadingCausales(true);
    try {
      // Inicializar causales por defecto si no existen (idempotente).
      await fetch(`${API}/siscore/causales/inicializar`, { method: 'POST' });
      const response = await fetch(`${API}/siscore/causales/todas`);
      if (response.ok) {
        const data = await response.json();
        setCausales(data.causales || []);
      }
    } catch (error) {
      alert('Error al cargar causales');
    } finally {
      setLoadingCausales(false);
    }
  };

  const handleCrearCausal = async () => {
    if (!nuevaCausal.trim()) return;
    trackAccion('crear_causal');
    try {
      const response = await fetch(`${API}/siscore/causales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevaCausal.trim(), activo: true }),
      });
      if (response.ok) {
        await cargarCausales();
        setNuevaCausal('');
        alert('Causal creada exitosamente');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al crear causal');
      }
    } catch {
      alert('Error al crear causal');
    }
  };

  const handleActualizarCausal = async (id: string, nuevoNombre: string) => {
    if (!nuevoNombre.trim()) {
      alert('El nombre no puede estar vacío');
      return;
    }
    try {
      const causal = causales.find(c => c._id === id);
      if (!causal) return;
      const response = await fetch(`${API}/siscore/causales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), activo: causal.activo }),
      });
      if (response.ok) {
        await cargarCausales();
        setCausalEditando(null);
        setNombreEditando('');
        alert('Causal actualizada exitosamente');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al actualizar causal');
      }
    } catch {
      alert('Error al actualizar causal');
    }
  };

  const iniciarEdicion = (id: string, nombre: string) => {
    setCausalEditando(id);
    setNombreEditando(nombre);
  };

  const cancelarEdicion = () => {
    setCausalEditando(null);
    setNombreEditando('');
  };

  const guardarEdicion = (id: string) => {
    handleActualizarCausal(id, nombreEditando);
  };

  const handleEliminarCausal = async (id: string) => {
    if (!confirm('¿Eliminar esta causal?')) return;
    trackAccion('eliminar_causal');
    try {
      const response = await fetch(`${API}/siscore/causales/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await cargarCausales();
        alert('Causal eliminada exitosamente');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al eliminar causal');
      }
    } catch {
      alert('Error al eliminar causal');
    }
  };

  const handleToggleCausalActiva = async (id: string, activo: boolean) => {
    try {
      const causal = causales.find(c => c._id === id);
      if (!causal) return;
      // Actualización optimista del estado local
      const nuevasCausales = causales.map(c => (c._id === id ? { ...c, activo } : c));
      setCausales(nuevasCausales);
      const response = await fetch(`${API}/siscore/causales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: causal.nombre, activo }),
      });
      if (response.ok) {
        await cargarCausales();
      } else {
        await cargarCausales();
        const error = await response.json();
        alert(error.detail || 'Error al actualizar estado');
      }
    } catch {
      await cargarCausales();
      alert('Error al actualizar estado de causal');
    }
  };

  if (autorizado === null) {
    return (
      <div className="CM-layout">
        <HeaderModulo titulo="Configuración Medical Care" />
        <main className="CM-main"><p className="CM-aviso">Cargando…</p></main>
      </div>
    );
  }
  if (!autorizado) {
    return (
      <div className="CM-layout">
        <HeaderModulo titulo="Configuración Medical Care" />
        <main className="CM-main">
          <div className="CM-card">
            <h2>Acceso restringido</h2>
            <p>Esta configuración está disponible solo para los perfiles ADMIN y CONTROL.</p>
            <button onClick={() => router.push(hogarPorPerfil())}>Volver</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="CM-layout">
      <HeaderModulo
        titulo="Configuración Medical Care"
        subtitulo="Causales de fusión y sincronización V3"
      />

      <main className="CM-main">
        {/* ── CAUSALES DE FUSIÓN ── */}
        <section className="CM-card">
          <h2 className="CM-titulo"><FaFilter /> Causales de Fusión</h2>
          <p className="CM-hint">
            Opciones del dropdown de fusión de planillas en Solicitud de Vehículos.
            {' '}<strong>{causales.filter(c => c.activo).length} activas</strong> de {causales.length}.
          </p>

          <div className="CM-crearFila">
            <input
              type="text"
              value={nuevaCausal}
              onChange={(e) => setNuevaCausal(e.target.value)}
              placeholder="Ej: lleva paqueteo"
              className="CM-input"
            />
            <button onClick={handleCrearCausal} disabled={!nuevaCausal.trim()} className="CM-btn CM-btn--primario">
              <FaPlus /> Crear
            </button>
          </div>

          {loadingCausales ? (
            <p className="CM-aviso">Cargando causales…</p>
          ) : causales.length === 0 ? (
            <p className="CM-aviso">No hay causales registradas — crea una para comenzar.</p>
          ) : (
            <div className="CM-causalesGrid">
              {causales.map((causal) => (
                <div key={causal._id} className={`CM-causalCard ${causal.activo ? 'CM-causal--activa' : 'CM-causal--inactiva'}`}>
                  <div className="CM-causalMain">
                    {causalEditando === causal._id ? (
                      <input
                        type="text"
                        value={nombreEditando}
                        onChange={(e) => setNombreEditando(e.target.value)}
                        className="CM-input CM-input--edicion"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') guardarEdicion(causal._id);
                          if (e.key === 'Escape') cancelarEdicion();
                        }}
                      />
                    ) : (
                      <>
                        <div className="CM-causalNombre">{causal.nombre}</div>
                        <span className={`CM-badge ${causal.activo ? 'CM-badge--activa' : 'CM-badge--inactiva'}`}>
                          {causal.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="CM-causalAcciones">
                    {causalEditando === causal._id ? (
                      <>
                        <button onClick={() => guardarEdicion(causal._id)} className="CM-ico CM-ico--guardar" title="Guardar"><FaCheckCircle /></button>
                        <button onClick={cancelarEdicion} className="CM-ico CM-ico--cancelar" title="Cancelar"><FaTimes /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => iniciarEdicion(causal._id, causal.nombre)} className="CM-ico" title="Editar"><FaEdit /></button>
                        <button
                          onClick={() => handleToggleCausalActiva(causal._id, !causal.activo)}
                          className={`CM-ico ${causal.activo ? 'CM-ico--apagar' : 'CM-ico--prender'}`}
                          title={causal.activo ? 'Desactivar' : 'Activar'}
                        >
                          {causal.activo ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        <button onClick={() => handleEliminarCausal(causal._id)} className="CM-ico CM-ico--eliminar" title="Eliminar"><FaTrash /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── SYNC V3 ── */}
        <section className="CM-card">
          <h2 className="CM-titulo"><FaCog /> Sincronización V3</h2>
          {loadingConfig ? (
            <p className="CM-aviso">Cargando configuración…</p>
          ) : syncConfig ? (
            <>
              <div className="CM-syncEstado">
                <h3>Estado del Sync</h3>
                <button
                  className={`CM-toggle ${syncConfig.activo ? 'CM-toggle--activo' : 'CM-toggle--inactivo'}`}
                  onClick={handleToggleActivo}
                >
                  {syncConfig.activo ? '● Activo' : '○ Inactivo'}
                </button>
              </div>
              <p className="CM-hint">
                {syncConfig.activo
                  ? 'El sync se ejecutará automáticamente en los horarios configurados.'
                  : 'El sync está pausado. No se ejecutará automáticamente.'}
              </p>

              <h3 className="CM-subtitulo">Horarios Programados</h3>
              <p className="CM-hint">Formato HH:MM (ej: 08:00, 14:30)</p>
              <div className="CM-crearFila">
                <input
                  type="time"
                  className="CM-input CM-input--hora"
                  value={nuevoHorario}
                  onChange={(e) => setNuevoHorario(e.target.value)}
                />
                <button onClick={handleAgregarHorario} disabled={!nuevoHorario} className="CM-btn CM-btn--primario">
                  <FaPlus /> Agregar
                </button>
              </div>

              <div className="CM-horariosList">
                {syncConfig.horarios.length === 0 ? (
                  <p className="CM-aviso">No hay horarios configurados.</p>
                ) : (
                  syncConfig.horarios.map((horario) => (
                    <div key={horario} className="CM-horarioItem">
                      <span>{horario}</span>
                      <button onClick={() => handleEliminarHorario(horario)} className="CM-ico CM-ico--eliminar" title="Eliminar horario">
                        <FaTrash />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="CM-info">
                <p><strong>Información:</strong></p>
                <ul>
                  <li>El sync consume datos del API de Siscore V3 automáticamente.</li>
                  <li>Se ejecuta a la hora exacta en cada horario configurado.</li>
                  <li>Puedes agregar o quitar horarios según lo necesites.</li>
                  <li>Los cambios se guardan en la base de datos inmediatamente.</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="CM-aviso">No se pudo cargar la configuración.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default ConfigMCP;
