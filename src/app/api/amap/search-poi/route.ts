import { NextRequest, NextResponse } from 'next/server';
import { searchPOI } from '@/lib/amap';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');
    const city = searchParams.get('city');
    const type = searchParams.get('type') || '';

    if (!keyword || !city) {
      return NextResponse.json({ error: '请提供关键词和城市' }, { status: 400 });
    }

    const result = await searchPOI(keyword, city, type);

    return NextResponse.json({ pois: result });
  } catch (error: any) {
    console.error('POI search error:', error);
    return NextResponse.json(
      { error: error.message || 'POI搜索失败' },
      { status: 500 }
    );
  }
}
