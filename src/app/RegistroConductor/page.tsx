import dynamic from 'next/dynamic';
const RegistroConductor = dynamic(() => import('@/Paginas/RegistroConductor/index'), { ssr: false });
export default function Page() { return <RegistroConductor />; }
