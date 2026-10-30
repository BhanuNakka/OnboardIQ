import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Files, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listAll } from '../api/applicationApi.js';
import { getApiError } from '../api/client.js';
import { Button, Card, EmptyState, InlineError, Loading, PageHeading, RiskBadge, SearchBox, StatusBadge } from '../components/UI.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [risk, setRisk] = useState(''); const [page, setPage] = useState(1);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setResult(await listAll({ page, limit: 10, ...(status ? { status } : {}), ...(risk ? { riskCategory: risk } : {}) })); } catch (e) { setError(getApiError(e)); } finally { setLoading(false); } }, [page, status, risk]);
  useEffect(() => { load(); }, [load]);
  const items = useMemo(() => (result?.items || []).filter((app) => `${app.applicationId} ${app.personalDetails?.fullName || ''}`.toLowerCase().includes(search.toLowerCase())), [result, search]);
  return <>
    <PageHeading eyebrow="OPERATIONS" title="Applications" description="Search and review applications visible to your staff role." action={<Button variant="outline" onClick={load}><RefreshCw size={16} /> Refresh</Button>} />
    <Card className="table-card"><div className="filters-row"><SearchBox value={search} onChange={setSearch} /><label className="filter-select"><span>Status</span><select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}><option value="">All statuses</option>{['SUBMITTED', 'EXTRACTING', 'AUTO_APPROVED', 'IN_REVIEW', 'PENDING_CHECKER', 'RESUBMISSION_REQUESTED', 'APPROVED', 'REJECTED', 'AUTO_REJECTED', 'CLOSED_EXPIRED'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-select"><span>Risk</span><select value={risk} onChange={(e) => { setPage(1); setRisk(e.target.value); }}><option value="">All risk</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label></div>
      {loading ? <Loading label="Loading applications" /> : error ? <InlineError message={error} onRetry={load} /> : items.length === 0 ? <EmptyState icon={Files} title="No applications found" body={search || status || risk ? 'Try changing the search or filters.' : 'There are no applications available for your role yet.'} /> : <div className="table-scroll"><table><thead><tr><th>APPLICATION</th><th>STATUS</th><th>RISK</th><th>DECISION</th><th>CREATED</th><th /></tr></thead><tbody>{items.map((app) => { const target = user.role === 'MAKER' && app.status === 'IN_REVIEW' ? `/maker/applications/${encodeURIComponent(app.applicationId)}` : `/staff/applications/${encodeURIComponent(app.applicationId)}`; return <tr key={app.applicationId}><td><div className="application-cell"><span className="application-icon"><Files size={16} /></span><span><strong>{app.applicationId}</strong><small>{app.personalDetails?.fullName || 'Applicant'}</small></span></div></td><td><StatusBadge status={app.status} /></td><td><RiskBadge risk={app.riskCategory} /></td><td>{app.decision || <span className="muted">—</span>}</td><td>{app.createdAt ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(app.createdAt)) : '—'}</td><td><Link to={target} className="row-arrow" aria-label={`Open ${app.applicationId}`}><ArrowRight size={17} /></Link></td></tr>; })}</tbody></table></div>}
      {!loading && result?.total > 0 && <div className="pagination"><span>{result.total} total applications · Page {result.page} of {Math.max(1, Math.ceil(result.total / result.limit))}</span><div><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * result.limit >= result.total} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>}
    </Card>
  </>;
}
