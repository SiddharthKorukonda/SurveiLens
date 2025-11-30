import { ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
  className = '',
}: BadgeProps) {
  const variantClass = styles[variant] || '';
  const sizeClass = styles[size] || '';
  const pulseClass = pulse ? styles.pulse : '';

  return (
    <span className={`${styles.badge} ${variantClass} ${sizeClass} ${pulseClass} ${className}`}>
      {pulse && <span className={styles.dot} />}
      {children}
    </span>
  );
}

export function StatusBadge({
  active,
  label,
  className = '',
}: {
  active: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant={active ? 'success' : 'default'}
      pulse={active}
      className={className}
    >
      {label || (active ? 'Active' : 'Idle')}
    </Badge>
  );
}

export function SeverityBadge({
  severity,
  className = '',
}: {
  severity: 'high' | 'medium' | 'low';
  className?: string;
}) {
  const variant = severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'default';
  return (
    <Badge variant={variant} className={className}>
      {severity.toUpperCase()}
    </Badge>
  );
}

export default Badge;

