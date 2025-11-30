import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, PrimaryButton, SecondaryButton } from '../components';
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
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  // Generate unique log ID
  const generateLogId = () => {
    logIdRef.current += 1;
    return `log-${Date.now()}-${logIdRef.current}`;
  };

  // Add a log entry
  const addLog = useCallback((level: LogLevel, message: string, data?: Record<string, unknown>) => {
    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    if (isPaused) {
      setQueuedLogs((prev) => [...prev, entry]);
    } else {
      setLogs((prev) => [...prev.slice(-499), entry]);
    }
  }, [isPaused]);

  // Fetch status and log it
  useEffect(() => {
    if (!server) return;

    const fetchAndLog = async () => {
      try {
        const status = await getStatus(server.baseUrl);
        
        // Log status update
        const activeCameras = Object.values(status.cameras).filter((c) => c.running).length;
        addLog(
          'info',
          `Status: ${status.running ? 'RUNNING' : 'IDLE'} | Cameras: ${activeCameras}/4`,
          { status }
        );

        // Check for alerts in status
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

    // Initial log
    addLog('info', `Connected to ${server.baseUrl}`);
    addLog('info', `Server: ${server.name} | Cameras: ${server.cameras.length}`);

    fetchAndLog();
    const interval = setInterval(fetchAndLog, 3000);
    return () => clearInterval(interval);
  }, [server, addLog]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  // Handle resume - flush queued logs
  const handleResume = () => {
    setLogs((prev) => [...prev, ...queuedLogs].slice(-500));
    setQueuedLogs([]);
    setIsPaused(false);
  };

  // Clear logs
  const handleClear = () => {
    setLogs([]);
    setQueuedLogs([]);
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

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

  return (
    <ServerLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Debug Console</h1>
            <p className={styles.subtitle}>
              Real-time status and diagnostic logs
            </p>
          </div>

          <div className={styles.controls}>
            <div className={styles.filterGroup}>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
                className={styles.select}
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="error">Errors</option>
                <option value="alert">Alerts</option>
              </select>
            </div>

            <SecondaryButton
              size="sm"
              onClick={isPaused ? handleResume : () => setIsPaused(true)}
            >
              {isPaused ? `Resume (${queuedLogs.length})` : 'Pause'}
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={handleClear}>
              Clear
            </SecondaryButton>
          </div>
        </div>

        {/* Console */}
        <GlassPanel className={styles.console}>
          <div className={styles.consoleHeader}>
            <span className={styles.consoleTitle}>
              <span className={styles.consoleDot} />
              {server.name} — {server.baseUrl}
            </span>
            <span className={styles.logCount}>
              {filteredLogs.length} entries
              {isPaused && <span className={styles.pausedBadge}>PAUSED</span>}
            </span>
          </div>

          <div className={styles.consoleBody}>
            {filteredLogs.length === 0 ? (
              <div className={styles.emptyConsole}>
                <span>Waiting for logs...</span>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`${styles.logEntry} ${getLevelClass(log.level)}`}
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
        </GlassPanel>

        {/* Quick stats */}
        <div className={styles.stats}>
          <GlassPanel className={styles.statCard}>
            <div className={styles.statValue}>{logs.filter((l) => l.level === 'info').length}</div>
            <div className={styles.statLabel}>Info</div>
          </GlassPanel>
          <GlassPanel className={styles.statCard}>
            <div className={`${styles.statValue} ${styles.statError}`}>
              {logs.filter((l) => l.level === 'error').length}
            </div>
            <div className={styles.statLabel}>Errors</div>
          </GlassPanel>
          <GlassPanel className={styles.statCard}>
            <div className={`${styles.statValue} ${styles.statAlert}`}>
              {logs.filter((l) => l.level === 'alert').length}
            </div>
            <div className={styles.statLabel}>Alerts</div>
          </GlassPanel>
        </div>
      </div>
    </ServerLayout>
  );
}

export default Debug;

