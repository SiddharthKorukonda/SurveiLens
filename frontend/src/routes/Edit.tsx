import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassPanel,
  PrimaryButton,
  SecondaryButton,
  Input,
} from '../components';
import { useServers } from '../hooks/useServers';
import { startCamera } from '../api/client';
import { useCameraStream } from '../hooks/useCameraStream';
import type { CameraConfig, CameraId } from '../types';
import { CAMERA_IDS, createDefaultCamera } from '../types';
import styles from './Edit.module.css';
import ServerLayout from './ServerLayout';

interface CameraCardProps {
  camera: CameraConfig;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (updates: Partial<CameraConfig>) => void;
  onRemove: () => void;
  baseUrl: string;
  token: string;
}

function CameraCard({
  camera,
  index,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
  baseUrl,
  token,
}: CameraCardProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { videoRef, isConnecting, isConnected, error, connect, disconnect } =
    useCameraStream({
      baseUrl,
      room: `edit-${camera.id}`,
      cameraId: camera.id,
      token,
    });

  const handleStartDetection = async () => {
    setIsStarting(true);
    setStartError(null);
    try {
      await startCamera(baseUrl, camera);
      setIsRunning(true);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <GlassPanel className={styles.cameraCard}>
      <div className={styles.cameraHeader} onClick={onToggle}>
        <div className={styles.cameraTitle}>
          <span className={styles.cameraIcon}>◉</span>
          <span>Camera {index + 1}</span>
          {camera.name && camera.name !== `Camera ${index + 1}` && (
            <span className={styles.cameraName}>({camera.name})</span>
          )}
        </div>
        <div className={styles.cameraHeaderRight}>
          {isRunning && <span className={styles.runningBadge}>Running</span>}
          {isConnected && <span className={styles.connectedBadge}>Connected</span>}
          <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={styles.cameraContent}
          >
            <div className={styles.cameraFields}>
              <Input
                label="Camera Name"
                value={camera.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g., Front Entrance"
              />
              <Input
                label="Source"
                value={camera.source}
                onChange={(e) => onChange({ source: e.target.value })}
                placeholder="0 or rtsp://..."
                hint="Device index or RTSP URL"
              />
              <Input
                label="Confidence"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={camera.conf}
                onChange={(e) => onChange({ conf: parseFloat(e.target.value) || 0.25 })}
              />
              <Input
                label="YOLO Weights"
                value={camera.weights}
                onChange={(e) => onChange({ weights: e.target.value })}
                placeholder="yolo11n.pt"
              />
              <Input
                label="Notes"
                value={camera.notes || ''}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>

            {/* Preview */}
            <div className={styles.previewSection}>
              <div className={styles.previewContainer}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={styles.previewVideo}
                />
                {!isConnected && (
                  <div className={styles.previewPlaceholder}>
                    {isConnecting ? 'Connecting...' : 'No preview'}
                  </div>
                )}
              </div>

              {error && (
                <motion.div
                  className={styles.error}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {error}
                </motion.div>
              )}
              {startError && (
                <motion.div
                  className={styles.error}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {startError}
                </motion.div>
              )}
            </div>

            <div className={styles.cameraActions}>
              <SecondaryButton
                size="sm"
                onClick={isConnected ? disconnect : connect}
                loading={isConnecting}
              >
                {isConnected ? 'Disconnect' : 'Connect Stream'}
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                onClick={handleStartDetection}
                loading={isStarting}
                disabled={isRunning}
              >
                {isRunning ? 'Detection Running' : 'Start Detection'}
              </SecondaryButton>
              {index > 0 && (
                <button className={styles.removeBtn} onClick={onRemove}>
                  Remove
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

export function Edit() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer, updateServer } = useServers();
  const server = getServer(serverId || '');

  // Local form state
  const [serverName, setServerName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [expandedCamera, setExpandedCamera] = useState<CameraId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form with server data
  useEffect(() => {
    if (server) {
      setServerName(server.name);
      setBaseUrl(server.baseUrl);
      setToken(server.token || '');
      setCameras(server.cameras);
    }
  }, [server]);

  const updateCamera = (id: CameraId, updates: Partial<CameraConfig>) => {
    setCameras((prev) =>
      prev.map((cam) => (cam.id === id ? { ...cam, ...updates } : cam))
    );
  };

  const removeCamera = (id: CameraId) => {
    setCameras((prev) => prev.filter((cam) => cam.id !== id));
  };

  const addCamera = () => {
    const usedIds = new Set(cameras.map((c) => c.id));
    const nextId = CAMERA_IDS.find((id) => !usedIds.has(id));
    if (nextId) {
      const newCamera = createDefaultCamera(nextId, cameras.length);
      setCameras((prev) => [...prev, newCamera]);
      setExpandedCamera(nextId);
    }
  };

  const handleSave = () => {
    if (!serverId) return;

    setIsSaving(true);
    setSaveSuccess(false);

    // Simulate brief save delay for UX
    setTimeout(() => {
      updateServer(serverId, {
        name: serverName,
        baseUrl,
        token,
        cameras,
      });
      setIsSaving(false);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 300);
  };

  if (!server) {
    return (
      <ServerLayout>
        <GlassPanel className={styles.errorPanel}>
          <h2>Server not found</h2>
          <PrimaryButton onClick={() => navigate('/servers')}>
            Back to Servers
          </PrimaryButton>
        </GlassPanel>
      </ServerLayout>
    );
  }

  const hasChanges =
    serverName !== server.name ||
    baseUrl !== server.baseUrl ||
    token !== (server.token || '') ||
    JSON.stringify(cameras) !== JSON.stringify(server.cameras);

  return (
    <ServerLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Edit Server</h1>
          <p className={styles.subtitle}>
            Modify server configuration and cameras
          </p>
        </div>

        <GlassPanel className={styles.section}>
          <h2 className={styles.sectionTitle}>Server Details</h2>
          <div className={styles.serverFields}>
            <Input
              label="Server Name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="e.g., Office Building"
            />
            <Input
              label="Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:8000"
              hint="API endpoint for this server"
            />
            <Input
              label="Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Shared secret"
              hint="WebRTC authentication token"
            />
          </div>
        </GlassPanel>

        <div className={styles.camerasSection}>
          <div className={styles.camerasSectionHeader}>
            <h2 className={styles.sectionTitle}>Cameras</h2>
            {cameras.length < 4 && (
              <SecondaryButton size="sm" onClick={addCamera}>
                + Add Camera
              </SecondaryButton>
            )}
          </div>

          <div className={styles.camerasList}>
            {cameras.map((camera, index) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                index={index}
                isExpanded={expandedCamera === camera.id}
                onToggle={() =>
                  setExpandedCamera(
                    expandedCamera === camera.id ? null : camera.id
                  )
                }
                onChange={(updates) => updateCamera(camera.id, updates)}
                onRemove={() => removeCamera(camera.id)}
                baseUrl={baseUrl}
                token={token}
              />
            ))}
          </div>
        </div>

        <div className={styles.saveSection}>
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={styles.successMessage}
              >
                ✓ Changes saved successfully
              </motion.div>
            )}
          </AnimatePresence>

          <PrimaryButton
            size="lg"
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges}
          >
            Save Changes
          </PrimaryButton>
        </div>
      </div>
    </ServerLayout>
  );
}

export default Edit;

