import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { GlassPanel, PrimaryButton } from '../components';
import styles from './Home.module.css';

// Typewriter effect component
function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
          // Keep cursor blinking for a bit then hide
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, 50);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span className={styles.typewriter}>
      {displayedText}
      <span className={`${styles.cursor} ${showCursor ? styles.cursorVisible : ''}`}>|</span>
    </span>
  );
}

export function Home() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);

  const handleDeploy = () => {
    setIsExiting(true);
    setTimeout(() => {
      navigate('/servers');
    }, 600);
  };

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -50,
      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
    }
  };

  const itemVariants = {
    initial: { opacity: 0, y: 30 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
    }
  };

  const featureVariants = {
    initial: { opacity: 0, x: -20 },
    animate: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: 0.8 + i * 0.1, duration: 0.4 }
    })
  };

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {!isExiting && (
          <motion.div
            className={styles.hero}
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <GlassPanel variant="strong" glow className={styles.heroPanel}>
              {/* Animated background pattern inside panel */}
              <div className={styles.panelPattern} />
              
              {/* Logo with glow */}
              <motion.div
                className={styles.logoContainer}
                variants={itemVariants}
              >
                <motion.span 
                  className={styles.logoIcon}
                  animate={{
                    textShadow: [
                      '0 0 20px rgba(56, 189, 248, 0.5)',
                      '0 0 60px rgba(56, 189, 248, 0.8), 0 0 100px rgba(56, 189, 248, 0.4)',
                      '0 0 20px rgba(56, 189, 248, 0.5)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ◈
                </motion.span>
                <h1 className={styles.title}>
                  <span className={styles.titleText}>SurveiLens</span>
                  <span className={styles.titleReflection}>SurveiLens</span>
                </h1>
              </motion.div>

              {/* Tagline with typewriter effect */}
              <motion.div
                className={styles.taglineContainer}
                variants={itemVariants}
              >
                <p className={styles.tagline}>
                  <TypewriterText 
                    text="Real-time risk intelligence for every camera." 
                    delay={600}
                  />
                </p>
              </motion.div>

              {/* Description */}
              <motion.p
                className={styles.description}
                variants={itemVariants}
              >
                Multi-camera video intelligence platform powered by YOLO detection.
                Monitor, detect, and respond to threats in real-time.
              </motion.p>

              {/* Features grid */}
              <motion.div className={styles.features} variants={itemVariants}>
                {[
                  { icon: '◉', text: 'Up to 4 cameras per server' },
                  { icon: '◉', text: 'Real-time YOLO detection' },
                  { icon: '◉', text: 'WebRTC live streaming' },
                  { icon: '◉', text: 'Instant alert triage' },
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    className={styles.feature}
                    variants={featureVariants}
                    custom={i}
                    initial="initial"
                    animate="animate"
                    whileHover={{ x: 5, color: 'var(--color-text-primary)' }}
                  >
                    <span className={styles.featureIcon}>{feature.icon}</span>
                    <span>{feature.text}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* Deploy button with pulsing glow */}
              <motion.div
                variants={itemVariants}
                className={styles.buttonContainer}
              >
                <motion.div
                  className={styles.buttonGlow}
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <PrimaryButton
                  size="xl"
                  glow
                  pulse
                  onClick={handleDeploy}
                  className={styles.deployButton}
                >
                  <motion.span 
                    className={styles.deployIcon}
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ▶
                  </motion.span>
                  Deploy
                </PrimaryButton>
              </motion.div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative orbiting elements */}
      <div className={styles.orbitContainer}>
        <div className={styles.orbit1}>
          <div className={styles.orbitDot} />
        </div>
        <div className={styles.orbit2}>
          <div className={styles.orbitDot} />
        </div>
        <div className={styles.orbit3}>
          <div className={styles.orbitDot} />
        </div>
      </div>

      {/* Floating particles */}
      <div className={styles.particlesContainer}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={styles.floatingParticle}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Corner decorations */}
      <div className={styles.cornerTL} />
      <div className={styles.cornerTR} />
      <div className={styles.cornerBL} />
      <div className={styles.cornerBR} />
    </div>
  );
}

export default Home;
