import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const icons = { success: CheckCircle2, error: CircleAlert, info: Info };
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const toast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`; setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  return <ToastContext.Provider value={toast}>{children}<div className="toast-stack" aria-live="polite" aria-atomic="false">
    {toasts.map(({ id, message, type }) => { const Icon = icons[type] || Info; return <div className={`toast toast-${type}`} key={id} role="status"><Icon size={18} /><span>{message}</span><button aria-label="Dismiss notification" onClick={() => dismiss(id)}><X size={15} /></button></div>; })}
  </div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
