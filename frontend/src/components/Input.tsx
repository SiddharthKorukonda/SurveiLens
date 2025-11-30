import { InputHTMLAttributes, forwardRef, useState } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = props.value !== undefined && props.value !== '';
    const isActive = isFocused || hasValue;

    return (
      <div className={`${styles.wrapper} ${className}`}>
        <div className={`${styles.inputContainer} ${error ? styles.hasError : ''} ${isActive ? styles.active : ''}`}>
          <input
            ref={ref}
            className={styles.input}
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
          {label && (
            <label className={`${styles.label} ${isActive ? styles.labelActive : ''}`}>
              {label}
            </label>
          )}
          <div className={styles.border} />
        </div>
        {error && <span className={styles.error}>{error}</span>}
        {hint && !error && <span className={styles.hint}>{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = props.value !== undefined && props.value !== '';
    const isActive = isFocused || hasValue;

    return (
      <div className={`${styles.wrapper} ${className}`}>
        <div className={`${styles.inputContainer} ${error ? styles.hasError : ''} ${isActive ? styles.active : ''}`}>
          <textarea
            ref={ref}
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
          {label && (
            <label className={`${styles.label} ${isActive ? styles.labelActive : ''}`}>
              {label}
            </label>
          )}
          <div className={styles.border} />
        </div>
        {error && <span className={styles.error}>{error}</span>}
        {hint && !error && <span className={styles.hint}>{hint}</span>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default Input;

