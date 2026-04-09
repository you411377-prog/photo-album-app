const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const getRenderApiBaseUrl = () => {
  const configured = import.meta.env.VITE_RENDER_API_BASE_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return '';
};

export const getRenderApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getRenderApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
};
