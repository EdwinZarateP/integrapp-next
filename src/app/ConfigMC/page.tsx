import dynamic from 'next/dynamic';

const ConfigMCP = dynamic(() => import('@/Paginas/ConfigMCP'), { ssr: false });

export default function Page() {
  return <ConfigMCP />;
}
