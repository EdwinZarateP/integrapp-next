'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaBuilding, FaLock } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
// Mismo registro de logos del panel interno (/indicadores/clientes): si el
// cliente tiene dashboard publicado, su tarjeta usa SU logo; si no, icono.
import { obtenerCliente } from '@/Paginas/IndicadoresClientes/clientes';
import '@/Componentes/IndicadoresChrome/estilos.css';
import './estilos.css';

// Perfiles que entran al portal «Mis Indicadores»: CLIENTE (externo, solo ve
// sus clientes asignados) y ADMIN (pruebas/soporte).
const PERFILES_PERMITIDOS = ['CLIENTE', 'ADMIN'];

// Cliente del panel (respuesta de /indicadores-cliente/mis-indicadores)
interface ClienteAsignado {
  nit: string;
  entidad: string;
  razon: string;
  cliente_id: string | null; // null = aún sin dashboard publicado
  disponible: boolean;
}

interface MisIndicadoresResponse {
  success: boolean;
  data?: {
    perfil: string;
    clientes: ClienteAsignado[];
  };
  detail?: string;
}

const PanelMisClientes: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);
  const [clientes, setClientes] = useState<ClienteAsignado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gate: solo CLIENTE/ADMIN (los internos usan /indicadores/clientes).
  useEffect(() => {
    const usuarioMatch = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const perfilMatch = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/);
    const regionalMatch = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/);
    const perfil = perfilMatch?.[2] || '';
    if (!usuarioMatch || !PERFILES_PERMITIDOS.includes(perfil)) {
      router.replace('/LoginUsuario');
      return;
    }
    setDatosUsuario({ usuario: usuarioMatch[2], perfil, regional: regionalMatch?.[2] });

    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/indicadores-cliente/mis-indicadores?usuario=${encodeURIComponent(usuarioMatch[2])}`)
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json() as Promise<MisIndicadoresResponse>;
      })
      .then(res => {
        if (res.success && res.data) setClientes(res.data.clientes || []);
        else throw new Error(res.detail || 'No se pudieron cargar sus clientes.');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar sus clientes.'))
      .finally(() => setCargando(false));
  }, [router]);

  // Cerrar menú al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cerrarSesion = () => {
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.includes('usuario') || cookieName.includes('cliente') || cookieName.includes('perfil') || cookieName.includes('regional')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
    setMenuAbierto(false);
    router.push('/LoginUsuario');
  };

  // El dashboard del cliente (rutas estáticas por cliente_id).
  const rutaDashboard = (clienteId: string) => `/indicadores/mis-clientes/${clienteId}`;

  return (
    <div className="MC-container">
      {/* Header */}
      <header className="MC-header">
        <div className="MC-headerInner">
          <button className="MC-brand" title="Mis indicadores">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="MC-brandName">
              Integr<span className="MC-brandAccent">App</span>
            </span>
          </button>

          <h1 className="MC-titulo">Mis indicadores</h1>

          {/* Usuario + menú */}
          <div className="MC-userZone" ref={menuRef}>
            <button className="MC-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="MC-userIcon" />
              <div className="MC-userInfo">
                <span className="MC-userName">{datosUsuario?.usuario || 'Usuario'}</span>
                <span className="MC-userPerfil">
                  {datosUsuario?.perfil}{datosUsuario?.regional ? ` · ${datosUsuario.regional}` : ''}
                </span>
              </div>
              <FaChevronDown className={`MC-chevron ${menuAbierto ? 'MC-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="MC-dropdown">
                <button className="MC-dropItem MC-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Panel de clientes asignados (centrado verticalmente entre header y footer) */}
      <main className="MC-main">
        <div className="MC-selector">
          {cargando ? (
            <div className="MC-estado">
              <span className="MC-spinner" aria-hidden />
              <p>Cargando sus clientes…</p>
            </div>
          ) : error ? (
            <div className="MC-estado MC-estado--error">
              <p>{error}</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="MC-estado">
              <p>No tiene clientes asignados. Solicite al administrador que asigne sus clientes desde Gestión de Usuarios.</p>
            </div>
          ) : (
            <>
              <div className="MC-intro">
                <h2 className="MC-introTitulo">Elegí un cliente</h2>
                <p className="MC-subtitulo">para ver sus indicadores de servicio</p>
              </div>
              <div className="MC-clientesGrid">
            {clientes.map(c => {
              const nombre = c.razon || c.entidad || c.nit;
              // Logo del registro interno (mismo del panel /indicadores/clientes);
              // si el cliente no está registrado, la tarjeta va con icono.
              const registrado = c.cliente_id ? obtenerCliente(c.cliente_id) : undefined;
              const srcLogo = registrado?.logo;
              return c.disponible && c.cliente_id ? (
                <button
                  key={c.nit}
                  className="MC-clienteCard"
                  onClick={() => router.push(rutaDashboard(c.cliente_id!))}
                  title={nombre}
                >
                  <div className={srcLogo ? 'MC-clienteLogoWrap' : 'MC-clienteIcono'}>
                    {srcLogo ? (
                      <Image
                        src={srcLogo}
                        alt={nombre}
                        width={220}
                        height={110}
                        style={{ objectFit: 'contain' }}
                        unoptimized
                      />
                    ) : (
                      <FaBuilding />
                    )}
                  </div>
                  {/* Con logo el nombre sobra (el logo ES la identidad, igual
                      que el panel interno); sin logo se muestra el nombre. */}
                  {!srcLogo && <span className="MC-clienteNombre">{nombre}</span>}
                  <span className="MC-clienteBtn">Ver indicadores →</span>
                </button>
              ) : (
                <div key={c.nit} className="MC-clienteCard MC-clienteCard--pronto" title="Dashboard en preparación">
                  <div className="MC-clienteIcono MC-clienteIcono--pronto">
                    <FaLock />
                  </div>
                  <span className="MC-clienteNombre">{nombre}</span>
                  <span className="MC-clientePronto">Próximamente</span>
                </div>
              );
            })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="MC-footer">
        <p>© {new Date().getFullYear()} Integra — Mis indicadores</p>
      </footer>
    </div>
  );
};

export default PanelMisClientes;
