import { Link } from 'react-router-dom';
import { ArrowRight, Shield, ShieldCheck } from 'lucide-react';
import { Button, Card, PageHeading } from '../components/UI.jsx';

export default function AdminPage() {
  return <>
    <PageHeading eyebrow="ADMINISTRATOR" title="System workspace" description="Administrative access is limited to the operations currently exposed by the backend." />
    <div className="admin-grid"><Card className="admin-feature-card"><span className="metric-icon icon-blue"><Shield size={19} /></span><h2>Application oversight</h2><p>Review the application inventory and current statuses available to your role.</p><Link to="/applications"><Button>Open application list <ArrowRight size={16} /></Button></Link></Card><Card className="admin-feature-card"><span className="metric-icon icon-green"><ShieldCheck size={19} /></span><h2>Compliance reporting</h2><p>View backend-provided status and risk metrics, audit records and decision exports.</p><Link to="/compliance"><Button variant="outline">Open compliance <ArrowRight size={16} /></Button></Link></Card></div>
    <div className="content-note"><ShieldCheck size={16} /><span>The backend does not expose user-management or rule-configuration endpoints, so those controls are not shown.</span></div>
  </>;
}
