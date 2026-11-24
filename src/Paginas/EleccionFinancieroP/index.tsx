'use client';

/**
 * Pantalla de elección del perfil FINANCIERO (2026-11-24): tras el login no
 * cae directo en Otros Costos — elige entre Otros Costos y el Módulo
 * Financiero. No rompe nada: Otros Costos sigue intacto y los demás flujos
 * del perfil FINANCIERO no cambian.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaCoins, FaFileInvoiceDollar, FaSignOutAlt } from 'react-icons/fa';
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import './estilos.css';

export default function EleccionFinancieroP() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    const info = document.cookie.match(/(^| )usuarioInfoPedidosCookie=([^;]+)/)?.[2];
    if (info) {
      try { setNombre(JSON.parse(decodeURIComponent(info)).nombre ?? ''); } catch { /* sin info */ }
    }
    // Si no es FINANCIERO, no tiene nada que elegir aquí.
    const perfil = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2];
    if (perfil && perfil !== 'FINANCIERO') router.replace('/Modulos');
  }, [router]);

  const irAOtrosCostos = () => {
    // Otros Costos vive bajo el menú Medical Care: fija su cookie de portal.
    document.cookie = 'clientePedidosCookie=MEDICAL_CARE; path=/; max-age=1209600';
    router.push('/OtrosCostos');
  };

  const irAFinanciero = () => router.push('/Financiero');

  const cerrarSesion = () => {
    document.cookie.split(';').forEach((c) => {
      const nombre_ = c.split('=')[0].trim();
      if (nombre_.endsWith('PedidosCookie')) document.cookie = `${nombre_}=; path=/; max-age=0`;
    });
    window.localStorage.removeItem('baseUsuarioAccessToken');
    window.localStorage.removeItem('finAccessToken');
    router.push('/LoginUsuario');
  };

  return (
    <div className="EF-fondo">
      <header className="EF-header">
        <Image src={LOGO_INTEGRA} width={201} height={40} alt="Integra ONE" priority />
        {nombre && <span className="EF-usuario">Hola, {nombre.split(' ')[0]}</span>}
        <button className="EF-salir" onClick={cerrarSesion}><FaSignOutAlt /> Cerrar sesión</button>
      </header>

      <main className="EF-main">
        <h1>¿A dónde quieres entrar?</h1>
        <div className="EF-tarjetas">
          <button className="EF-tarjeta" onClick={irAOtrosCostos}>
            <span className="EF-icono EF-iconoNaranja"><FaCoins /></span>
            <span className="EF-titulo">Otros Costos</span>
            <span className="EF-desc">Solicitudes de costos adicionales, aprobaciones y pagos</span>
          </button>
          <button className="EF-tarjeta" onClick={irAFinanciero}>
            <span className="EF-icono EF-iconoVerde"><FaFileInvoiceDollar /></span>
            <span className="EF-titulo">Módulo Financiero</span>
            <span className="EF-desc">Requisiciones, traslados, viajes, facturas DIAN y tesorería</span>
          </button>
        </div>
      </main>

      <footer className="EF-footer">
        <span>© {new Date().getFullYear()} Integra Cadena de Servicios S.A.S. · Colombia</span>
      </footer>
    </div>
  );
}
