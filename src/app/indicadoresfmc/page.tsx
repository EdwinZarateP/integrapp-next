import dynamic from 'next/dynamic';
const Indicadoresfmc = dynamic(() => import('@/Paginas/Indicadores-fmc/index'), { ssr: false });
export default function Page() { return <Indicadoresfmc />; }
