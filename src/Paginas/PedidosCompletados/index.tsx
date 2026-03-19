'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaChartBar, FaSignOutAlt, FaBoxOpen, FaCheckCircle,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUserCircle, FaChevronDown,
  FaUsers, FaTable,
} from 'react-icons/fa';
import TablaPedidosCompletados from '@/Componentes/PedidosComponentes/TablaPedidosCompletados';
import Cookies from 'js-cookie';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const PedidosCompletados: React.FC = () => {
  const perfil = Cookies.get('perfilPedidosCookie') || '';
  const usuario = Cookies.get('usuarioPedidosCookie') || '';
  const regional = Cookies.get('regionalPedidosCookie') || '';
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cerrarSesion = () => {
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie'].forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
    router.push('/LoginUsuario');
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="PC-layout">

      {/* ── HEADER ── */}
      <header className="PC-header">
        <div className="PC-headerInner">

          {/* Logo */}
          <button className="PC-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="PC-brandName">
              <span>Integr</span><span className="PC-brandAccent">App</span>
            </span>
          </button>

          {/* Nav tabs */}
          <nav className="PC-nav">
            <button className="PC-navTab" onClick={() => router.push('/Pedidos')}>
              <FaBoxOpen /> Gestión de Pedidos
            </button>
            <button className="PC-navTab PC-navTabActive" onClick={() => router.push('/PedidosCompletados')}>
              <FaCheckCircle /> Completados
            </button>
          </nav>

          {/* Usuario + menú */}
          <div className="PC-userZone" ref={menuRef}>
            <button className="PC-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="PC-userIcon" />
              <div className="PC-userInfo">
                <span className="PC-userName">{usuario || 'Usuario'}</span>
                <span className="PC-userPerfil">{perfil}{regional ? ` · ${regional}` : ''}</span>
              </div>
              <FaChevronDown className={`PC-chevron ${menuAbierto ? 'PC-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="PC-dropdown">
                <button className="PC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/indicadores'); }}>
                  <FaChartBar /> Indicadores
                </button>
                {perfil === 'ADMIN' && (
                  <>
                    <button className="PC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/GestionUsuarios'); }}>
                      <FaUsers /> Gestión de usuarios
                    </button>
                    <button className="PC-dropItem" onClick={() => { setMenuAbierto(false); router.push('/Tarifas'); }}>
                      <FaTable /> Tarifas
                    </button>
                  </>
                )}
                <div className="PC-dropDivider" />
                <button className="PC-dropItem PC-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── TABLA PRINCIPAL ── */}
      <main className="PC-main">
        <TablaPedidosCompletados />
      </main>

      {/* ── FOOTER ── */}
      <footer className="PC-footer">
        <div className="PC-footerInner">
          <div className="PC-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="PC-footerLinks">
            <a href="tel:+573125443396" className="PC-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="PC-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="PC-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="PC-footerCopy">
            © {new Date().getFullYear()} Integra — Torre de Control
          </span>
        </div>
      </footer>
    </div>
  );
};

export default PedidosCompletados;
