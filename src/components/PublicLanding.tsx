/**
 * @file src/components/PublicLanding.tsx
 * @description The main public landing page component rendered at host.okdems.org (root '/').
 * Displays the minimalist OKDEMS Digital Team greeting on a simple Democratic blue background.
 */

import React from 'react';

export const PublicLanding: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0047AB] text-slate-900 flex flex-col justify-center items-center p-6 text-center select-none font-sans">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-8 md:p-12">
        <div className="mb-6 flex justify-center">
          <div className="bg-[#0047AB] text-white px-4 py-2 rounded-xl text-lg font-bold tracking-tight flex items-center gap-2 shadow-md">
            <span className="bg-white text-[#0047AB] px-2 py-0.5 rounded text-sm font-black">OKDEMS</span>
            PDF HOST
          </div>
        </div>
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 leading-relaxed mb-6">
          You've reached a project of the OKDEMS Digital Team, for more info please contact{' '}
          <a
            href="mailto:digitools@okdemocrats.org"
            className="text-[#0047AB] hover:text-blue-800 underline font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
          >
            digitools@okdemocrats.org
          </a>
        </h1>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black border-t border-slate-100 pt-6">
          Oklahoma Democratic Party &bull; Internal Service
        </div>
      </div>
    </div>
  );
};
