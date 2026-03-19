import dynamic from 'next/dynamic';
const SalaEspera = dynamic(() => import('@/Paginas/SalaEspera/index'), { ssr: false });
export default function Page() { return <SalaEspera />; }
