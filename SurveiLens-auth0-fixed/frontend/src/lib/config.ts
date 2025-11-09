export const cfg = {
  USE_BACKEND: import.meta.env.VITE_USE_BACKEND === "1",
  USE_MOCKS: import.meta.env.VITE_USE_MOCKS === "1",
  API_BASE: import.meta.env.VITE_API_BASE ?? "http://localhost:8000",
  DISABLE_AUTH: import.meta.env.VITE_DISABLE_AUTH === "1",
}