// TODO: improve this
export function buildDeeplink(screen, params = {}) {
    const base = `hvkclient://${screen}`;
    const query = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    return query ? `${base}?${query}` : base;
}