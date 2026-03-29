import { NextRequest, NextResponse } from 'next/server';

const AMAP_KEY = process.env.AMAP_KEY || '';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function straightDist(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function parseLoc(v: any): { lng: number; lat: number } {
  if (!v) return { lng: 0, lat: 0 };
  if (typeof v === 'string') { const p = v.split(',').map(Number); return { lng: p[0] || 0, lat: p[1] || 0 }; }
  return v;
}

async function amapFetch(endpoint: string, params: Record<string, string>, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const u = new URL(`https://restapi.amap.com/v3${endpoint}`);
      u.searchParams.set('key', AMAP_KEY);
      u.searchParams.set('output', 'JSON');
      for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
      const res = await fetch(u.toString());
      const d = await res.json();
      if (d.status !== '1') throw new Error(d.info || 'err');
      return d;
    } catch (e: any) {
      if (e.message?.includes('EXCEED') || e.message?.includes('LIMIT')) await delay(800 * (i + 1));
      else if (i >= retries - 1) return null;
      else throw e;
    }
  }
  return null;
}

interface Station { name: string; location: { lng: number; lat: number }; type: string; isTransfer?: boolean }

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pois, city } = body;

  if (!pois?.length) return NextResponse.json({ error: '请至少提供1个景点' }, { status: 400 });
  if (!city) return NextResponse.json({ error: '请提供城市' }, { status: 400 });

  console.log(`[RECOMMEND] city=${city}, pois=${pois.length}`);

  // ============ 第1步：两两查公交路线，提取站点 ============
  const poiRoutes: any[] = [];
  const stationMap = new Map<string, Station>();
  const lineStations: Map<string, Set<string>> = new Map();

  for (let i = 0; i < pois.length; i++) {
    for (let j = i + 1; j < pois.length; j++) {
      console.log(`[Step1] ${pois[i].name} → ${pois[j].name}`);
      const data = await amapFetch('/direction/transit/integrated', {
        origin: `${pois[i].location.lng},${pois[i].location.lat}`,
        destination: `${pois[j].location.lng},${pois[j].location.lat}`,
        city, strategy: '0',
      });
      await delay(250);

      if (!data?.route?.transits?.length) { console.log(`[Step1] no transits`); continue; }

      const transit = data.route.transits[0];
      console.log(`[Step1] duration=${transit?.duration}s, segments=${transit?.segments?.length}`);

      poiRoutes.push({
        from: pois[i].id, to: pois[j].id,
        fromName: pois[i].name, toName: pois[j].name,
        duration: transit?.duration || 0,
        distance: transit?.distance || 0,
        walkingDistance: transit?.walking_distance || 0,
      });

      for (const seg of (transit?.segments || [])) {
        // AMap API v3 公交路线数据在 seg.bus.buslines[0]，不是 seg.transit
        const busline = seg.bus?.buslines?.[0];
        if (!busline) continue; // 纯步行段（buslines 为空数组）

        const isSubway = /地铁线路/.test(busline.type || '');
        const sType = isSubway ? 'subway' : 'bus';
        const lineName = (busline.name || '').split('(')[0].trim();

        if (lineName && isSubway && !lineStations.has(lineName)) lineStations.set(lineName, new Set());

        const addStop = (name: string, loc: any) => {
          if (!name || !loc) return;
          const location = parseLoc(loc);
          if (!location.lng) return;
          if (lineName && isSubway) lineStations.get(lineName)?.add(name);
          if (!stationMap.has(name)) stationMap.set(name, { name, location, type: sType });
        };

        if (busline.departure_stop) addStop(busline.departure_stop.name, busline.departure_stop.location);
        if (Array.isArray(busline.via_stops)) for (const v of busline.via_stops) addStop(v?.name, v?.location);
        if (busline.arrival_stop) addStop(busline.arrival_stop.name, busline.arrival_stop.location);
      }
    }
  }

  // 换乘站标记
  const lineNames = Array.from(lineStations.keys());
  for (let i = 0; i < lineNames.length; i++) {
    for (let j = i + 1; j < lineNames.length; j++) {
      const setA = lineStations.get(lineNames[i])!;
      const setB = lineStations.get(lineNames[j])!;
      for (const name of setA) {
        if (setB.has(name)) { const s = stationMap.get(name); if (s) s.isTransfer = true; }
      }
    }
  }

  const transferStations = Array.from(stationMap.values()).filter(s => s.isTransfer);
  const otherStations = Array.from(stationMap.values())
    .filter(s => !s.isTransfer)
    .sort((a, b) => (a.type === 'subway' ? 0 : 1) - (b.type === 'subway' ? 0 : 1))
    .slice(0, 6);

  let uniqueStations: Station[] = [...transferStations, ...otherStations];

  // 兜底：没有站点时，用几何中心 + 各景点位置
  if (uniqueStations.length === 0) {
    console.log(`[FALLBACK] 没有站点，用几何中心`);
    const center: Station = {
      name: '推荐中心区域',
      location: {
        lng: pois.reduce((s: number, p: any) => s + p.location.lng, 0) / pois.length,
        lat: pois.reduce((s: number, p: any) => s + p.location.lat, 0) / pois.length,
      },
      type: 'center',
    };
    uniqueStations = [center];
    for (const p of pois) {
      uniqueStations.push({ name: `${p.name}附近`, location: p.location, type: 'poi' });
    }
  }

  console.log(`[Step1] search stations: ${uniqueStations.length} → ${uniqueStations.slice(0, 8).map(s => s.name).join(', ')}`);

  // ============ 第2步：搜索住宿 ============
  const allAccommodations: any[] = [];
  const seenIds = new Set<string>();

  for (const station of uniqueStations) {
    const data = await amapFetch('/place/around', {
      location: `${station.location.lng},${station.location.lat}`,
      keywords: '酒店|旅馆|民宿|宾馆|公寓|住宿',
      radius: '2000',
      offset: '20',
      sortrule: 'distance',
    });
    await delay(250);

    const poiList = data?.pois || [];
    console.log(`[Step2] ${station.name}: ${poiList.length} results`);

    for (const poi of poiList) {
      if (seenIds.has(poi.id)) continue;
      seenIds.add(poi.id);
      const loc = parseLoc(poi.location);

      let price: number | undefined;
      const rawCost = poi.biz_ext?.cost;
      if (rawCost) { const p = parseFloat(String(rawCost)); if (!isNaN(p) && p > 0) price = p; }

      let rating: number | undefined;
      const rawRating = poi.biz_ext?.rating;
      if (rawRating) { const r = parseFloat(String(rawRating)); if (!isNaN(r) && r > 0) rating = r; }

      const estDurations: Record<string, number> = {};
      for (const p of pois) {
        const d = straightDist(loc, p.location);
        estDurations[p.id] = d < 800 ? Math.round(d / 80) : Math.round(d / 300);
      }

      const times = pois.map((p: any) => estDurations[p.id]);
      const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
      const variance = times.reduce((s: number, t: number) => s + (t - avg) ** 2, 0) / times.length;

      allAccommodations.push({
        id: poi.id, name: poi.name, address: poi.address || '', location: loc,
        type: poi.type || '', tel: poi.tel, rating, price,
        nearStation: { name: station.name, type: station.type, isTransfer: !!station.isTransfer, distance: parseInt(poi.distance) || 0 },
        _estDurations: estDurations, _estAvg: avg, _estBalance: Math.sqrt(variance),
      });
    }
  }

  console.log(`[Step2] total accommodations: ${allAccommodations.length}`);

  // ============ 第3步：排序取 TOP 15 ============
  allAccommodations.sort((a, b) => {
    if (Math.abs(a._estBalance - b._estBalance) > 5) return a._estBalance - b._estBalance;
    return a._estAvg - b._estAvg;
  });
  const topList = allAccommodations.slice(0, 15);

  // ============ 第4步：TOP 15 查真实路线 ============
  const finalResults: any[] = [];
  for (const acc of topList) {
    const routesToPois: any[] = [];
    const durationsMap: Record<string, number> = {};

    for (const poi of pois) {
      const dist = straightDist(acc.location, poi.location);
      if (dist < 800) {
        const walkMin = Math.round(dist / 80);
        routesToPois.push({ poiId: poi.id, poiName: poi.name, duration: walkMin * 60, distance: dist, walkingDistance: dist });
        durationsMap[poi.id] = walkMin;
      } else {
        const tData = await amapFetch('/direction/transit/integrated', {
          origin: `${acc.location.lng},${acc.location.lat}`,
          destination: `${poi.location.lng},${poi.location.lat}`,
          city, strategy: '0',
        });
        await delay(250);
        const dur = tData?.route?.transits?.[0]?.duration || 0;
        routesToPois.push({
          poiId: poi.id, poiName: poi.name, duration: dur,
          distance: tData?.route?.transits?.[0]?.distance || 0,
          walkingDistance: tData?.route?.transits?.[0]?.walking_distance || 0,
        });
        durationsMap[poi.id] = Math.round(dur / 60);
      }
    }

    const times = pois.map((p: any) => durationsMap[p.id] || 0);
    const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
    const variance = times.reduce((s: number, t: number) => s + (t - avg) ** 2, 0) / times.length;

    const { _estDurations, _estAvg, _estBalance, ...rest } = acc;
    finalResults.push({ ...rest, routesToPois, durationsMap, avgDuration: avg, balance: Math.sqrt(variance) });
  }

  finalResults.sort((a, b) => {
    if (Math.abs(a.balance - b.balance) > 5) return a.balance - b.balance;
    return a.avgDuration - b.avgDuration;
  });

  console.log(`[RESULT] ${finalResults.length} accommodations returned`);

  return NextResponse.json({
    poiRoutes,
    accommodations: finalResults,
    totalFound: allAccommodations.length,
    searchedStations: uniqueStations.slice(0, 10).map(s => ({ name: s.name, type: s.type, isTransfer: !!s.isTransfer })),
  });
}
