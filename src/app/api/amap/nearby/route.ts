import { NextRequest, NextResponse } from 'next/server';

const CATEGORIES = [
  { key: 'attraction', name: '景点', types: '110000', icon: '🎭' },
  { key: 'hotel',      name: '住宿', types: '100000', icon: '🛎️' },
  { key: 'restaurant', name: '餐厅', types: '050000', icon: '🍴' },
  { key: 'shopping',   name: '购物', types: '060000', icon: '🛍️' },
];

const DISPLAY_PER_DISTRICT = 6;   // 每个行政区每类展示数量
const CANDIDATES_PER_DISTRICT = 20; // 每个区每类拉取候选数量
const DISTRICT_RADIUS = '2500';    // 以区中心搜索的半径（米）
const MAX_DISTRICTS = 8;           // 最多取几个行政区

interface NearbyPOI {
  id: string;
  name: string;
  location: { lng: number; lat: number };
}

function distSq(a: NearbyPOI, b: NearbyPOI): number {
  const dlng = a.location.lng - b.location.lng;
  const dlat = a.location.lat - b.location.lat;
  return dlng * dlng + dlat * dlat;
}

/** 贪心最远点采样，保证同一区内 N 个标记分布均匀 */
function selectDistributed(pois: NearbyPOI[], count: number): NearbyPOI[] {
  if (pois.length <= count) return pois;
  const selected: NearbyPOI[] = [pois[0]];
  const remaining = pois.slice(1);
  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDist = -1;
    for (let i = 0; i < remaining.length; i++) {
      const minDist = Math.min(...selected.map((s) => distSq(remaining[i], s)));
      if (minDist > bestMinDist) { bestMinDist = minDist; bestIdx = i; }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  return selected;
}

/** 在指定坐标附近搜索某类 POI 候选 */
async function fetchPOIs(
  key: string, lng: number, lat: number, types: string, limit: number
): Promise<NearbyPOI[]> {
  try {
    const url = `https://restapi.amap.com/v3/place/around?key=${key}&location=${lng},${lat}&types=${types}&radius=${DISTRICT_RADIUS}&offset=${limit}&page=1&extensions=base`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.pois)) return [];
    return data.pois.map((p: any) => {
      const [pLng, pLat] = (p.location as string).split(',').map(Number);
      return { id: p.id as string, name: p.name as string, location: { lng: pLng, lat: pLat } };
    });
  } catch { return []; }
}

/** 通过 adcode 查询城市下的行政区列表（取中心坐标） */
async function fetchDistricts(
  key: string, adcode: string
): Promise<Array<{ name: string; center: { lng: number; lat: number } }>> {
  try {
    const url = `https://restapi.amap.com/v3/config/district?keywords=${adcode}&subdistrict=1&extensions=base&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    const subs: any[] = data.districts?.[0]?.districts ?? [];
    return subs
      .filter((d: any) => d.center)
      .slice(0, MAX_DISTRICTS)
      .map((d: any) => {
        const [dLng, dLat] = (d.center as string).split(',').map(Number);
        return { name: d.name as string, center: { lng: dLng, lat: dLat } };
      });
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const adcode = searchParams.get('adcode') ?? '';

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const key = process.env.AMAP_KEY;
  if (!key) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  // 获取行政区列表；若无 adcode 则退化为以城市中心单点搜索
  let districts = adcode ? await fetchDistricts(key, adcode) : [];
  if (districts.length === 0) {
    districts = [{ name: '', center: { lng: Number(lng), lat: Number(lat) } }];
  }

  // 每个类别：并行在各行政区搜索，汇总去重
  const results = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const seen = new Set<string>();
      const allPois: NearbyPOI[] = [];

      await Promise.all(
        districts.map(async (district) => {
          const candidates = await fetchPOIs(
            key, district.center.lng, district.center.lat,
            cat.types, CANDIDATES_PER_DISTRICT
          );
          const selected = selectDistributed(candidates, DISPLAY_PER_DISTRICT);
          for (const p of selected) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              allPois.push(p);
            }
          }
        })
      );

      return { ...cat, pois: allPois };
    })
  );

  return NextResponse.json({ categories: results });
}
