import { InputHTMLAttributes, forwardRef, useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'glass';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, variant = 'default', className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const id = useId();
    const hasValue = props.value !== undefined && props.value !== '';
    const isActive = isFocused || hasValue;

    return (
      <div className={`${styles.wrapper} ${className}`}>
        <motion.div 
          className={`${styles.inputContainer} ${styles[variant]} ${error ? styles.hasError : ''} ${isActive ? styles.active : ''}`}
          animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Icon */}
          {icon && <span className={styles.icon}>{icon}</span>}
          
          {/* Input field */}
          <input
            ref={ref}
            id={id}
            className={`${styles.input} ${icon ? styles.hasIcon : ''}`}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          
          {/* Floating label */}
          {label && (
            <motion.label 
              htmlFor={id}
              className={`${styles.label} ${icon ? styles.hasIconLabel : ''}`}
              animate={isActive ? {
                y: -10,
                scale: 0.8,
              } : {
                y: 0,
                scale: 1,
              }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {label}
            </motion.label>
          )}
          
          {/* Animated border */}
          <div className={styles.border}>
            <div className={styles.borderGlow} />
          </div>
          
          {/* Focus line */}
          <motion.div 
            className={styles.focusLine}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isFocused ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          />
        </motion.div>
        
        {/* Error/Hint messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.span 
              key="error"
              className={styles.error}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {error}
            </motion.span>
          )}
          {hint && !error && (
            <motion.span 
              key="hint"
              className={styles.hint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {hint}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: 'default' | 'glass';
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, variant = 'default', className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const id = useId();
    const hasValue = props.value !== undefined && props.value !== '';
    const isActive = isFocused || hasValue;

    return (
      <div className={`${styles.wrapper} ${className}`}>
        <motion.div 
          className={`${styles.inputContainer} ${styles[variant]} ${styles.textareaContainer} ${error ? styles.hasError : ''} ${isActive ? styles.active : ''}`}
          animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <textarea
            ref={ref}
            id={id}
            className={`${styles.input} ${styles.textarea}`}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          
          {/* Floating label */}
          {label && (
            <motion.label 
              htmlFor={id}
              className={`${styles.label} ${styles.textareaLabel}`}
              animate={isActive ? {
                y: -8,
                scale: 0.8,
              } : {
                y: 0,
                scale: 1,
              }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {label}
            </motion.label>
          )}
          
          {/* Animated border */}
          <div className={styles.border}>
            <div className={styles.borderGlow} />
          </div>
          
          {/* Focus line */}
          <motion.div 
            className={styles.focusLine}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isFocused ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          />
        </motion.div>
        
        {/* Error/Hint messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.span 
              key="error"
              className={styles.error}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {error}
            </motion.span>
          )}
          {hint && !error && (
            <motion.span 
              key="hint"
              className={styles.hint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {hint}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default Input;
