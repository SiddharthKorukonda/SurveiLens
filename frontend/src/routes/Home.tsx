import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassPanel, PrimaryButton } from '../components';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();

  const handleDeploy = () => {
    navigate('/servers');
  };

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <GlassPanel variant="strong" glow className={styles.heroPanel}>
          <motion.div
            className={styles.logoContainer}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <span className={styles.logoIcon}>◈</span>
            <h1 className={styles.title}>SurveiLens</h1>
          </motion.div>

          <motion.p
            className={styles.tagline}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Real-time risk intelligence for every camera.
          </motion.p>

          <motion.p
            className={styles.description}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Multi-camera video intelligence platform powered by YOLO detection.
            Monitor, detect, and respond to threats in real-time.
          </motion.p>

          <motion.div
            className={styles.features}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className={styles.feature}>
              <span className={styles.featureIcon}>◉</span>
              <span>Up to 4 cameras per server</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>◉</span>
              <span>Real-time YOLO detection</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>◉</span>
              <span>WebRTC live streaming</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>◉</span>
              <span>Instant alert triage</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <PrimaryButton
              size="lg"
              glow
              onClick={handleDeploy}
              className={styles.deployButton}
            >
              <span className={styles.deployIcon}>▶</span>
              Deploy
            </PrimaryButton>
          </motion.div>
        </GlassPanel>
      </motion.div>

      {/* Decorative elements */}
      <div className={styles.orbitContainer}>
        <div className={styles.orbit1} />
        <div className={styles.orbit2} />
        <div className={styles.orbit3} />
      </div>
    </div>
  );
}

export default Home;

