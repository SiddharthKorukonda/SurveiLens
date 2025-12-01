import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode, useState, useRef, useCallback } from 'react';
import styles from './GlassPanel.module.css';

interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  variant?: 'default' | 'strong' | 'light' | 'subtle';
  glow?: boolean;
  tilt?: boolean;
  hover?: boolean;
  reflection?: boolean;
  className?: string;
  neonColor?: 'cyan' | 'purple' | 'green' | 'red' | 'amber';
}

export function GlassPanel({
  children,
  variant = 'default',
  glow = false,
  tilt = false,
  hover = true,
  reflection = true,
  className = '',
  neonColor = 'cyan',
  ...props
}: GlassPanelProps) {
  const [tiltStyle, setTiltStyle] = useState({ 
    rotateX: 0, 
    rotateY: 0,
    glowX: 50,
    glowY: 50,
  });
  const [isHovered, setIsHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!panelRef.current) return;
      
      const rect = panelRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate tilt angles
      const rotateX = tilt ? ((y - centerY) / centerY) * -8 : 0;
      const rotateY = tilt ? ((x - centerX) / centerX) * 8 : 0;
      
      // Calculate glow position (percentage)
      const glowX = (x / rect.width) * 100;
      const glowY = (y / rect.height) * 100;
      
      setTiltStyle({ rotateX, rotateY, glowX, glowY });
    });
  }, [tilt]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setTiltStyle({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 });
  };

  const variantClass = styles[variant] || '';
  const glowClass = glow ? styles.glow : '';
  const hoverClass = hover ? styles.hoverable : '';
  const neonClass = styles[`neon-${neonColor}`] || '';

  return (
    <motion.div
      ref={panelRef}
      className={`${styles.panel} ${variantClass} ${glowClass} ${hoverClass} ${neonClass} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt
          ? `perspective(1000px) rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg)`
          : undefined,
        '--glow-x': `${tiltStyle.glowX}%`,
        '--glow-y': `${tiltStyle.glowY}%`,
      } as React.CSSProperties}
      whileHover={glow ? { scale: 1.02 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...props}
    >
      {/* Reflection layer */}
      {reflection && (
        <div className={styles.reflection} />
      )}
      
      {/* Dynamic glow that follows cursor */}
      {isHovered && glow && (
        <div 
          className={styles.dynamicGlow}
          style={{
            background: `radial-gradient(circle at ${tiltStyle.glowX}% ${tiltStyle.glowY}%, var(--panel-glow-color, rgba(56, 189, 248, 0.15)) 0%, transparent 60%)`,
          }}
        />
      )}
      
      {/* Content */}
      <div className={styles.content}>
        {children}
      </div>
      
      {/* Animated border glow */}
      {glow && <div className={styles.borderGlow} />}
    </motion.div>
  );
}

export default GlassPanel;
