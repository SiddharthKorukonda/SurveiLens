import { ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

// Generate floating particles
function Particles() {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      tx: (Math.random() - 0.5) * 200,
      ty: (Math.random() - 0.5) * 200,
    }));
  }, []);

  return (
    <div className={styles.particles}>
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  // Smooth parallax effect on mouse move
  useEffect(() => {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 30;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      setMousePos({ x: currentX, y: currentY });
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pageTransition = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.98 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  };

  return (
    <div className={styles.layout} ref={containerRef}>
      {/* Animated background with parallax */}
      <div className={styles.backgroundContainer}>
        <div
          className={styles.backgroundVideo}
          style={{
            transform: `translate(${mousePos.x}px, ${mousePos.y}px) scale(1.15)`,
          }}
        >
          {/* Video background - using CSS animation as fallback */}
          <video
            className={styles.bgVideo}
            autoPlay
            loop
            muted
            playsInline
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
          >
            {/* Add video sources here if you have them */}
            {/* <source src="/videos/city-night.mp4" type="video/mp4" /> */}
          </video>
          
          {/* Animated gradient background as video alternative */}
          <div className={styles.gradientBg} />
          
          {/* Animated circuit pattern */}
          <div className={styles.circuitPattern} />
          
          {/* Grid overlay */}
          <div className={styles.gridOverlay} />
          
          {/* Floating particles */}
          <Particles />
          
          {/* Scanline effect */}
          <div className={styles.scanline} />
        </div>
        
        {/* Gradient overlay for readability */}
        <div className={styles.overlay} />
        
        {/* Vignette effect */}
        <div className={styles.vignette} />
      </div>

      {/* Floating Glass Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navGlass}>
          <div className={styles.navContent}>
            <NavLink to="/" className={styles.logo}>
              <motion.span 
                className={styles.logoIcon}
                animate={{ 
                  textShadow: [
                    '0 0 10px rgba(56, 189, 248, 0.5)',
                    '0 0 20px rgba(56, 189, 248, 0.8)',
                    '0 0 10px rgba(56, 189, 248, 0.5)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ◈
              </motion.span>
              <span className={styles.logoText}>SurveiLens</span>
            </NavLink>

            <div className={styles.navLinks}>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive && location.pathname === '/' ? styles.active : ''}`
                }
              >
                <span className={styles.navLinkText}>Home</span>
                <span className={styles.navLinkUnderline} />
              </NavLink>
              <NavLink
                to="/servers"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
              >
                <span className={styles.navLinkText}>My Servers</span>
                <span className={styles.navLinkUnderline} />
              </NavLink>
            </div>
          </div>
          
          {/* Nav glow effect */}
          <div className={styles.navGlow} />
        </div>
      </nav>

      {/* Main content with smooth page transitions */}
      <main className={styles.main}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={pageTransition.initial}
            animate={pageTransition.animate}
            exit={pageTransition.exit}
            transition={pageTransition.transition}
            className={styles.pageContent}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default Layout;
