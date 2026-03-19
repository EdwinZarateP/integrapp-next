import dynamic from 'next/dynamic';
const CertificadoLaboralP = dynamic(() => import('@/Paginas/CertificadoLaboralP/index'), { ssr: false });
export default function Page() { return <CertificadoLaboralP />; }
