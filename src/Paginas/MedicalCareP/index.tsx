'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUserCircle, FaSignOutAlt, FaChevronDown,
} from 'react-icons/fa';
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
                <button className="MC-dropItem" onClick={() => router.push('/GestionPacientes')}>
                  <FaUserCircle /> Pacientes
                </button>
                <button className="MC-dropItem" onClick={() => router.push('/GestionPedidosV3')}>
                  <FaUserCircle /> Pedidos V3
                </button>
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
        <div className="MC-welcome">
          <div className="MC-welcomeCard">
            <h1 className="MC-welcomeTitle">Gestión de Despachos Rutas</h1>
            <p className="MC-welcomeText">
              Sistema de gestión de despachos y rutas de Fresenius Medical Care. Utiliza el menú de usuario para acceder a las funciones disponibles.
            </p>
            
            <div className="MC-welcomeActions">
              <button 
                className="MC-welcomeBtn MC-btnPrimary"
                onClick={() => router.push('/GestionPacientes')}
              >
                <FaUserCircle /> Ir a Gestión de Pacientes
              </button>
              <button 
                className="MC-welcomeBtn MC-btnSecondary"
                onClick={() => router.push('/GestionPedidosV3')}
              >
                <FaUserCircle /> Ir a Gestión de Pedidos V3
              </button>
            </div>

            <div className="MC-welcomeFeatures">
              <div className="MC-feature">
                <div className="MC-featureIcon">📊</div>
                <h3 className="MC-featureTitle">Carga Masiva Pacientes</h3>
                <p className="MC-featureText">Importa pacientes desde Excel con normalización automática de datos</p>
              </div>
              
              <div className="MC-feature">
                <div className="MC-featureIcon">📦</div>
                <h3 className="MC-featureTitle">Carga Masiva Pedidos</h3>
                <p className="MC-featureText">Importa pedidos desde Excel con progreso en tiempo real</p>
              </div>
              
              <div className="MC-feature">
                <div className="MC-featureIcon">✏️</div>
                <h3 className="MC-featureTitle">Gestión Completa</h3>
                <p className="MC-featureText">Crea, edita y elimina pacientes y pedidos individualmente</p>
              </div>
            </div>
          </div>
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
