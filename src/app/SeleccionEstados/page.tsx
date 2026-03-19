import dynamic from 'next/dynamic';
const SeleccionEstados = dynamic(() => import('@/Paginas/SeleccionEstados/index'), { ssr: false });
export default function Page() { return <SeleccionEstados />; }
