/**
 * LanzadorModulos (2026-11-25, 4.ª tanda) — la Torre de Control a un clic en
 * TODAS las páginas: pestaña delgada vertical fija en el borde izquierdo que
 * despliega la barra de módulos (SidebarModulos en modo overlay) encima del
 * contenido — la página no se mueve; al navegar, el overlay se cierra solo.
 *
 * Montado en ClientProviders (como TelemetriaGlobal). Visibilidad:
 * - Solo con sesión de la app (usuarioPedidosCookie) — excluye logins
 *   públicos y el portal de conductores (cookies conductor*).
 * - Solo perfiles cuyo hogar ES /Modulos (hogarPorPerfil): los micro-portales
 *   (FINANCIERO, VISUALIZADOR, CLIENTE…) y el portal de Seguridad con
 *   cookie SEGURIDAD no ven la pestaña — igual que el propio hub.
 * - Nunca en /, /Modulos (ya tiene la barra), /LoginUsuario ni rutas públicas.
 * - Oculto en ≤768px (cada portal móvil tiene su propia navegación).
 */
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { FaThLarge } from 'react-icons/fa';
import { esPerfilMicroPortal } from '@/Funciones/hogarPorPerfil';
import SidebarModulos from '@/Componentes/SidebarModulos';
import './estilos.css';

const RUTAS_OCULTAS = ['/', '/Modulos', '/LoginUsuario'];
const PREFIJOS_OCULTOS = [
  '/Login', '/Registro', '/Verificar', '/Autorizacion', '/Aceptar',
  '/Olvido', '/Olvidoclave', '/recuperar', '/SalaEspera', '/SeleccionEstados',
];

const LanzadorModulos: React.FC = () => {
  const pathname = usePathname() || '';
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const tieneSesion = !!Cookies.get('usuarioPedidosCookie');
    // (2026-11-25, ajuste) Visibilidad por PERFIL (no por cookie de portal):
    // un ADMIN/ANALISTA dentro de /revision (cookie SEGURIDAD) SÍ debe ver el
    // lanzador — solo los perfiles micro-portal (FINANCIERO, VISUALIZADOR,
    // CLIENTE…, PADRINO) no lo ven.
    const esMultiModulo = !esPerfilMicroPortal();
    const ruta = pathname.replace(/\/+$/, '') || '/';
    const oculta = RUTAS_OCULTAS.includes(ruta) || PREFIJOS_OCULTOS.some(p => ruta.startsWith(p));
    setVisible(tieneSesion && esMultiModulo && !oculta);
  }, [pathname]);

  // Cerrar con Escape + bloquear scroll del fondo mientras el overlay está abierto.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', alTeclear);
    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = scrollPrevio;
    };
  }, [abierto]);

  // Al navegar fuera de la página actual, cerrar (p. ej. botón atrás).
  useEffect(() => { setAbierto(false); }, [pathname]);

  if (!visible) return null;

  return (
    <>
      {/* Pestaña del borde izquierdo: siempre accesible, un clic abre.
          En /revision se corre a la derecha de SU sidebar (262px) para no
          taparla (más abajo la media query la devuelve al borde en ≤900px,
          donde el sidebar de revisión pasa a drawer). */}
      <button
        className={`lmz-pestania${pathname.startsWith('/revision') ? ' lmz-pestania--juntoSidebar' : ''}`}
        onClick={() => setAbierto(a => !a)}
        aria-label={abierto ? 'Cerrar menú de módulos' : 'Abrir menú de módulos'}
        aria-expanded={abierto}
        title="Módulos (Torre de Control)"
      >
        <FaThLarge className="lmz-pestania-icono" />
        <span className="lmz-pestania-texto">MÓDULOS</span>
      </button>

      {/* Overlay: fondo clicable para cerrar + la barra de siempre. */}
      {abierto && (
        <div className="lmz-overlay" onClick={() => setAbierto(false)} role="dialog" aria-modal="true" aria-label="Módulos">
          <div className="lmz-sidebarWrap" onClick={e => e.stopPropagation()}>
            <SidebarModulos modo="overlay" alNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default LanzadorModulos;
