// Feature plugin entry. Each group registers itself through window.NihaoCore.
// Every module is loaded independently so a failure in one never breaks the others.
const modules = [
  () => import('./platform/index.js'),
  () => import('./motivation/index.js'),
  () => import('./lesson-path/index.js'),
  () => import('./speak-studio/index.js'),
  () => import('./games-reading/index.js')
];

export const ready = Promise.all(modules.map(load => load().catch(err => console.error('[features] module failed', err))));
