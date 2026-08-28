/**
 * Compresión de imágenes en el cliente, pensada para fotos tomadas con la
 * cámara del celular dentro de <input type="file">.
 *
 * Por qué existe: en Android/Chrome, al volver de la cámara el navegador
 * decodifica la foto a resolución completa en RAM para validarla contra el
 * `accept`; con cámaras de 12–50 MP y una pestaña ya cargada, la pestaña se
 * queda sin memoria ("memoria insuficiente para completar la operación
 * anterior") y el archivo nunca llega al onChange. Comprimir apenas llega el
 * archivo (y no retener el original) baja drásticamente el pico de memoria
 * del flujo de dos caras (frente → Swal → reverso) y de paso las subidas.
 *
 * Reglas:
 * - Solo procesa imágenes (JPEG/PNG/WEBP). Los PDF y cualquier otro tipo se
 *   devuelven intactos.
 * - Si el resultado comprimido pesara MÁS que el original, devuelve el
 *   original (fotos ya optimizadas, imágenes pequeñas).
 * - NUNCA rompe el flujo: ante cualquier fallo devuelve el archivo original.
 * - `image/heic`/`image/heif` se devuelven intactos: los navegadores sin
 *   soporte no pueden decodificarlos y el backend los rechazaría igual.
 */

/** Lado mayor máximo de la imagen de salida (px). */
const LADO_MAX = 1600;
/** Calidad JPEG de salida (0–1). */
const CALIDAD = 0.82;

const TIPOS_COMPRIMIBLES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export async function comprimirImagen(
  archivo: File,
  ladoMax = LADO_MAX,
  calidad = CALIDAD
): Promise<File> {
  if (!archivo || !TIPOS_COMPRIMIBLES.includes(archivo.type)) return archivo;
  try {
    // createImageBitmap con orientation:'from-image' aplica la rotación EXIF
    // (las fotos de celular landscape-guardadas-como-portrait) sin canvas
    // intermedio manual. Soportado en todos los Chrome/Safari modernos.
    const opciones: ImageBitmapOptions & { resizeQuality?: string } = {
      imageOrientation: 'from-image',
    };

    let bitmap: ImageBitmap | ImageData | HTMLImageElement;
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(archivo, opciones as ImageBitmapOptions);
    } else {
      // Fallback: <img> + objectURL (iOS viejos / navegadores sin bitmap).
      bitmap = await cargarConImg(archivo);
    }

    const ancho = 'width' in bitmap ? bitmap.width : 0;
    const alto = 'height' in bitmap ? bitmap.height : 0;
    if (!ancho || !alto) return archivo;

    const escala = Math.min(1, ladoMax / Math.max(ancho, alto));
    const wFinal = Math.max(1, Math.round(ancho * escala));
    const hFinal = Math.max(1, Math.round(alto * escala));

    const canvas = document.createElement('canvas');
    canvas.width = wFinal;
    canvas.height = hFinal;
    const ctx = canvas.getContext('2d');
    if (!ctx) return archivo;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, wFinal, hFinal);
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', calidad)
    );
    // Liberar el canvas lo antes posible (móviles con poca RAM).
    canvas.width = 0;
    canvas.height = 0;

    if (!blob || blob.size === 0 || blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    // Cualquier fallo (formato raro, memoria, navegador viejo): archivo tal cual.
    return archivo;
  }
}

async function cargarConImg(archivo: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
    return img;
  } finally {
    // El objectURL se revoca al terminar; el <img> ya decodificó en memoria.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
