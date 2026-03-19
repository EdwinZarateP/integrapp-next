import dynamic from 'next/dynamic';
const Registro = dynamic(() => import('@/Paginas/Registro/index'), { ssr: false });
export default function Page() { return <Registro />; }
