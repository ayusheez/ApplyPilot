import { API_BASE_URL } from "./auth";
import { createApiClient } from "./http-client";
export { ApiError } from "./http-client";
const client = createApiClient(API_BASE_URL);
export const { listApplications, getApplication, createApplication, updateApplication, deleteApplication, saveImport, analyseEmail } = client;
