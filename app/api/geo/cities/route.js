import { NextResponse } from 'next/server';
import { getCitiesByState } from '../../../../server/services/geoService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stateId = searchParams.get('state_id');

    if (!stateId) {
      return NextResponse.json({ error: 'state_id is required' }, { status: 400 });
    }

    const cities = getCitiesByState(stateId);
    return NextResponse.json(cities);
  } catch (error) {
    console.error('Geo cities error:', error);
    return NextResponse.json({ error: 'Failed to load cities' }, { status: 500 });
  }
}
