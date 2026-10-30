import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';
const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured');
try { await connectDatabase(); app.listen(port, () => console.log(`OnboardIQ API listening on http://localhost:${port}`)); }
catch (error) { console.error('Unable to start OnboardIQ API:', error.message); process.exit(1); }
