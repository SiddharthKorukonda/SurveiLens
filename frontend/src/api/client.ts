import type { 
  CameraConfig, 
  PipelineStatus, 
  AlertRecord, 
  HealthResponse,
  CameraId,
  Severity,
  UploadedVideo,
} from '../types';

// Default API base URL (can be overridden per server)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// Start detection for a camera
export async function startCamera(
  baseUrl: string,
  camera: CameraConfig
): Promise<PipelineStatus> {
  return apiFetch<PipelineStatus>(baseUrl, '/start', {
    method: 'POST',
    body: JSON.stringify({
      camera_id: camera.id,
      source: camera.source,
      yolo_weights: camera.weights,
      conf: camera.conf,
    }),
  });
}

// Stop detection for a camera or all cameras
export async function stopCamera(
  baseUrl: string,
  cameraId?: CameraId
): Promise<PipelineStatus> {
  return apiFetch<PipelineStatus>(baseUrl, '/stop', {
    method: 'POST',
    body: JSON.stringify({ camera_id: cameraId }),
  });
}

// Get pipeline status
export async function getStatus(baseUrl: string): Promise<PipelineStatus> {
  return apiFetch<PipelineStatus>(baseUrl, '/pipeline/status');
}

// Get camera-specific status
export async function getCameraStatus(
  baseUrl: string,
  cameraId: CameraId
): Promise<PipelineStatus['cameras'][CameraId]> {
  return apiFetch(baseUrl, `/camera/${cameraId}/status`);
}

// Get alerts
export async function getAlerts(
  baseUrl: string,
  limit = 250,
  cameraId?: CameraId
): Promise<AlertRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cameraId) {
    params.append('camera_id', cameraId);
  }
  
  const data = await apiFetch<Record<string, unknown>[]>(
    baseUrl,
    `/alerts?${params.toString()}`
  );
  
  return data.map(normalizeAlert);
}

// Clear all alerts
export async function clearAlerts(baseUrl: string): Promise<void> {
  return apiFetch(baseUrl, '/alerts', { method: 'DELETE' });
}

// Health check
export async function healthCheck(baseUrl: string): Promise<HealthResponse> {
  return apiFetch<HealthResponse>(baseUrl, '/health');
}

// Upload a video file for offline detection
export async function uploadVideoFile(baseUrl: string, file: File): Promise<UploadedVideo> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${baseUrl}/videos/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return normalizeUploadedVideo(data);
}

// Fetch uploaded videos
export async function listUploadedVideos(baseUrl: string): Promise<UploadedVideo[]> {
  const data = await apiFetch<Record<string, unknown>[]>(baseUrl, '/videos/uploads');
  return data.map(normalizeUploadedVideo);
}

// Start detection for an uploaded video
export async function startUploadedVideo(
  baseUrl: string,
  videoId: string,
  options: { conf?: number; yoloWeights?: string } = {}
): Promise<UploadedVideoCommandResponse> {
  const payload: Record<string, unknown> = {};
  if (options.conf !== undefined) {
    payload.conf = options.conf;
  }
  if (options.yoloWeights) {
    payload.yolo_weights = options.yoloWeights;
  }

  const raw = await apiFetch<Record<string, unknown>>(
    baseUrl,
    `/videos/uploads/${videoId}/start`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  return {
    message: (raw.message as string) || 'started',
    cameraId: (raw.camera_id as CameraId) || 'upload',
    video: normalizeUploadedVideo((raw.video as Record<string, unknown>) || {}),
    pipeline: raw.pipeline as PipelineStatus,
  };
}

// Stop detection for an uploaded video
export async function stopUploadedVideo(
  baseUrl: string,
  videoId: string
): Promise<UploadedVideoCommandResponse> {
  const raw = await apiFetch<Record<string, unknown>>(
    baseUrl,
    `/videos/uploads/${videoId}/stop`,
    {
      method: 'POST',
    }
  );

  return {
    message: (raw.message as string) || 'stopped',
    cameraId: (raw.camera_id as CameraId) || 'upload',
    video: normalizeUploadedVideo((raw.video as Record<string, unknown>) || {}),
    pipeline: raw.pipeline as PipelineStatus,
  };
}

// Normalize alert data from backend
function normalizeAlert(raw: Record<string, unknown>): AlertRecord {
  const timestamp = (raw.timestamp as string) || new Date().toISOString();
  const labels = (raw.labels as string[]) || [];
  const cameraId = raw.camera_id as CameraId | undefined;
  
  // Determine severity from danger_level or severity field
  let severity: Severity = 'low';
  const dangerLevel = ((raw.danger_level as string) || '').toLowerCase();
  const rawSeverity = ((raw.severity as string) || '').toLowerCase();
  
  if (dangerLevel === 'high' || rawSeverity === 'high') {
    severity = 'high';
  } else if (dangerLevel === 'medium' || rawSeverity === 'medium') {
    severity = 'medium';
  }
  
  // Generate unique ID from timestamp + labels + camera
  const id = `${timestamp}-${labels.join(',')}-${cameraId || 'unknown'}`;
  
  return {
    id,
    timestamp,
    severity,
    cameraId,
    labels,
    type: raw.type as string | undefined,
    raw,
  };
}

function normalizeUploadedVideo(raw: Record<string, unknown>): UploadedVideo {
  const statusRaw = (raw.status as string) || 'uploaded';
  const status: UploadedVideo['status'] =
    statusRaw === 'processing'
      ? 'processing'
      : statusRaw === 'stopped'
      ? 'stopped'
      : 'uploaded';
  const sizeRaw = raw.size_bytes;
  let sizeBytes = 0;
  if (typeof sizeRaw === 'number') {
    sizeBytes = sizeRaw;
  } else if (typeof sizeRaw === 'string') {
    sizeBytes = Number(sizeRaw) || 0;
  }

  return {
    videoId: (raw.video_id as string) || '',
    filename: (raw.filename as string) || 'video.mp4',
    storedFilename: (raw.stored_filename as string) || '',
    sizeBytes,
    uploadedAt: (raw.uploaded_at as string) || new Date().toISOString(),
    cameraId: ((raw.camera_id as CameraId) || 'upload') as CameraId,
    status,
    lastStartedAt: raw.last_started_at as string | undefined,
    lastStoppedAt: raw.last_stopped_at as string | undefined,
    active: Boolean(raw.active),
  };
}

export interface UploadedVideoCommandResponse {
  message: string;
  cameraId: CameraId;
  video: UploadedVideo;
  pipeline: PipelineStatus;
}

// WebRTC signaling connection
export function createSignalingConnection(
  baseUrl: string,
  room: string,
  cameraId: CameraId,
  token: string,
  callbacks: {
    onOffer: (sdp: string, room: string, cameraId: string) => void;
    onError: (error: Error) => void;
    onClose: () => void;
  }
): {
  sendAnswer: (sdp: string) => void;
  close: () => void;
} {
  // Convert HTTP URL to WebSocket URL
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
  
  const ws = new WebSocket(wsUrl);
  
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
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'offer') {
        callbacks.onOffer(msg.sdp, msg.room, msg.camera_id);
      }
    } catch (e) {
      console.error('Failed to parse signaling message:', e);
    }
  };
  
  ws.onerror = () => {
    callbacks.onError(new Error('WebSocket error'));
  };
  
  ws.onclose = () => {
    callbacks.onClose();
  };
  
  return {
    sendAnswer: (sdp: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'answer',
          room,
          sdp,
        }));
      }
    },
    close: () => {
      ws.close();
    },
  };
}

// Default export for convenience
export default {
  startCamera,
  stopCamera,
  getStatus,
  getCameraStatus,
  getAlerts,
  clearAlerts,
  healthCheck,
  uploadVideoFile,
  listUploadedVideos,
  startUploadedVideo,
  stopUploadedVideo,
  createSignalingConnection,
};

