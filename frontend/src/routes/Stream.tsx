import { useState, useEffect } from 'react';
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

interface CameraTileProps {
  camera: CameraConfig;
  serverId: string;
  baseUrl: string;
  token: string;
  status: PipelineStatus['cameras'][CameraId] | null;
  isLarge: boolean;
}

function CameraTile({ camera, serverId, baseUrl, token, status, isLarge }: CameraTileProps) {
  const { videoRef, isConnecting, isConnected, error, bitrate, connect, disconnect } =
    useManagedCameraStream(
      serverId,
      camera.id,
      baseUrl,
      token,
      `stream-${serverId}-${camera.id}`,
      true // autoConnect
    );

  const [isHovered, setIsHovered] = useState(false);
  const isRunning = status?.running ?? false;

  return (
    <motion.div
      className={`${styles.tile} ${isLarge ? styles.tileLarge : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      layout
    >
      <GlassPanel className={styles.tilePanel} tilt={!isLarge}>
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
                  <div className={styles.spinner} />
                  <span>Connecting...</span>
                </div>
              ) : error ? (
                <div className={styles.errorState}>
                  <span>⚠</span>
                  <span>{error}</span>
                  <SecondaryButton size="sm" onClick={connect}>
                    Retry
                  </SecondaryButton>
                </div>
              ) : (
                <div className={styles.noSignal}>
                  <span>◈</span>
                  <span>No Signal</span>
                  <SecondaryButton size="sm" onClick={connect}>
                    Connect
                  </SecondaryButton>
                </div>
              )}
            </div>
          )}

          {/* Overlays */}
          <div className={styles.overlay}>
            <div className={styles.overlayTop}>
              <span className={styles.cameraName}>{camera.name}</span>
              <StatusBadge active={isRunning} label={isRunning ? 'Detecting' : 'Idle'} />
            </div>
          </div>

          <AnimatePresence>
            {isHovered && (
              <motion.div
                className={styles.overlayBottom}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Source:</span>
                  <span className={styles.metaValue}>{camera.source}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Conf:</span>
                  <span className={styles.metaValue}>{camera.conf}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Weights:</span>
                  <span className={styles.metaValue}>{camera.weights}</span>
                </div>
                {bitrate && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Bitrate:</span>
                    <span className={styles.metaValue}>{bitrate.toFixed(0)} kbps</span>
                  </div>
                )}
                
                {/* Stop Stream button on hover */}
                {isConnected && (
                  <div className={styles.streamActions}>
                    <button 
                      className={styles.stopStreamBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnect();
                      }}
                    >
                      <span className={styles.stopIcon}>■</span>
                      Stop Stream
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connection indicator */}
          {isConnected && (
            <div className={styles.connectionIndicator}>
              <span className={styles.liveIndicator}>● LIVE</span>
            </div>
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function PlaceholderTile() {
  return (
    <div className={styles.tile}>
      <GlassPanel className={styles.tilePanel}>
        <div className={styles.videoContainer}>
          <div className={styles.videoPlaceholder}>
            <div className={styles.noSignal}>
              <span className={styles.placeholderIcon}>◇</span>
              <span>No camera in this slot</span>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

export function Stream() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');

  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Fetch status periodically
  useEffect(() => {
    if (!server) return;

    const fetchStatus = async () => {
      try {
        const s = await getStatus(server.baseUrl);
        setStatus(s);
      } catch {
        setStatus(null);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [server]);

  if (!server) {
    return (
      <ServerLayout>
        <GlassPanel className={styles.errorPanel}>
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

  // Determine grid layout
  const getGridClass = () => {
    if (cameraCount === 1) return styles.gridSingle;
    if (cameraCount === 2) return styles.gridDouble;
    return styles.gridQuad;
  };

  // Get camera status
  const getCameraStatus = (cameraId: CameraId) => {
    return status?.cameras?.[cameraId] || null;
  };

  return (
    <ServerLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>{server.name}</h1>
            <div className={styles.headerMeta}>
              <span>{cameraCount} camera{cameraCount !== 1 ? 's' : ''}</span>
              <span className={styles.metaSep}>•</span>
              <StatusBadge active={anyRunning} />
            </div>
          </div>
          <div className={styles.headerActions}>
            <PrimaryButton
              onClick={handleStartAll}
              loading={isStarting}
              disabled={anyRunning}
            >
              Start Detection
            </PrimaryButton>
            <DangerButton
              onClick={handleStopAll}
              loading={isStopping}
              disabled={!anyRunning}
            >
              Stop All
            </DangerButton>
          </div>
        </div>

        {/* Camera grid */}
        {cameraCount === 0 ? (
          <GlassPanel className={styles.emptyState}>
            <div className={styles.emptyIcon}>◈</div>
            <h3>No cameras configured</h3>
            <p>Add cameras in the Edit view to start streaming.</p>
            <PrimaryButton onClick={() => navigate(`/servers/${serverId}/edit`)}>
              Edit Server
            </PrimaryButton>
          </GlassPanel>
        ) : (
          <div className={`${styles.grid} ${getGridClass()}`}>
            {server.cameras.map((camera) => (
              <CameraTile
                key={camera.id}
                camera={camera}
                serverId={serverId || ''}
                baseUrl={server.baseUrl}
                token={server.token || ''}
                status={getCameraStatus(camera.id)}
                isLarge={cameraCount === 1}
              />
            ))}
            {/* Add placeholder tiles for 3-camera setup */}
            {cameraCount === 3 && <PlaceholderTile />}
          </div>
        )}
      </div>
    </ServerLayout>
  );
}

export default Stream;
