import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, Edit3, FileCheck2, FileText, RefreshCw, Send, ShieldCheck, UploadCloud } from 'lucide-react';
import { getApplication, getDecision, submitApplication } from '../api/applicationApi.js';
import { listDocuments, uploadDocument } from '../api/documentApi.js';
import { getApiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Card, Field, InlineError, Loading, PageHeading, ProgressBar, RiskBadge, StatusBadge } from '../components/UI.jsx';
import ApplicationEditor from '../components/ApplicationEditor.jsx';

const documentTypes = [
  ['PAN_CARD', 'PAN card'], ['AADHAAR_CARD', 'Aadhaar card'], ['ELECTRICITY_BILL', 'Electricity bill'], ['BANK_STATEMENT', 'Bank statement'], ['DRIVING_LICENCE', 'Driving licence']
];
const marker = 'SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT';
function dateLabel(value) { return value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)) : '—'; }
const explanation = {
  DOCUMENT_MISSING: 'One or more required document types are missing.', DOCUMENT_TYPE_MISMATCH: 'The document classification differs from the declared type.', LOW_EXTRACTION_CONFIDENCE: 'Some document fields need manual review.',
  AGE_BELOW_18: 'Applicant is below the minimum age.', PAN_INVALID: 'The declared PAN format or holder type is invalid.', PAN_MISMATCH: 'PAN on the document differs from the application.', DOB_MISMATCH: 'Date of birth differs across the submitted details.', AADHAAR_MISMATCH: 'Aadhaar last four digits do not match.', NAME_MISMATCH: 'The document name has a significant mismatch.', NAME_MISMATCH_MINOR: 'The document name needs review.', SANCTIONS_MATCH: 'A simulated sanctions list match was found.', SANCTIONS_POSSIBLE_MATCH: 'A possible simulated sanctions match needs review.', PEP_MATCH: 'A simulated PEP match needs enhanced review.', ADDRESS_PROOF_STALE: 'Address proof is outside the accepted date range.', ADDRESS_MISMATCH: 'The address proof PIN code differs from the application.', DOCUMENT_EXPIRED: 'The driving licence has expired.', DUPLICATE_CUSTOMER: 'The simulated PAN matches an existing customer.'
};

export default function ApplicationDetailPage() {
  const { applicationId } = useParams(); const location = useLocation(); const navigate = useNavigate(); const toast = useToast();
  const [application, setApplication] = useState(null); const [documents, setDocuments] = useState([]); const [decision, setDecision] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [editing, setEditing] = useState(false);
  const [documentType, setDocumentType] = useState('PAN_CARD'); const [file, setFile] = useState(null); const [uploadBusy, setUploadBusy] = useState(false); const [uploadProgress, setUploadProgress] = useState(0); const [submitBusy, setSubmitBusy] = useState(false); const [uploadError, setUploadError] = useState('');
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    setError('');
    try {
      const [app, docs] = await Promise.all([getApplication(applicationId), listDocuments(applicationId)]);
      setApplication(app); setDocuments(docs.items || []);
      try { setDecision(await getDecision(applicationId)); } catch (e) { if (e.response?.status === 404) setDecision(null); else throw e; }
    } catch (e) { setError(getApiError(e)); }
    finally { setLoading(false); }
  }, [applicationId]);
  useEffect(() => { mounted.current = true; refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => { if (location.state?.created) { toast('Application created. Add at least three documents to submit it.', 'success'); navigate(location.pathname, { replace: true, state: {} }); } }, [location.pathname, location.state, navigate, toast]);

  async function upload() {
    setUploadError('');
    if (!file) { setUploadError('Choose a UTF-8 .txt document first.'); return; }
    if (!file.name.toLowerCase().endsWith('.txt')) { setUploadError('Only .txt documents are supported by this mock extraction workflow.'); return; }
    if (file.size > 1024 * 1024) { setUploadError('The selected file is larger than 1 MB.'); return; }
    try { const text = await file.text(); if (!text.includes(marker)) { setUploadError(`The synthetic document marker is required: “${marker}”.`); return; } }
    catch { setUploadError('The file could not be read as text. Choose a UTF-8 .txt file.'); return; }
    setUploadBusy(true); setUploadProgress(0);
    try {
      await uploadDocument(applicationId, documentType, file, (event) => { if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100)); });
      setFile(null); const picker = document.getElementById('document-file'); if (picker) picker.value = '';
      toast('Document uploaded. Upload is not the same as verification.', 'success'); await refresh();
    } catch (e) { setUploadError(getApiError(e)); }
    finally { setUploadBusy(false); }
  }
  async function submitForReview() {
    setSubmitBusy(true); setUploadError('');
    try {
      const result = await submitApplication(applicationId); setApplication((current) => ({ ...current, status: result.status })); toast('Application submitted. Mock extraction is running.', 'success');
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        if (!mounted.current) return;
        const next = await getApplication(applicationId); setApplication(next);
        if (next.status !== 'EXTRACTING') { try { setDecision(await getDecision(applicationId)); } catch { setDecision(null); } break; }
      }
      if (mounted.current) await refresh();
    } catch (e) { setUploadError(getApiError(e)); }
    finally { if (mounted.current) setSubmitBusy(false); }
  }

  if (loading) return <Loading label="Loading application" />;
  if (error) return <InlineError message={error} onRetry={refresh} />;
  if (!application) return null;
  const canUpload = ['SUBMITTED', 'RESUBMISSION_REQUESTED'].includes(application.status);
  const canSubmit = canUpload && documents.length >= 3;
  const timeline = [
    { label: 'Application started', done: true }, { label: 'Documents added', done: documents.length >= 3 },
    { label: 'Verification submitted', done: !['SUBMITTED', 'RESUBMISSION_REQUESTED'].includes(application.status) },
    { label: 'Decision recorded', done: Boolean(decision) || ['APPROVED', 'REJECTED', 'AUTO_APPROVED', 'AUTO_REJECTED'].includes(application.status) }
  ];
  return <>
    <button className="back-link page-back" onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Back to applications</button>
    <PageHeading eyebrow="APPLICATION DETAILS" title={application.applicationId} description={`${application.personalDetails?.fullName || 'Customer'} · Created ${dateLabel(application.createdAt)}`} action={<StatusBadge status={application.status} />} />
    <div className="detail-grid">
      <div className="detail-main-column">
        {editing && <ApplicationEditor application={application} onCancel={() => setEditing(false)} onSaved={(updated) => { setApplication(updated); setEditing(false); toast('Application details updated.', 'success'); }} />}
        <Card className="detail-summary-card"><div className="section-heading"><div><h2>Onboarding status</h2><p>Current application progress from the backend</p></div><div className="summary-code"><span>REFERENCE</span><strong>{application.applicationId}</strong></div></div><div className="timeline">{timeline.map((step, index) => <div className={`timeline-step ${step.done ? 'timeline-step-done' : ''}`} key={step.label}><span className="timeline-marker">{step.done ? <Check size={13} /> : index + 1}</span><div><strong>{step.label}</strong>{index < timeline.length - 1 && <small>{step.done ? 'Completed' : 'Waiting'}</small>}</div>{index < timeline.length - 1 && <i className={step.done ? 'timeline-line timeline-line-done' : 'timeline-line'} />}</div>)}</div></Card>
        <Card className="detail-card"><div className="section-heading"><div><h2>Application details</h2><p>Identity data submitted for verification</p></div><div className="section-actions"><RiskBadge risk={application.riskCategory} />{['SUBMITTED', 'RESUBMISSION_REQUESTED'].includes(application.status) && <Button variant="outline" size="sm" onClick={() => setEditing((value) => !value)}><Edit3 size={15} /> Edit details</Button>}</div></div><div className="detail-fields"><div><small>Full name</small><strong>{application.personalDetails?.fullName || '—'}</strong></div><div><small>Date of birth</small><strong>{application.personalDetails?.dob || '—'}</strong></div><div><small>PAN</small><strong className="mono">{application.personalDetails?.panNumber || '—'}</strong></div><div><small>Aadhaar last 4</small><strong className="mono">•••• {application.personalDetails?.aadhaarLast4 || '—'}</strong></div><div><small>Email</small><strong>{application.personalDetails?.email || '—'}</strong></div><div><small>Mobile</small><strong>{application.personalDetails?.mobile || '—'}</strong></div><div className="detail-field-wide"><small>Address</small><strong>{[application.addressDetails?.address, application.addressDetails?.city, application.addressDetails?.state, application.addressDetails?.pincode].filter(Boolean).join(', ') || '—'}</strong></div></div></Card>
        <Card className="detail-card"><div className="section-heading"><div><h2>Documents</h2><p>{documents.length} uploaded · Minimum 3 required before submit</p></div><span className="count-chip">{documents.length}/3+</span></div>
          {documents.length ? <div className="document-list">{documents.map((doc) => <div className="document-row" key={doc._id}><span className="document-icon"><FileText size={18} /></span><div className="document-copy"><strong>{doc.fileName}</strong><small>{doc.documentType.replaceAll('_', ' ')} · Added {dateLabel(doc.createdAt)}</small></div><StatusBadge status={doc.extractionStatus} /></div>)}</div> : <div className="document-empty">No documents have been uploaded.</div>}
          {canUpload && <div className="upload-panel"><div className="upload-panel-heading"><div><h3>Add a document</h3><p>UTF-8 .txt only · up to 1 MB per file</p></div><span className="mock-pill">MOCK TEXT EXTRACTION</span></div><div className="upload-controls"><Field label="Document type" required><select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>{documentTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Choose file" required hint="The file must include the required synthetic specimen line."><input id="document-file" type="file" accept=".txt,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field></div>{file && <div className="selected-file"><FileText size={16} /><span>{file.name}</span><small>{(file.size / 1024).toFixed(0)} KB</small></div>}{uploadBusy && <ProgressBar value={uploadProgress} />}{uploadError && <div className="form-alert" role="alert">{uploadError}</div>}<Button variant="outline" onClick={upload} disabled={uploadBusy || !file}>{uploadBusy ? 'Uploading…' : 'Upload document'}<UploadCloud size={16} /></Button></div>}
          {!canUpload && <div className="content-note"><ShieldCheck size={16} /><span>Documents are locked while this application is being reviewed.</span></div>}
        </Card>
        <Card className="detail-card"><div className="section-heading"><div><h2>Decision</h2><p>Evaluation outcome and reasons returned by the backend</p></div>{decision?.decision && <StatusBadge status={decision.status || decision.decision} />}</div>
          {decision ? <><div className="decision-summary"><div><small>Decision</small><strong>{decision.decision}</strong></div><div><small>Risk category</small><strong><RiskBadge risk={decision.riskCategory} /></strong></div><div><small>Name match score</small><strong>{typeof decision.nameMatchScore === 'number' ? decision.nameMatchScore.toFixed(4) : 'Unavailable'}</strong></div><div><small>Re-KYC due</small><strong>{decision.rekycDueDate || '—'}</strong></div></div>{decision.reasonCodes?.length > 0 ? <div className="reason-list"><h3>Reason codes</h3>{decision.reasonCodes.map((code) => <div className="reason-item" key={code}><span>{code}</span><small>{explanation[code] || 'Review the application details with an authorized officer.'}</small></div>)}</div> : <div className="success-note"><Check size={16} /> No rule reason codes were returned.</div>}</> : <div className="decision-wait"><Clock3 size={18} /><div><strong>Decision not available yet</strong><p>The backend has not returned an evaluation for this application.</p></div></div>}
        </Card>
      </div>
      <aside className="detail-side-column"><Card className="action-card"><div className="action-card-icon"><Send size={18} /></div><h2>Ready to submit?</h2><p>Upload at least three required text documents before sending your application for mock verification.</p><Button className="full-width" disabled={!canSubmit || submitBusy} onClick={submitForReview}>{submitBusy ? <><RefreshCw size={16} className="spin" /> Processing…</> : <>Submit for verification <ArrowRight size={16} /></>}</Button>{submitBusy && <small className="action-hint">We’re checking the application status for up to 24 seconds.</small>}{!canSubmit && canUpload && <small className="action-hint">{Math.max(0, 3 - documents.length)} more document{3 - documents.length === 1 ? '' : 's'} needed.</small>}{application.status === 'EXTRACTING' && <div className="processing-callout"><RefreshCw size={15} className="spin" /> Mock extraction is processing the document text.</div>}{application.status === 'RESUBMISSION_REQUESTED' && <div className="resubmit-callout">The maker requested updated documents. Upload them here and submit again.</div>}</Card>
        <Card className="detail-side-card"><div className="section-heading"><div><h3>Applicant contact</h3></div></div><div className="contact-list"><div><small>Email</small><strong>{application.personalDetails?.email || '—'}</strong></div><div><small>Phone</small><strong>{application.personalDetails?.mobile || '—'}</strong></div></div></Card>
        <div className="privacy-callout"><ShieldCheck size={17} /><div><strong>Your information is protected</strong><span>Aadhaar is limited to its last four digits. Use synthetic data only in this demo.</span></div></div>
      </aside>
    </div>
  </>;
}
