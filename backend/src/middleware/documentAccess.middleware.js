import Application from '../models/Application.js';
import { HttpError } from '../utils/http.js';

export async function authorizeCustomerUpload(req, _res, next) {
  try {
    const app = await Application.findOne({ applicationId: req.params.applicationId });
    if (!app) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
    if (String(app.userId) !== String(req.user._id)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this application');
    if (!['SUBMITTED', 'RESUBMISSION_REQUESTED'].includes(app.status)) throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Documents cannot be uploaded in the current application status');
    next();
  } catch (error) { next(error); }
}
