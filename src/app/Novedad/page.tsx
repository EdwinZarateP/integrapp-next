import dynamic from 'next/dynamic';
const Novedad = dynamic(() => import('@/Paginas/Novedad/index'), { ssr: false });
export default function Page() { return <Novedad />; }
