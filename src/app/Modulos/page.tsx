import dynamic from 'next/dynamic';
const Modulos = dynamic(() => import('@/Paginas/ModulosP/index'), { ssr: false });
export default function Page() { return <Modulos />; }
