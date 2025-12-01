import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassPanel,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  StatusBadge,
} from '../components';
import { useServers } from '../hooks/useServers';
import { useManagedCameraStream } from '../hooks/useStreamManager';
import { startCamera, stopCamera, getStatus } from '../api/client';
import type { CameraConfig, CameraId, PipelineStatus } from '../types';
import styles from './Stream.module.css';
import ServerLayout from './ServerLayout';

// Floating particles component
function StreamParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <div className={styles.particles}>
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

interface CameraTileProps {
  camera: CameraConfig;
  serverId: string;
  baseUrl: string;
  token: string;
  status: PipelineStatus['cameras'][CameraId] | null;
  isLarge: boolean;
  index: number;
}

const CameraTile = memo(function CameraTile({ camera, serverId, baseUrl, token, status, isLarge, index }: CameraTileProps) {
  const { videoRef, isConnecting, isConnected, isManuallyStopped, error, bitrate, connect, disconnect } =
    useManagedCameraStream(
      serverId,
      camera.id,
      baseUrl,
      token,
      `stream-${serverId}-${camera.id}`,
      true
    );

  const [isHovered, setIsHovered] = useState(false);
  const [tiltStyle, setTiltStyle] = useState({ rotateX: 0, rotateY: 0 });
  const tileRef = useRef<HTMLDivElement>(null);
  const isRunning = status?.running ?? false;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!tileRef.current || isLarge) return;
    const rect = tileRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    
    setTiltStyle({ rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTiltStyle({ rotateX: 0, rotateY: 0 });
  };

  const tileVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        delay: index * 0.15,
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <motion.div
      ref={tileRef}
      className={`${styles.tile} ${isLarge ? styles.tileLarge : ''} ${isHovered ? styles.tileHovered : ''}`}
      variants={tileVariants}
      initial="hidden"
      animate="visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isLarge ? undefined : `perspective(1000px) rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg)`,
      }}
      layout
    >
      <div className={`${styles.tilePanel} ${isConnected ? styles.tilePanelActive : ''}`}>
        {/* Glow effect */}
        <div className={`${styles.tileGlow} ${isHovered ? styles.tileGlowActive : ''}`} />
        
        {/* Animated gradient border */}
        {isConnected && <div className={styles.tileBorderGlow} />}
        
        <div className={styles.videoContainer}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
          />
          
          {!isConnected && (
            <div className={styles.videoPlaceholder}>
              {isConnecting ? (
                <div className={styles.connecting}>
                  <motion.div 
                    className={styles.spinner}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    ◌
                  </motion.div>
                  <span>Connecting...</span>
                </div>
              ) : error ? (
                <div className={styles.errorState}>
                  <span className={styles.errorIcon}>⚠</span>
                  <span>{error}</span>
                  <SecondaryButton size="sm" onClick={connect}>
                    Retry
                  </SecondaryButton>
                </div>
              ) : isManuallyStopped ? (
                <div className={styles.noSignal}>
                  <span className={styles.stoppedIcon}>■</span>
                  <span>Stream Stopped</span>
                  <SecondaryButton size="sm" onClick={connect}>
                    Reconnect
                  </SecondaryButton>
                </div>
              ) : (
                <div className={styles.noSignal}>
                  <motion.span 
                    className={styles.noSignalIcon}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ◈
                  </motion.span>
                  <span>No Signal</span>
                  <SecondaryButton size="sm" onClick={connect}>
                    Connect
                  </SecondaryButton>
                </div>
              )}
            </div>
          )}

          {/* Top overlay - always visible */}
          <div className={styles.overlay}>
            <div className={styles.overlayTop}>
              <span className={styles.cameraName}>{camera.name}</span>
              <StatusBadge active={isRunning} label={isRunning ? 'Detecting' : 'Idle'} />
            </div>
          </div>

          {/* Bottom overlay - on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className={styles.overlayBottom}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Source</span>
                    <span className={styles.metaValue}>{camera.source}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Conf</span>
                    <span className={styles.metaValue}>{camera.conf}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Weights</span>
                    <span className={styles.metaValue}>{camera.weights}</span>
                  </div>
                  {bitrate && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Bitrate</span>
                      <span className={styles.metaValue}>{bitrate.toFixed(0)} kbps</span>
                    </div>
                  )}
                </div>
                
                {isConnected && (
                  <motion.button 
                    className={styles.stopStreamBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnect();
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className={styles.stopIcon}>■</span>
                    Stop Stream
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live indicator */}
          {isConnected && (
            <motion.div 
              className={styles.connectionIndicator}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <motion.span 
                className={styles.liveIndicator}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ● LIVE
              </motion.span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

const PlaceholderTile = memo(function PlaceholderTile({ index }: { index: number }) {
  const tileVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delay: index * 0.15,
        duration: 0.5,
      },
    },
  };

  return (
    <motion.div 
      className={styles.tile}
      variants={tileVariants}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.tilePlaceholder}>
        <div className={styles.placeholderContent}>
          <motion.span 
            className={styles.placeholderIcon}
            animate={{ 
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ◇
          </motion.span>
          <span>No camera in this slot</span>
        </div>
        <div className={styles.placeholderBorder} />
      </div>
    </motion.div>
  );
});

export function Stream() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');

  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Use a ref to track if we should update status to prevent unnecessary re-renders
  const statusRef = useRef<PipelineStatus | null>(null);
  
  useEffect(() => {
    if (!server) return;

    const fetchStatus = async () => {
      try {
        const s = await getStatus(server.baseUrl);
        // Only update state if status actually changed
        const currentStr = JSON.stringify(statusRef.current);
        const newStr = JSON.stringify(s);
        if (currentStr !== newStr) {
          statusRef.current = s;
          setStatus(s);
        }
      } catch {
        if (statusRef.current !== null) {
          statusRef.current = null;
          setStatus(null);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [server]);

  if (!server) {
    return (
      <ServerLayout>
        <GlassPanel className={styles.errorPanel} glow>
          <h2>Server not found</h2>
          <p>The server you're looking for doesn't exist.</p>
          <PrimaryButton onClick={() => navigate('/servers')}>
            Back to Servers
          </PrimaryButton>
        </GlassPanel>
      </ServerLayout>
    );
  }

  const handleStartAll = async () => {
    setIsStarting(true);
    try {
      for (const camera of server.cameras) {
        await startCamera(server.baseUrl, camera);
      }
    } catch (err) {
      console.error('Failed to start cameras:', err);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopAll = async () => {
    setIsStopping(true);
    try {
      await stopCamera(server.baseUrl);
    } catch (err) {
      console.error('Failed to stop cameras:', err);
    } finally {
      setIsStopping(false);
    }
  };

  const cameraCount = server.cameras.length;
  const anyRunning = status?.running ?? false;
  const runningCount = status ? Object.values(status.cameras).filter(c => c.running).length : 0;

  const getGridClass = useCallback(() => {
    if (cameraCount === 1) return styles.gridSingle;
    if (cameraCount === 2) return styles.gridDouble;
    return styles.gridQuad;
  }, [cameraCount]);

  const getCameraStatus = useCallback((cameraId: CameraId) => {
    return status?.cameras?.[cameraId] || null;
  }, [status]);

  return (
    <ServerLayout>
      <div className={styles.container}>
        {/* Ambient particles */}
        <StreamParticles />
        
        {/* Header */}
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>{server.name}</h1>
            <div className={styles.headerMeta}>
              <span className={styles.cameraCount}>
                <span className={styles.countNumber}>{runningCount}</span>
                <span className={styles.countSep}>/</span>
                <span>{cameraCount}</span>
                <span className={styles.countLabel}>cameras active</span>
              </span>
              <span className={styles.metaSep}>•</span>
              <StatusBadge active={anyRunning} />
            </div>
          </div>
          
          {/* Floating control strip */}
          <motion.div 
            className={styles.controlStrip}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <PrimaryButton
              onClick={handleStartAll}
              loading={isStarting}
              disabled={anyRunning}
              glow={!anyRunning}
            >
              <span className={styles.btnIcon}>▶</span>
              Start Detection
            </PrimaryButton>
            <DangerButton
              onClick={handleStopAll}
              loading={isStopping}
              disabled={!anyRunning}
            >
              <span className={styles.btnIcon}>■</span>
              Stop All
            </DangerButton>
          </motion.div>
        </motion.div>

        {/* Camera grid */}
        {cameraCount === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <GlassPanel className={styles.emptyState} glow>
              <motion.div 
                className={styles.emptyIcon}
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                ◈
              </motion.div>
              <h3>No cameras configured</h3>
              <p>Add cameras in the Edit view to start streaming.</p>
              <PrimaryButton onClick={() => navigate(`/servers/${serverId}/edit`)} glow>
                Edit Server
              </PrimaryButton>
            </GlassPanel>
          </motion.div>
        ) : (
          <div className={`${styles.grid} ${getGridClass()}`}>
            {server.cameras.map((camera, index) => (
              <CameraTile
                key={camera.id}
                camera={camera}
                serverId={serverId || ''}
                baseUrl={server.baseUrl}
                token={server.token || ''}
                status={getCameraStatus(camera.id)}
                isLarge={cameraCount === 1}
                index={index}
              />
            ))}
            {cameraCount === 3 && <PlaceholderTile index={3} />}
          </div>
        )}
      </div>
    </ServerLayout>
  );
}

export default Stream;
