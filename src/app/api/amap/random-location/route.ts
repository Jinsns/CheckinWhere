import { NextResponse } from 'next/server';

const AMAP_KEY = process.env.AMAP_KEY || '';

const MAINLAND_PROVINCES = new Set([
  '北京市', '天津市', '上海市', '重庆市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省', '江苏省', '浙江省', '安徽省', '福建省',
  '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区',
  '海南省', '四川省', '贵州省', '云南省', '西藏自治区', '陕西省', '甘肃省',
  '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
]);

export async function GET() {
  for (let attempt = 0; attempt < 25; attempt++) {
    const lng = 73.5 + Math.random() * (135.0 - 73.5);
    const lat = 18.2 + Math.random() * (53.5 - 18.2);

    try {
      const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng.toFixed(6)},${lat.toFixed(6)}&output=JSON`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== '1') continue;

      const info = data.regeocode?.addressComponent;
      if (!info) continue;

      const province = info.province;
      if (!province || typeof province !== 'string') continue;
      if (!MAINLAND_PROVINCES.has(province)) continue;

      // 直辖市 city 字段为 []
      let cityName = info.city;
      if (!cityName || Array.isArray(cityName) || cityName === '') {
        cityName = province;
      }

      const displayName = typeof cityName === 'string'
        ? cityName.replace(/市$/, '')
        : province.replace(/省$|市$|自治区.*$/, '');

      return NextResponse.json({
        name: displayName,
        adcode: info.adcode || '',
        location: { lng, lat },
        level: 'district',
        province: province.replace(/省$|市$|自治区.*$/, ''),
        formatted_address: data.regeocode?.formatted_address || '',
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: '随机选点失败，请重试' }, { status: 500 });
}
