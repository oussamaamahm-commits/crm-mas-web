import gsap from 'gsap';

// Animaciones discretas: se omiten con "reducir movimiento" o con la pestaña oculta.
// Si el navegador deja de pintar frames (ventana ocluida), una animación quedaría a medias
// mostrando valores u opacidades intermedias: settle() fuerza siempre el estado final.

export const skipMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible';

/** Ejecuta fn tras ms aunque no haya frames. Devuelve la función de limpieza. */
export function settle(fn, ms = 1000) {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
}

/** Detiene las animaciones de los elementos y retira los estilos en línea que dejaron. */
export function finish(targets) {
  gsap.killTweensOf(targets);
  gsap.set(targets, { clearProps: 'opacity,transform' });
}
