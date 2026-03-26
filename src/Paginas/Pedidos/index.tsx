'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaChartBar, FaSignOutAlt, FaBoxOpen, FaCheckCircle,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUserCircle, FaChevronDown,
  FaPlus, FaTimes, FaFileUpload, FaFileDownload, FaCloudUploadAlt, FaUsers, FaTable,
  FaBars,
} from 'react-icons/fa';
import CargarPedidos from '@/Componentes/PedidosComponentes/CargarPedidos';
import TablaPedidos from '@/Componentes/PedidosComponentes/TablaPedidos';
import ExportarAutorizados from '@/Componentes/PedidosComponentes/ExportarAutorizados';
import ImportarPedidosVulcano from '@/Componentes/PedidosComponentes/importarPedidosVulcano';
import Cookies from 'js-cookie';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const Pedidos: React.FC = () => {
  const perfil = Cookies.get('perfilPedidosCookie') || '';
  const usuario = Cookies.get('usuarioPedidosCookie') || '';
  const regional = Cookies.get('regionalPedidosCookie') || '';
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [fabAbierto, setFabAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cargarRef = useRef<HTMLDivElement>(null);
  const exportarRef = useRef<HTMLDivElement>(null);
  const importarRef = useRef<HTMLDivElement>(null);

  const clickAccion = (ref: React.RefObject<HTMLDivElement>) => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    btn?.click();
    setFabAbierto(false);
  };

  const cerrarSesion = () => {
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie'].forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
    router.push('/LoginUsuario');
  };

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

  return (
    <div className="Ped-layout">

      {/* ── HEADER ── */}
      <header className="Ped-header">
        <div className="Ped-headerInner">

          {/* Logo */}
          <button className="Ped-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="Ped-brandName">
              <span>Integr</span><span className="Ped-brandAccent">App</span>
            </span>
          </button>


          {/* Nav tabs */}
          <nav className="Ped-nav">
            <button className="Ped-navTab Ped-navTabActive" onClick={() => router.push('/Pedidos')}>
              <FaBoxOpen /> Gestión de Pedidos
            </button>
          </nav>

          {/* Usuario + menú */}
          <div className="Ped-userZone" ref={menuRef}>
            <button className="Ped-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="Ped-userIcon" />
              <div className="Ped-userInfo">
                <span className="Ped-userName">{usuario || 'Usuario'}</span>
                <span className="Ped-userPerfil">{perfil}{regional ? ` · ${regional}` : ''}</span>
              </div>
              <FaChevronDown className={`Ped-chevron ${menuAbierto ? 'Ped-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="Ped-dropdown">
                <button className="Ped-dropItem" onClick={() => { setMenuAbierto(false); router.push('/PedidosCompletados'); }}>
                  <FaCheckCircle /> Pedidos Completados
                </button>
                <button className="Ped-dropItem" onClick={() => { setMenuAbierto(false); router.push('/indicadores'); }}>
                  <FaChartBar /> Indicadores
                </button>
                {perfil === 'ADMIN' && (
                  <>
                    <button className="Ped-dropItem" onClick={() => { setMenuAbierto(false); router.push('/GestionUsuarios'); }}>
                      <FaUsers /> Gestión de usuarios
                    </button>
                    <button className="Ped-dropItem" onClick={() => { setMenuAbierto(false); router.push('/Tarifas'); }}>
                      <FaTable /> Tarifas
                    </button>
                  </>
                )}
                <div className="Ped-dropDivider" />
                <button className="Ped-dropItem Ped-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── TABLA PRINCIPAL ── */}
      <main className="Ped-main">
        <TablaPedidos />
      </main>

      {/* ── COMPONENTES FUERA DE PANTALLA (para el FAB) ── */}
      <div className="Ped-accionesFuera">
        <div ref={cargarRef}><CargarPedidos /></div>
        <div ref={exportarRef}><ExportarAutorizados /></div>
        <div ref={importarRef}><ImportarPedidosVulcano /></div>
      </div>

      {/* ── FAB SPEED DIAL ── */}
      <div className="Ped-fab-zona">
        {fabAbierto && (
          <div className="Ped-fab-paleta">
            <button className="Ped-fab-opcion" onClick={() => clickAccion(cargarRef)}>
              <span className="Ped-fab-opcionLabel">Cargar pedidos</span>
              <span className="Ped-fab-opcionIcono"><FaFileUpload /></span>
            </button>
            <button className="Ped-fab-opcion" onClick={() => clickAccion(exportarRef)}>
              <span className="Ped-fab-opcionLabel">Exportar autorizados</span>
              <span className="Ped-fab-opcionIcono Ped-fab-opcionIcono--amber"><FaFileDownload /></span>
            </button>
            <button className="Ped-fab-opcion" onClick={() => clickAccion(importarRef)}>
              <span className="Ped-fab-opcionLabel">Importar Vulcano</span>
              <span className="Ped-fab-opcionIcono Ped-fab-opcionIcono--teal"><FaCloudUploadAlt /></span>
            </button>
          </div>
        )}
        <button
          className={`Ped-fab-btn ${fabAbierto ? 'Ped-fab-btn--open' : ''}`}
          onClick={() => setFabAbierto(o => !o)}
          aria-label={fabAbierto ? 'Cerrar acciones' : 'Abrir acciones'}
        >
          {fabAbierto ? <FaTimes /> : <FaPlus />}
        </button>
      </div>

      {/* ── FOOTER ── */}
      <footer className="Ped-footer">
        <div className="Ped-footerInner">
          <div className="Ped-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="Ped-footerLinks">
            <a href="tel:+573125443396" className="Ped-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="Ped-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="Ped-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="Ped-footerCopy">
            © {new Date().getFullYear()} Integra — Torre de Control
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Pedidos;
