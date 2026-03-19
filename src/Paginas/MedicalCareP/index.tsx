'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUserCircle, FaSignOutAlt, FaChevronDown,
} from 'react-icons/fa';
import { useState, useRef } from 'react';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const MedicalCareP: React.FC = () => {
  const router = useRouter();
  const usuario = typeof document !== 'undefined'
    ? (document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '')
    : '';
  const perfil = typeof document !== 'undefined'
    ? (document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '')
    : '';
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') router.replace('/Pedidos');
  }, [router]);

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
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie'].forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
    router.push('/LoginUsuario');
  };

  return (
    <div className="MC-layout">

      {/* ── HEADER ── */}
      <header className="MC-header">
        <div className="MC-headerInner">

          <button className="MC-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="MC-brandName">
              Integr<span className="MC-brandAccent">App</span>
            </span>
          </button>

          <div className="MC-clienteBadge">Fresenius Medical Care</div>

          <div className="MC-userZone" ref={menuRef}>
            <button className="MC-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="MC-userIcon" />
              <div className="MC-userInfo">
                <span className="MC-userName">{usuario || 'Usuario'}</span>
                <span className="MC-userPerfil">{perfil}</span>
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

      {/* ── MAIN ── */}
      <main className="MC-main">
        <div className="MC-placeholder">
          <div className="MC-placeholderIcon">🏗️</div>
          <h2 className="MC-placeholderTitulo">Portal Fresenius Medical Care</h2>
          <p className="MC-placeholderTexto">
            Este espacio está reservado para las funcionalidades del portal de
            <strong> Fresenius Medical Care</strong>. Próximamente se implementarán
            las herramientas y módulos correspondientes a este cliente.
          </p>
          <div className="MC-placeholderTag">En construcción</div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="MC-footer">
        <div className="MC-footerInner">
          <div className="MC-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="MC-footerLinks">
            <a href="tel:+573125443396" className="MC-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="MC-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="MC-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="MC-footerCopy">© {new Date().getFullYear()} Integra — Portal Medical Care</span>
        </div>
      </footer>
    </div>
  );
};

export default MedicalCareP;
