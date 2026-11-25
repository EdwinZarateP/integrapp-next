/**
 * HeaderModulo (2026-11-25) — header propio para los módulos que dejaron de
 * vivir dentro del portal Medical Care (Otros Costos, Histórico Otros Costos,
 * Gestión de Usuarios) y pasaron al hub /Modulos.
 *
 * Patrón visual del sistema de diseño Integra (espejo del UP-header de
 * UsoPortalKP): logo Integra ONE a la izquierda, título centrado, usuario con
 * popover y cerrar sesión a la derecha; filo inferior lima #8EC045, sticky,
 * ancho completo. Responsive: en ≤768px el título pasa a fila completa arriba
 * y logo+usuario a la segunda fila (mismas reglas del DC-header).
 *
 * `enlaces` son accesos contextuales visibles como píldoras junto al logo
 * (p. ej. ⬅ Módulos, o Estado de Vehículos para el FINANCIERO que hoy llega
 * al informe bancario desde Otros Costos).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Cookies from 'js-cookie';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaThLarge } from 'react-icons/fa';
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import { hogarPorPerfil } from '@/Funciones/hogarPorPerfil';
import './estilos.css';

export type EnlaceModulo = { etiqueta: string; ruta: string };

type Props = {
  /** Título del módulo (p. ej. "Otros Costos"). */
  titulo: string;
  /** Subtítulo corto bajo el título (opcional). */
  subtitulo?: string;
  /** Links contextuales (⬅ Módulos, Estado de Vehículos…). */
  enlaces?: EnlaceModulo[];
};

const HeaderModulo: React.FC<Props> = ({ titulo, subtitulo, enlaces = [] }) => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [regional, setRegional] = useState('');

  useEffect(() => {
    setUsuario(Cookies.get('usuarioPedidosCookie') || '');
    setPerfil((Cookies.get('perfilPedidosCookie') || '').toUpperCase());
    setRegional(Cookies.get('regionalPedidosCookie') || '');
  }, []);

  // Cerrar el popover al hacer clic fuera (patrón UsoPortalKP/ModulosP).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Limpieza total de sesión: TODAS las cookies *PedidosCookie + seguridad* +
  // conductor* + tokens de localStorage (patrón cerrarSesion de
  // EleccionFinancieroP, que barre por sufijo/prefijo y cubre cookies que
  // este módulo no conoce).
  const cerrarSesion = () => {
    document.cookie.split(';').forEach((c) => {
      const nombre = c.split('=')[0].trim();
      if (
        nombre.endsWith('PedidosCookie') ||
        nombre.startsWith('seguridad') ||
        nombre.startsWith('conductor')
      ) {
        document.cookie = `${nombre}=; path=/; max-age=0`;
      }
    });
    window.localStorage.removeItem('baseUsuarioAccessToken');
    window.localStorage.removeItem('finAccessToken');
    router.push('/LoginUsuario');
  };

  return (
    <header className="HM-header">
      <div className="HM-headerInner">
        <div className="HM-izquierda">
          <button
            className="HM-brand"
            onClick={() => router.push(hogarPorPerfil())}
            title="Torre de Control (módulos)"
          >
            <Image src={LOGO_INTEGRA} alt="Integra Logística" width={201} height={40} priority />
          </button>
          {enlaces.map((e) => (
            <button key={e.ruta} className="HM-enlace" onClick={() => router.push(e.ruta)}>
              {e.etiqueta}
            </button>
          ))}
        </div>

        <div className="HM-tituloZone">
          <span className="HM-titulo">{titulo}</span>
          {subtitulo && <span className="HM-subtitulo">{subtitulo}</span>}
        </div>

        <div className="HM-userZone" ref={menuRef}>
          <button className="HM-userBtn" onClick={() => setMenuAbierto((o) => !o)}>
            <FaUserCircle className="HM-userIcon" />
            <div className="HM-userInfo">
              <span className="HM-userName">{usuario || 'Usuario'}</span>
              <span className="HM-userPerfil">{perfil || '—'}{regional ? ` · ${regional}` : ''}</span>
            </div>
            <FaChevronDown className={`HM-chevron ${menuAbierto ? 'HM-chevronOpen' : ''}`} />
          </button>

          {menuAbierto && (
            <div className="HM-dropdown">
              <button
                className="HM-dropItem"
                onClick={() => {
                  setMenuAbierto(false);
                  // (2026-11-25, 2.ª tanda) El «atrás» es el HOGAR del perfil:
                  // los micro-portales (FINANCIERO, VISUALIZADOR…) no tienen
                  // hub — vuelven a su pantalla propia.
                  router.push(hogarPorPerfil());
                }}
              >
                <FaThLarge /> Torre de Control
              </button>
              <div className="HM-dropDivider" />
              <button className="HM-dropItem HM-dropItemDanger" onClick={cerrarSesion}>
                <FaSignOutAlt /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderModulo;
