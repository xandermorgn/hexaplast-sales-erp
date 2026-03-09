import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let countriesCache = null;
let statesCache = null;
let citiesCache = null;
let currenciesCache = null;

// Pre-built indexes for fast lookup
let statesByCountry = null; // Map<country_id, state[]>
let citiesByState = null;   // Map<state_id, city[]>

function ensureLoaded() {
  if (countriesCache) return;

  countriesCache = require('../../data/geo/countries.json');
  statesCache = require('../../data/geo/states.json');
  citiesCache = require('../../data/geo/cities.json');
  currenciesCache = require('../../data/geo/currencies.json');

  // Build state index by country_id
  statesByCountry = new Map();
  for (const s of statesCache) {
    const key = s.country_id;
    if (!statesByCountry.has(key)) statesByCountry.set(key, []);
    statesByCountry.get(key).push(s);
  }

  // Build city index by state_id
  citiesByState = new Map();
  for (const c of citiesCache) {
    const key = c.state_id;
    if (!citiesByState.has(key)) citiesByState.set(key, []);
    citiesByState.get(key).push(c);
  }
}

export function getCountries() {
  ensureLoaded();
  return countriesCache;
}

export function getStatesByCountry(countryId) {
  ensureLoaded();
  const id = Number(countryId);
  return statesByCountry.get(id) || [];
}

export function getCitiesByState(stateId) {
  ensureLoaded();
  const id = Number(stateId);
  return citiesByState.get(id) || [];
}

export function getCurrencies() {
  ensureLoaded();
  return currenciesCache;
}
