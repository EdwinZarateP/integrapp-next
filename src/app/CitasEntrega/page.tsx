import dynamic from 'next/dynamic';
const CitasEntregaP = dynamic(() => import('@/Paginas/CitasEntregaP'), { ssr: false });
export default function Page() { return <CitasEntregaP />; }
