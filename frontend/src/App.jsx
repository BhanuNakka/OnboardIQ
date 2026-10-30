import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import { Loading } from './components/UI.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CustomerDashboard from './pages/CustomerDashboard.jsx';
import ApplicationFormPage from './pages/ApplicationFormPage.jsx';
import ApplicationDetailPage from './pages/ApplicationDetailPage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import MakerQueuePage from './pages/MakerQueuePage.jsx';
import MakerReviewPage from './pages/MakerReviewPage.jsx';
import CheckerQueuePage from './pages/CheckerQueuePage.jsx';
import CompliancePage from './pages/CompliancePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import StaffApplicationPage from './pages/StaffApplicationPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const homeFor = { CUSTOMER: '/dashboard', MAKER: '/maker/reviews', CHECKER: '/checker/pending', COMPLIANCE: '/compliance', ADMIN: '/admin' };
function HomeRedirect() { const { user } = useAuth(); return <Navigate to={homeFor[user?.role] || '/login'} replace />; }
function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading label="Restoring secure session" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor[user.role] || '/login'} replace />;
  return children;
}
function Workspace({ roles, children }) { return <Protected roles={roles}><AppLayout /></Protected>; }
export default function App() {
  const { ready, user } = useAuth();
  if (!ready) return <div className="auth-loading"><Loading label="Preparing your secure workspace" /></div>;
  return <Routes>
    <Route path="/login" element={user ? <HomeRedirect /> : <LoginPage />} />
    <Route path="/register" element={user ? <HomeRedirect /> : <RegisterPage />} />
    <Route element={<Protected><AppLayout /></Protected>}>
      <Route path="/dashboard" element={<Protected roles={['CUSTOMER']}><CustomerDashboard /></Protected>} />
      <Route path="/applications/new" element={<Protected roles={['CUSTOMER']}><ApplicationFormPage /></Protected>} />
      <Route path="/applications/:applicationId" element={<Protected roles={['CUSTOMER']}><ApplicationDetailPage /></Protected>} />
      <Route path="/applications" element={<Protected roles={['MAKER', 'CHECKER', 'COMPLIANCE', 'ADMIN']}><ApplicationsPage /></Protected>} />
      <Route path="/staff/applications/:applicationId" element={<Protected roles={['MAKER', 'CHECKER', 'COMPLIANCE', 'ADMIN']}><StaffApplicationPage /></Protected>} />
      <Route path="/maker/reviews" element={<Protected roles={['MAKER']}><MakerQueuePage /></Protected>} />
      <Route path="/maker/applications/:applicationId" element={<Protected roles={['MAKER']}><MakerReviewPage /></Protected>} />
      <Route path="/checker/pending" element={<Protected roles={['CHECKER', 'COMPLIANCE']}><CheckerQueuePage /></Protected>} />
      <Route path="/compliance" element={<Protected roles={['COMPLIANCE', 'ADMIN']}><CompliancePage /></Protected>} />
      <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminPage /></Protected>} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    <Route path="/" element={user ? <HomeRedirect /> : <Navigate to="/login" replace />} />
    <Route path="*" element={user ? <NotFoundPage /> : <Navigate to="/login" replace />} />
  </Routes>;
}
