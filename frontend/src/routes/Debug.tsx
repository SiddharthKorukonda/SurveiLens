import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, PrimaryButton } from '../components';
import { useServers } from '../hooks/useServers';
import { getStatus } from '../api/client';
import type { LogEntry, LogLevel } from '../types';
import styles from './Debug.module.css';
import ServerLayout from './ServerLayout';

export function Debug() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [queuedLogs, setQueuedLogs] = useState<LogEntry[]>([]);
  const [flashingLogs, setFlashingLogs] = useState<Set<string>>(new Set());
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const consoleBodyRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  const generateLogId = () => {
    logIdRef.current += 1;
    return `log-${Date.now()}-${logIdRef.current}`;
  };

  const addLog = useCallback((level: LogLevel, message: string, data?: Record<string, unknown>) => {
    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    // Add flash effect for errors and alerts
    if (level === 'error' || level === 'alert') {
      setFlashingLogs(prev => new Set(prev).add(entry.id));
      setTimeout(() => {
        setFlashingLogs(prev => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      }, 1000);
    }

    if (isPaused) {
      setQueuedLogs((prev) => [...prev, entry]);
    } else {
      setLogs((prev) => [...prev.slice(-499), entry]);
    }
  }, [isPaused]);

  useEffect(() => {
    if (!server) return;

    const fetchAndLog = async () => {
      try {
        const status = await getStatus(server.baseUrl);
        
        const activeCameras = Object.values(status.cameras).filter((c) => c.running).length;
        addLog(
          'info',
          `Status: ${status.running ? 'RUNNING' : 'IDLE'} | Cameras: ${activeCameras}/4`,
          { status }
        );

        if (status.running) {
          Object.entries(status.cameras).forEach(([camId, camStatus]) => {
            if (camStatus.running) {
              addLog('info', `Camera ${camId}: detecting (conf=${camStatus.conf})`);
            }
          });
        }
      } catch (err) {
        addLog('error', `Failed to fetch status: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    addLog('success', `Connected to ${server.baseUrl}`);
    addLog('info', `Server: ${server.name} | Cameras: ${server.cameras.length}`);

    fetchAndLog();
    const interval = setInterval(fetchAndLog, 3000);
    return () => clearInterval(interval);
  }, [server, addLog]);

  // Smooth scroll to bottom
  useEffect(() => {
    if (!isPaused && consoleBodyRef.current) {
      consoleBodyRef.current.scrollTo({
        top: consoleBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs, isPaused]);

  const handleResume = () => {
    setLogs((prev) => [...prev, ...queuedLogs].slice(-500));
    setQueuedLogs([]);
    setIsPaused(false);
  };

  const handleClear = () => {
    setLogs([]);
    setQueuedLogs([]);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

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

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  const getLevelClass = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return styles.levelError;
      case 'alert':
        return styles.levelAlert;
      case 'success':
        return styles.levelSuccess;
      default:
        return styles.levelInfo;
    }
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
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
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
        {/* Header */}
        <motion.div className={styles.header} variants={itemVariants}>
          <div>
            <h1 className={styles.title}>Debug Console</h1>
            <p className={styles.subtitle}>
              Real-time status and diagnostic logs
            </p>
          </div>

          <div className={styles.controls}>
            {/* Filter buttons */}
            <div className={styles.filterButtons}>
              {(['all', 'info', 'error', 'alert'] as const).map((f) => (
                <motion.button
                  key={f}
                  className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''} ${styles[`filter${f.charAt(0).toUpperCase() + f.slice(1)}`]}`}
                  onClick={() => setFilter(f)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </motion.button>
              ))}
            </div>

            {/* Control buttons */}
            <motion.div 
              className={styles.controlButtons}
              whileHover={{ scale: 1.02 }}
            >
              <button
                className={`${styles.iconBtn} ${isPaused ? styles.iconBtnActive : ''}`}
                onClick={isPaused ? handleResume : () => setIsPaused(true)}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? (
                  <>
                    <span className={styles.playIcon}>▶</span>
                    <span className={styles.queueCount}>{queuedLogs.length}</span>
                  </>
                ) : (
                  <span className={styles.pauseIcon}>❚❚</span>
                )}
              </button>
              <button
                className={styles.iconBtn}
                onClick={handleClear}
                title="Clear"
              >
                <span className={styles.clearIcon}>✕</span>
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* Console */}
        <motion.div variants={itemVariants}>
          <div className={styles.console}>
            {/* Console header */}
            <div className={styles.consoleHeader}>
              <div className={styles.consoleTitleArea}>
                <motion.span 
                  className={styles.consoleDot}
                  animate={{ 
                    backgroundColor: isPaused 
                      ? ['#f59e0b', '#fbbf24', '#f59e0b'] 
                      : ['#22c55e', '#4ade80', '#22c55e']
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className={styles.consoleTitle}>
                  {server.name}
                </span>
                <span className={styles.consoleUrl}>{server.baseUrl}</span>
              </div>
              <div className={styles.consoleStats}>
                <span className={styles.logCount}>
                  {filteredLogs.length} entries
                </span>
                {isPaused && (
                  <motion.span 
                    className={styles.pausedBadge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    PAUSED
                  </motion.span>
                )}
              </div>
            </div>

            {/* Console body */}
            <div className={styles.consoleBody} ref={consoleBodyRef}>
              {filteredLogs.length === 0 ? (
                <div className={styles.emptyConsole}>
                  <motion.span
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Waiting for logs...
                  </motion.span>
                  <span className={styles.cursor}>_</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`${styles.logEntry} ${getLevelClass(log.level)} ${flashingLogs.has(log.id) ? styles.logFlash : ''}`}
                    >
                      <span className={styles.logTime}>
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className={styles.logLevel}>[{log.level.toUpperCase()}]</span>
                      <span className={styles.logMessage}>{log.message}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Cursor indicator */}
            <div className={styles.cursorLine}>
              <motion.span 
                className={styles.cursorIndicator}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ▌
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* Quick stats */}
        <motion.div className={styles.stats} variants={itemVariants}>
          {[
            { label: 'Info', level: 'info', color: 'cyan' },
            { label: 'Success', level: 'success', color: 'green' },
            { label: 'Errors', level: 'error', color: 'red' },
            { label: 'Alerts', level: 'alert', color: 'amber' },
          ].map((stat, i) => (
            <motion.div
              key={stat.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <GlassPanel className={`${styles.statCard} ${styles[`stat${stat.color.charAt(0).toUpperCase() + stat.color.slice(1)}`]}`}>
                <div className={styles.statValue}>
                  {logs.filter((l) => l.level === stat.level).length}
                </div>
                <div className={styles.statLabel}>{stat.label}</div>
              </GlassPanel>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </ServerLayout>
  );
}

export default Debug;
