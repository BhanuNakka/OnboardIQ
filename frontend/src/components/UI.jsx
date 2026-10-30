import { cloneElement, isValidElement, useId } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) {
  return <button className={`button button-${variant} button-${size} ${className}`} disabled={disabled} {...props}>{children}</button>;
}
export function Card({ children, className = '' }) { return <section className={`card ${className}`}>{children}</section>; }
export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}
export function Loading({ label = 'Loading your workspace' }) { return <div className="loading-state" role="status"><LoaderCircle className="spin" size={21} /><span>{label}</span></div>; }
export function EmptyState({ icon: Icon = Search, title, body, action }) { return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{body}</p>{action}</div>; }
export function InlineError({ message, onRetry }) { return <div className="inline-error" role="alert"><div><strong>We couldn’t load this information.</strong><span>{message}</span></div>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}</div>; }
function labelControl(element, id, errorId) {
  if (!isValidElement(element)) return element;
  if (['input', 'select', 'textarea'].includes(element.type)) return cloneElement(element, { id, 'aria-invalid': Boolean(element.props['aria-invalid']), ...(errorId ? { 'aria-describedby': errorId } : {}) });
  return cloneElement(element, {}, ...((element.props.children == null ? [] : Array.isArray(element.props.children) ? element.props.children : [element.props.children]).map((child) => labelControl(child, id, errorId))));
}
export function Field({ label, required, hint, error, children, className = '' }) { const controlId = useId(); const errorId = `${controlId}-error`; return <div className={`field ${className}`}><label htmlFor={controlId}>{label}{required && <span className="required"> *</span>}</label>{labelControl(children, controlId, error ? errorId : undefined)}{hint && !error && <small>{hint}</small>}{error && <small id={errorId} className="field-error" role="alert">{error}</small>}</div>; }
export function StatusBadge({ status }) {
  const value = status || 'UNKNOWN';
  const tone = ['APPROVED', 'AUTO_APPROVED'].includes(value) ? 'green' : ['REJECTED', 'AUTO_REJECTED'].includes(value) ? 'red' : ['HIGH'].includes(value) ? 'red' : ['IN_REVIEW', 'PENDING_CHECKER', 'RESUBMISSION_REQUESTED', 'EXTRACTING'].includes(value) ? 'amber' : 'slate';
  const label = value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`badge badge-${tone}`}><i />{label}</span>;
}
export function RiskBadge({ risk }) { return risk ? <span className={`risk-label risk-${risk.toLowerCase()}`}><i />{risk} risk</span> : <span className="muted">Not assessed</span>; }
export function SearchBox({ value, onChange, placeholder = 'Search applications' }) { return <label className="search-box"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />{value && <button type="button" onClick={() => onChange('')} aria-label="Clear search"><X size={15} /></button>}</label>; }
export function Modal({ open, title, body, confirmLabel = 'Confirm', busy = false, onCancel, onConfirm, danger = false }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">{title}</h2><p>{body}</p><div className="modal-actions"><Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}{confirmLabel}</Button></div></section></div>;
}
export function ProgressBar({ value = 0 }) { return <div className="progress-track" aria-label={`Upload ${Math.round(value)} percent complete`}><div className="progress-value" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }
