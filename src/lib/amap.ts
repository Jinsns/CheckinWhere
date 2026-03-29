// 高德地图 Web服务 API 封装 (服务端使用)

const AMAP_KEY = process.env.AMAP_KEY || '';

const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

interface GeocodeResult {
  status: string;
  info: string;
  geocodes: Array<{
    formatted_address: string;
    location: string;
    level: string;
    adcode: string;
    addressComponent?: {
      city?: string;
      province?: string;
      district?: string;
    };
  }>;
}

interface POIResult {
  status: string;
  info: string;
  pois: Array<{
    id: string;
    name: string;
    address: string;
    location: string;
    type: string;
    typecode: string;
    tel?: string;
    biz_ext?: {
      rating?: string;
      cost?: string;
    };
    photos?: Array<{ url: string }>;
  }>;
}

interface TransferResult {
  status: string;
  info: string;
  route: {
    transits: Array<{
      cost: number;
      distance: number;
      duration: number;
      walking_distance: number;
      segments: Array<{
        instruction: string;
        distance: number;
        time: number;
        transit_mode: string;
        transit?: {
          lines: Array<{ name: string }>;
          departure_stop?: { name: string };
          arrival_stop?: { name: string };
          via_stops?: unknown[];
        };
      }>;
    }>;
  };
}

async function fetchAmap<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${AMAP_BASE_URL}${endpoint}`);
  url.searchParams.set('key', AMAP_KEY);
  url.searchParams.set('output', 'JSON');

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`高德地图 API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== '1') {
    throw new Error(data.info || '高德地图 API 返回错误');
  }

  return data;
}

// 地理编码：城市名转坐标
export async function geocodeCity(cityName: string) {
  const result = await fetchAmap<GeocodeResult>('/geocode/geo', {
    address: cityName,
  });

  if (result.geocodes && result.geocodes.length > 0) {
    const geocode = result.geocodes[0];
    const [lng, lat] = geocode.location.split(',');

    // 获取城市名：优先 city，其次 province，最后用输入的城市名
    const addressComponent = geocode.addressComponent || {};
    const name = addressComponent.city || addressComponent.province || addressComponent.district || cityName;

    return {
      name,
      adcode: geocode.adcode,
      location: { lng: parseFloat(lng), lat: parseFloat(lat) },
      level: geocode.level,
    };
  }

  return null;
}

// POI 搜索
export async function searchPOI(keyword: string, city: string, type = '') {
  const result = await fetchAmap<POIResult>('/place/text', {
    keywords: keyword,
    city: city,
    citylimit: 'true',
    types: type,
    offset: '20',
  });

  if (result.pois) {
    return result.pois.map((poi) => {
      const [lng, lat] = poi.location.split(',');
      return {
        id: poi.id,
        name: poi.name,
        address: poi.address || '',
        location: { lng: parseFloat(lng), lat: parseFloat(lat) },
        type: poi.type || '',
        typecode: poi.typecode,
        tel: poi.tel,
        rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : undefined,
        cost: poi.biz_ext?.cost ? parseFloat(poi.biz_ext.cost) : undefined,
        photos: poi.photos?.map((p) => p.url),
      };
    });
  }

  return [];
}

// 周边酒店搜索
export async function searchHotels(location: { lng: number; lat: number }, radius = 3000) {
  const result = await fetchAmap<POIResult>('/place/around', {
    location: `${location.lng},${location.lat}`,
    keywords: '酒店',
    types: '100100', // 酒店类型
    radius: radius.toString(),
    offset: '20',
  });

  if (result.pois) {
    return result.pois.map((poi) => {
      const [lng, lat] = poi.location.split(',');
      return {
        id: poi.id,
        name: poi.name,
        address: poi.address || '',
        location: { lng: parseFloat(lng), lat: parseFloat(lat) },
        type: poi.type || '',
        tel: poi.tel,
        rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : undefined,
        price: poi.biz_ext?.cost ? parseFloat(poi.biz_ext.cost) : undefined,
        photos: poi.photos?.map((p) => p.url),
      };
    });
  }

  return [];
}

// 公交路径规划
export async function planTransfer(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  city: string
) {
  try {
    const result = await fetchAmap<TransferResult>('/direction/transit/integrated', {
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
      city: city,
      strategy: '0', // 推荐策略
    });

    if (result.route?.transits && result.route.transits.length > 0) {
      const transit = result.route.transits[0];
      return {
        duration: transit.duration,
        distance: transit.distance,
        walkingDistance: transit.walking_distance,
        cost: transit.cost,
      };
    }

    return null;
  } catch (error) {
    console.error('Transfer planning error:', error);
    return null;
  }
}

// 计算几何中心点
export function calculateCenter(locations: Array<{ lng: number; lat: number }>) {
  if (locations.length === 0) {
    return { lng: 0, lat: 0 };
  }

  const sum = locations.reduce(
    (acc, loc) => ({
      lng: acc.lng + loc.lng,
      lat: acc.lat + loc.lat,
    }),
    { lng: 0, lat: 0 }
  );

  return {
    lng: sum.lng / locations.length,
    lat: sum.lat / locations.length,
  };
}
