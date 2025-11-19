export const API_BASE = "http://localhost:8000";
export const SIGNALING_URL = "ws://localhost:8000/ws";
export const DEFAULT_SECRET = "CHANGE_ME_SHARED_SECRET";

export function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function readSecretFromQuery() {
  const params = getQueryParams();
  const secret = params.get("secret");
  return secret || DEFAULT_SECRET;
}

export function getParam(name, fallback = "") {
  const params = getQueryParams();
  return params.get(name) ?? fallback;
}

export function getNumberParam(name, fallback) {
  const params = getQueryParams();
  const value = params.get(name);
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getBoolParam(name) {
  const params = getQueryParams();
  return params.get(name) === "1" || params.get(name) === "true";
}
