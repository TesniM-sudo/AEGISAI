const configuredApiBase = import.meta.env.VITE_MARKET_API_URL;

export const getApiBase = () => {
  if (configuredApiBase && configuredApiBase !== "auto") {
    return configuredApiBase;
  }

  // Auto mode: use the same host serving the frontend, but backend port.
  const protocol = window.location.protocol || "http:";
  const host = window.location.hostname || "127.0.0.1";
  return `${protocol}//${host}:8010`;
};
