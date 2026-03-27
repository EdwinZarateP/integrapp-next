import dynamic from 'next/dynamic';
const CrucePacientesV3P = dynamic(() => import('@/Paginas/CrucePacientesV3P/index'), { ssr: false });
export default function Page() { return <CrucePacientesV3P />; }
