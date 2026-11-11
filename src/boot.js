// Starts the picture the address asks for (src/scenes.js) and wires the two buttons that change it.
import { SCENE, showScene } from './scenes.js';

document.documentElement.dataset.scene = SCENE;
const q = new URLSearchParams(location.search);
const switcher = document.getElementById('scenes');
if (q.has('capture') || q.has('clean')) switcher?.remove();
for (const button of switcher?.querySelectorAll('button') ?? []) {
  button.classList.toggle('on', button.dataset.scene === SCENE);
  button.addEventListener('click', () => showScene(button.dataset.scene));
  // Space is jump: a button must never be left holding the keyboard
  button.addEventListener('keydown', (e) => e.preventDefault());
  button.addEventListener('focus', () => button.blur());
}
if (SCENE === 'autumn') await import('./main.js');
else await import('./night/main.js');
