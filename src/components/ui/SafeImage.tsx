import React, { useState } from 'react';
import { PawPrint } from 'lucide-react';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectClass?: string;
  zoomOnHover?: boolean;
  fallbackLabel?: string;
}

export function SafeImage({
  src,
  alt,
  className = '',
  aspectClass = 'aspect-[4/3]',
  zoomOnHover = false,
  fallbackLabel,
}: SafeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showFallback = !src || failed;

  return (
    <div
      className={`relative overflow-hidden bg-[#ECE8DF] ${aspectClass} ${className}`}
    >
      {!showFallback ? (
        <>
          {!loaded && (
            <div
              className="absolute inset-0 bg-[#E6E1D6] animate-pulse"
              aria-hidden="true"
            />
          )}
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`w-full h-full object-cover transition-all duration-500 ease-out ${
              loaded ? 'opacity-100' : 'opacity-0'
            } ${zoomOnHover ? 'group-hover:scale-105' : ''}`}
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#EAF2EC] to-[#E2ECE5] text-[#2D6A4F] p-4 text-center">
          <PawPrint className="w-7 h-7 mb-1.5 opacity-75" />
          {fallbackLabel && (
            <span className="text-xs font-medium text-[#1B4332] line-clamp-1">
              {fallbackLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
