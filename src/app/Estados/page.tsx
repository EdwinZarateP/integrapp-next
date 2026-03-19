import dynamic from 'next/dynamic';
const Estados = dynamic(() => import('@/Paginas/EstadosManifiestos/index'), { ssr: false });
export default function Page() { return <Estados />; }
