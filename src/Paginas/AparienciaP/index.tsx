/**
 * Apariencia (/Apariencia) — 2026-11-25, 10.ª tanda.
 *
 * El ADMIN elige el efecto de temporada de TODA la app (navidad, halloween,
 * fiestas patrias, celebración, san valentín, semana santa) con un clic: se
 * guarda en el backend (config_apariencia) y las partículas + el acento del
 * header aparecen en todas las páginas al instante (cache 5 min del
 * EfectoTemporada; esta página refresca el cache local al cambiar).
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import HeaderModulo from '@/Componentes/HeaderModulo';
import { EFECTOS } from '@/Funciones/efectosTemporada';
import { trackAccion } from '@/Funciones/telemetriaApp';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const CACHE_KEY = 'integrapp.efectoTemporada';
const PERFILES_PERMITIDOS = ['ADMIN'];

type Estado = {
  efecto: string;
  actualizado_por?: string | null;
  nombre?: string | null;
  fecha?: string | null;
};

const fmtFecha = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

export default function AparienciaP() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '').toUpperCase();
    setUsuario(u);
    setAutorizado(PERFILES_PERMITIDOS.includes(p));
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (PERFILES_PERMITIDOS.includes(p)) {
      fetch(`${API}/apariencia`)
        .then(r => (r.ok ? r.json() : null))
        .then(j => j && setEstado(j))
        .catch(() => setError('No se pudo consultar la apariencia actual.'));
    }
  }, [router]);

  const aplicar = async (id: string, etiqueta: string) => {
    if (guardando || !usuario) return;
    const r = await Swal.fire({
      title: `¿Activar «${etiqueta}»?`,
      text: 'El efecto se verá en toda la aplicación de inmediato.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#005f56',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Activar',
      cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    setGuardando(true);
    setError('');
    try {
      const resp = await fetch(`${API}/apariencia`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ efecto: id, usuario }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error al guardar');
      setEstado(prev => ({ ...(prev || {}), ...data }));
      trackAccion('cambiar_efecto_temporada', { efecto: id });
      // Refrescar el cache global para ver el efecto YA (sin esperar TTL) y
      // avisar al componente global (montado desde el arranque con el estado
      // viejo) — sin este evento, las partículas no aparecían sin recargar.
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ efecto: id, ts: Date.now() }));
      } catch { /* noop */ }
      document.body.classList.remove(...EFECTOS.map(e => `efecto-${e.id}`));
      if (id !== 'ninguno') document.body.classList.add(`efecto-${id}`);
      window.dispatchEvent(new Event('efecto-temporada-cambiado'));
      Swal.fire('✅ Listo', `Efecto activo: ${etiqueta}`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (autorizado === null) {
    return (
      <div className="AP-layout">
        <HeaderModulo titulo="Apariencia" />
        <main className="AP-main"><p className="AP-aviso">Cargando…</p></main>
      </div>
    );
  }
  if (!autorizado) {
    return (
      <div className="AP-layout">
        <HeaderModulo titulo="Apariencia" />
        <main className="AP-main">
          <div className="AP-card AP-restringido">
            <h2>Acceso restringido</h2>
            <p>La apariencia de la aplicación la configura solo el perfil ADMIN.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="AP-layout">
      <HeaderModulo
        titulo="Apariencia"
        subtitulo="Efecto de temporada de toda la aplicación"
      />

      <main className="AP-main">
        <div className="AP-card AP-estado">
          <strong>Efecto activo: {EFECTOS.find(e => e.id === estado?.efecto)?.etiqueta || '—'}</strong>
          {estado?.nombre && (
            <span className="AP-estadoMeta">
              Configurado por {estado.nombre} · {fmtFecha(estado.fecha)}
            </span>
          )}
        </div>

        <div className="AP-grid">
          {EFECTOS.map(e => {
            const activo = estado?.efecto === e.id;
            return (
              <button
                key={e.id}
                className={`AP-efecto${activo ? ' AP-efecto--activo' : ''}`}
                disabled={guardando}
                onClick={() => aplicar(e.id, e.etiqueta)}
                style={activo ? { borderColor: e.color } : undefined}
              >
                <span className="AP-efectoEmoji">{e.emoji}</span>
                <span className="AP-efectoNombre">{e.etiqueta}</span>
                <span className="AP-efectoDesc">{e.descripcion}</span>
                <span className="AP-efectoFilo" style={{ background: e.color }} aria-hidden="true" />
                {activo && <span className="AP-efectoActivo">● Activo</span>}
              </button>
            );
          })}
        </div>

        {error && <p className="AP-error">{error}</p>}
        <p className="AP-nota">
          El efecto aplica a todas las páginas internas al instante: partículas SOLO dentro de
          la franja del header + su color de temporada — el área de trabajo nunca se toca.
          Los usuarios con «reducir movimiento» en su sistema ven solo el color.
        </p>
      </main>
    </div>
  );
}
