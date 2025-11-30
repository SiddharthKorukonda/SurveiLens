import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, PrimaryButton, DangerButton, SecondaryButton, Modal, StatusBadge } from '../components';
import { useServers } from '../hooks/useServers';
import { getStatus } from '../api/client';
import type { ServerConfig, PipelineStatus } from '../types';
import styles from './MyServers.module.css';

interface ServerCardProps {
  server: ServerConfig;
  status: PipelineStatus | null;
  onStream: () => void;
  onAlerts: () => void;
  onDebug: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ServerCard({
  server,
  status,
  onStream,
  onAlerts,
  onDebug,
  onEdit,
  onDelete,
}: ServerCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const activeCameras = status
    ? Object.values(status.cameras).filter((c) => c.running).length
    : 0;
  const isActive = status?.running ?? false;

  return (
    <motion.div
      className={styles.cardWrapper}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      layout
    >
      <GlassPanel tilt glow className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.serverName}>{server.name || 'Unnamed Server'}</h3>
          <StatusBadge active={isActive} />
        </div>

        <div className={styles.cardInfo}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Cameras</span>
            <span className={styles.infoValue}>
              {activeCameras} / {server.cameras.length} active
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Endpoint</span>
            <span className={styles.infoValue}>{server.baseUrl}</span>
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

        <AnimatePresence>
          {isHovered && (
            <motion.div
              className={styles.actionRail}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <button className={styles.actionBtn} onClick={onStream}>
                <span className={styles.actionIcon}>▶</span>
                Stream
              </button>
              <button className={styles.actionBtn} onClick={onAlerts}>
                <span className={styles.actionIcon}>⚠</span>
                Alerts
              </button>
              <button className={styles.actionBtn} onClick={onDebug}>
                <span className={styles.actionIcon}>⌘</span>
                Debug
              </button>
              <button className={styles.actionBtn} onClick={onEdit}>
                <span className={styles.actionIcon}>✎</span>
                Edit
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionDanger}`}
                onClick={onDelete}
              >
                <span className={styles.actionIcon}>✕</span>
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>
    </motion.div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function MyServers() {
  const navigate = useNavigate();
  const { servers, deleteServer } = useServers();
  
  // Debug logging
  console.log('[MyServers] Rendering with servers:', servers.length, servers.map(s => s.name));
  const [serverStatuses, setServerStatuses] = useState<
    Record<string, PipelineStatus | null>
  >({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<ServerConfig | null>(null);

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
  const activeServers = Object.values(serverStatuses).filter(
    (s) => s?.running
  ).length;
  const camerasOnline = Object.values(serverStatuses).reduce((acc, status) => {
    if (!status) return acc;
    return (
      acc + Object.values(status.cameras).filter((c) => c.running).length
    );
  }, 0);

  const handleDelete = (server: ServerConfig) => {
    setServerToDelete(server);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (serverToDelete) {
      deleteServer(serverToDelete.id);
      setDeleteModalOpen(false);
      setServerToDelete(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Servers</h1>
          <p className={styles.subtitle}>
            Manage your video intelligence servers
          </p>
        </div>
        <PrimaryButton glow onClick={() => navigate('/servers/new')}>
          <span>+</span> Add Server
        </PrimaryButton>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <GlassPanel className={styles.statCard}>
          <div className={styles.statValue}>
            <AnimatedNumber value={totalServers} />
          </div>
          <div className={styles.statLabel}>Total Servers</div>
        </GlassPanel>
        <GlassPanel className={styles.statCard}>
          <div className={styles.statValue}>
            <AnimatedNumber value={activeServers} />
          </div>
          <div className={styles.statLabel}>Active Servers</div>
        </GlassPanel>
        <GlassPanel className={styles.statCard}>
          <div className={styles.statValue}>
            <AnimatedNumber value={camerasOnline} />
          </div>
          <div className={styles.statLabel}>Cameras Online</div>
        </GlassPanel>
      </div>

      {/* Server grid */}
      {servers.length === 0 ? (
        <GlassPanel className={styles.emptyState}>
          <div className={styles.emptyIcon}>◈</div>
          <h3>No servers configured</h3>
          <p>Add your first server to start monitoring</p>
          <PrimaryButton onClick={() => navigate('/servers/new')}>
            Add Server
          </PrimaryButton>
        </GlassPanel>
      ) : (
        <div className={styles.grid}>
          <AnimatePresence>
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                status={serverStatuses[server.id] || null}
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
      >
        <div className={styles.deleteModal}>
          <p>
            Are you sure you want to delete{' '}
            <strong>{serverToDelete?.name || 'this server'}</strong>?
          </p>
          <p className={styles.deleteWarning}>
            This will remove its configuration. Active streams will be stopped.
          </p>
          <div className={styles.deleteActions}>
            <SecondaryButton onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <DangerButton onClick={confirmDelete}>Delete</DangerButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Animated number component
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 500;
    const startTime = Date.now();
    const startValue = displayValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(startValue + (value - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <>{displayValue}</>;
}

export default MyServers;

