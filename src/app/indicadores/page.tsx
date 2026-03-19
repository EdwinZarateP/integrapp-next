import dynamic from 'next/dynamic';
const Indicadores = dynamic(() => import('@/Paginas/Indicadores/index'), { ssr: false });
export default function Page() { return <Indicadores />; }
