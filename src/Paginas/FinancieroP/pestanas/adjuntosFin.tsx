'use client';

/** Adjuntos de un registro del Módulo Financiero (GCS, URL firmada). */
import { useEffect, useState } from 'react';
import { FaPaperclip, FaTimes } from 'react-icons/fa';
import {
  AdjuntoFin, eliminarAdjuntoFin, listarAdjuntosFin, subirAdjuntoFin, urlDescargaAdjunto,
} from '@/Funciones/ApiPedidos/financiero';
import { toastFin } from '../nucleo/componentes';

export function AdjuntosFin({ modulo, referencia }: { modulo: string; referencia: string }) {
  const [adjuntos, setAdjuntos] = useState<AdjuntoFin[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    listarAdjuntosFin(modulo, referencia)
      .then((lista) => { if (vivo) setAdjuntos(lista); })
      .catch(() => { if (vivo) setAdjuntos([]); });
    return () => { vivo = false; };
  }, [modulo, referencia, recarga]);

  const recargarAdjuntos = () => setRecarga((n) => n + 1);

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      for (const f of Array.from(files)) await subirAdjuntoFin(f, modulo, referencia);
      toastFin('Adjunto(s) subido(s)');
      recargarAdjuntos();
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error subiendo', 'mal');
    } finally { setSubiendo(false); }
  };

  return (
    <div className="fin-adjuntos">
      <h4 className="fin-subtitulo"><FaPaperclip /> Adjuntos</h4>
      <ul className="fin-listaAdjuntos">
        {adjuntos?.map((a) => (
          <li key={a.id}>
            <button className="fin-link" onClick={async () => {
              try { window.open(await urlDescargaAdjunto(a.id), '_blank', 'noopener'); }
              catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
            }}>{a.nombre_archivo}</button>
            <span className="fin-suave"> {(a.tamano_bytes / 1024).toFixed(0)} KB</span>
            <button className="fin-btnIcono fin-icoMal" title="Eliminar" onClick={async () => {
              if (!window.confirm(`¿Eliminar ${a.nombre_archivo}?`)) return;
              try { await eliminarAdjuntoFin(a.id); toastFin('Adjunto eliminado'); recargarAdjuntos(); }
              catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
            }}><FaTimes /></button>
          </li>
        ))}
        {adjuntos && adjuntos.length === 0 && <li className="fin-suave">Sin adjuntos.</li>}
      </ul>
      <label className="fin-btn fin-btnSecundario fin-subirBtn">
        {subiendo ? 'Subiendo…' : '＋ Adjuntar soporte'}
        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => subir(e.target.files)} />
      </label>
    </div>
  );
}
