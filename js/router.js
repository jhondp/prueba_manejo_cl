export function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] ?? 'inicio', param: parts[1] ?? null };
}

export function startRouter(onRoute) {
  const run = () => onRoute(parseRoute(location.hash));
  addEventListener('hashchange', run);
  run();
}

export const navigate = (path) => { location.hash = `#/${path}`; };
