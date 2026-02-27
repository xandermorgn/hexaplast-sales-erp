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
