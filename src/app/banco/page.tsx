import dynamic from 'next/dynamic';
const Banco = dynamic(() => import('@/Paginas/banco/index'), { ssr: false });
export default function Page() { return <Banco />; }
