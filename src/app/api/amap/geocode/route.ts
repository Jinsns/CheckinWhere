import { NextRequest, NextResponse } from 'next/server';
import { geocodeCity } from '@/lib/amap';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');

    if (!city) {
      return NextResponse.json({ error: '请提供城市名称' }, { status: 400 });
    }

    const result = await geocodeCity(city);

    if (!result) {
      return NextResponse.json({ error: '未找到该城市' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Geocode error:', error);
    return NextResponse.json(
      { error: error.message || '地理编码失败' },
      { status: 500 }
    );
  }
}
