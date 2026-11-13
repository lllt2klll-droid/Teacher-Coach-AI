import { create } from 'zustand';
import { uid } from '@/lib/utils';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = uid('toast');
    const item: ToastItem = { ...toast, id, duration: toast.duration ?? 4200 };
    set((state) => ({ toasts: [...state.toasts.slice(-4), item] }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => get().dismiss(id), item.duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'info' }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'warning', duration: 5200 }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'error', duration: 6500 }),
};
