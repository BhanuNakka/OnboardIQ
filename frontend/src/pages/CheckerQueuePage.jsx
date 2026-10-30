import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Check, ChevronDown, ChevronUp, FileSearch, XCircle } from 'lucide-react';
import { getCheckerQueue, decideApplication } from '../api/reviewApi.js';
import { getDecision } from '../api/applicationApi.js';
import { listDocuments, listExtractions } from '../api/documentApi.js';
import { getApiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Card, EmptyState, Field, InlineError, Loading, Modal, PageHeading, RiskBadge, StatusBadge } from '../components/UI.jsx';

function EvidencePanel({ applicationId }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [documents, extractions] = await Promise.all([listDocuments(applicationId), listExtractions(applicationId)]);
        let decision = null;
        try { decision = await getDecision(applicationId); } catch (e) { if (e.response?.status !== 404) throw e; }
        if (active) setData({ documents: documents.items || [], extractions: extractions.items || [], decision });
      } catch (e) { if (active) setError(getApiError(e)); }
      finally { if (active) setLoading(false); }
    }
    load(); return () => { active = false; };
  }, [applicationId]);
  if (loading) return <div className="evidence-panel"><Loading label="Loading KYC evidence" /></div>;
  if (error) return <div className="evidence-panel"><InlineError message={error} /></div>;
  const extractionRows = data.extractions.flatMap((record) => (record.extractedFields || []).map((field) => ({ ...field, documentId: record.documentId })));
  function displayValue(field) {
    const value = String(field.value ?? '—'); const key = String(field.fieldName || '').toLowerCase();
    if (key.includes('pan') && value.length === 10) return `${value.slice(0, 3)}XXXXX${value.slice(-2)}`;
    if (key.includes('aadhaar')) return `•••• ${value.slice(-4)}`;
    return value;
  }
  return <div className="evidence-panel"><div className="section-heading"><div><h3>Review evidence</h3><p>Saved document metadata, extracted fields and rule decision</p></div></div>
    {data.decision && <div className="evidence-decision"><span>Decision: <strong>{data.decision.decision}</strong></span><span>Name match: <strong>{typeof data.decision.nameMatchScore === 'number' ? data.decision.nameMatchScore.toFixed(3) : 'Unavailable'}</strong></span><span>Risk: <strong>{data.decision.riskCategory || 'Unavailable'}</strong></span></div>}
    <div className="evidence-documents"><strong>Documents ({data.documents.length})</strong>{data.documents.length ? data.documents.map((doc) => <div className="evidence-document" key={doc._id}><span>{doc.fileName}</span><small>{doc.documentType?.replaceAll('_', ' ')} · {doc.extractionStatus || 'Not extracted'}</small></div>) : <p>No document records returned.</p>}</div>
    <div className="table-scroll"><table><thead><tr><th>EXTRACTED FIELD</th><th>VALUE</th><th>CONFIDENCE</th></tr></thead><tbody>{extractionRows.map((field, index) => <tr key={`${field.documentId}-${field.fieldName}-${index}`}><td>{String(field.fieldName || '').replaceAll('_', ' ')}</td><td className="extraction-value">{displayValue(field)}</td><td>{typeof field.confidence === 'number' ? `${Math.round(field.confidence * 100)}%` : 'Unavailable'}</td></tr>)}</tbody></table></div>
    {!extractionRows.length && <p className="evidence-empty">No extracted fields are available from the API yet.</p>}
  </div>;
}

export default function CheckerQueuePage() {
  const [items, setItems] = useState([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [comments, setComments] = useState({}); const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState(''); const [evidenceId, setEvidenceId] = useState(''); const [page, setPage] = useState(1); const toast = useToast();
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await getCheckerQueue({ page, limit: 10 }); setItems(data.items || []); setTotal(data.total || 0); } catch (e) { setError(getApiError(e)); } finally { setLoading(false); } }, [page]);
  useEffect(() => { load(); }, [load]);
  async function act() {
    if (!confirm) return; const text = comments[confirm.applicationId]?.trim() || '';
    if (text.length < 10) { setActionError('Add a comment of at least 10 characters before deciding.'); return; }
    setBusy(true); setActionError('');
    try { await decideApplication(confirm.applicationId, { decision: confirm.decision, comments: text }); toast(`Checker decision ${confirm.decision.toLowerCase()} recorded.`, 'success'); setConfirm(null); await load(); }
    catch (e) { setActionError(getApiError(e)); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading eyebrow="CHECKER WORKSPACE" title="Pending decisions" description="Independently review maker recommendations and record your decision." action={<span className="queue-count">{total} awaiting decision</span>} />
    <div className="queue-info"><BadgeCheck size={17} /><span>Maker and checker must be different users. Final decisions trigger the mock core-banking action only after approval.</span></div>
    {loading ? <Card><Loading label="Loading checker queue" /></Card> : error ? <InlineError message={error} onRetry={load} /> : items.length === 0 ? <Card><EmptyState icon={BadgeCheck} title="No pending decisions" body="Applications with PENDING_CHECKER status will appear here." /></Card> : <div className="checker-list">{items.map((app) => <Card className="checker-card" key={app.applicationId}><div className="checker-card-top"><div className="application-cell"><span className="application-icon"><BadgeCheck size={17} /></span><span><strong>{app.applicationId}</strong><small>{app.personalDetails?.fullName || 'Applicant'}</small></span></div><StatusBadge status={app.status} /></div><div className="checker-detail-strip"><div><small>Risk category</small><RiskBadge risk={app.riskCategory} /></div><div><small>Rule decision</small><strong>{app.decision || '—'}</strong></div><div><small>Reason codes</small><strong>{(app.reasonCodes || []).join(' · ') || 'None returned'}</strong></div></div><div className="maker-rec"><div><small>MAKER RECOMMENDATION</small><strong>{app.makerAction?.makerRecommendation || 'High-risk auto-route'}</strong></div><p>{app.makerAction?.makerComments || 'This high-risk approval requires independent confirmation.'}</p><span>Maker ID · {app.makerAction?.makerId || 'System routing'}</span></div><Button variant="outline" size="sm" onClick={() => setEvidenceId((current) => current === app.applicationId ? '' : app.applicationId)}><FileSearch size={15} /> {evidenceId === app.applicationId ? 'Hide KYC evidence' : 'Review KYC evidence'} {evidenceId === app.applicationId ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</Button>{evidenceId === app.applicationId && <EvidencePanel applicationId={app.applicationId} />}<Field label="Checker comments" required hint="At least 10 characters; recorded in the audit history."><textarea rows="2" value={comments[app.applicationId] || ''} onChange={(e) => setComments((state) => ({ ...state, [app.applicationId]: e.target.value }))} placeholder="Add your independent review comments…" /></Field><div className="checker-actions"><Button variant="danger-outline" onClick={() => { setActionError(''); setConfirm({ applicationId: app.applicationId, decision: 'REJECT' }); }}><XCircle size={16} /> Reject</Button><Button variant="outline" onClick={() => { setActionError(''); setConfirm({ applicationId: app.applicationId, decision: 'SEND_BACK' }); }}>Send back to maker</Button><Button onClick={() => { setActionError(''); setConfirm({ applicationId: app.applicationId, decision: 'APPROVE' }); }}><Check size={16} /> Approve</Button></div></Card>)}</div>}
    {!loading && total > 10 && <div className="pagination"><span>Page {page} of {Math.ceil(total / 10)} · {total} pending decisions</span><div><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 10 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
    <Modal open={Boolean(confirm)} title={`${confirm?.decision === 'APPROVE' ? 'Approve' : confirm?.decision === 'REJECT' ? 'Reject' : 'Send back'} application?`} body="This decision will be sent to the backend and written to the application audit trail. Confirm that your review is complete." confirmLabel={confirm?.decision === 'SEND_BACK' ? 'Send back' : confirm?.decision === 'APPROVE' ? 'Approve application' : 'Reject application'} danger={confirm?.decision === 'REJECT'} busy={busy} onCancel={() => setConfirm(null)} onConfirm={act} />
    {confirm && actionError && <div className="modal-error" role="alert">{actionError}</div>}
  </>;
}
