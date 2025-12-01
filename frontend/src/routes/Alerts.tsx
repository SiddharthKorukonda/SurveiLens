import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassPanel,
  PrimaryButton,
  SeverityBadge,
} from '../components';
import { useServers } from '../hooks/useServers';
import { useTriage } from '../hooks/useTriage';
import { getAlerts } from '../api/client';
import type { AlertRecord, Severity, TriageState } from '../types';
import styles from './Alerts.module.css';
import ServerLayout from './ServerLayout';

type TimeFilter = '5' | '60' | '1440' | '0';

// Severity chip component with glow
function SeverityChip({ 
  severity, 
  count, 
  active,
  onClick 
}: { 
  severity: Severity | 'all'; 
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    all: { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', text: 'var(--color-accent)' },
    high: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: 'var(--color-danger)' },
    medium: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: 'var(--color-warning)' },
    low: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', text: 'var(--color-success)' },
  };

  const c = colors[severity];

  return (
    <motion.button
      className={`${styles.severityChip} ${active ? styles.severityChipActive : ''}`}
      style={{
        background: c.bg,
        borderColor: active ? c.text : c.border,
        color: c.text,
        boxShadow: active ? `0 0 15px ${c.border}` : 'none',
      }}
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className={styles.chipLabel}>{severity === 'all' ? 'All' : severity}</span>
      <span className={styles.chipCount}>{count}</span>
    </motion.button>
  );
}

export function Alerts() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');
  const { getTriage, setTriage } = useTriage(serverId || '');
  const listRef = useRef<HTMLDivElement>(null);

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());

  // Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('1440');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch alerts
  useEffect(() => {
    if (!server) return;

    const fetchAlerts = async () => {
      try {
        const data = await getAlerts(server.baseUrl);
        
        // Track new alerts
        const currentIds = new Set(alerts.map(a => a.id));
        const newIds = new Set<string>();
        data.forEach(alert => {
          if (!currentIds.has(alert.id)) {
            newIds.add(alert.id);
          }
        });
        
        if (newIds.size > 0) {
          setNewAlertIds(prev => new Set([...prev, ...newIds]));
          // Clear new status after animation
          setTimeout(() => {
            setNewAlertIds(prev => {
              const next = new Set(prev);
              newIds.forEach(id => next.delete(id));
              return next;
            });
          }, 3000);
        }
        
        setAlerts(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [server, alerts]);

  // Filter alerts - only show alerts from after the server was created
  const filteredAlerts = useMemo(() => {
    const now = Date.now();
    const timeWindow = parseInt(timeFilter) * 60 * 1000;
    
    // Get server creation time - only show alerts after this time
    const serverCreatedAt = server?.createdAt ? new Date(server.createdAt).getTime() : 0;

    return alerts.filter((alert) => {
      const alertTime = new Date(alert.timestamp).getTime();
      
      // Filter out alerts from before server was created
      if (alertTime < serverCreatedAt) {
        return false;
      }
      
      if (timeWindow > 0) {
        if (now - alertTime > timeWindow) return false;
      }

      if (severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const labels = (alert.labels || []).join(' ').toLowerCase();
        const cameraId = (alert.cameraId || '').toLowerCase();
        if (!labels.includes(query) && !cameraId.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [alerts, timeFilter, severityFilter, searchQuery, server?.createdAt]);

  // Count by severity
  const counts = useMemo(() => {
    const c = { all: 0, high: 0, medium: 0, low: 0 };
    filteredAlerts.forEach((a) => {
      c[a.severity]++;
      c.all++;
    });
    return c;
  }, [filteredAlerts]);

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

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const handleTriageClick = (alertId: string, state: TriageState) => {
    const current = getTriage(alertId);
    setTriage(alertId, current === state ? null : state);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 }
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
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>Server Alerts</h1>
            <p className={styles.subtitle}>
              Monitoring {server.cameras.length} camera
              {server.cameras.length !== 1 ? 's' : ''}
              {lastUpdated && (
                <motion.span 
                  className={styles.updated}
                  key={lastUpdated.getTime()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {' '}· Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                </motion.span>
              )}
            </p>
          </div>

          {/* Severity chips */}
          <div className={styles.severityChips}>
            <SeverityChip 
              severity="high" 
              count={counts.high} 
              active={severityFilter === 'high'}
              onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
            />
            <SeverityChip 
              severity="medium" 
              count={counts.medium}
              active={severityFilter === 'medium'}
              onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
            />
            <SeverityChip 
              severity="low" 
              count={counts.low}
              active={severityFilter === 'low'}
              onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
            />
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants}>
          <div className={styles.filters}>
            <motion.div 
              className={styles.filterPill}
              whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.3)' }}
            >
              <label className={styles.filterLabel}>Time</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className={styles.select}
              >
                <option value="5">Last 5 min</option>
                <option value="60">Last 1 hour</option>
                <option value="1440">Last 24 hours</option>
                <option value="0">All time</option>
              </select>
            </motion.div>

            <motion.div 
              className={`${styles.filterPill} ${styles.filterSearch}`}
              whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.3)' }}
            >
              <label className={styles.filterLabel}>Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="knife, gun, person..."
                className={styles.searchInput}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Alerts list */}
        {isLoading ? (
          <motion.div variants={itemVariants}>
            <GlassPanel className={styles.loading} glow>
              <motion.div 
                className={styles.spinner}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ◌
              </motion.div>
              <span>Loading alerts...</span>
            </GlassPanel>
          </motion.div>
        ) : filteredAlerts.length === 0 ? (
          <motion.div variants={itemVariants}>
            <GlassPanel className={styles.emptyState} glow>
              <div className={styles.emptyIcon}>
                ✓
              </div>
              <h3>No Alerts Detected</h3>
              <p>Your cameras are monitoring. No threats have been detected.</p>
            </GlassPanel>
          </motion.div>
        ) : (
          <div className={styles.alertsList} ref={listRef}>
            <AnimatePresence mode="popLayout">
              {filteredAlerts.map((alert, index) => {
                const triageState = getTriage(alert.id);
                const isNew = newAlertIds.has(alert.id);
                const isHighNew = isNew && alert.severity === 'high';

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: -30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 50, scale: 0.95 }}
                    transition={{ 
                      delay: index * 0.02,
                      duration: 0.4,
                      ease: [0.4, 0, 0.2, 1]
                    }}
                    layout
                    className={`${styles.alertRow} ${
                      triageState === 'deny' ? styles.alertDenied : ''
                    } ${isHighNew ? styles.alertFlash : ''} ${isNew ? styles.alertNew : ''}`}
                  >
                    <motion.div 
                      className={styles.alertCard}
                      whileHover={{ scale: 1.01, y: -2 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Flash indicator for high severity */}
                      {isHighNew && <div className={styles.flashIndicator} />}
                      
                      {/* Separator line */}
                      <div className={styles.alertSeparator} />
                      
                      <div className={styles.alertContent}>
                        <div className={styles.alertMain}>
                          <div className={styles.alertMeta}>
                            <span className={styles.alertTime}>
                              {formatTime(alert.timestamp)}
                            </span>
                            <span className={styles.alertCamera}>
                              {alert.cameraId || 'Unknown'}
                            </span>
                          </div>
                          <SeverityBadge severity={alert.severity} />
                          <div className={styles.alertLabels}>
                            {(alert.labels || []).map((label, i) => (
                              <span key={i} className={styles.labelTag}>{label}</span>
                            )) || <span className={styles.labelTag}>Detection</span>}
                          </div>
                        </div>

                        {/* Triage buttons */}
                        <div className={styles.triageButtons}>
                          <motion.button
                            className={`${styles.triageBtn} ${styles.triageAccept} ${
                              triageState === 'accept' ? styles.triageActive : ''
                            }`}
                            onClick={() => handleTriageClick(alert.id, 'accept')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {triageState === 'accept' && <span className={styles.checkmark}>✓</span>}
                            Accept
                          </motion.button>
                          <motion.button
                            className={`${styles.triageBtn} ${styles.triageReview} ${
                              triageState === 'review' ? styles.triageActive : ''
                            }`}
                            onClick={() => handleTriageClick(alert.id, 'review')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {triageState === 'review' && <span className={styles.checkmark}>✓</span>}
                            Review
                          </motion.button>
                          <motion.button
                            className={`${styles.triageBtn} ${styles.triageDeny} ${
                              triageState === 'deny' ? styles.triageActive : ''
                            }`}
                            onClick={() => handleTriageClick(alert.id, 'deny')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {triageState === 'deny' && <span className={styles.checkmark}>✓</span>}
                            Deny
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </ServerLayout>
  );
}

export default Alerts;
