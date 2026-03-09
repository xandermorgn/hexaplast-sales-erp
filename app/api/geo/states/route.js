import { NextResponse } from 'next/server';
import { getStatesByCountry } from '../../../../server/services/geoService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get('country_id');

    if (!countryId) {
      return NextResponse.json({ error: 'country_id is required' }, { status: 400 });
    }

    const states = getStatesByCountry(countryId);
    return NextResponse.json(states);
  } catch (error) {
    console.error('Geo states error:', error);
    return NextResponse.json({ error: 'Failed to load states' }, { status: 500 });
  }
}
