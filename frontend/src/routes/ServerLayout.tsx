import { ReactNode } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SecondaryButton } from '../components';
import { useServers } from '../hooks/useServers';
import styles from './ServerLayout.module.css';

interface ServerLayoutProps {
  children: ReactNode;
}

export function ServerLayout({ children }: ServerLayoutProps) {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');

  const tabs = [
    { path: 'stream', label: 'Stream', icon: '▶' },
    { path: 'alerts', label: 'Alerts', icon: '⚠' },
    { path: 'debug', label: 'Debug', icon: '⌘' },
    { path: 'edit', label: 'Edit', icon: '✎' },
  ];

  return (
    <div className={styles.layout}>
      {/* Sub-navigation */}
      <div className={styles.subNav}>
        <div className={styles.subNavLeft}>
          <SecondaryButton
            size="sm"
            onClick={() => navigate('/servers')}
            className={styles.backBtn}
          >
            ← Back
          </SecondaryButton>
          {server && (
            <span className={styles.serverName}>{server.name}</span>
          )}
        </div>

        <nav className={styles.tabs}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={`/servers/${serverId}/${tab.path}`}
              className={({ isActive }) =>
                `${styles.tab} ${isActive ? styles.tabActive : ''}`
              }
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={styles.content}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default ServerLayout;

