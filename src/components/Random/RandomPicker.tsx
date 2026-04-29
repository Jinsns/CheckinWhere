'use client';

import { useState } from 'react';
import { Button, message, Spin } from 'antd';
import { ThunderboltOutlined, GlobalOutlined, ReloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useAppContext } from '@/store/AppContext';
import type { City } from '@/types';
import './RandomPicker.css';

const PROVINCES: { name: string; cities: string[] }[] = [
  { name: '北京', cities: ['北京'] },
  { name: '天津', cities: ['天津'] },
  { name: '上海', cities: ['上海'] },
  { name: '重庆', cities: ['重庆', '万州', '涪陵', '永川', '江津', '合川'] },
  { name: '河北', cities: ['石家庄', '唐山', '秦皇岛', '邯郸', '保定', '张家口', '承德', '廊坊', '沧州', '衡水'] },
  { name: '山西', cities: ['太原', '大同', '朔州', '忻州', '阳泉', '晋中', '长治', '晋城', '吕梁', '临汾', '运城'] },
  { name: '内蒙古', cities: ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布'] },
  { name: '辽宁', cities: ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭'] },
  { name: '吉林', cities: ['长春', '吉林市', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'] },
  { name: '黑龙江', cities: ['哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '鸡西', '双鸭山', '伊春', '黑河', '绥化'] },
  { name: '江苏', cities: ['南京', '苏州', '无锡', '常州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'] },
  { name: '浙江', cities: ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'] },
  { name: '安徽', cities: ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'] },
  { name: '福建', cities: ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'] },
  { name: '江西', cities: ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'] },
  { name: '山东', cities: ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'] },
  { name: '河南', cities: ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'] },
  { name: '湖北', cities: ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施'] },
  { name: '湖南', cities: ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'] },
  { name: '广东', cities: ['广州', '深圳', '珠海', '汕头', '韶关', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'] },
  { name: '广西', cities: ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'] },
  { name: '海南', cities: ['海口', '三亚', '儋州', '琼海', '万宁', '文昌', '五指山', '陵水'] },
  { name: '四川', cities: ['成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳'] },
  { name: '贵州', cities: ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁'] },
  { name: '云南', cities: ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'] },
  { name: '西藏', cities: ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'] },
  { name: '陕西', cities: ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'] },
  { name: '甘肃', cities: ['兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏', '甘南'] },
  { name: '青海', cities: ['西宁', '海东', '海北', '黄南', '海南州', '果洛', '玉树', '海西'] },
  { name: '宁夏', cities: ['银川', '石嘴山', '吴忠', '固原', '中卫'] },
  { name: '新疆', cities: ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰'] },
];

interface RandomPickerProps {
  onCityFound: (city: City) => void;
}

export default function RandomPicker({ onCityFound }: RandomPickerProps) {
  const { dispatch } = useAppContext();
  const [mode, setMode] = useState<'province' | 'coord'>('province');
  const [loading, setLoading] = useState(false);
  const [province, setProvince] = useState<typeof PROVINCES[0] | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [coordInfo, setCoordInfo] = useState<{ province: string; formatted_address: string } | null>(null);

  const applyCity = (cityData: City) => {
    dispatch({ type: 'SET_CITY', payload: cityData });
    dispatch({ type: 'SET_MAP_CENTER', payload: cityData.location });
    dispatch({ type: 'SET_MAP_ZOOM', payload: 12 });
    dispatch({ type: 'CLEAR_POIS' });
    onCityFound(cityData);
    message.success(`已定位到 ${cityData.name}`);
  };

  const geocodeAndApply = async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/amap/geocode?city=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error('定位失败');
      const cityData: City = await res.json();
      applyCity(cityData);
    } catch {
      message.error('定位失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const rollProvince = () => {
    const p = PROVINCES[Math.floor(Math.random() * PROVINCES.length)];
    setProvince(p);
    setCity(null);
    geocodeAndApply(p.name);
  };

  const rollCity = () => {
    if (!province) return;
    const c = province.cities[Math.floor(Math.random() * province.cities.length)];
    setCity(c);
    geocodeAndApply(c);
  };

  const rollCoord = async () => {
    setLoading(true);
    setCoordInfo(null);
    try {
      const res = await fetch('/api/amap/random-location');
      if (!res.ok) throw new Error('选点失败');
      const data = await res.json();
      setCoordInfo({ province: data.province, formatted_address: data.formatted_address });
      applyCity(data);
    } catch {
      message.error('随机选点失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="random-picker">
      <div className="rp-header">
        <span className="rp-title">✨ 选择困难？让缘分来定</span>
      </div>

      <div className="rp-tabs">
        <button
          className={`rp-tab ${mode === 'province' ? 'active' : ''}`}
          onClick={() => setMode('province')}
        >
          🗺️ 按省市随机
        </button>
        <button
          className={`rp-tab ${mode === 'coord' ? 'active' : ''}`}
          onClick={() => setMode('coord')}
        >
          🎯 按坐标随机
        </button>
      </div>

      <Spin spinning={loading}>
        {mode === 'province' ? (
          <div className="rp-province">
            <Button
              className="rp-roll-btn"
              icon={<ThunderboltOutlined />}
              onClick={rollProvince}
              loading={loading}
              block
            >
              随机一个省份
            </Button>

            {province && (
              <div className="rp-result">
                <div className="rp-result-row">
                  <span className="rp-label">省份</span>
                  <span className="rp-value province-tag">{province.name}</span>
                </div>
                {city && (
                  <div className="rp-result-row">
                    <span className="rp-label">城市</span>
                    <span className="rp-value city-tag">{city}</span>
                  </div>
                )}
                <Button
                  className="rp-city-btn"
                  icon={<ReloadOutlined />}
                  onClick={rollCity}
                  loading={loading}
                  block
                >
                  再随机一个城市
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rp-coord">
            <div className="rp-coord-desc">在中国大陆范围内随机投放一个坐标点，看看命运把你送到哪里</div>
            <Button
              className="rp-roll-btn coord"
              icon={<GlobalOutlined />}
              onClick={rollCoord}
              loading={loading}
              block
            >
              🎲 随机投骰
            </Button>

            {coordInfo && (
              <div className="rp-result">
                <div className="rp-result-row">
                  <EnvironmentOutlined style={{ color: '#FF2442' }} />
                  <span className="rp-addr">{coordInfo.formatted_address || `${coordInfo.province}境内随机点`}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Spin>
    </div>
  );
}
