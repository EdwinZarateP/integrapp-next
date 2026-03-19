import dynamic from 'next/dynamic';
const PanelConductores = dynamic(() => import('@/Paginas/PanelConductores/index'), { ssr: false });
export default function Page() { return <PanelConductores />; }
