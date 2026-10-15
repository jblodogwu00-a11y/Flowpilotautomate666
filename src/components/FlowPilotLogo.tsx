import React, { useEffect, useState } from 'react';

export const CUSTOM_LOGO_STORAGE_KEY = 'flowpilot_custom_brand_logo_v1';
export const CUSTOM_LOGO_EVENT = 'flowpilot-brand-logo-updated';

export function getStoredCustomLogo(): string | null {
  try {
    return localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredCustomLogo(dataUrl: string | null): void {
  try {
    if (dataUrl) {
      localStorage.setItem(CUSTOM_LOGO_STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(CUSTOM_LOGO_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

interface FlowPilotLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export const FlowPilotLogo: React.FC<FlowPilotLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() =>
    getStoredCustomLogo()
  );

  useEffect(() => {
    const handleLogoChange = () => {
      setCustomLogoUrl(getStoredCustomLogo());
    };
    window.addEventListener(CUSTOM_LOGO_EVENT, handleLogoChange);
    window.addEventListener('storage', handleLogoChange);
    return () => {
      window.removeEventListener(CUSTOM_LOGO_EVENT, handleLogoChange);
      window.removeEventListener('storage', handleLogoChange);
    };
  }, []);

  const iconDimensions =
    size === 'sm'
      ? 'w-6 h-6'
      : size === 'lg'
      ? 'w-10 h-10'
      : 'w-8 h-8';

  const textSize =
    size === 'sm'
      ? 'text-sm sm:text-base'
      : size === 'lg'
      ? 'text-2xl sm:text-3xl'
      : 'text-xl sm:text-2xl';

  const primaryTextColor = variant === 'dark' ? 'text-white' : 'text-[#0F172A]';
  const accentTextColor = variant === 'dark' ? 'text-emerald-400' : 'text-[#047857]';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      {customLogoUrl ? (
        <img
          src={customLogoUrl}
          alt="FlowPilot Brand Logo"
          referrerPolicy="no-referrer"
          className={`${
            size === 'sm' ? 'h-6' : size === 'lg' ? 'h-10' : 'h-8'
          } w-auto object-contain shrink-0`}
        />
      ) : (
        <div
          className={`${iconDimensions} relative flex items-center justify-center rounded-xl bg-[#0F172A] border border-amber-500/40 shadow-xs shrink-0 overflow-hidden`}
        >
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full p-1"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="fpClassicBrass"
                x1="12"
                y1="12"
                x2="108"
                y2="108"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient
                id="fpEmeraldFacet"
                x1="36"
                y1="20"
                x2="84"
                y2="100"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="55%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>

            {/* Outer Horological Precision Ring */}
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="url(#fpClassicBrass)"
              strokeWidth="3.2"
              strokeDasharray="6 4"
            />
            <circle
              cx="60"
              cy="60"
              r="41"
              stroke="#10B981"
              strokeOpacity="0.45"
              strokeWidth="2.2"
            />

            {/* Cardinal Chronometer Ticks */}
            <path
              d="M60 6V16M60 104V114M6 60H16M104 60H114"
              stroke="#F59E0B"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Classic Compass Rose & Emerald Jewel Facets */}
            <path
              d="M60 20L76 60L60 100L44 60L60 20Z"
              fill="url(#fpEmeraldFacet)"
              stroke="url(#fpClassicBrass)"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path
              d="M20 60L60 44L100 60L60 76L20 60Z"
              fill="#0F172A"
              fillOpacity="0.82"
              stroke="#34D399"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Sovereign Quill / Trajectory Needle */}
            <path
              d="M36 84L84 36M84 36H66M84 36V54"
              stroke="#FEF3C7"
              strokeWidth="4.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Center Horological Jewel Bearing */}
            <circle
              cx="60"
              cy="60"
              r="7.5"
              fill="#F59E0B"
              stroke="#0F172A"
              strokeWidth="3"
            />
          </svg>
        </div>
      )}

      {showWordmark && (
        <span className={`font-display ${textSize} font-bold tracking-tight ${primaryTextColor}`}>
          Flow<span className={accentTextColor}>Pilot</span>
        </span>
      )}
    </span>
  );
};
