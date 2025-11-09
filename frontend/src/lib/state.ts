import { create } from "zustand";

export type Camera = {
  id: string;           // cam-a, cam-b, cam-1, etc
  label: string;
  host: string;         // hostname or ip
  port: string;         // e.g. "8554"
  streamUrl?: string;   // rtsp/webrtc/http
  os?: string;          // "macOS" | "Windows" | "Linux"
  micId?: string;       // optional device id
};

export type Policy = {
  highThreshold: number;
  medThreshold: number;
  retentionHours: number;
  redactFaces: boolean;
};

export type Server = {
  id: string;          // slug
  name: string;
  createdAt: number;
  cameras: Camera[];
  policy: Policy;
};

type Store = {
  servers: Server[];
  addServer: (s: Server) => void;
  updateServer: (id: string, patch: Partial<Server>) => void;
  removeServer: (id: string) => void;
  upsertCamera: (serverId: string, cam: Camera) => void;
  setPolicy: (serverId: string, p: Policy) => void;
};

const KEY = "surveilens.servers";

function load(): Server[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function save(arr: Server[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

export const useStore = create<Store>((set, get) => ({
  servers: [],
  addServer: (s) => {
    const arr = [...get().servers, s];
    save(arr);
    set({ servers: arr });
  },
  updateServer: (id, patch) => {
    const arr = get().servers.map((x) => (x.id === id ? { ...x, ...patch } : x));
    save(arr);
    set({ servers: arr });
  },
  removeServer: (id) => {
    const arr = get().servers.filter((x) => x.id !== id);
    save(arr);
    set({ servers: arr });
  },
  upsertCamera: (serverId, cam) => {
    const arr = get().servers.map((sv) => {
      if (sv.id !== serverId) return sv;
      const idx = sv.cameras.findIndex((c) => c.id === cam.id);
      const cams = idx >= 0 ? sv.cameras.map((c, i) => (i === idx ? cam : c)) : [...sv.cameras, cam];
      return { ...sv, cameras: cams };
    });
    save(arr);
    set({ servers: arr });
  },
  setPolicy: (serverId, p) => {
    const arr = get().servers.map((sv) => (sv.id === serverId ? { ...sv, policy: p } : sv));
    save(arr);
    set({ servers: arr });
  },
}));

// initialize from localStorage once
if (typeof window !== "undefined") {
  const servers = load();
  (useStore as any).setState({ servers });
}
