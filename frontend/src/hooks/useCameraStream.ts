import { useState, useEffect, useRef, useCallback } from 'react';
import type { CameraId } from '../types';

interface UseCameraStreamOptions {
  baseUrl: string;
  room: string;
  cameraId: CameraId;
  token: string;
  autoConnect?: boolean;
}

interface UseCameraStreamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  bitrate: number | null;
}

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302'] },
];

export function useCameraStream({
  baseUrl,
  room,
  cameraId,
  token,
  autoConnect = false,
}: UseCameraStreamOptions): UseCameraStreamReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bitrate, setBitrate] = useState<number | null>(null);
  
  const bytesPrevRef = useRef(0);
  const timePrevRef = useRef(0);

  const cleanup = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      pcRef.current = null;
    }
    
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      wsRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setBitrate(null);
    bytesPrevRef.current = 0;
    timePrevRef.current = 0;
  }, []);

  const startStats = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    statsIntervalRef.current = window.setInterval(async () => {
      if (!pcRef.current) return;
      
      try {
        const stats = await pcRef.current.getStats(null);
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (!bytesPrevRef.current) {
              bytesPrevRef.current = report.bytesReceived;
              timePrevRef.current = report.timestamp;
              return;
            }
            
            const deltaBytes = report.bytesReceived - bytesPrevRef.current;
            const deltaTime = (report.timestamp - timePrevRef.current) / 1000;
            
            if (deltaTime > 0) {
              const kbps = (deltaBytes * 8) / deltaTime / 1000;
              setBitrate(kbps);
            }
            
            bytesPrevRef.current = report.bytesReceived;
            timePrevRef.current = report.timestamp;
          }
        });
      } catch (e) {
        console.warn('Stats error:', e);
      }
    }, 2000);
  }, []);

  const connect = useCallback(() => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    setError(null);
    
    // Create WebSocket connection
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      // Register as viewer
      ws.send(JSON.stringify({
        type: 'register',
        role: 'viewer',
        room,
        camera_id: cameraId,
        token,
      }));
    };
    
    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'offer') {
          // Create peer connection
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;
          
          pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (state === 'connected') {
              setIsConnected(true);
              setIsConnecting(false);
              startStats();
            } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
              setIsConnected(false);
              if (statsIntervalRef.current) {
                clearInterval(statsIntervalRef.current);
                statsIntervalRef.current = null;
              }
            }
          };
          
          pc.onicecandidate = (event) => {
            if (event.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'ice-candidate',
                room,
                candidate: {
                  candidate: event.candidate.candidate,
                  sdpMid: event.candidate.sdpMid,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                },
              }));
            }
          };
          
          pc.ontrack = (event) => {
            if (videoRef.current) {
              videoRef.current.srcObject = event.streams[0] || new MediaStream([event.track]);
              videoRef.current.play().catch(() => {});
            }
          };
          
          // Set remote description (offer)
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: msg.sdp,
          }));
          
          // Create and send answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          ws.send(JSON.stringify({
            type: 'answer',
            room,
            sdp: pc.localDescription?.sdp,
          }));
        } else if (msg.type === 'ice-candidate' && pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }
      } catch (e) {
        console.error('Error handling signaling message:', e);
      }
    };
    
    ws.onerror = () => {
      setError('WebSocket connection failed');
      setIsConnecting(false);
    };
    
    ws.onclose = () => {
      if (isConnecting) {
        setError('Connection closed unexpectedly');
      }
      cleanup();
    };
  }, [baseUrl, room, cameraId, token, isConnecting, isConnected, cleanup, startStats]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      cleanup();
    };
  }, [autoConnect]); // Only run on mount and when autoConnect changes

  return {
    videoRef,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
    bitrate,
  };
}

