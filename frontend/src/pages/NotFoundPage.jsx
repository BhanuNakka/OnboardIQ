import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../components/UI.jsx';
export default function NotFoundPage() { return <Card className="not-found-card"><div className="eyebrow">PAGE NOT FOUND</div><h1>This page isn’t available.</h1><p>The route may have changed or your role may not have access to it.</p><Link to="/"><Button><ArrowLeft size={16} /> Return to your workspace</Button></Link></Card>; }
