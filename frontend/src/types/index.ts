// Camera and Server types
export type CameraId = 'cam1' | 'cam2' | 'cam3' | 'cam4' | 'upload';

export interface CameraConfig {
  id: CameraId;
  name: string;
  source: string;
  conf: number;
  weights: string;
  notes?: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  baseUrl: string;
  token?: string;
  cameras: CameraConfig[];
  createdAt: string;
  updatedAt: string;
}

// Uploaded video types
export type UploadedVideoStatus = 'uploaded' | 'processing' | 'stopped';

export interface UploadedVideo {
  videoId: string;
  filename: string;
  storedFilename: string;
  sizeBytes: number;
  uploadedAt: string;
  cameraId: CameraId;
  status: UploadedVideoStatus;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  active: boolean;
}

// Alert types
export type Severity = 'high' | 'medium' | 'low';
export type TriageState = 'accept' | 'review' | 'deny' | null;

export interface AlertRecord {
  id: string;
  timestamp: string;
  severity: Severity;
  cameraId?: CameraId;
  cameraName?: string;
  labels?: string[];
  type?: string;
  raw: Record<string, unknown>;
}

// API response types
export interface CameraStatus {
  camera_id: string;
  running: boolean;
  uptime_sec: number | null;
  source: string | null;
  conf: number;
  yolo_weights: string;
}

export interface PipelineStatus {
  running: boolean;
  uptime_sec: number | null;
  pid: number;
  cameras: Record<CameraId, CameraStatus>;
  args: {
    VIDEO_SOURCE: string | number;
    IMG_SIZE: number;
    FPS: number;
    YOLO_WEIGHTS: string;
    YOLO_CONF: number;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  cameras_active: number;
}

// Debug log types
export type LogLevel = 'info' | 'error' | 'alert' | 'success';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

// Triage map type
export type TriageMap = Record<string, TriageState>;

// Default camera config factory
export const createDefaultCamera = (id: CameraId, index: number): CameraConfig => ({
  id,
  name: `Camera ${index + 1}`,
  source: '0',
  conf: 0.25,
  weights: 'yolo11n.pt',
  notes: '',
});

// Default server config factory
export const createDefaultServer = (id: string): ServerConfig => ({
  id,
  name: '',
  baseUrl: 'http://localhost:8000',
  token: 'CHANGE_ME_SHARED_SECRET',
  cameras: [createDefaultCamera('cam1', 0)],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Valid camera IDs
export const CAMERA_IDS: CameraId[] = ['cam1', 'cam2', 'cam3', 'cam4'];

