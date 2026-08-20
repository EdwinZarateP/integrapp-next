'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaChartBar, FaBuilding } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import { CLIENTES } from '../clientes';
import './estilos.css';

const PanelClientes: React.FC = () => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);

  useEffect(() => {
    const usuarioMatch = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const perfilMatch = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/);
    const regionalMatch = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/);

    if (usuarioMatch) {
      setDatosUsuario({
        usuario: usuarioMatch[2],
        perfil: perfilMatch?.[2],
        regional: regionalMatch?.[2],
      });
    }
  }, []);

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

  return (
    <div className="PC-container">
      {/* Header */}
      <header className="PC-header">
        <div className="PC-headerInner">
          <button className="PC-brand" onClick={() => router.push('/indicadores')} title="Menú de indicadores">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="PC-brandName">
              Integr<span className="PC-brandAccent">App</span>
            </span>
          </button>

          <h1 className="PC-titulo">Indicadores por cliente</h1>

          {/* Usuario + menú */}
          <div className="PC-userZone" ref={menuRef}>
            <button className="PC-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="PC-userIcon" />
              <div className="PC-userInfo">
                <span className="PC-userName">{datosUsuario?.usuario || 'Usuario'}</span>
                <span className="PC-userPerfil">
                  {datosUsuario?.perfil}{datosUsuario?.regional ? ` · ${datosUsuario.regional}` : ''}
                </span>
              </div>
              <FaChevronDown className={`PC-chevron ${menuAbierto ? 'PC-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="PC-dropdown">
                <button className="PC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/indicadores'); }}>
                  <FaChartBar /> Menú de indicadores
                </button>
                <div className="PC-dropDivider" />
                <button className="PC-dropItem PC-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Panel de clientes */}
      <main className="PC-main">
        <p className="PC-subtitulo">Elegí un cliente para ver sus indicadores</p>
        <div className="PC-clientesGrid">
          {CLIENTES.map(cliente => (
            <button
              key={cliente.id}
              className="PC-clienteCard"
              onClick={() => router.push(`/indicadores/clientes/${cliente.id}`)}
              title={cliente.nombre}
            >
              <div className="PC-clienteLogoWrap">
                <Image
                  src={cliente.logo}
                  alt={cliente.nombre}
                  width={220}
                  height={110}
                  style={{ objectFit: 'contain' }}
                  unoptimized
                />
              </div>
              <span className="PC-clienteBtn">Ver indicadores →</span>
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="PC-footer">
        <p>© {new Date().getFullYear()} Integra — Indicadores por cliente</p>
      </footer>
    </div>
  );
};

export default PanelClientes;
