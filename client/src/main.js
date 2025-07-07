import App from './App.svelte';

const app = new App({
  target: typeof document !== 'undefined' ? document.getElementById('app') : undefined,
  hydrate: true
});

export default app;
