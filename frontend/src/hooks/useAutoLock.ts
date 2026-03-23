import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVault } from '../stores/vaultStore';

// Development logger
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};

/**
 * Custom hook for auto-lock functionality
 * Monitors user activity and automatically locks the vault after a period of inactivity
 * 
 * Features:
 * - Monitors mouse, keyboard, touch, and scroll events
 * - Resets inactivity timer on any user activity
 * - Automatically locks vault when inactivity exceeds configured time
 * - Respects autoLockMinutes = 0 (disabled) setting
 * - Properly cleans up event listeners and timers
 * - Responsive to settings changes
 * 
 * Usage:
 * ```tsx
 * const autoLock = useAutoLock(autoLockMinutes);
 * 
 * // Auto-lock will automatically trigger when inactive
 * // You can manually reset the timer if needed:
 * autoLock.resetInactivityTimer();
 * 
 * // Or manually trigger auto-lock:
 * autoLock.triggerAutoLock();
 * ```
 * 
 * @param autoLockMinutes - Auto-lock timeout in minutes (0 = disabled)
 * @returns Object containing auto-lock state and control functions
 */
export const useAutoLock = (autoLockMinutes: number) => {
  const { lockVault } = useVault();
  const [inactiveTime, setInactiveTime] = useState(0);
  const [isEnabled, setIsEnabled] = useState(autoLockMinutes > 0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activityDetectedRef = useRef<number>(Date.now());
  const isMountedRef = useRef(true);
  const autoLockMs = useMemo(() => autoLockMinutes * 60 * 1000, [autoLockMinutes]);

  // Reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (autoLockMs <= 0) return;
    
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Update last activity time
    activityDetectedRef.current = Date.now();
    
    // Set new timer
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setInactiveTime(autoLockMs);
      }
    }, autoLockMs);
  }, [autoLockMs]);

  // Handle user activity
  const handleUserActivity = useCallback(() => {
    if (autoLockMs <= 0) return;
    
    // Reset the timer on user activity
    resetInactivityTimer();
  }, [autoLockMs, resetInactivityTimer]);

  // Set up event listeners for user activity
  useEffect(() => {
    if (autoLockMs <= 0) return;

    const events = [
      'mousedown', 'mousemove', 'keydown', 'keypress', 
      'touchstart', 'touchmove', 'scroll', 'wheel',
      'click', 'dblclick', 'input', 'change'
    ];

    const handleActivity = () => {
      if (isMountedRef.current) {
        handleUserActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial setup
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [autoLockMs, handleUserActivity, resetInactivityTimer]);

  // Check for auto-lock condition
  useEffect(() => {
    if (inactiveTime >= autoLockMs && autoLockMs > 0 && isEnabled) {
      log('Auto-lock triggered due to inactivity');
      lockVault();
    }
  }, [inactiveTime, autoLockMs, isEnabled, lockVault]);

  // Update enabled state when autoLockMinutes changes
  useEffect(() => {
    setIsEnabled(autoLockMinutes > 0);
  }, [autoLockMinutes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Manually trigger auto-lock (for testing or manual lock)
  const triggerAutoLock = useCallback(() => {
    if (isEnabled) {
      setInactiveTime(autoLockMs);
    }
  }, [autoLockMs, isEnabled]);

  return {
    isEnabled,
    inactiveTime,
    resetInactivityTimer,
    triggerAutoLock,
    isActive: isEnabled && inactiveTime < autoLockMs,
    autoLockMinutes,
    remainingTime: Math.max(0, autoLockMs - inactiveTime)
  };
};

export default useAutoLock;