import { NextResponse } from 'next/server';
import { getCurrencies } from '../../../../server/services/geoService.js';

export async function GET() {
  try {
    const currencies = getCurrencies();
    return NextResponse.json(currencies);
  } catch (error) {
    console.error('Geo currencies error:', error);
    return NextResponse.json({ error: 'Failed to load currencies' }, { status: 500 });
  }
}
