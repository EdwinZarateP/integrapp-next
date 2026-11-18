'use client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaMapMarkerAlt } from 'react-icons/fa';
import CertificadoLaboralC from '@/Componentes/CertificadoLaboralC';
import logo from '@/Imagenes/albatros.png';
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import './estilos.css';

function CertificadoLaboralP() {
  const router = useRouter();

  return (
    <div className="CLP-layout">

      {/* ── HEADER ── */}
      <header className="CLP-header">
        <div className="CLP-headerInner">
          <button className="CLP-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={LOGO_INTEGRA} alt="Integra Logística" width={201} height={40} priority />
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="CLP-main">
        <CertificadoLaboralC />
      </main>

      {/* ── FOOTER ── */}
      <footer className="CLP-footer">
        <div className="CLP-footerInner">
          <div className="CLP-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="CLP-footerLinks">
            <span className="CLP-footerLink">Integra Technologies @ {new Date().getFullYear()} – GAMP 5 & ALCOA+</span>
            <span className="CLP-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="CLP-footerCopy">© {new Date().getFullYear()} Integra — Portal Empleados</span>
        </div>
      </footer>
    </div>
  );
}

export default CertificadoLaboralP;
