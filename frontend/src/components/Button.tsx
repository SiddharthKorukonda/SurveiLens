import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode, useState } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  pulse?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  glow = false,
  pulse = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  const variantClass = styles[variant] || '';
  const sizeClass = styles[size] || '';
  const glowClass = glow ? styles.glow : '';
  const pulseClass = pulse ? styles.pulse : '';
  const fullWidthClass = fullWidth ? styles.fullWidth : '';
  const loadingClass = loading ? styles.loading : '';
  const pressedClass = isPressed ? styles.pressed : '';

  return (
    <motion.button
      className={`${styles.button} ${variantClass} ${sizeClass} ${glowClass} ${pulseClass} ${fullWidthClass} ${loadingClass} ${pressedClass} ${className}`}
      disabled={disabled || loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.03 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      {...props}
    >
      {/* Shimmer effect layer */}
      <span className={styles.shimmer} />
      
      {/* Border glow animation */}
      <span className={styles.borderGlow} />
      
      {/* Loading spinner */}
      {loading && (
        <span className={styles.spinner}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeDasharray="31.416" 
              strokeDashoffset="10" 
            />
          </svg>
        </span>
      )}
      
      {/* Content */}
      <span className={styles.content}>
        {icon && iconPosition === 'left' && (
          <span className={styles.icon}>{icon}</span>
        )}
        <span className={styles.text}>{children}</span>
        {icon && iconPosition === 'right' && (
          <span className={styles.icon}>{icon}</span>
        )}
      </span>
      
      {/* Hover glow overlay */}
      <span className={styles.hoverGlow} />
    </motion.button>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props} />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="danger" {...props} />;
}

export function SuccessButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="success" {...props} />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="ghost" {...props} />;
}

export default Button;
