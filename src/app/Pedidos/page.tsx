import dynamic from 'next/dynamic';
const Pedidos = dynamic(() => import('@/Paginas/Pedidos/index'), { ssr: false });
export default function Page() { return <Pedidos />; }
