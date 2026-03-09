import { NextResponse } from 'next/server';
import { getCountries } from '../../../../server/services/geoService.js';

export async function GET() {
  try {
    const countries = getCountries();
    return NextResponse.json(countries);
  } catch (error) {
    console.error('Geo countries error:', error);
    return NextResponse.json({ error: 'Failed to load countries' }, { status: 500 });
  }
}
