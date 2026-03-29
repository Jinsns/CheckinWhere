import { NextRequest, NextResponse } from 'next/server';
import { planTransfer } from '@/lib/amap';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const originLng = parseFloat(searchParams.get('originLng') || '0');
    const originLat = parseFloat(searchParams.get('originLat') || '0');
    const destLng = parseFloat(searchParams.get('destLng') || '0');
    const destLat = parseFloat(searchParams.get('destLat') || '0');
    const city = searchParams.get('city') || '';

    if (!originLng || !originLat || !destLng || !destLat || !city) {
      return NextResponse.json({ error: '请提供完整的起点、终点坐标和城市' }, { status: 400 });
    }

    const result = await planTransfer(
      { lng: originLng, lat: originLat },
      { lng: destLng, lat: destLat },
      city
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Transfer planning error:', error);
    return NextResponse.json(
      { error: error.message || '路径规划失败' },
      { status: 500 }
    );
  }
}
