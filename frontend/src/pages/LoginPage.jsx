import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../api/client.js';
import { Button, Field } from '../components/UI.jsx';

export default function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const [visible, setVisible] = useState(false); const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({ mode: 'onTouched', defaultValues: { role: 'CUSTOMER' } });
  const selectedRole = watch('role'); const isStaffRole = ['MAKER', 'CHECKER', 'COMPLIANCE', 'ADMIN'].includes(selectedRole);
  const demoAccounts = [
    ['CUSTOMER', 'Customer', 'customer@onboardiq.test'], ['MAKER', 'Maker', 'maker@onboardiq.test'], ['CHECKER', 'Checker', 'checker@onboardiq.test'],
    ['COMPLIANCE', 'Compliance', 'compliance@onboardiq.test'], ['ADMIN', 'Admin', 'admin@onboardiq.test']
  ];
  function selectDemoAccount(role, email) { setValue('role', role, { shouldValidate: true }); setValue('email', email, { shouldValidate: true }); setValue('password', 'DemoPass123!', { shouldValidate: true }); setServerError(''); }
  async function submit(values) { setServerError(''); const { role, ...credentials } = values; try { const user = await login(credentials, role); navigate(({ CUSTOMER: '/dashboard', MAKER: '/maker/reviews', CHECKER: '/checker/pending', COMPLIANCE: '/compliance', ADMIN: '/admin' })[user.role] || '/', { replace: true }); } catch (error) { setServerError(error.response ? getApiError(error) : error.message || 'Sign in could not be completed.'); } }
  return <div className="auth-page">
    <section className="auth-panel"><div className="auth-brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>OnboardIQ</span></div><div className="auth-art"><div className="auth-art-grid" /><div className="auth-art-content"><div className="art-kicker"><span /> BANKING OPERATIONS</div><h1>Trust starts with a<br /><em>clear process.</em></h1><p>A secure workspace for identity checks, application review and customer onboarding.</p><div className="art-stat-row"><div><strong>01</strong><span>Capture</span></div><i /><div><strong>02</strong><span>Verify</span></div><i /><div><strong>03</strong><span>Decide</span></div></div></div><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-footer"><span>●</span> Synthetic demonstration environment</div></div></section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><div className="auth-mobile-brand"><div className="brand-mark"><ShieldCheck size={21} /></div><span>OnboardIQ</span></div><div className="auth-heading"><div className="eyebrow">WELCOME BACK</div><h2>Sign in to your workspace</h2><p>Use your OnboardIQ account to continue.</p></div>
      <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
        {serverError && <div className="form-alert" role="alert">{serverError}</div>}
        <Field label="Sign in as" required error={errors.role?.message}><select {...register('role', { required: 'Select your account role.' })}><option value="CUSTOMER">Customer</option><option value="MAKER">Maker</option><option value="CHECKER">Checker</option><option value="COMPLIANCE">Compliance</option><option value="ADMIN">Admin</option></select></Field>
        <Field label="Email address" required hint={isStaffRole ? 'Institution staff use their work email. Demo accounts use @onboardiq.test.' : 'Use the email address registered to your customer account.'} error={errors.email?.message}><input type="email" autoComplete="username" placeholder={isStaffRole ? 'name@onboardiq.test' : 'you@example.com'} {...register('email', { required: 'Enter your email address.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' } })} /></Field>
        <Field label="Password" required error={errors.password?.message}><div className="password-input"><input type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" {...register('password', { required: 'Enter your password.' })} /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>
        <div className="form-meta"><span><ShieldCheck size={14} /> Secure sign in</span><span>JWT session</span></div>
        <Button type="submit" disabled={isSubmitting} className="auth-submit">{isSubmitting ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></Button>
      </form>
      {import.meta.env.DEV && <section className="demo-account-panel" aria-label="Development demo accounts"><strong>Explore role dashboards</strong><p>Choose a seeded demo account to fill the sign-in form. The selected role is checked against the backend account.</p><div className="demo-role-list">{demoAccounts.map(([role, label, email]) => <button type="button" key={role} onClick={() => selectDemoAccount(role, email)}>{label}</button>)}</div><small>Demo users must be seeded in the connected database. See the backend README.</small></section>}
      <div className="auth-switch">New to OnboardIQ? <Link to="/register">Create a customer account</Link></div>
      <div className="auth-footnote">By continuing, you agree to the organization’s identity verification process.</div>
    </div></section>
  </div>;
}
