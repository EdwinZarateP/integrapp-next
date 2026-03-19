'use client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import CertificadoLaboralC from '@/Componentes/CertificadoLaboralC';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

function CertificadoLaboralP() {
  const router = useRouter();

  return (
    <div className="CLP-layout">

      {/* ── HEADER ── */}
      <header className="CLP-header">
        <div className="CLP-headerInner">
          <button className="CLP-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="CLP-brandName">
              Integr<span className="CLP-brandAccent">App</span>
            </span>
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
            <a href="tel:+573125443396" className="CLP-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="CLP-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="CLP-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="CLP-footerCopy">© {new Date().getFullYear()} Integra — Portal Empleados</span>
        </div>
      </footer>
    </div>
  );
}

export default CertificadoLaboralP;
