import { useState, useEffect, useMemo } from 'react';
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

export function Alerts() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');
  const { getTriage, setTriage } = useTriage(serverId || '');

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
  }, [server]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    const now = Date.now();
    const timeWindow = parseInt(timeFilter) * 60 * 1000;

    return alerts.filter((alert) => {
      // Time filter
      if (timeWindow > 0) {
        const alertTime = new Date(alert.timestamp).getTime();
        if (now - alertTime > timeWindow) return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }

      // Search filter
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
  }, [alerts, timeFilter, severityFilter, searchQuery]);

  // Count by severity
  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    filteredAlerts.forEach((a) => {
      c[a.severity]++;
    });
    return c;
  }, [filteredAlerts]);

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

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const handleTriageClick = (alertId: string, state: TriageState) => {
    const current = getTriage(alertId);
    setTriage(alertId, current === state ? null : state);
  };

  return (
    <ServerLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Server Alerts</h1>
            <p className={styles.subtitle}>
              Monitoring {server.cameras.length} camera
              {server.cameras.length !== 1 ? 's' : ''}
              {lastUpdated && (
                <span className={styles.updated}>
                  {' '}
                  · Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                </span>
              )}
            </p>
          </div>

          <div className={styles.severityCounts}>
            <div className={`${styles.countBadge} ${styles.countHigh}`}>
              High: {counts.high}
            </div>
            <div className={`${styles.countBadge} ${styles.countMedium}`}>
              Medium: {counts.medium}
            </div>
            <div className={`${styles.countBadge} ${styles.countLow}`}>
              Low: {counts.low}
            </div>
          </div>
        </div>

        {/* Filters */}
        <GlassPanel className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Time Window</label>
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
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Severity</label>
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as Severity | 'all')
              }
              className={styles.select}
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className={`${styles.filterGroup} ${styles.filterSearch}`}>
            <label className={styles.filterLabel}>Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="knife, gun..."
              className={styles.searchInput}
            />
          </div>
        </GlassPanel>

        {/* Alerts list */}
        {isLoading ? (
          <GlassPanel className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading alerts...</span>
          </GlassPanel>
        ) : filteredAlerts.length === 0 ? (
          <GlassPanel className={styles.emptyState}>
            <div className={styles.emptyIcon}>✓</div>
            <h3>No alerts found</h3>
            <p>No alerts match your current filters.</p>
          </GlassPanel>
        ) : (
          <div className={styles.alertsList}>
            <AnimatePresence>
              {filteredAlerts.map((alert, index) => {
                const triageState = getTriage(alert.id);
                const isNew = index === 0 && Date.now() - new Date(alert.timestamp).getTime() < 10000;

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.02 }}
                    className={`${styles.alertRow} ${
                      triageState === 'deny' ? styles.alertDenied : ''
                    } ${isNew && alert.severity === 'high' ? styles.alertFlash : ''}`}
                  >
                    <GlassPanel className={styles.alertCard}>
                      <div className={styles.alertMain}>
                        <div className={styles.alertTime}>
                          {formatTime(alert.timestamp)}
                        </div>
                        <SeverityBadge severity={alert.severity} />
                        <div className={styles.alertCamera}>
                          {alert.cameraId || 'Unknown'}
                        </div>
                        <div className={styles.alertLabels}>
                          {(alert.labels || []).join(', ') || 'Detection'}
                        </div>
                      </div>

                      <div className={styles.triageButtons}>
                        <button
                          className={`${styles.triageBtn} ${styles.triageAccept} ${
                            triageState === 'accept' ? styles.triageActive : ''
                          }`}
                          onClick={() => handleTriageClick(alert.id, 'accept')}
                        >
                          Accept
                        </button>
                        <button
                          className={`${styles.triageBtn} ${styles.triageReview} ${
                            triageState === 'review' ? styles.triageActive : ''
                          }`}
                          onClick={() => handleTriageClick(alert.id, 'review')}
                        >
                          Review
                        </button>
                        <button
                          className={`${styles.triageBtn} ${styles.triageDeny} ${
                            triageState === 'deny' ? styles.triageActive : ''
                          }`}
                          onClick={() => handleTriageClick(alert.id, 'deny')}
                        >
                          Deny
                        </button>
                      </div>
                    </GlassPanel>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </ServerLayout>
  );
}

export default Alerts;

