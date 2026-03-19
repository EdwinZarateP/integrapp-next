import dynamic from 'next/dynamic';
const InicioPropietarios = dynamic(() => import('@/Paginas/InicioPropietarios/index'), { ssr: false });
export default function Page() { return <InicioPropietarios />; }
