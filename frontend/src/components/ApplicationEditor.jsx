import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, X } from 'lucide-react';
import { updateApplication } from '../api/applicationApi.js';
import { getApiError } from '../api/client.js';
import { Button, Card, Field } from './UI.jsx';

export default function ApplicationEditor({ application, onSaved, onCancel }) {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ mode: 'onTouched' });
  useEffect(() => {
    reset({ ...application.personalDetails, ...application.addressDetails, annualIncome: application.personalDetails?.annualIncome ?? '', consentToKyc: application.personalDetails?.consentToKyc === true });
  }, [application, reset]);
  async function submit(values) {
    setServerError('');
    const payload = {
      personalDetails: { fullName: values.fullName.trim(), dob: values.dob, gender: values.gender, panNumber: values.panNumber.trim().toUpperCase(), aadhaarLast4: values.aadhaarLast4, mobile: values.mobile, email: values.email.trim(), occupationCode: values.occupationCode, annualIncome: Number(values.annualIncome), consentToKyc: values.consentToKyc === true },
      addressDetails: { address: values.address.trim(), city: values.city.trim(), state: values.state.trim(), pincode: values.pincode }
    };
    try { const updated = await updateApplication(application.applicationId, payload); onSaved(updated); }
    catch (error) { setServerError(getApiError(error)); }
  }
  return <Card className="detail-card edit-application-card"><div className="section-heading"><div><h2>Edit application details</h2><p>Save corrected personal or address details before resubmitting.</p></div><Button variant="ghost" size="sm" onClick={onCancel}><X size={16} /> Close</Button></div>
    <form className="form-grid" onSubmit={handleSubmit(submit)} noValidate>
      <Field label="Full name" required error={errors.fullName?.message}><input {...register('fullName', { required: 'Enter full name.' })} /></Field>
      <Field label="Date of birth" required error={errors.dob?.message}><input type="date" {...register('dob', { required: 'Enter date of birth.' })} /></Field>
      <Field label="Gender" required error={errors.gender?.message}><select {...register('gender', { required: 'Select gender.' })}><option value="">Select</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></Field>
      <Field label="PAN number" required error={errors.panNumber?.message}><input maxLength={10} {...register('panNumber', { required: 'Enter PAN.', pattern: { value: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: 'Enter a valid PAN format.' } })} /></Field>
      <Field label="Aadhaar last 4" required error={errors.aadhaarLast4?.message}><input inputMode="numeric" maxLength={4} {...register('aadhaarLast4', { required: 'Enter last four digits.', pattern: { value: /^\d{4}$/, message: 'Enter exactly four digits.' } })} /></Field>
      <Field label="Mobile" required error={errors.mobile?.message}><input inputMode="tel" maxLength={10} {...register('mobile', { required: 'Enter mobile number.', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid mobile number.' } })} /></Field>
      <Field label="Email" required error={errors.email?.message}><input type="email" {...register('email', { required: 'Enter email.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} /></Field>
      <Field label="Occupation code" required error={errors.occupationCode?.message}><input {...register('occupationCode', { required: 'Enter occupation code.' })} /></Field>
      <Field label="Annual income (INR)" required error={errors.annualIncome?.message}><input type="number" min="0" step="1" {...register('annualIncome', { required: 'Enter annual income.', valueAsNumber: true, min: { value: 0, message: 'Income must be zero or higher.' }, validate: (value) => Number.isFinite(value) || 'Enter a valid amount.' })} /></Field>
      <Field label="Address" required className="field-span-2" error={errors.address?.message}><input {...register('address', { required: 'Enter address.' })} /></Field>
      <Field label="City" required error={errors.city?.message}><input {...register('city', { required: 'Enter city.' })} /></Field>
      <Field label="State" required error={errors.state?.message}><input {...register('state', { required: 'Enter state.' })} /></Field>
      <Field label="PIN code" required error={errors.pincode?.message}><input inputMode="numeric" maxLength={6} {...register('pincode', { required: 'Enter PIN code.', pattern: { value: /^[1-9]\d{5}$/, message: 'Enter a valid 6-digit PIN.' } })} /></Field>
      <div className="field-span-2"><label className="checkbox-row"><input type="checkbox" {...register('consentToKyc', { required: 'Consent is required.' })} /> I confirm consent to KYC processing remains active.</label>{errors.consentToKyc && <small className="field-error" role="alert">{errors.consentToKyc.message}</small>}</div>
      {serverError && <div className="form-alert field-span-2" role="alert">{serverError}</div>}
      <div className="edit-form-actions field-span-2"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save updated details'}<Save size={16} /></Button></div>
    </form>
  </Card>;
}
