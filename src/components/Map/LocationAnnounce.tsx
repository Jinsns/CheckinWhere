'use client';

import { useEffect, useState, useRef } from 'react';
import './LocationAnnounce.css';

interface Props {
  locationName: string | null;
}

type Phase = 'idle' | 'reveal' | 'fade' | 'settled';

export default function LocationAnnounce({ locationName }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!locationName) {
      setPhase('idle');
      setDisplayName(null);
      return;
    }

    setDisplayName(locationName);
    setPhase('reveal');

    const t1 = setTimeout(() => setPhase('fade'), 2000);
    const t2 = setTimeout(() => setPhase('settled'), 2700);
    timersRef.current = [t1, t2];

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [locationName]);

  if (phase === 'idle' || !displayName) return null;

  const isFading = phase === 'fade';

  return (
    <div className="location-announce">
      {(phase === 'reveal' || phase === 'fade') && (
        // 背景层：仅做透明度淡出
        <div className={`la-backdrop ${isFading ? 'la-backdrop-out' : 'la-backdrop-in'}`}>
          {/* 文字层：淡出时向左上角飞走 */}
          <div className={`la-content ${isFading ? 'la-content-out' : 'la-content-in'}`}>
            <div className="la-subtitle">你来到了</div>
            <div className="la-text">{displayName}</div>
          </div>
        </div>
      )}
      {phase === 'settled' && (
        <div className="la-tag">
          <span className="la-tag-dot" />
          <span className="la-tag-name">{displayName}</span>
        </div>
      )}
    </div>
  );
}
