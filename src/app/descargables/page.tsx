import dynamic from 'next/dynamic';
const Descargables = dynamic(() => import('@/Paginas/descargables/index'), { ssr: false });
export default function Page() { return <Descargables />; }
