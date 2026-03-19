import dynamic from 'next/dynamic';
const Inicio = dynamic(() => import('@/Paginas/Inicio/index'), { ssr: false });
export default function Page() { return <Inicio />; }
