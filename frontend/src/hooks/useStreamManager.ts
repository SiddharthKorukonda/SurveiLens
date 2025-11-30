import { useCallback, useSyncExternalStore, useEffect, useRef } from 'react';
import type { CameraId } from '../types';

// Stream connection key format: `${serverId}:${cameraId}`
type StreamKey = string;

interface StreamConnection {
  key: StreamKey;
  serverId: string;
  cameraId: CameraId;
  baseUrl: string;
  token: string;
  room: string;
  pc: RTCPeerConnection | null;
  ws: WebSocket | null;
  stream: MediaStream | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  bitrate: number | null;
  bytesPrev: number;
  timePrev: number;
  statsInterval: number | null;
}

// Global state
const connections = new Map<StreamKey, StreamConnection>();
const listeners = new Set<() => void>();
const videoElements = new Map<StreamKey, HTMLVideoElement>();

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302'] }];

// Notify all listeners of state change
function notifyListeners() {
  listeners.forEach((listener) => listener());
}

// Get snapshot for useSyncExternalStore
function getSnapshot(): Map<StreamKey, StreamConnection> {
  return connections;
}

// Subscribe for useSyncExternalStore
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Create a stream key
function createStreamKey(serverId: string, cameraId: CameraId): StreamKey {
  return `${serverId}:${cameraId}`;
}

// Start stats collection for a connection
function startStats(conn: StreamConnection) {
  if (conn.statsInterval) {
    clearInterval(conn.statsInterval);
  }

  conn.statsInterval = window.setInterval(async () => {
    if (!conn.pc) return;

    try {
      const stats = await conn.pc.getStats(null);
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          if (!conn.bytesPrev) {
            conn.bytesPrev = report.bytesReceived;
            conn.timePrev = report.timestamp;
            return;
          }

          const deltaBytes = report.bytesReceived - conn.bytesPrev;
          const deltaTime = (report.timestamp - conn.timePrev) / 1000;

          if (deltaTime > 0) {
            conn.bitrate = (deltaBytes * 8) / deltaTime / 1000;
            notifyListeners();
          }

          conn.bytesPrev = report.bytesReceived;
          conn.timePrev = report.timestamp;
        }
      });
    } catch (e) {
      console.warn('[StreamManager] Stats error:', e);
    }
  }, 2000);
}

// Stop stats collection for a connection
function stopStats(conn: StreamConnection) {
  if (conn.statsInterval) {
    clearInterval(conn.statsInterval);
    conn.statsInterval = null;
  }
}

// Connect to a stream
function connectStream(
  serverId: string,
  cameraId: CameraId,
  baseUrl: string,
  token: string,
  room: string
): void {
  const key = createStreamKey(serverId, cameraId);

  // Check if already connected or connecting
  const existing = connections.get(key);
  if (existing && (existing.status === 'connected' || existing.status === 'connecting')) {
    console.log('[StreamManager] Already connected/connecting:', key);
    return;
  }

  // Create new connection
  const conn: StreamConnection = {
    key,
    serverId,
    cameraId,
    baseUrl,
    token,
    room,
    pc: null,
    ws: null,
    stream: null,
    status: 'connecting',
    error: null,
    bitrate: null,
    bytesPrev: 0,
    timePrev: 0,
    statsInterval: null,
  };

  connections.set(key, conn);
  notifyListeners();

  console.log('[StreamManager] Connecting:', key);

  // Create WebSocket connection
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);
  conn.ws = ws;

  ws.onopen = () => {
    console.log('[StreamManager] WebSocket open:', key);
    ws.send(
      JSON.stringify({
        type: 'register',
        role: 'viewer',
        room,
        camera_id: cameraId,
        token,
      })
    );
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'offer') {
        console.log('[StreamManager] Received offer:', key);

        // Create peer connection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        conn.pc = pc;

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          console.log('[StreamManager] PC state:', key, state);

          if (state === 'connected') {
            conn.status = 'connected';
            conn.error = null;
            startStats(conn);
            notifyListeners();
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            conn.status = 'disconnected';
            stopStats(conn);
            notifyListeners();
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'ice-candidate',
                room,
                candidate: {
                  candidate: event.candidate.candidate,
                  sdpMid: event.candidate.sdpMid,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                },
              })
            );
          }
        };

        pc.ontrack = (event) => {
          console.log('[StreamManager] Track received:', key);
          const stream = event.streams[0] || new MediaStream([event.track]);
          conn.stream = stream;

          // Attach to video element if registered
          const video = videoElements.get(key);
          if (video) {
            video.srcObject = stream;
            video.play().catch(() => {});
          }

          notifyListeners();
        };

        // Set remote description (offer)
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'offer',
            sdp: msg.sdp,
          })
        );

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(
          JSON.stringify({
            type: 'answer',
            room,
            sdp: pc.localDescription?.sdp,
          })
        );
      } else if (msg.type === 'ice-candidate' && conn.pc) {
        try {
          await conn.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {
          console.warn('[StreamManager] Error adding ICE candidate:', e);
        }
      }
    } catch (e) {
      console.error('[StreamManager] Error handling message:', e);
    }
  };

  ws.onerror = () => {
    console.error('[StreamManager] WebSocket error:', key);
    conn.status = 'error';
    conn.error = 'WebSocket connection failed';
    notifyListeners();
  };

  ws.onclose = () => {
    console.log('[StreamManager] WebSocket closed:', key);
    if (conn.status === 'connecting') {
      conn.status = 'error';
      conn.error = 'Connection closed unexpectedly';
    }
    notifyListeners();
  };
}

// Disconnect a stream
function disconnectStream(serverId: string, cameraId: CameraId): void {
  const key = createStreamKey(serverId, cameraId);
  const conn = connections.get(key);

  if (!conn) {
    console.log('[StreamManager] No connection to disconnect:', key);
    return;
  }

  console.log('[StreamManager] Disconnecting:', key);

  stopStats(conn);

  if (conn.pc) {
    try {
      conn.pc.close();
    } catch (e) {
      console.warn('[StreamManager] Error closing PC:', e);
    }
    conn.pc = null;
  }

  if (conn.ws) {
    try {
      conn.ws.close();
    } catch (e) {
      console.warn('[StreamManager] Error closing WS:', e);
    }
    conn.ws = null;
  }

  conn.stream = null;
  conn.status = 'disconnected';
  conn.error = null;
  conn.bitrate = null;

  // Remove video element reference
  const video = videoElements.get(key);
  if (video) {
    video.srcObject = null;
  }
  videoElements.delete(key);

  connections.delete(key);
  notifyListeners();
}

// Disconnect all streams for a server
function disconnectServer(serverId: string): void {
  const keysToDisconnect: StreamKey[] = [];

  connections.forEach((conn, key) => {
    if (conn.serverId === serverId) {
      keysToDisconnect.push(key);
    }
  });

  keysToDisconnect.forEach((key) => {
    const conn = connections.get(key);
    if (conn) {
      disconnectStream(conn.serverId, conn.cameraId);
    }
  });
}

// Register a video element for a stream
function registerVideoElement(
  serverId: string,
  cameraId: CameraId,
  video: HTMLVideoElement | null
): void {
  const key = createStreamKey(serverId, cameraId);

  if (video) {
    videoElements.set(key, video);

    // If stream already exists, attach it
    const conn = connections.get(key);
    if (conn?.stream) {
      video.srcObject = conn.stream;
      video.play().catch(() => {});
    }
  } else {
    videoElements.delete(key);
  }
}

// Get connection state for a stream
function getConnection(serverId: string, cameraId: CameraId): StreamConnection | undefined {
  const key = createStreamKey(serverId, cameraId);
  return connections.get(key);
}

// Hook to use the stream manager
export function useStreamManager() {
  // Subscribe to changes
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    connect: connectStream,
    disconnect: disconnectStream,
    disconnectServer,
    registerVideo: registerVideoElement,
    getConnection,
    getAllConnections: () => connections,
  };
}

// Hook for a single camera stream with video ref management
export function useManagedCameraStream(
  serverId: string,
  cameraId: CameraId,
  baseUrl: string,
  token: string,
  room: string,
  autoConnect: boolean = true
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manager = useStreamManager();

  // Register video element when ref changes
  useEffect(() => {
    manager.registerVideo(serverId, cameraId, videoRef.current);

    return () => {
      manager.registerVideo(serverId, cameraId, null);
    };
  }, [serverId, cameraId, manager]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      const conn = manager.getConnection(serverId, cameraId);
      if (!conn || conn.status === 'disconnected' || conn.status === 'error') {
        manager.connect(serverId, cameraId, baseUrl, token, room);
      }
    }
  }, [serverId, cameraId, baseUrl, token, room, autoConnect, manager]);

  const connection = manager.getConnection(serverId, cameraId);

  const connect = useCallback(() => {
    manager.connect(serverId, cameraId, baseUrl, token, room);
  }, [serverId, cameraId, baseUrl, token, room, manager]);

  const disconnect = useCallback(() => {
    manager.disconnect(serverId, cameraId);
  }, [serverId, cameraId, manager]);

  return {
    videoRef,
    isConnecting: connection?.status === 'connecting',
    isConnected: connection?.status === 'connected',
    error: connection?.error || null,
    bitrate: connection?.bitrate || null,
    connect,
    disconnect,
  };
}

export default useStreamManager;

