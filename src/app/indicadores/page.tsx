'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaTruck, FaUserCircle, FaChevronDown, FaSignOutAlt, FaArrowLeft } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const IndicadoresMenu: React.FC = () => {
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
    } else {
      // Si no hay usuario, redirigir al login
      router.push('/LoginUsuario');
    }
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
    // Eliminar todas las cookies relacionadas con la sesión
    const cookies = document.cookie.split(';');

    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.includes('usuario') || cookieName.includes('cliente') || cookieName.includes('perfil') || cookieName.includes('regional')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });

    setMenuAbierto(false);
    // Redirigir al login
    router.push('/LoginUsuario');
  };

  const indicadores = [
    {
      id: 'transporte',
      titulo: 'Indicadores de Transporte',
      descripcion: 'Dashboard de guías de transporte y métricas logísticas',
      icono: <FaTruck />,
      ruta: '/indicadores/transporte',
    },
    // Aquí se agregarán más indicadores en el futuro
  ];

  return (
    <div className="IM-container">
      {/* Header */}
      <header className="IM-header">
        <div className="IM-headerInner">
          <button className="IM-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="IM-brandName">
              Integr<span className="IM-brandAccent">App</span>
            </span>
          </button>

          {/* Usuario + menú */}
          <div className="IM-userZone" ref={menuRef}>
            <button className="IM-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="IM-userIcon" />
              <div className="IM-userInfo">
                <span className="IM-userName">{datosUsuario?.usuario || 'Usuario'}</span>
                <span className="IM-userPerfil">
                  {datosUsuario?.perfil}{datosUsuario?.regional ? ` · ${datosUsuario.regional}` : ''}
                </span>
              </div>
              <FaChevronDown className={`IM-chevron ${menuAbierto ? 'IM-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="IM-dropdown">
                <button className="IM-dropItem" onClick={() => { setMenuAbierto(false); router.push('/'); }}>
                  <FaArrowLeft /> Volver al inicio
                </button>
                <div className="IM-dropDivider" />
                <button className="IM-dropItem IM-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="IM-main">
        <div className="IM-indicadoresGrid">
          {indicadores.map((indicador) => (
            <button
              key={indicador.id}
              className="IM-indicadorCard"
              onClick={() => router.push(indicador.ruta)}
            >
              <div className="IM-indicadorIconWrap">
                <span className="IM-indicadorIcon">{indicador.icono}</span>
              </div>
              <span className="IM-indicadorTitulo">{indicador.titulo}</span>
              <span className="IM-indicadorDescripcion">{indicador.descripcion}</span>
              <span className="IM-indicadorBtn">Ingresar →</span>
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="IM-footer">
        <p>© {new Date().getFullYear()} Integra — Sistema de Indicadores</p>
      </footer>
    </div>
  );
};

export default IndicadoresMenu;
