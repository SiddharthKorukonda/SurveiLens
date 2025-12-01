import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import styles from './AddServer.module.css';

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
  const [showSuccess, setShowSuccess] = useState(false);

  const { videoRef, isConnecting, isConnected, error, connect, disconnect } =
    useCameraStream({
      baseUrl,
      room: `preview-${camera.id}`,
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
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
    },
  };

  const contentVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: { 
      height: 'auto', 
      opacity: 1,
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
    },
    exit: { 
      height: 0, 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      layout
    >
      <div className={`${styles.cameraCard} ${isExpanded ? styles.cameraCardExpanded : ''}`}>
        {/* Glow effect */}
        <div className={`${styles.cameraGlow} ${isExpanded ? styles.cameraGlowActive : ''}`} />
        
        {/* Header */}
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
                textShadow: ['0 0 10px var(--color-success-glow)', '0 0 20px var(--color-success-glow)', '0 0 10px var(--color-success-glow)']
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
            {isRunning && (
              <motion.span 
                className={styles.runningBadge}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                Running
              </motion.span>
            )}
            {isConnected && (
              <motion.span 
                className={styles.connectedBadge}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                Connected
              </motion.span>
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

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={styles.cameraContent}
            >
              <div className={styles.cameraBody}>
                {/* Fields */}
                <div className={styles.cameraFields}>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Input
                      label="Camera Name"
                      value={camera.name}
                      onChange={(e) => onChange({ name: e.target.value })}
                      placeholder="e.g., Front Entrance"
                      variant="glass"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Input
                      label="Source"
                      value={camera.source}
                      onChange={(e) => onChange({ source: e.target.value })}
                      placeholder="0 or rtsp://..."
                      hint="Device index or RTSP URL"
                      variant="glass"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Input
                      label="Confidence"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={camera.conf}
                      onChange={(e) => onChange({ conf: parseFloat(e.target.value) || 0.25 })}
                      variant="glass"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <Input
                      label="YOLO Weights"
                      value={camera.weights}
                      onChange={(e) => onChange({ weights: e.target.value })}
                      placeholder="yolo11n.pt"
                      variant="glass"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
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
                    
                    {/* Success flash */}
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

                  {/* Errors */}
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

                {/* Actions */}
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

export function AddServer() {
  const navigate = useNavigate();
  const { addServer } = useServers();

  const [serverName, setServerName] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000');
  const [token, setToken] = useState('CHANGE_ME_SHARED_SECRET');
  const [cameras, setCameras] = useState<CameraConfig[]>([
    createDefaultCamera('cam1', 0),
  ]);
  const [expandedCamera, setExpandedCamera] = useState<CameraId | null>('cam1');
  const [isDeploying, setIsDeploying] = useState(false);

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

  const canDeploy =
    serverName.trim() !== '' &&
    baseUrl.trim() !== '' &&
    cameras.length > 0 &&
    cameras.some((c) => c.source.trim() !== '');

  const handleDeploy = () => {
    if (!canDeploy) return;

    setIsDeploying(true);

    const newServer = addServer({
      name: serverName,
      baseUrl,
      token,
      cameras,
    });

    console.log('[AddServer] Server created:', newServer);

    setTimeout(() => {
      navigate('/servers');
    }, 500);
  };

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
    <motion.div 
      className={styles.container}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Breadcrumb */}
      <motion.div className={styles.breadcrumb} variants={itemVariants}>
        <span onClick={() => navigate('/')}>Home</span>
        <span className={styles.breadcrumbSep}>/</span>
        <span onClick={() => navigate('/servers')}>My Servers</span>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbActive}>Add Server</span>
      </motion.div>

      {/* Title */}
      <motion.h1 className={styles.title} variants={itemVariants}>
        Add Server
      </motion.h1>

      {/* Server Details */}
      <motion.div variants={itemVariants}>
        <GlassPanel glow className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>◈</span>
            Server Details
          </h2>
          <div className={styles.serverFields}>
            <Input
              label="Server Name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="e.g., Office Building"
              variant="glass"
            />
            <Input
              label="Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:8000"
              hint="API endpoint for this server"
              variant="glass"
            />
            <Input
              label="Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Shared secret"
              hint="WebRTC authentication token"
              variant="glass"
            />
          </div>
        </GlassPanel>
      </motion.div>

      {/* Cameras Section */}
      <motion.div className={styles.camerasSection} variants={itemVariants}>
        <div className={styles.camerasSectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>◉</span>
            Cameras
            <span className={styles.cameraCount}>{cameras.length}/4</span>
          </h2>
          {cameras.length < 4 && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <SecondaryButton size="sm" onClick={addCamera} glow>
                + Add Camera
              </SecondaryButton>
            </motion.div>
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

      {/* Deploy Section */}
      <motion.div className={styles.deploySection} variants={itemVariants}>
        {/* Progress bar */}
        <AnimatePresence>
          {isDeploying && (
            <motion.div
              className={styles.progressBar}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
        
        <motion.div
          className={styles.deployButtonWrapper}
          whileHover={canDeploy ? { scale: 1.02 } : {}}
          whileTap={canDeploy ? { scale: 0.98 } : {}}
        >
          <PrimaryButton
            size="xl"
            glow={canDeploy}
            pulse={canDeploy}
            onClick={handleDeploy}
            disabled={!canDeploy}
            loading={isDeploying}
            className={styles.deployButton}
          >
            <span className={styles.deployIcon}>▶</span>
            Deploy Server
          </PrimaryButton>
        </motion.div>
        
        {!canDeploy && (
          <motion.p 
            className={styles.deployHint}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Fill in server name and at least one camera source to deploy
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}

export default AddServer;
