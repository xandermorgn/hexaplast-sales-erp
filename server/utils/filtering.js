/**
 * Returns a SQL fragment + params to restrict data visibility:
 * - main employees & admins: see all data (no filter)
 * - sub employees: see only own data (created_by = user_id)
 * - regular employees: not expected to call sales endpoints
 */
export function buildVisibilityFilter(req, createdByColumn = 'created_by') {
  if (!req?.user) return { clause: '', params: [] };
  const { role, role_type, id } = req.user;
  // master_admin or main employees see everything
  if (role === 'master_admin' || role_type === 'main') {
    return { clause: '', params: [] };
  }
  // sub employees see only own data
  if (role === 'employee' && role_type === 'sub') {
    return { clause: ` AND ${createdByColumn} = ?`, params: [id] };
  }
  // fallback: no extra filter (regular employees shouldn't hit sales endpoints,
  // but if they do, show nothing by returning impossible condition)
  if (role === 'employee' && role_type === 'regular') {
    return { clause: ` AND ${createdByColumn} = ?`, params: [id] };
  }
  return { clause: '', params: [] };
}

export function buildDateFilter(queryParams = {}, columnName = 'created_at', createdByColumn = 'created_by') {
  const clauses = [];
  const params = [];

  const fromDate = queryParams?.from_date;
  const toDate = queryParams?.to_date;
  const createdBy = queryParams?.created_by;

  if (fromDate) {
    clauses.push(`date(${columnName}) >= date(?)`);
    params.push(fromDate);
  }

  if (toDate) {
    clauses.push(`date(${columnName}) <= date(?)`);
    params.push(toDate);
  }

  if (createdBy !== undefined && createdBy !== null && createdBy !== '') {
    const parsed = Number.parseInt(String(createdBy), 10);
    if (!Number.isNaN(parsed)) {
      clauses.push(`${createdByColumn} = ?`);
      params.push(parsed);
    }
  }

  return {
    clause: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  };
}
