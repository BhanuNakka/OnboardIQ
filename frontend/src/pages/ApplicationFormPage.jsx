import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, FileCheck2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createApplication } from '../api/applicationApi.js';
import { getApiError } from '../api/client.js';
import { Button, Card, Field, PageHeading } from '../components/UI.jsx';

const occupationOptions = [['SALARIED_PRIVATE', 'Private salaried'], ['STUDENT', 'Student'], ['JEWELLER_BULLION_DEALER', 'Jewellery / bullion dealer']];
export default function ApplicationFormPage() {
  const navigate = useNavigate(); const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ mode: 'onTouched', defaultValues: { gender: '', occupationCode: '', consentToKyc: false } });
  async function submit(values) {
    setServerError('');
    const payload = { personalDetails: { fullName: values.fullName.trim(), dob: values.dob, gender: values.gender, panNumber: values.panNumber.trim().toUpperCase(), aadhaarLast4: values.aadhaarLast4, mobile: values.mobile, email: values.email.trim(), occupationCode: values.occupationCode, annualIncome: Number(values.annualIncome), consentToKyc: values.consentToKyc === true }, addressDetails: { address: values.address.trim(), city: values.city.trim(), state: values.state.trim(), pincode: values.pincode } };
    try { const app = await createApplication(payload); navigate(`/applications/${encodeURIComponent(app.applicationId)}`, { state: { created: true } }); }
    catch (error) { setServerError(getApiError(error)); }
  }
  return <>
    <Link className="back-link page-back" to="/dashboard"><ArrowLeft size={16} /> Back to applications</Link>
    <PageHeading eyebrow="NEW CUSTOMER APPLICATION" title="Personal and address details" description="Enter the details exactly as they appear on your synthetic identity documents." />
    <div className="form-progress"><div className="progress-step progress-step-active"><span>01</span><div><strong>Applicant details</strong><small>Personal and address information</small></div></div><div className="progress-line" /><div className="progress-step"><span>02</span><div><strong>Documents</strong><small>Upload and submit</small></div></div></div>
    <form className="application-form" onSubmit={handleSubmit(submit)} noValidate>
      {serverError && <div className="form-alert form-alert-wide" role="alert">{serverError}</div>}
      <Card className="form-card"><div className="form-section-heading"><div className="form-section-icon"><FileCheck2 size={18} /></div><div><h2>Personal details</h2><p>Use the applicant’s legal name and identity information.</p></div></div><div className="form-grid">
        <Field label="Full name" required error={errors.fullName?.message}><input autoComplete="name" placeholder="As shown on identity document" {...register('fullName', { required: 'Enter the applicant’s full name.', minLength: { value: 2, message: 'Name must be at least 2 characters.' }, maxLength: { value: 120, message: 'Name is too long.' } })} /></Field>
        <Field label="Date of birth" required error={errors.dob?.message}><input type="date" {...register('dob', { required: 'Enter the applicant’s date of birth.', validate: (value) => value <= new Date().toISOString().slice(0, 10) || 'Date of birth cannot be in the future.' })} /></Field>
        <Field label="Gender" required error={errors.gender?.message}><select {...register('gender', { required: 'Select a gender.' })}><option value="">Select</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></Field>
        <Field label="PAN number" required hint="10 characters · PAN is masked in application lists." error={errors.panNumber?.message}><input className="input-uppercase" autoComplete="off" maxLength={10} placeholder="ABCDE1234F" {...register('panNumber', { required: 'Enter a PAN number.', pattern: { value: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: 'Enter a 10-character PAN format.' } })} /></Field>
        <Field label="Aadhaar last 4 digits" required hint="Only four digits are collected." error={errors.aadhaarLast4?.message}><input inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0000" {...register('aadhaarLast4', { required: 'Enter the last four digits.', pattern: { value: /^\d{4}$/, message: 'Enter exactly four digits.' } })} /></Field>
        <Field label="Mobile number" required error={errors.mobile?.message}><input inputMode="tel" autoComplete="tel-national" maxLength={10} placeholder="9876543210" {...register('mobile', { required: 'Enter a mobile number.', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number.' } })} /></Field>
        <Field label="Email address" required error={errors.email?.message}><input type="email" autoComplete="email" placeholder="name@example.com" {...register('email', { required: 'Enter an email address.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' } })} /></Field>
        <Field label="Occupation" required error={errors.occupationCode?.message}><select {...register('occupationCode', { required: 'Select an occupation.' })}><option value="">Select occupation</option>{occupationOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
        <Field label="Annual income (INR)" required error={errors.annualIncome?.message}><input type="number" min="0" step="1" inputMode="numeric" placeholder="e.g. 900000" {...register('annualIncome', { required: 'Enter annual income.', valueAsNumber: true, min: { value: 0, message: 'Income must be zero or higher.' }, validate: (value) => Number.isFinite(value) || 'Enter a valid amount.' })} /></Field>
      </div></Card>
      <Card className="form-card"><div className="form-section-heading"><div className="form-section-icon form-section-icon-teal"><ShieldCheck size={18} /></div><div><h2>Residential address</h2><p>Provide the current address and postal code.</p></div></div><div className="form-grid">
        <Field label="Address" required className="field-span-2" error={errors.address?.message}><input autoComplete="street-address" placeholder="House / flat, street and area" {...register('address', { required: 'Enter the address.', maxLength: { value: 240, message: 'Address is too long.' } })} /></Field>
        <Field label="City" required error={errors.city?.message}><input autoComplete="address-level2" placeholder="City" {...register('city', { required: 'Enter the city.' })} /></Field>
        <Field label="State" required error={errors.state?.message}><input autoComplete="address-level1" placeholder="State" {...register('state', { required: 'Enter the state.' })} /></Field>
        <Field label="PIN code" required error={errors.pincode?.message}><input inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="400001" {...register('pincode', { required: 'Enter a PIN code.', pattern: { value: /^[1-9]\d{5}$/, message: 'Enter a valid 6-digit PIN code.' } })} /></Field>
      </div></Card>
      <Card className="consent-card"><label className="consent-row"><input type="checkbox" {...register('consentToKyc', { required: 'Consent is required to continue.' })} /><span><strong>Consent to KYC checks</strong><small>I consent to the collection and processing of the details above for this synthetic KYC demonstration.</small></span></label>{errors.consentToKyc && <small className="field-error consent-error">{errors.consentToKyc.message}</small>}</Card>
      <div className="form-actions"><Link className="back-link" to="/dashboard">Cancel</Link><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating application…' : 'Continue to documents'}<ArrowRight size={16} /></Button></div>
      <p className="form-privacy-note"><ShieldCheck size={14} /> Aadhaar is limited to the last four digits. Use synthetic specimen data only.</p>
    </form>
  </>;
}
