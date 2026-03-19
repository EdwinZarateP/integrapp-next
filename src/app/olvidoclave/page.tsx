import dynamic from 'next/dynamic';
const Olvidoclave = dynamic(() => import('@/Paginas/Olvidoclave/index'), { ssr: false });
export default function Page() { return <Olvidoclave />; }
