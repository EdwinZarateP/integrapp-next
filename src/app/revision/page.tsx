import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const RevisionVehiculos = dynamic(() => import('@/Paginas/revision/index'), { ssr: false });

// Suspense: la bandeja lee useSearchParams (estado en la URL) — requisito del
// export estático para páginas que consumen query params.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <RevisionVehiculos />
    </Suspense>
  );
}
