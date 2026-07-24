/**
 * Simple toast notification utility
 * In production, this would integrate with a toast library like react-hot-toast
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastId = 0;
const listeners = new Set<(toast: Toast) => void>();

export const toast = {
  success: (message: string, duration = 3000) => {
    const id = `toast-${toastId++}`;
    const toast: Toast = { id, message, type: 'success', duration };
    listeners.forEach((listener) => listener(toast));
  },

  error: (message: string, duration = 5000) => {
    const id = `toast-${toastId++}`;
    const toast: Toast = { id, message, type: 'error', duration };
    listeners.forEach((listener) => listener(toast));
  },

  info: (message: string, duration = 3000) => {
    const id = `toast-${toastId++}`;
    const toast: Toast = { id, message, type: 'info', duration };
    listeners.forEach((listener) => listener(toast));
  },

  warning: (message: string, duration = 4000) => {
    const id = `toast-${toastId++}`;
    const toast: Toast = { id, message, type: 'warning', duration };
    listeners.forEach((listener) => listener(toast));
  },

  subscribe: (listener: (toast: Toast) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export type { Toast, ToastType };
