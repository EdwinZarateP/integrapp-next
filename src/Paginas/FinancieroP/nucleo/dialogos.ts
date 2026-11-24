'use client';

/**
 * Diálogos del Módulo Financiero sobre SweetAlert2 (mismo componente que usa
 * el resto de la app). Reemplazan los window.prompt/confirm nativos.
 */
import Swal from 'sweetalert2';

export async function confirmar(titulo: string, texto = ''): Promise<boolean> {
  const r = await Swal.fire({
    title: titulo, text: texto, icon: 'question',
    showCancelButton: true, confirmButtonText: 'Sí, continuar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#349F4A', cancelButtonColor: '#6b7280',
    reverseButtons: true,
  });
  return r.isConfirmed;
}

/** Texto obligatorio (rechazos, glosas, motivos). Cancelar → null. */
export async function pedirTexto(titulo: string, placeholder = '', texto = ''): Promise<string | null> {
  const r = await Swal.fire({
    title: titulo, text: texto, icon: 'warning',
    input: 'textarea', inputPlaceholder: placeholder,
    showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#349F4A', cancelButtonColor: '#6b7280',
    reverseButtons: true,
    preConfirm: (v: string) => {
      if (!v.trim()) Swal.showValidationMessage('Escribe el motivo (es obligatorio).');
      return v.trim();
    },
  });
  return r.isConfirmed ? (r.value as string) : null;
}

/** Texto opcional (referencias, OC). Cancelar → null; vacío → ''. */
export async function pedirTextoOpcional(titulo: string, placeholder = ''): Promise<string | null> {
  const r = await Swal.fire({
    title: titulo,
    input: 'text', inputPlaceholder: placeholder,
    showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#349F4A', cancelButtonColor: '#6b7280', reverseButtons: true,
  });
  return r.isConfirmed ? String(r.value ?? '').trim() : null;
}

/** Número (valor de anticipo). Cancelar → null. */
export async function pedirNumero(titulo: string, texto = ''): Promise<number | null> {
  const r = await Swal.fire({
    title: titulo, text: texto,
    input: 'number', inputAttributes: { min: '0', step: 'any' },
    showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#349F4A', cancelButtonColor: '#6b7280', reverseButtons: true,
    preConfirm: (v: string) => {
      const n = parseFloat(v);
      if (!(n > 0)) Swal.showValidationMessage('Ingresa un valor mayor a cero.');
      return n;
    },
  });
  return r.isConfirmed ? (r.value as number) : null;
}

/** Fecha AAAA-MM-DD opcional (pagos de servicios). Cancelar → null; vacío → ''. */
export async function pedirFecha(titulo: string): Promise<string | null> {
  const r = await Swal.fire({
    title: titulo,
    input: 'date',
    showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#349F4A', cancelButtonColor: '#6b7280', reverseButtons: true,
  });
  return r.isConfirmed ? String(r.value ?? '') : null;
}

/** Elección sí/no (decisión de pago urgente). Cancelar → null. */
export async function elegirSiNo(titulo: string, texto: string, etiquetaSi = 'Sí', etiquetaNo = 'No'): Promise<boolean | null> {
  const r = await Swal.fire({
    title: titulo, text: texto, icon: 'question',
    showCancelButton: true, confirmButtonText: etiquetaSi, cancelButtonText: etiquetaNo,
    confirmButtonColor: '#349F4A', cancelButtonColor: '#dc2626', reverseButtons: true,
  });
  return r.isConfirmed ? true : r.dismiss === Swal.DismissReason.cancel ? false : null;
}
