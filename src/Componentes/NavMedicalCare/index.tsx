'use client';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaUserCircle, FaSignOutAlt, FaChevronDown, FaRoute, FaUsers, FaHome, FaBoxOpen, FaDollarSign, FaTruck,
} from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

export type PaginaMC = 'medicalcare' | 'pacientes' | 'pedidosv3' | 'cruce' | 'solicitud';

interface Props {
  paginaActual: PaginaMC;
}

const ITEMS: { id: PaginaMC; label: string; ruta: string; icono: React.ReactNode }[] = [
  { id: 'medicalcare', label: 'Medical Care',          ruta: '/MedicalCare',         icono: <FaHome /> },
  { id: 'pacientes',   label: 'Pacientes',             ruta: '/GestionPacientes',    icono: <FaUserCircle /> },
  { id: 'pedidosv3',   label: 'Pedidos V3',            ruta: '/GestionPedidosV3',    icono: <FaBoxOpen /> },
  { id: 'cruce',       label: 'Cruce Pacientes ↔ V3',  ruta: '/CrucePacientesV3',   icono: <FaRoute /> },
  { id: 'solicitud',   label: 'Solicitud de Vehículos', ruta: '/SolicitudVehiculos', icono: <FaTruck /> },
];

const NavMedicalCare: React.FC<Props> = ({ paginaActual }) => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    const usuarioCookie = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const perfilCookie = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    setUsuario(usuarioCookie);
    setPerfil(perfilCookie);
  }, []);

  const cerrarSesion = () => {
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie']
      .forEach(n => { document.cookie = `${n}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`; });
    router.push('/LoginUsuario');
  };

  const navegar = (ruta: string, esActual: boolean) => {
    setAbierto(false);
    if (!esActual) router.push(ruta);
  };

  return (
    <header className="NMC-header">
      <div className="NMC-inner">

        <button className="NMC-brand" onClick={() => router.push('/')} title="Inicio">
          <Image src={logo} alt="Integra" height={40} priority />
          <span className="NMC-brandName">Integr<span className="NMC-brandAccent">App</span></span>
        </button>

        <div className="NMC-badge">Fresenius Medical Care</div>

        <div className="NMC-userZone" ref={menuRef}>
          <button className="NMC-userBtn" onClick={() => setAbierto(o => !o)}>
            <FaUserCircle className="NMC-userIcon" />
            <div className="NMC-userInfo">
              <span className="NMC-userName">{montado ? (usuario || 'Usuario') : 'Usuario'}</span>
              <span className="NMC-userPerfil">{montado ? perfil : ''}</span>
            </div>
            <FaChevronDown className={`NMC-chevron${abierto ? ' NMC-chevronOpen' : ''}`} />
          </button>

          {abierto && (
            <div className="NMC-dropdown">
              {ITEMS.map(item => {
                const esActual = item.id === paginaActual;
                return (
                  <button
                    key={item.id}
                    className={`NMC-dropItem${esActual ? ' NMC-dropItemActive' : ''}`}
                    onClick={() => navegar(item.ruta, esActual)}
                  >
                    {item.icono} {item.label}
                  </button>
                );
              })}
              {perfil === 'ADMIN' && (
                <>
                  <button className="NMC-dropItem" onClick={() => navegar('/GestionUsuarios', false)}>
                    <FaUsers /> Gestión de usuarios
                  </button>
                  <button className="NMC-dropItem" onClick={() => navegar('/GestionTarifasRutas', false)}>
                    <FaDollarSign /> Tarifas Rutas FMC
                  </button>
                </>
              )}
              <div className="NMC-dropDivider" />
              <button className="NMC-dropItem NMC-dropItemDanger" onClick={cerrarSesion}>
                <FaSignOutAlt /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default NavMedicalCare;
