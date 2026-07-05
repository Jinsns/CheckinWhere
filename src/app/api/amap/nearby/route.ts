import { NextRequest, NextResponse } from 'next/server';

const ATTRACTION_CATEGORY = { key: 'attraction', name: '景点', types: '110000', icon: '🎭' };
const TARGET_ATTRACTION_COUNT = 20;
const AMAP_PAGE_SIZE = 25;

interface NearbyPOI {
  id: string;
  name: string;
  location: { lng: number; lat: number };
}

async function fetchAttractionsByCity(key: string, city: string): Promise<NearbyPOI[]> {
  const seen = new Set<string>();
  const attractions: NearbyPOI[] = [];

  for (let page = 1; page <= 2; page++) {
    try {
      const url = `https://restapi.amap.com/v3/place/text?key=${key}&keywords=景点&types=${ATTRACTION_CATEGORY.types}&city=${encodeURIComponent(city)}&citylimit=true&offset=${AMAP_PAGE_SIZE}&page=${page}&sortrule=1&extensions=base`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== '1' || !Array.isArray(data.pois) || data.pois.length === 0) break;

      for (const p of data.pois) {
        if (!p.id || !p.location || seen.has(p.id)) continue;
        const [pLng, pLat] = (p.location as string).split(',').map(Number);
        if (!Number.isFinite(pLng) || !Number.isFinite(pLat)) continue;
        seen.add(p.id);
        attractions.push({ id: p.id as string, name: p.name as string, location: { lng: pLng, lat: pLat } });
      }

      if (attractions.length >= TARGET_ATTRACTION_COUNT) break;
    } catch {
      break;
    }
  }

  return attractions;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city') ?? searchParams.get('adcode') ?? '';

  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }

  const key = process.env.AMAP_KEY;
  if (!key) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const pois = await fetchAttractionsByCity(key, city);

  return NextResponse.json({
    categories: [{ ...ATTRACTION_CATEGORY, pois }],
  });
}
