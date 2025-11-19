import { SIGNALING_URL } from "./env.js";

const DEFAULT_ICE = [{ urls: ["stun:stun.l.google.com:19302"] }];

export function connectViewer({
  room = "cam-1",
  token,
  iceServers = DEFAULT_ICE,
  onTrack,
  onState,
  onIceState,
  onBitrate,
  onLog = () => {},
}) {
  let pc;
  let ws;
  let statsTimer;
  let bytesPrev = 0;
  let timePrev = 0;

  const cleanup = () => {
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
    if (pc) {
      try { pc.close(); } catch (err) { console.warn(err); }
      pc = null;
    }
    if (ws) {
      try { ws.close(); } catch (err) { console.warn(err); }
      ws = null;
    }
    onState?.("disconnected");
  };

  const send = (payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...payload, room }));
    }
  };

  const startStats = () => {
    stopStats();
    statsTimer = setInterval(async () => {
      if (!pc) return;
      try {
        const stats = await pc.getStats(null);
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            if (!bytesPrev) {
              bytesPrev = report.bytesReceived;
              timePrev = report.timestamp;
              return;
            }
            const deltaBytes = report.bytesReceived - bytesPrev;
            const deltaTime = (report.timestamp - timePrev) / 1000;
            if (deltaTime > 0) {
              const bitrate = (deltaBytes * 8) / deltaTime; // bits per second
              onBitrate?.(bitrate / 1000);
            }
            bytesPrev = report.bytesReceived;
            timePrev = report.timestamp;
          }
        });
      } catch (err) {
        console.warn("stats error", err);
      }
    }, 2000);
  };

  const stopStats = () => {
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
    bytesPrev = 0;
    timePrev = 0;
  };

  const createPeerConnection = () => {
    pc = new RTCPeerConnection({ iceServers });
    pc.onconnectionstatechange = () => {
      onLog?.("pc state", pc.connectionState);
      const state = pc.connectionState || "unknown";
      onState?.(state);
      if (state === "connected") {
        startStats();
      }
      if (state === "failed" || state === "disconnected") {
        stopStats();
      }
    };
    pc.oniceconnectionstatechange = () => {
      onLog?.("ice state", pc.iceConnectionState);
      onIceState?.(pc.iceConnectionState || "unknown");
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: "ice-candidate", candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        }});
      }
    };
    pc.ontrack = (event) => {
      onTrack?.(event.streams?.[0] || new MediaStream([event.track]));
    };
    return pc;
  };

  const handleOffer = async (message) => {
    if (!pc) createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: message.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: "answer", sdp: pc.localDescription.sdp });
    onLog?.("answer sent");
  };

  const handleIceCandidate = async (message) => {
    if (!pc || !message.candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    } catch (err) {
      onLog?.("ICE add error", err);
    }
  };

  ws = new WebSocket(SIGNALING_URL);
  ws.onopen = () => {
    onLog?.("ws open");
    ws.send(JSON.stringify({ type: "register", role: "viewer", room, token }));
    onState?.("connecting");
  };
  ws.onmessage = async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.room && message.room !== room) return;
    if (message.type === "offer") await handleOffer(message);
    else if (message.type === "ice-candidate") await handleIceCandidate(message);
    else onLog?.("ws", message);
  };
  ws.onerror = (evt) => {
    onLog?.("ws error", evt);
    cleanup();
  };
  ws.onclose = () => {
    onLog?.("ws closed");
    cleanup();
  };

  return {
    disconnect: cleanup,
  };
}
