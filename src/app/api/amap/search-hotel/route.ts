import { NextRequest, NextResponse } from 'next/server';
import { searchHotels } from '@/lib/amap';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lng = parseFloat(searchParams.get('lng') || '0');
    const lat = parseFloat(searchParams.get('lat') || '0');
    const radius = parseInt(searchParams.get('radius') || '3000');

    if (!lng || !lat) {
      return NextResponse.json({ error: '请提供有效的位置坐标' }, { status: 400 });
    }

    const result = await searchHotels({ lng, lat }, radius);

    return NextResponse.json({ hotels: result });
  } catch (error: any) {
    console.error('Hotel search error:', error);
    return NextResponse.json(
      { error: error.message || '酒店搜索失败' },
      { status: 500 }
    );
  }
}
