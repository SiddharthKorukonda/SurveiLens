import { useCallback, useSyncExternalStore } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ServerConfig, CameraConfig, CameraId } from '../types';

const STORAGE_KEY = 'surveilens_servers';

// Global state and listeners for cross-component synchronization
let globalServers: ServerConfig[] = [];
const listeners = new Set<() => void>();

// Load servers from localStorage
function loadServersFromStorage(): ServerConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load servers from localStorage:', e);
  }
  return [];
}

// Save servers to localStorage and notify listeners
function saveServers(servers: ServerConfig[]): void {
  try {
    globalServers = servers;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
    // Notify all listeners of the change
    listeners.forEach(listener => listener());
  } catch (e) {
    console.error('Failed to save servers to localStorage:', e);
  }
}

// Initialize global state from localStorage
globalServers = loadServersFromStorage();

// Subscribe function for useSyncExternalStore
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Get snapshot function for useSyncExternalStore
function getSnapshot(): ServerConfig[] {
  return globalServers;
}


export function useServers() {
  // Use useSyncExternalStore for proper synchronization across components
  const servers = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Add a new server
  const addServer = useCallback((server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>): ServerConfig => {
    const newServer: ServerConfig = {
      ...server,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const updatedServers = [...globalServers, newServer];
    saveServers(updatedServers);
    
    console.log('[useServers] Added server:', newServer.name, 'Total:', updatedServers.length);
    return newServer;
  }, []);

  // Update an existing server
  const updateServer = useCallback((id: string, updates: Partial<ServerConfig>) => {
    const updatedServers = globalServers.map(server => {
      if (server.id === id) {
        return {
          ...server,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
      return server;
    });
    saveServers(updatedServers);
    console.log('[useServers] Updated server:', id);
  }, []);

  // Delete a server
  const deleteServer = useCallback((id: string) => {
    const updatedServers = globalServers.filter(server => server.id !== id);
    saveServers(updatedServers);
    console.log('[useServers] Deleted server:', id, 'Remaining:', updatedServers.length);
  }, []);

  // Get a server by ID
  const getServer = useCallback((id: string): ServerConfig | undefined => {
    return globalServers.find(server => server.id === id);
  }, []);

  // Refresh from localStorage (useful after external changes)
  const refresh = useCallback(() => {
    const loaded = loadServersFromStorage();
    globalServers = loaded;
    listeners.forEach(listener => listener());
  }, []);

  return {
    servers,
    addServer,
    updateServer,
    deleteServer,
    getServer,
    refresh,
  };
}

export function useServer(serverId: string) {
  const { servers, updateServer, deleteServer } = useServers();
  
  // Find the server from the synchronized state
  const server = servers.find(s => s.id === serverId);

  // Update server name
  const setName = useCallback((name: string) => {
    updateServer(serverId, { name });
  }, [serverId, updateServer]);

  // Update base URL
  const setBaseUrl = useCallback((baseUrl: string) => {
    updateServer(serverId, { baseUrl });
  }, [serverId, updateServer]);

  // Update token
  const setToken = useCallback((token: string) => {
    updateServer(serverId, { token });
  }, [serverId, updateServer]);

  // Update cameras
  const setCameras = useCallback((cameras: CameraConfig[]) => {
    updateServer(serverId, { cameras });
  }, [serverId, updateServer]);

  // Add a camera
  const addCamera = useCallback((camera: CameraConfig) => {
    if (!server) return;
    const cameras = [...server.cameras, camera];
    updateServer(serverId, { cameras });
  }, [server, serverId, updateServer]);

  // Update a specific camera
  const updateCamera = useCallback((cameraId: CameraId, updates: Partial<CameraConfig>) => {
    if (!server) return;
    const cameras = server.cameras.map(cam => {
      if (cam.id === cameraId) {
        return { ...cam, ...updates };
      }
      return cam;
    });
    updateServer(serverId, { cameras });
  }, [server, serverId, updateServer]);

  // Remove a camera
  const removeCamera = useCallback((cameraId: CameraId) => {
    if (!server) return;
    const cameras = server.cameras.filter(cam => cam.id !== cameraId);
    updateServer(serverId, { cameras });
  }, [server, serverId, updateServer]);

  // Delete this server
  const remove = useCallback(() => {
    deleteServer(serverId);
  }, [serverId, deleteServer]);

  return {
    server,
    setName,
    setBaseUrl,
    setToken,
    setCameras,
    addCamera,
    updateCamera,
    removeCamera,
    remove,
  };
}
