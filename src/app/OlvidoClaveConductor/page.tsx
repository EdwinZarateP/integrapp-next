import dynamic from 'next/dynamic';
const OlvidoClaveConductor = dynamic(() => import('@/Paginas/OlvidoClaveConductor/index'), { ssr: false });
export default function Page() { return <OlvidoClaveConductor />; }
