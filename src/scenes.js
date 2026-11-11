// Which picture is shown. There are two, each a whole world of its own, so going from one to the other loads the
// page again with the other named in its address: ?scene=aurora (the first, and what a bare address shows) or
// ?scene=autumn.
const q = new URLSearchParams(location.search);
export const SCENE = q.get('scene') === 'autumn' ? 'autumn' : 'aurora';

/** Goes to the other picture, from its start. Asked for the one already showing, does nothing. */
export function showScene(scene) {
  if (scene === SCENE || (scene !== 'autumn' && scene !== 'aurora')) return;
  const next = new URLSearchParams(location.search);
  next.set('scene', scene);
  location.search = next.toString();
}
