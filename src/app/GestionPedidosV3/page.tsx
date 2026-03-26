import dynamic from 'next/dynamic';
const GestionPedidosV3P = dynamic(() => import('@/Paginas/GestionPedidosV3P/index'), { ssr: false });
export default function Page() { return <GestionPedidosV3P />; }