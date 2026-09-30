export function abrirCatalogo(navigate) {
  const esCompu = window.innerWidth >= 768;
  if (esCompu) {
    const w = 480, h = 720;
    const left = window.screenX + window.outerWidth - w - 40;
    const top = window.screenY + 80;
    window.open('/catalogo', 'catalogo', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  } else {
    navigate('/catalogo');
  }
}