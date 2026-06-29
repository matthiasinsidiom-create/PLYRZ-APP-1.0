import React from 'react';

interface SponsorBoxProps {
  type: 'MATCH' | 'MVP';
  sponsorName: string;
  sponsorLogoUrl?: string | null;
  className?: string;
}

export const SponsorBox: React.FC<SponsorBoxProps> = ({ type, sponsorName, sponsorLogoUrl, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center bg-zinc-900 border border-amber-500/30 rounded-[24px] shadow-[0_0_30px_rgba(251,191,36,0.15)] min-w-[320px] w-full h-[180px] relative overflow-hidden ${className}`}>
      {/* Background glow */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-4 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80 mb-2 whitespace-nowrap">
          {type} PRÄSENTIERT VON
        </span>
        
        {sponsorLogoUrl ? (
          <div className="w-[220px] h-[90px] flex items-center justify-center mb-2 shrink-0">
            <img 
               src={sponsorLogoUrl} 
               alt={sponsorName} 
               className="w-full h-full object-contain drop-shadow-xl" 
               crossOrigin="anonymous" 
               referrerPolicy="no-referrer"
            />
          </div>
        ) : null}
        
        <span className={`${sponsorLogoUrl ? 'text-sm' : 'text-xl'} font-black text-white italic uppercase tracking-wider text-center line-clamp-2 leading-tight w-full max-w-[280px]`}>
          {sponsorName}
        </span>
      </div>
    </div>
  );
};
