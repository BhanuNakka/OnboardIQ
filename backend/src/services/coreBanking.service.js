import CoreAccount from '../models/CoreAccount.js';
import Application from '../models/Application.js';
import { recordAudit } from './audit.service.js';
import { randomInt } from 'node:crypto';
export async function createAccount(applicationId, actorId = null) {
  const existing = await CoreAccount.findOne({ applicationId }); if (existing) return existing;
  const app = await Application.findOne({ applicationId }); if (!app) { const e = new Error('Application not found'); e.status = 404; e.code = 'APPLICATION_NOT_FOUND'; throw e; }
  if (!['APPROVED', 'AUTO_APPROVED'].includes(app.status)) { const e = new Error('Application is not approved'); e.status = 409; e.code = 'APPLICATION_NOT_APPROVED'; throw e; }
  let account;
  try { account = await CoreAccount.create({ applicationId, customerId: `CUST-${randomInt(10000000, 99999999)}`, accountNumber: `${randomInt(1000000000, 9999999999)}` }); }
  catch (error) { if (error.code === 11000) { const raced = await CoreAccount.findOne({ applicationId }); if (raced) return raced; } throw error; }
  await recordAudit({ applicationId, actorId, action: 'CORE_ACCOUNT_CREATED', details: { customerId: account.customerId, accountNumber: account.accountNumber } }); return account;
}
