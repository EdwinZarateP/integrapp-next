import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const PanelConductores = dynamic(() => import('@/Paginas/PanelConductores/index'), { ssr: false });

// Suspense: el panel lee useSearchParams (estado en la URL) — requisito del
// export estático para páginas que consumen query params.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PanelConductores />
    </Suspense>
  );
}
