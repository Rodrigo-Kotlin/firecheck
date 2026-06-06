export function register() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registrado com sucesso:', reg.scope);
        })
        .catch((err) => {
          console.error('Falha ao registrar o Service Worker:', err);
        });
    });
  }
}
