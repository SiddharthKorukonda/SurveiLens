import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode, useState, useRef } from 'react';
import styles from './GlassPanel.module.css';

interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  variant?: 'default' | 'strong' | 'light';
  glow?: boolean;
  tilt?: boolean;
  className?: string;
}

export function GlassPanel({
  children,
  variant = 'default',
  glow = false,
  tilt = false,
  className = '',
  ...props
}: GlassPanelProps) {
  const [tiltStyle, setTiltStyle] = useState({ rotateX: 0, rotateY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt || !panelRef.current) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    
    setTiltStyle({ rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    if (!tilt) return;
    setTiltStyle({ rotateX: 0, rotateY: 0 });
  };

  const variantClass = styles[variant] || '';
  const glowClass = glow ? styles.glow : '';

  return (
    <motion.div
      ref={panelRef}
      className={`${styles.panel} ${variantClass} ${glowClass} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt
          ? `perspective(1000px) rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg)`
          : undefined,
      }}
      whileHover={glow ? { scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default GlassPanel;

