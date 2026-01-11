import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const FUNCTION_MAP = {
  '/api/weekends': 'getWeekends',
  '/api/holidays': 'getHolidays',
  '/api/season': 'getSeason',
  '/api/isApproved': 'isApproved'
};

export async function api(path, options = {}) {
  const [pathname, queryString] = path.split('?');
  const fnName = FUNCTION_MAP[pathname] || pathname.split('/').filter(Boolean).pop();
  
  if (!functions) throw new Error("Firebase Functions not initialized");

  const callable = httpsCallable(functions, fnName);

  // Build payload from query/body
  const params = new URLSearchParams(queryString);
  let bodyData = {};
  if (options.body) {
    try { bodyData = JSON.parse(options.body); } catch (_) { bodyData = {}; }
  }
  const payload = { ...Object.fromEntries(params.entries()), ...bodyData };

  const result = await callable(payload);
  return result?.data || {};
}
