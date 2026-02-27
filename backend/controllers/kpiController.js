import { getSalesKPIs } from '../utils/kpiCalculator.js';

export function getKpiOverview(req, res) {
  try {
    const kpis = getSalesKPIs();
    return res.status(200).json(kpis);
  } catch (error) {
    console.error('Get KPI overview error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch KPI overview',
    });
  }
}
