import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, FilePlus2, Files, ShieldCheck, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listMine } from '../api/applicationApi.js';
import { getApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, EmptyState, InlineError, Loading, PageHeading, StatusBadge } from '../components/UI.jsx';

function formatDate(value) { return value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'; }
export default function CustomerDashboard() {
  const { user } = useAuth(); const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [page, setPage] = useState(1);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setResult(await listMine({ page, limit: 10 })); } catch (e) { setError(getApiError(e)); } finally { setLoading(false); } }, [page]);
  useEffect(() => { load(); }, [load]);
  const items = result?.items || [];
  return <>
    <PageHeading eyebrow="CUSTOMER WORKSPACE" title={`Good day, ${user?.name?.split(' ')[0] || 'there'}`} description="Track your onboarding applications and continue where you left off." action={<Link to="/applications/new"><Button><FilePlus2 size={17} /> Start an application</Button></Link>} />
    <div className="metric-grid metric-grid-customer"><Card className="metric-card"><div className="metric-top"><span>Total applications</span><span className="metric-icon icon-blue"><Files size={18} /></span></div><strong>{loading ? '—' : result?.total ?? 0}</strong><small>Applications linked to your account</small></Card><Card className="metric-card"><div className="metric-top"><span>Loaded this page</span><span className="metric-icon icon-teal"><Clock3 size={18} /></span></div><strong>{loading ? '—' : items.length}</strong><small>Records returned by the current page request</small></Card><Card className="metric-card metric-card-note"><div className="metric-top"><span>Secure by design</span><span className="metric-icon icon-green"><ShieldCheck size={18} /></span></div><strong className="metric-note">Your identity data</strong><small>Only authorized operations staff can review submitted documents.</small></Card></div>
    <Card className="table-card"><div className="section-heading"><div><h2>Your applications</h2><p>Application status and next steps</p></div>{!loading && items.length > 0 && <Link className="text-link" to="/applications/new">New application <ArrowRight size={15} /></Link>}</div>
      {loading ? <Loading label="Loading applications" /> : error ? <InlineError message={error} onRetry={load} /> : items.length === 0 ? <EmptyState icon={Files} title="No applications yet" body="Start a KYC application to begin secure customer onboarding." action={<Link to="/applications/new"><Button><FilePlus2 size={16} /> Start an application</Button></Link>} /> : <div className="table-scroll"><table><thead><tr><th>APPLICATION</th><th>STATUS</th><th>DECISION</th><th>CREATED</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{items.map((app) => <tr key={app.applicationId}><td><Link className="application-cell" to={`/applications/${encodeURIComponent(app.applicationId)}`}><span className="application-icon"><Files size={16} /></span><span><strong>{app.applicationId}</strong><small>{app.personalDetails?.fullName || 'Applicant'}</small></span></Link></td><td><StatusBadge status={app.status} /></td><td>{app.decision ? <span className="decision-text">{app.decision}</span> : <span className="muted">Pending</span>}</td><td>{formatDate(app.createdAt)}</td><td><Link className="row-arrow" to={`/applications/${encodeURIComponent(app.applicationId)}`} aria-label={`Open ${app.applicationId}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>}
      {result?.total > 10 && <div className="pagination"><span>Showing page {result.page} of {Math.ceil(result.total / result.limit)} · {result.total} applications</span><div><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * result.limit >= result.total || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
    </Card>
    <div className="content-note"><ShieldCheck size={16} /><span>Document extraction in this demonstration reads supplied text files; it does not perform OCR.</span></div>
  </>;
}
