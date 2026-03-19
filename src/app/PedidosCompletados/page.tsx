import dynamic from 'next/dynamic';
const PedidosCompletados = dynamic(() => import('@/Paginas/PedidosCompletados/index'), { ssr: false });
export default function Page() { return <PedidosCompletados />; }
