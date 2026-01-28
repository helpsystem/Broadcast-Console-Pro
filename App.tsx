import React, { useState, useEffect } from 'react';
import { PreFlightCheck } from './components/PreFlightCheck';
import { SlideBuilder } from './components/SlideBuilder';
import { LiveConsole } from './components/LiveConsole';
import { Session, BroadcastOverlayConfig } from './types';

// Initial Mock Data
const INITIAL_SESSION: Session = {
  id: 'session-1',
  title: 'Sunday Morning Service',
  date: new Date(),
  slides: []
};

const INITIAL_OVERLAY: BroadcastOverlayConfig = {
  layout: 'FULL_CAM',
  logoUrl: null,
  showLogo: true,
  lowerThirds: [],
  activeLowerThirdIndex: 0,
  showLowerThird: false,
  lowerThirdSize: 'standard',
  isRotating: false,
  rotationInterval: 15, // seconds
  prayerRequests: [],
  showPrayerTicker: false,
  donations: [],
  activeDonationId: null,
  donationDisplayMode: 'OVERLAY'
};

export type AppLanguage = 'en' | 'fa';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [session, setSession] = useState<Session>(INITIAL_SESSION);
  const [broadcastConfig, setBroadcastConfig] = useState<BroadcastOverlayConfig>(INITIAL_OVERLAY);
  const [lang, setLang] = useState<AppLanguage>('en');
  
  // Shared Active Slide State
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Toggle Language Handler
  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'fa' : 'en');
  };

  const handlePreFlightComplete = (validStream: MediaStream) => {
    setStream(validStream);
    setIsReady(true);
  };

  // Set font class based on language
  const fontClass = lang === 'fa' ? 'font-sans-fa' : 'font-sans-en';
  const dir = lang === 'fa' ? 'rtl' : 'ltr';

  if (!isReady) {
    return <PreFlightCheck onComplete={handlePreFlightComplete} />;
  }

  return (
    <div 
      dir={dir} 
      className={`flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 ${fontClass}`}
    >
      {/* Global Language Toggle (Absolute Position for easy access) */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
         {/* Language Switcher */}
         <button 
           onClick={toggleLang}
           className="bg-slate-800/80 backdrop-blur border border-slate-700 hover:border-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-2 shadow-lg"
         >
           <span>{lang === 'en' ? '🇺🇸 EN' : '🇮🇷 FA'}</span>
           <span className="text-slate-500">⇄</span>
           <span>{lang === 'en' ? '🇮🇷 FA' : '🇺🇸 EN'}</span>
         </button>
      </div>

      {/* Left Sidebar: Builder */}
      <SlideBuilder 
        session={session} 
        setSession={setSession} 
        lang={lang}
        activeSlideIndex={activeSlideIndex}
        onSlideSelect={setActiveSlideIndex}
      />
      
      {/* Right Area: Console */}
      {stream && (
        <LiveConsole 
          session={session} 
          mediaStream={stream} 
          lang={lang}
          broadcastConfig={broadcastConfig}
          setBroadcastConfig={setBroadcastConfig}
          activeSlideIndex={activeSlideIndex}
          onSlideChange={setActiveSlideIndex}
        />
      )}
    </div>
  );
}

export default App;