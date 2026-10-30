import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../api/client.js';
import { Button, Field } from '../components/UI.jsx';
import { useState } from 'react';

export default function RegisterPage() {
  const { register: createAccount } = useAuth(); const navigate = useNavigate(); const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ mode: 'onTouched' });
  async function submit(values) { setServerError(''); try { await createAccount({ name: values.name.trim(), email: values.email.trim(), password: values.password }); navigate('/dashboard', { replace: true }); } catch (error) { setServerError(getApiError(error)); } }
  return <div className="auth-simple-page"><div className="auth-simple-top"><Link to="/login" className="back-link"><ArrowLeft size={16} /> Back to sign in</Link><div className="auth-brand"><div className="brand-mark"><ShieldCheck size={21} /></div><span>OnboardIQ</span></div></div><main className="register-card"><div className="eyebrow">CUSTOMER REGISTRATION</div><h1>Create your account</h1><p className="register-intro">Your details are used to create a customer login. KYC information is collected in the application form.</p>
    <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>{serverError && <div className="form-alert" role="alert">{serverError}</div>}
      <Field label="Full name" required error={errors.name?.message}><input autoComplete="name" placeholder="Your full name" {...register('name', { required: 'Enter your name.', minLength: { value: 2, message: 'Name must contain at least 2 characters.' } })} /></Field>
      <Field label="Email address" required error={errors.email?.message}><input type="email" autoComplete="email" placeholder="you@example.com" {...register('email', { required: 'Enter your email address.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' } })} /></Field>
      <Field label="Password" required hint="Use at least 8 characters." error={errors.password?.message}><input type="password" autoComplete="new-password" placeholder="Create a password" {...register('password', { required: 'Create a password.', minLength: { value: 8, message: 'Password must contain at least 8 characters.' } })} /></Field>
      <Field label="Confirm password" required error={errors.confirmPassword?.message}><input type="password" autoComplete="new-password" placeholder="Enter your password again" {...register('confirmPassword', { required: 'Confirm your password.', validate: (value) => value === watch('password') || 'Passwords do not match.' })} /></Field>
      <Button type="submit" disabled={isSubmitting} className="auth-submit">{isSubmitting ? 'Creating account…' : 'Create customer account'}<ArrowRight size={17} /></Button>
    </form><div className="register-note"><ShieldCheck size={16} /> Public registration creates a CUSTOMER account only. Staff roles are provisioned by the backend seed process for development or by an authorized administrator.</div></main></div>;
}
