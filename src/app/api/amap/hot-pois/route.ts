import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');

  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }

  const key = process.env.AMAP_KEY;
  if (!key) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // 使用 sortrule=1（综合权重/热度排序），搜索该城市热门景点
    const url = `https://restapi.amap.com/v3/place/text?key=${key}&keywords=景点&types=110000&city=${encodeURIComponent(city)}&citylimit=true&offset=12&page=1&sortrule=1&extensions=base`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== '1' || !Array.isArray(data.pois)) {
      return NextResponse.json({ pois: [] });
    }

    const pois = data.pois.map((p: any) => {
      const [lng, lat] = (p.location as string).split(',').map(Number);
      return {
        id: p.id as string,
        name: p.name as string,
        address: (p.address as string) || '',
        location: { lng, lat },
        type: (p.type as string) || '',
        typecode: p.typecode as string,
        rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : undefined,
      };
    });

    return NextResponse.json({ pois });
  } catch (e) {
    return NextResponse.json({ pois: [] });
  }
}
