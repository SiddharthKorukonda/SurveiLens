import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, PrimaryButton, DangerButton, SecondaryButton, Modal, StatusBadge } from '../components';
import { useServers } from '../hooks/useServers';
import { useStreamManager } from '../hooks/useStreamManager';
import { clearTriageForServer } from '../hooks/useTriage';
import { getStatus, stopCamera, clearAlerts } from '../api/client';
import type { ServerConfig, PipelineStatus } from '../types';
import styles from './MyServers.module.css';

interface ServerCardProps {
  server: ServerConfig;
  status: PipelineStatus | null;
  index: number;
  onStream: () => void;
  onAlerts: () => void;
  onDebug: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ServerCard({
  server,
  status,
  index,
  onStream,
  onAlerts,
  onDebug,
  onEdit,
  onDelete,
}: ServerCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tiltStyle, setTiltStyle] = useState({ rotateX: 0, rotateY: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  
  const activeCameras = status
    ? Object.values(status.cameras).filter((c) => c.running).length
    : 0;
  const isActive = status?.running ?? false;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    
    setTiltStyle({ rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTiltStyle({ rotateX: 0, rotateY: 0 });
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: index * 0.1,
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -20,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      ref={cardRef}
      className={`${styles.cardWrapper} ${isHovered ? styles.cardHovered : ''}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg)`,
      }}
    >
      <div className={styles.card}>
        {/* Animated background pattern */}
        <div className={styles.cardPattern} />
        
        {/* Glow effect on hover */}
        <div className={`${styles.cardGlow} ${isHovered ? styles.cardGlowActive : ''}`} />
        
        {/* Card content */}
        <div className={styles.cardContent}>
          <div className={styles.cardHeader}>
            <div className={styles.serverNameContainer}>
              <motion.span 
                className={styles.serverIcon}
                animate={isActive ? { 
                  boxShadow: ['0 0 10px var(--color-success-glow)', '0 0 20px var(--color-success-glow)', '0 0 10px var(--color-success-glow)']
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ◈
              </motion.span>
              <h3 className={styles.serverName}>{server.name || 'Unnamed Server'}</h3>
            </div>
            <StatusBadge active={isActive} />
          </div>

          <div className={styles.cardInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Cameras</span>
              <span className={styles.infoValue}>
                <span className={styles.infoHighlight}>{activeCameras}</span> / {server.cameras.length} active
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Endpoint</span>
              <span className={`${styles.infoValue} ${styles.endpoint}`}>{server.baseUrl}</span>
            </div>
            {status?.uptime_sec && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Uptime</span>
                <span className={styles.infoValue}>
                  {formatUptime(status.uptime_sec)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action rail that slides in from right */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className={styles.actionRail}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <motion.button 
                className={styles.actionBtn} 
                onClick={onStream}
                whileHover={{ scale: 1.05, x: 3 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={styles.actionIcon}>▶</span>
                <span className={styles.actionText}>Stream</span>
              </motion.button>
              <motion.button 
                className={styles.actionBtn} 
                onClick={onAlerts}
                whileHover={{ scale: 1.05, x: 3 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={styles.actionIcon}>⚠</span>
                <span className={styles.actionText}>Alerts</span>
              </motion.button>
              <motion.button 
                className={styles.actionBtn} 
                onClick={onDebug}
                whileHover={{ scale: 1.05, x: 3 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={styles.actionIcon}>⌘</span>
                <span className={styles.actionText}>Debug</span>
              </motion.button>
              <motion.button 
                className={styles.actionBtn} 
                onClick={onEdit}
                whileHover={{ scale: 1.05, x: 3 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={styles.actionIcon}>✎</span>
                <span className={styles.actionText}>Edit</span>
              </motion.button>
              <motion.button
                className={`${styles.actionBtn} ${styles.actionDanger}`}
                onClick={onDelete}
                whileHover={{ scale: 1.05, x: 3 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={styles.actionIcon}>✕</span>
                <span className={styles.actionText}>Delete</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Animated number component with glow
function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const duration = 800;
      const startTime = Date.now();
      const startValue = 0;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(Math.floor(startValue + (value - startValue) * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setHasAnimated(true);
        }
      };

      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  useEffect(() => {
    if (hasAnimated && displayValue !== value) {
      setDisplayValue(value);
    }
  }, [value, hasAnimated, displayValue]);

  return <span className={styles.animatedNumber}>{displayValue}</span>;
}

export function MyServers() {
  const navigate = useNavigate();
  const { servers, deleteServer } = useServers();
  const streamManager = useStreamManager();
  
  const [serverStatuses, setServerStatuses] = useState<Record<string, PipelineStatus | null>>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<ServerConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch status for all servers
  useEffect(() => {
    const fetchStatuses = async () => {
      const statuses: Record<string, PipelineStatus | null> = {};
      for (const server of servers) {
        try {
          const status = await getStatus(server.baseUrl);
          statuses[server.id] = status;
        } catch {
          statuses[server.id] = null;
        }
      }
      setServerStatuses(statuses);
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, [servers]);

  // Calculate stats
  const totalServers = servers.length;
  const activeServers = Object.values(serverStatuses).filter((s) => s?.running).length;
  const camerasOnline = Object.values(serverStatuses).reduce((acc, status) => {
    if (!status) return acc;
    return acc + Object.values(status.cameras).filter((c) => c.running).length;
  }, 0);

  const handleDelete = (server: ServerConfig) => {
    setServerToDelete(server);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (serverToDelete) {
      setIsDeleting(true);
      
      try {
        // Stop all cameras on the server
        await stopCamera(serverToDelete.baseUrl);
      } catch (e) {
        console.warn('Failed to stop cameras on server:', e);
      }
      
      try {
        // Clear alerts on the backend for this server
        await clearAlerts(serverToDelete.baseUrl);
      } catch (e) {
        console.warn('Failed to clear alerts on server:', e);
      }
      
      // Disconnect all streams for this server
      streamManager.disconnectServer(serverToDelete.id);
      
      // Clear triage data for this server
      clearTriageForServer(serverToDelete.id);
      
      // Small delay for animation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Delete server from local storage
      deleteServer(serverToDelete.id);
      
      setDeleteModalOpen(false);
      setServerToDelete(null);
      setIsDeleting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
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
      {/* Header */}
      <motion.div className={styles.header} variants={itemVariants}>
        <div>
          <h1 className={styles.title}>My Servers</h1>
          <p className={styles.subtitle}>
            Manage your video intelligence servers
          </p>
        </div>
        <PrimaryButton glow pulse onClick={() => navigate('/servers/new')}>
          <span className={styles.addIcon}>+</span> Add Server
        </PrimaryButton>
      </motion.div>

      {/* Stats with staggered animation */}
      <motion.div className={styles.stats} variants={itemVariants}>
        {[
          { value: totalServers, label: 'Total Servers', delay: 0 },
          { value: activeServers, label: 'Active Servers', delay: 100 },
          { value: camerasOnline, label: 'Cameras Online', delay: 200 },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
          >
            <GlassPanel glow className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value={stat.value} delay={stat.delay + 500} />
              </div>
              <div className={styles.statLabel}>{stat.label}</div>
              <div className={styles.statGlow} />
            </GlassPanel>
          </motion.div>
        ))}
      </motion.div>

      {/* Server grid */}
      {servers.length === 0 ? (
        <motion.div variants={itemVariants}>
          <GlassPanel glow className={styles.emptyState}>
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
            <h3>No servers configured</h3>
            <p>Add your first server to start monitoring</p>
            <PrimaryButton glow onClick={() => navigate('/servers/new')}>
              Add Server
            </PrimaryButton>
          </GlassPanel>
        </motion.div>
      ) : (
        <div className={styles.grid}>
          <AnimatePresence mode="popLayout">
            {servers.map((server, index) => (
              <ServerCard
                key={server.id}
                server={server}
                status={serverStatuses[server.id] || null}
                index={index}
                onStream={() => navigate(`/servers/${server.id}/stream`)}
                onAlerts={() => navigate(`/servers/${server.id}/alerts`)}
                onDebug={() => navigate(`/servers/${server.id}/debug`)}
                onEdit={() => navigate(`/servers/${server.id}/edit`)}
                onDelete={() => handleDelete(server)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Server"
        size="sm"
        variant="danger"
      >
        <div className={styles.deleteModal}>
          <p>
            Are you sure you want to delete{' '}
            <strong className={styles.deleteServerName}>{serverToDelete?.name || 'this server'}</strong>?
          </p>
          <p className={styles.deleteWarning}>
            <span className={styles.warningIcon}>⚠</span>
            This will remove its configuration. Active streams will be stopped.
          </p>
          <div className={styles.deleteActions}>
            <SecondaryButton onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <DangerButton onClick={confirmDelete} loading={isDeleting}>
              Delete
            </DangerButton>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

export default MyServers;
