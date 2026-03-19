import dynamic from 'next/dynamic';
const DetalleEstados = dynamic(() => import('@/Paginas/DetalleEstados/index'), { ssr: false });
export default function Page() { return <DetalleEstados />; }
