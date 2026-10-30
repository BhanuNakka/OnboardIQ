import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMakerQueue } from '../api/reviewApi.js';
import { getApiError } from '../api/client.js';
import { Button, Card, EmptyState, InlineError, Loading, PageHeading, RiskBadge, SearchBox, StatusBadge } from '../components/UI.jsx';

export default function MakerQueuePage() {
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setResult(await getMakerQueue({ page, limit: 10 })); } catch (e) { setError(getApiError(e)); } finally { setLoading(false); } }, [page]);
  useEffect(() => { load(); }, [load]);
  const items = useMemo(() => (result?.items || []).filter((app) => `${app.applicationId} ${app.personalDetails?.fullName || ''}`.toLowerCase().includes(search.toLowerCase())), [result, search]);
  return <>
    <PageHeading eyebrow="MAKER WORKSPACE" title="Review queue" description="Review applications routed for human assessment. High-risk cases are prioritized by the backend." action={<Button variant="outline" onClick={load}><RefreshCw size={16} /> Refresh queue</Button>} />
    <div className="queue-info"><ClipboardCheck size={17} /><span>Each recommendation requires a comment of at least 10 characters. Final decisions are made by a separate checker.</span></div>
    <Card className="table-card"><div className="filters-row"><SearchBox value={search} onChange={setSearch} placeholder="Search by application or name" /><span className="queue-count">{result?.total ?? '—'} pending review</span></div>
      {loading ? <Loading label="Loading review queue" /> : error ? <InlineError message={error} onRetry={load} /> : items.length === 0 ? <EmptyState icon={ClipboardCheck} title="Review queue is clear" body="Applications needing maker review will appear here when the backend routes them to IN_REVIEW." /> : <div className="table-scroll"><table><thead><tr><th>APPLICATION</th><th>STATUS</th><th>RISK</th><th>REASON CODES</th><th /><th /></tr></thead><tbody>{items.map((app) => <tr key={app.applicationId}><td><div className="application-cell"><span className="application-icon"><ClipboardCheck size={16} /></span><span><strong>{app.applicationId}</strong><small>{app.personalDetails?.fullName || 'Applicant'}</small></span></div></td><td><StatusBadge status={app.status} /></td><td><RiskBadge risk={app.riskCategory} /></td><td><span className="reason-code-inline">{(app.reasonCodes || []).join(' · ') || 'Review required'}</span></td><td>{app.createdAt ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(app.createdAt)) : '—'}</td><td><Link className="row-arrow" to={`/maker/applications/${encodeURIComponent(app.applicationId)}`} aria-label={`Review ${app.applicationId}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>}
      {!loading && result?.total > 10 && <div className="pagination"><span>Page {result.page} of {Math.ceil(result.total / result.limit)} · {result.total} pending reviews</span><div><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * result.limit >= result.total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
    </Card>
  </>;
}
