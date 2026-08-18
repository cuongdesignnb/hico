import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminToast, AdminToastApi, AdminToastOptions, AdminToastVariant } from '../../../types/adminToast';
import { AdminToastContext } from './AdminToastContext';
import { AdminToastViewport } from './AdminToastViewport';
import './AdminToast.css';

const DEFAULT_DURATIONS: Record<AdminToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
};
const MAX_VISIBLE_TOASTS = 5;
const DUPLICATE_WINDOW_MS = 1500;

const createToastId = (counter: { current: number }) => {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);
  counter.current += 1;
  return `admin-toast-${Date.now()}-${counter.current}`;
};

export const AdminToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const counter = useRef({ current: 0 });

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const add = useCallback((variant: AdminToastVariant, message: string, options: AdminToastOptions = {}) => {
    const normalizedMessage = message.trim() || 'Đã có lỗi xảy ra.';
    const createdAt = Date.now();
    const id = createToastId(counter.current);
    setToasts((current) => {
      const duplicate = current.some((toast) => toast.variant === variant && toast.message === normalizedMessage && createdAt - toast.createdAt < DUPLICATE_WINDOW_MS);
      if (duplicate) return current;
      const toast: AdminToast = {
        id,
        variant,
        title: options.title,
        message: normalizedMessage,
        duration: options.duration ?? DEFAULT_DURATIONS[variant],
        persistent: options.persistent ?? false,
        createdAt,
      };
      const next = [...current, toast];
      if (next.length <= MAX_VISIBLE_TOASTS) return next;
      const removableIndex = next.findIndex((item) => !item.persistent);
      if (removableIndex < 0) return current;
      return [...next.slice(0, removableIndex), ...next.slice(removableIndex + 1)];
    });
    return id;
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => !toast.persistent && toast.duration > 0)
      .map((toast) => window.setTimeout(() => dismiss(toast.id), toast.duration));
    return () => timers.forEach(window.clearTimeout);
  }, [dismiss, toasts]);

  const api = useMemo<AdminToastApi>(() => ({
    success: (message, options) => add('success', message, options),
    error: (message, options) => add('error', message, options),
    warning: (message, options) => add('warning', message, options),
    info: (message, options) => add('info', message, options),
    dismiss,
    clear,
  }), [add, clear, dismiss]);

  return <AdminToastContext.Provider value={api}>
    {children}
    <AdminToastViewport toasts={toasts} onDismiss={dismiss} />
  </AdminToastContext.Provider>;
};
