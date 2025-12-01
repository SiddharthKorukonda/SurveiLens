import { useState, useEffect, useMemo } from 'react';
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
  hasChanges: boolean;
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
  hasChanges,
  onToggle,
  onChange,
  onRemove,
  baseUrl,
  token,
}: CameraCardProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setIsStarting(false);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
    },
  };

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" layout>
      <div className={`${styles.cameraCard} ${isExpanded ? styles.cameraCardExpanded : ''} ${hasChanges ? styles.cameraCardChanged : ''}`}>
        {/* Unsaved changes indicator */}
        {hasChanges && (
          <motion.div 
            className={styles.unsavedIndicator}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
          />
        )}
        
        <motion.div 
          className={styles.cameraHeader} 
          onClick={onToggle}
          whileHover={{ backgroundColor: 'rgba(56, 189, 248, 0.05)' }}
        >
          <div className={styles.cameraTitle}>
            <motion.span 
              className={styles.cameraIcon}
              animate={isRunning ? {
                color: ['var(--color-success)', 'var(--color-success-bright)', 'var(--color-success)'],
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ◉
            </motion.span>
            <span className={styles.cameraNumber}>Camera {index + 1}</span>
            {camera.name && camera.name !== `Camera ${index + 1}` && (
              <span className={styles.cameraName}>— {camera.name}</span>
            )}
          </div>
          <div className={styles.cameraHeaderRight}>
            {/* Activity chip */}
            {isRunning && (
              <motion.span 
                className={styles.activityChip}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                Active
              </motion.span>
            )}
            {isConnected && (
              <span className={styles.connectedBadge}>Connected</span>
            )}
            <motion.span 
              className={styles.chevron}
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              ▼
            </motion.span>
          </div>
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className={styles.cameraContent}
            >
              <div className={styles.cameraBody}>
                {/* Fields with staggered animation */}
                <div className={styles.cameraFields}>
                  {[
                    { label: 'Camera Name', value: camera.name, key: 'name', placeholder: 'e.g., Front Entrance' },
                    { label: 'Source', value: camera.source, key: 'source', placeholder: '0 or rtsp://...', hint: 'Device index or RTSP URL' },
                    { label: 'Confidence', value: camera.conf, key: 'conf', type: 'number', step: '0.01', min: '0', max: '1' },
                    { label: 'YOLO Weights', value: camera.weights, key: 'weights', placeholder: 'yolo11n.pt' },
                  ].map((field, i) => (
                    <motion.div
                      key={field.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Input
                        label={field.label}
                        value={field.value}
                        onChange={(e) => onChange({ [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0.25 : e.target.value })}
                        placeholder={field.placeholder}
                        hint={field.hint}
                        type={field.type}
                        step={field.step}
                        min={field.min}
                        max={field.max}
                        variant="glass"
                      />
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className={styles.fullWidth}
                  >
                    <Input
                      label="Notes"
                      value={camera.notes || ''}
                      onChange={(e) => onChange({ notes: e.target.value })}
                      placeholder="Optional notes..."
                      variant="glass"
                    />
                  </motion.div>
                </div>

                {/* Preview */}
                <motion.div 
                  className={styles.previewSection}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className={`${styles.previewContainer} ${isConnected ? styles.previewActive : ''}`}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={styles.previewVideo}
                    />
                    {!isConnected && (
                      <div className={styles.previewPlaceholder}>
                        {isConnecting ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className={styles.spinner}
                          >
                            ◌
                          </motion.div>
                        ) : (
                          <>
                            <span className={styles.previewIcon}>◉</span>
                            <span>No preview</span>
                          </>
                        )}
                      </div>
                    )}
                    
                    <AnimatePresence>
                      {showSuccess && (
                        <motion.div
                          className={styles.successFlash}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          ✓ Detection Started
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {(error || startError) && (
                      <motion.div
                        className={styles.error}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        ⚠ {error || startError}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div 
                  className={styles.cameraActions}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
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
                    <motion.button 
                      className={styles.removeBtn} 
                      onClick={onRemove}
                      whileHover={{ scale: 1.05, color: 'var(--color-danger)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Remove
                    </motion.button>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function Edit() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer, updateServer } = useServers();
  const server = getServer(serverId || '');

  const [serverName, setServerName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [expandedCamera, setExpandedCamera] = useState<CameraId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize form with server data (with streaming effect)
  useEffect(() => {
    if (server) {
      // Simulate streaming data load
      const timeout1 = setTimeout(() => setServerName(server.name), 100);
      const timeout2 = setTimeout(() => setBaseUrl(server.baseUrl), 200);
      const timeout3 = setTimeout(() => setToken(server.token || ''), 300);
      const timeout4 = setTimeout(() => {
        setCameras(server.cameras);
        setIsLoaded(true);
      }, 400);
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
        clearTimeout(timeout4);
      };
    }
  }, [server]);

  // Track which cameras have changes
  const camerasWithChanges = useMemo(() => {
    if (!server) return new Set<CameraId>();
    const changes = new Set<CameraId>();
    cameras.forEach((cam) => {
      const original = server.cameras.find(c => c.id === cam.id);
      if (!original || JSON.stringify(cam) !== JSON.stringify(original)) {
        changes.add(cam.id);
      }
    });
    return changes;
  }, [cameras, server]);

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

    setTimeout(() => {
      updateServer(serverId, {
        name: serverName,
        baseUrl,
        token,
        cameras,
      });
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 300);
  };

  if (!server) {
    return (
      <ServerLayout>
        <GlassPanel className={styles.errorPanel} glow>
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
    }
  };

  return (
    <ServerLayout>
      <motion.div 
        className={styles.container}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className={styles.header} variants={itemVariants}>
          <h1 className={styles.title}>Edit Server</h1>
          <p className={styles.subtitle}>
            Modify server configuration and cameras
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <GlassPanel glow className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>◈</span>
              Server Details
              {(serverName !== server.name || baseUrl !== server.baseUrl || token !== (server.token || '')) && (
                <motion.span 
                  className={styles.unsavedDot}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </h2>
            <div className={styles.serverFields}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoaded ? 1 : 0.5 }}
              >
                <Input
                  label="Server Name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g., Office Building"
                  variant="glass"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoaded ? 1 : 0.5 }}
              >
                <Input
                  label="Base URL"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  hint="API endpoint for this server"
                  variant="glass"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoaded ? 1 : 0.5 }}
              >
                <Input
                  label="Token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Shared secret"
                  hint="WebRTC authentication token"
                  variant="glass"
                />
              </motion.div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div className={styles.camerasSection} variants={itemVariants}>
          <div className={styles.camerasSectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>◉</span>
              Cameras
              <span className={styles.cameraCount}>{cameras.length}/4</span>
            </h2>
            {cameras.length < 4 && (
              <SecondaryButton size="sm" onClick={addCamera} glow>
                + Add Camera
              </SecondaryButton>
            )}
          </div>

          <div className={styles.camerasList}>
            <AnimatePresence mode="popLayout">
              {cameras.map((camera, index) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  index={index}
                  isExpanded={expandedCamera === camera.id}
                  hasChanges={camerasWithChanges.has(camera.id)}
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
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div className={styles.saveSection} variants={itemVariants}>
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className={styles.successMessage}
              >
                <span className={styles.successIcon}>✓</span>
                Changes saved successfully
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className={styles.saveButtonWrapper}
            whileHover={hasChanges ? { scale: 1.02 } : {}}
            whileTap={hasChanges ? { scale: 0.98 } : {}}
          >
            <PrimaryButton
              size="xl"
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
              glow={hasChanges}
              pulse={hasChanges}
              className={styles.saveButton}
            >
              Save Changes
            </PrimaryButton>
          </motion.div>

          {hasChanges && (
            <motion.p 
              className={styles.unsavedHint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              You have unsaved changes
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </ServerLayout>
  );
}

export default Edit;
