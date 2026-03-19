import dynamic from 'next/dynamic';
const Api2 = dynamic(() => import('@/Paginas/Api/autenticar'), { ssr: false });
export default function Page() { return <Api2 />; }
