import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from './GlassPanel';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'danger';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  variant = 'default',
}: ModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8, 
      y: 30,
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      y: -20,
      transition: {
        duration: 0.2,
        ease: 'easeOut',
      }
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay}>
          {/* Backdrop with blur and vignette */}
          <motion.div
            className={styles.backdrop}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          >
            <div className={styles.vignette} />
          </motion.div>
          
          {/* Modal container */}
          <motion.div
            className={`${styles.modal} ${styles[size]} ${styles[variant]}`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <GlassPanel 
              variant="strong" 
              glow 
              neonColor={variant === 'danger' ? 'red' : 'cyan'}
              className={styles.panel}
            >
              {/* Animated corner accents */}
              <div className={styles.cornerTL} />
              <div className={styles.cornerTR} />
              <div className={styles.cornerBL} />
              <div className={styles.cornerBR} />
              
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  <motion.button 
                    className={styles.closeButton} 
                    onClick={onClose}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
              )}
              <div className={styles.content}>{children}</div>
            </GlassPanel>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Modal;
