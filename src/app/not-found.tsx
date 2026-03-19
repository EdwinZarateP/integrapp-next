import dynamic from 'next/dynamic';
const NoEncontrado = dynamic(() => import('@/Paginas/NoEncontrado/index'), { ssr: false });
export default function NotFound() { return <NoEncontrado />; }
