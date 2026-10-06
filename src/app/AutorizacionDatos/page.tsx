import dynamic from 'next/dynamic';
const AutorizacionDatos = dynamic(() => import('@/Paginas/AutorizacionDatos/index'), { ssr: false });
export default function Page() { return <AutorizacionDatos />; }
