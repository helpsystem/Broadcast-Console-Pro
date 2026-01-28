import React, { useEffect, useState, useRef } from 'react';
import { Session, Slide, SlideType, BroadcastOverlayConfig, LowerThirdItem, PrayerRequest, DonationItem, LowerThirdSize, SlideContentScripture } from '../types';
import { socketService } from '../services/socketService';
import { useHybridRecorder } from '../hooks/useHybridRecorder';
import { translateText } from '../services/geminiService';
import { AppLanguage } from '../App';

interface LiveConsoleProps {
  session: Session;
  mediaStream: MediaStream;
  lang: AppLanguage;
  broadcastConfig: BroadcastOverlayConfig;
  setBroadcastConfig: React.Dispatch<React.SetStateAction<BroadcastOverlayConfig>>;
  activeSlideIndex: number;
  onSlideChange: (index: number) => void;
}

const DICT = {
    en: {
        live: "LIVE",
        synced: "Devices Synced",
        startRec: "Start REC",
        stopRec: "Stop REC",
        presenterNotes: "Presenter Notes",
        noNotes: "No notes for this slide.",
        songChords: "Song Chords",
        noChords: "No chords available.",
        prev: "Previous",
        next: "Next Slide",
        settings: "Broadcast Settings",
        uploadLogo: "Upload Logo",
        showLogo: "Show Logo",
        infoOverlay: "Information Overlay (Lower Thirds)",
        layout: "Broadcast Layout",
        fullCam: "Full Cam",
        pip: "Picture in Picture",
        split: "Split Screen",
        addItem: "Add New Item",
        title: "Title (Primary)",
        subtitle: "Subtitle (Secondary)",
        autoTranslate: "Auto Translate",
        rotation: "Auto Rotation",
        interval: "Interval (sec)",
        prayerWall: "Prayer Wall",
        showPrayerWall: "Show Prayer Ticker",
        addRequest: "Add Request",
        requestNamePlaceholder: "Name (e.g. Sarah)",
        requestContentPlaceholder: "Prayer request...",
        close: "Close",
        audioTrack: "Backing Track",
        manageRequests: "Manage Requests",
        donations: "Donations & QR",
        donationTitle: "Title (e.g. Offering)",
        donationDesc: "Description",
        donationUrl: "Link / Payment URL",
        donationDuration: "Display Time (sec)",
        addDonation: "Add QR Code",
        show: "Show",
        showing: "Showing...",
        size: "Size",
        sizeSmall: "Small",
        sizeStandard: "Standard",
        sizeLarge: "Large",
        sizeXL: "Extra Large",
        modeCard: "Card",
        modeFull: "Full",
        prevPage: "Prev Page",
        nextPage: "Next Page"
    },
    fa: {
        live: "زنده",
        synced: "دستگاه متصل",
        startRec: "شروع ضبط",
        stopRec: "توقف ضبط",
        presenterNotes: "یادداشت‌های ارائه دهنده",
        noNotes: "یادداشتی وجود ندارد.",
        songChords: "آکوردها",
        noChords: "آکوردی موجود نیست.",
        prev: "قبلی",
        next: "اسلاید بعدی",
        settings: "تنظیمات پخش",
        uploadLogo: "بارگذاری لوگو",
        showLogo: "نمایش لوگو",
        infoOverlay: "زیرنویس اطلاعات (Lower Thirds)",
        layout: "چیدمان پخش",
        fullCam: "تمام صفحه",
        pip: "تصویر در تصویر",
        split: "دو بخشی (کنفرانس)",
        addItem: "افزودن مورد جدید",
        title: "عنوان (اصلی)",
        subtitle: "زیرعنوان (ثانویه)",
        autoTranslate: "ترجمه خودکار",
        rotation: "چرخش خودکار",
        interval: "فاصله زمانی (ثانیه)",
        prayerWall: "دیوار دعا",
        showPrayerWall: "نمایش لیست دعا",
        addRequest: "ثبت درخواست",
        requestNamePlaceholder: "نام (مثلا: مریم از تهران)",
        requestContentPlaceholder: "متن درخواست دعا...",
        close: "بستن",
        audioTrack: "فایل صوتی زمینه",
        manageRequests: "مدیریت لیست",
        donations: "هدایا و بارکد (QR)",
        donationTitle: "عنوان (مثلا: هدیه به خدا)",
        donationDesc: "توضیحات کوتاه",
        donationUrl: "لینک پرداخت",
        donationDuration: "زمان نمایش (ثانیه)",
        addDonation: "افزودن بارکد",
        show: "نمایش",
        showing: "در حال نمایش...",
        size: "اندازه",
        sizeSmall: "کوچک",
        sizeStandard: "استاندارد",
        sizeLarge: "بزرگ",
        sizeXL: "خیلی بزرگ",
        modeCard: "کارت",
        modeFull: "تمام صفحه",
        prevPage: "صفحه قبل",
        nextPage: "صفحه بعد"
    }
};

export const LiveConsole: React.FC<LiveConsoleProps> = ({ session, mediaStream, lang, broadcastConfig, setBroadcastConfig, activeSlideIndex, onSlideChange }) => {
  const t = DICT[lang];
  const [syncedCount, setSyncedCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Sections Toggles
  const [openSection, setOpenSection] = useState<'layout' | 'logo' | 'prayer' | 'lowerthird' | 'donations' | null>('layout');

  // New Item State for Lower Thirds
  const [newItem, setNewItem] = useState<Partial<LowerThirdItem>>({ title: '', subtitle: '' });
  
  // Prayer Wall State
  const [newPrayerName, setNewPrayerName] = useState('');
  const [newPrayerContent, setNewPrayerContent] = useState('');
  
  // Donation State
  const [newDonation, setNewDonation] = useState<Partial<DonationItem>>({ title: '', description: '', url: '', duration: 30 });

  const [isTranslating, setIsTranslating] = useState(false);
  
  // Internal Pagination for Scripture
  const [internalPageIndex, setInternalPageIndex] = useState(0);

  // Ref to access latest session state inside event listeners without re-binding
  const sessionRef = useRef(session);
  const donationTimerRef = useRef<number | null>(null);

  const { isRecording, recordingTime, startRecording, stopRecording, error: recError } = useHybridRecorder(mediaStream);

  // Update ref when session changes
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Reset internal page when active slide changes
  useEffect(() => {
    setInternalPageIndex(0);
  }, [activeSlideIndex]);

  // Rotation Logic for Lower Thirds
  useEffect(() => {
    let interval: any;
    if (broadcastConfig.showLowerThird && broadcastConfig.isRotating && broadcastConfig.lowerThirds.length > 1) {
       interval = setInterval(() => {
          setBroadcastConfig(prev => ({
             ...prev,
             activeLowerThirdIndex: (prev.activeLowerThirdIndex + 1) % prev.lowerThirds.length
          }));
       }, broadcastConfig.rotationInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [broadcastConfig.showLowerThird, broadcastConfig.isRotating, broadcastConfig.lowerThirds.length, broadcastConfig.rotationInterval]);

  useEffect(() => {
    socketService.connect();
    
    const handleConnect = () => setSyncedCount(prev => prev + 1);

    const handleSlideChangeMsg = (data: any) => {
      const slides = sessionRef.current.slides;
      const foundIndex = slides.findIndex(s => s.id === data.slideId);
      if (foundIndex !== -1) {
        onSlideChange(foundIndex);
      }
    };

    socketService.on('connect', handleConnect);
    socketService.on('slide_change', handleSlideChangeMsg);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('slide_change', handleSlideChangeMsg);
    };
  }, []);

  const handleSlideChange = (index: number) => {
    onSlideChange(index);
    const slide = session.slides[index];
    if (slide) {
      socketService.emitSlideChange(slide.id);
    }
  };
  
  // Smart Navigation Handler
  const handleNext = () => {
    const slide = session.slides[activeSlideIndex];
    if (slide && slide.type === SlideType.SCRIPTURE) {
        const content = slide.content as SlideContentScripture;
        if (content.pages && internalPageIndex < content.pages.length - 1) {
            setInternalPageIndex(prev => prev + 1);
            return;
        }
    }
    // Default next slide
    if (activeSlideIndex < session.slides.length - 1) {
        handleSlideChange(activeSlideIndex + 1);
    }
  };

  const handlePrev = () => {
    const slide = session.slides[activeSlideIndex];
    if (slide && slide.type === SlideType.SCRIPTURE) {
        if (internalPageIndex > 0) {
            setInternalPageIndex(prev => prev - 1);
            return;
        }
    }
    // Default prev slide
    if (activeSlideIndex > 0) {
        handleSlideChange(activeSlideIndex - 1);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setBroadcastConfig(prev => ({ ...prev, logoUrl: ev.target!.result as string }));
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Lower Third Helpers
  const handleAddItemImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) setNewItem(prev => ({ ...prev, imageUrl: ev.target!.result as string }));
        };
        reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleAddLowerThird = () => {
      if (!newItem.title) return;
      const item: LowerThirdItem = {
          id: crypto.randomUUID(),
          title: newItem.title,
          subtitle: newItem.subtitle || '',
          imageUrl: newItem.imageUrl
      };
      setBroadcastConfig(prev => ({
          ...prev,
          lowerThirds: [...prev.lowerThirds, item],
          activeLowerThirdIndex: prev.lowerThirds.length // Switch to new item
      }));
      setNewItem({ title: '', subtitle: '', imageUrl: undefined });
  };

  const handleDeleteItem = (id: string) => {
      setBroadcastConfig(prev => ({
          ...prev,
          lowerThirds: prev.lowerThirds.filter(i => i.id !== id),
          activeLowerThirdIndex: 0
      }));
  };

  const handleTranslateNewItem = async () => {
      if (!newItem.title) return;
      setIsTranslating(true);
      // If lang is FA, translate to EN. If EN, translate to FA.
      const target = lang === 'fa' ? 'en' : 'fa';
      const result = await translateText(newItem.title, target);
      if (result) {
          setNewItem(prev => ({ ...prev, subtitle: result }));
      }
      setIsTranslating(false);
  };

  // Prayer Wall Helpers
  const handleAddPrayerRequest = () => {
      if (!newPrayerName.trim() || !newPrayerContent.trim()) return;
      const newRequest: PrayerRequest = {
        id: crypto.randomUUID(),
        name: newPrayerName.trim(),
        content: newPrayerContent.trim()
      };
      setBroadcastConfig(prev => ({
          ...prev,
          prayerRequests: [...prev.prayerRequests, newRequest]
      }));
      setNewPrayerName('');
      setNewPrayerContent('');
  };

  const handleDeletePrayerRequest = (index: number) => {
      setBroadcastConfig(prev => ({
          ...prev,
          prayerRequests: prev.prayerRequests.filter((_, i) => i !== index)
      }));
  };

  // Donation Helpers
  const handleAddDonation = () => {
    if (!newDonation.title || !newDonation.url) return;
    const item: DonationItem = {
      id: crypto.randomUUID(),
      title: newDonation.title,
      description: newDonation.description || '',
      url: newDonation.url,
      duration: newDonation.duration || 30
    };
    setBroadcastConfig(prev => ({
      ...prev,
      donations: [...prev.donations, item]
    }));
    setNewDonation({ title: '', description: '', url: '', duration: 30 });
  };

  const handleTriggerDonation = (id: string, mode: 'OVERLAY' | 'FULLSCREEN') => {
    // If clicking same button for active donation, toggle off
    if (broadcastConfig.activeDonationId === id && broadcastConfig.donationDisplayMode === mode) {
        handleHideDonation();
        return;
    }

    const donation = broadcastConfig.donations.find(d => d.id === id);
    if (!donation) return;

    if (donationTimerRef.current) clearTimeout(donationTimerRef.current);

    setBroadcastConfig(prev => ({ 
        ...prev, 
        activeDonationId: id,
        donationDisplayMode: mode
    }));

    // Auto Hide Logic (Apply to both modes for now based on duration)
    donationTimerRef.current = window.setTimeout(() => {
       setBroadcastConfig(prev => ({ ...prev, activeDonationId: null }));
    }, donation.duration * 1000);
  };

  const handleHideDonation = () => {
    if (donationTimerRef.current) clearTimeout(donationTimerRef.current);
    setBroadcastConfig(prev => ({ ...prev, activeDonationId: null }));
  };

  const handleDeleteDonation = (id: string) => {
    if (broadcastConfig.activeDonationId === id) handleHideDonation();
    setBroadcastConfig(prev => ({
      ...prev,
      donations: prev.donations.filter(d => d.id !== id)
    }));
  };

  const toggleSection = (section: 'layout' | 'logo' | 'prayer' | 'lowerthird' | 'donations') => {
      setOpenSection(prev => prev === section ? null : section);
  };

  const activeSlide = session.slides[activeSlideIndex];
  const activeLowerThird = broadcastConfig.lowerThirds[broadcastConfig.activeLowerThirdIndex];
  const activeDonation = broadcastConfig.donations.find(d => d.id === broadcastConfig.activeDonationId);
  
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper for Lower Third Sizing
  const getLowerThirdSizeClass = (size: LowerThirdSize) => {
    switch (size) {
      case 'small': return 'max-w-md scale-90 origin-bottom-left';
      case 'large': return 'max-w-3xl scale-110 origin-bottom-left';
      case 'xl': return 'max-w-4xl scale-125 origin-bottom-left';
      case 'standard':
      default: return 'max-w-2xl';
    }
  };

  // --- RENDERING HELPERS ---
  const renderSlideContent = () => {
      if (activeSlide?.type === SlideType.SCRIPTURE) {
          const content = activeSlide.content as SlideContentScripture;
          const pages = content.pages || [];
          const currentPage = pages[internalPageIndex];

          if (!currentPage) return null;

          return (
            <div key={currentPage.id} className={`p-8 rounded-2xl ${broadcastConfig.layout === 'FULL_CAM' ? 'bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl' : ''} max-w-4xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <h2 className="text-4xl font-bold text-white mb-6 drop-shadow-xl font-sans-fa leading-normal">
                {currentPage.textPrimary}
                </h2>
                <p className="text-2xl text-slate-200 drop-shadow-lg italic font-serif leading-relaxed opacity-90">
                {currentPage.textSecondary}
                </p>
                <div className="mt-8 text-emerald-400 font-bold tracking-widest uppercase text-sm border-t border-white/10 pt-4 inline-block px-8">
                {currentPage.book} {currentPage.chapter}:{currentPage.verses}
                </div>
                {/* Page Indicator */}
                {pages.length > 1 && (
                    <div className="flex justify-center gap-1 mt-4">
                        {pages.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === internalPageIndex ? 'bg-emerald-500 w-3' : 'bg-slate-600'}`} />
                        ))}
                    </div>
                )}
            </div>
          );
      } else if (activeSlide?.type === SlideType.LYRICS) {
          const content = activeSlide.content as any;
          return (
            <div className="space-y-6 w-full px-12 text-center">
                {content.lines?.map((line: string, i: number) => (
                    <p key={i} className="text-6xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] leading-tight font-sans-fa">
                        {line}
                    </p>
                ))}
            </div>
          );
      } else if (activeSlide?.type === SlideType.MEDIA) {
        const content = activeSlide.content as any;
        if(content.mediaType === 'image' && content.url) {
            return <img src={content.url} className="w-full h-full object-contain drop-shadow-2xl" alt="Media Slide" />
        }
        if(content.mediaType === 'video' && content.url) {
            return (
                <video 
                  src={content.url} 
                  autoPlay={content.isAutoPlay} 
                  loop={content.isLoop} 
                  controls 
                  className="w-full h-full object-contain drop-shadow-2xl" 
                />
            );
        }
        if(content.mediaType === 'audio' && content.url) {
             return (
                 <div className="bg-black/80 backdrop-blur p-8 rounded-2xl border border-slate-700 flex flex-col items-center gap-6 shadow-2xl">
                     <div className="text-6xl animate-pulse">🔊</div>
                     <div className="text-white font-bold text-xl uppercase tracking-widest">Audio Playback</div>
                     <audio 
                        src={content.url} 
                        controls 
                        autoPlay={content.isAutoPlay} 
                        loop={content.isLoop} 
                        className="w-96"
                     />
                 </div>
             );
        }
        return null;
      }
      return null;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 h-full overflow-hidden relative z-0">
      {/* Top Bar */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shadow-md z-20">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse tracking-wider shadow-red-900/50 shadow-lg border border-red-500/50">
              {t.live}
          </div>
          <h1 className={`text-white font-bold text-lg ${lang === 'fa' ? 'font-sans-fa' : ''}`}>{session.title}</h1>
        </div>
        
        <div className="flex items-center gap-6">
           <button
             onClick={() => setShowSettings(!showSettings)}
             className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${showSettings ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
           >
             <span>⚙️</span> {t.settings}
           </button>

           <div className="flex items-center gap-2 text-slate-400 text-xs font-medium bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
             <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
             {syncedCount} {t.synced}
           </div>

           <div className="flex items-center gap-3">
             {isRecording && (
                <div className="text-red-400 font-mono font-bold text-lg tabular-nums">
                  {formatTime(recordingTime)}
                </div>
             )}
             
             {!isRecording ? (
                <button 
                  onClick={() => startRecording()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-2 shadow-lg hover:shadow-red-900/20"
                >
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  {t.startRec}
                </button>
             ) : (
                <button 
                  onClick={() => stopRecording()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-lg font-medium text-xs transition border border-slate-600"
                >
                  {t.stopRec}
                </button>
             )}
           </div>
        </div>
      </div>

      {/* Broadcast Settings Panel */}
      {showSettings && (
         <div className="absolute top-16 right-0 w-80 bg-slate-900/95 backdrop-blur-md border-l border-b border-slate-700 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right-10 duration-200 overflow-y-auto max-h-[calc(100vh-4rem)]">
            
            {/* 1. Layout Section */}
            <div className="border-b border-slate-800">
               <button onClick={() => toggleSection('layout')} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition">
                  <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-blue-400">
                    <span>📺</span> {t.layout}
                  </h3>
                  <span className={`text-slate-500 text-xs transition-transform ${openSection === 'layout' ? 'rotate-180' : ''}`}>▼</span>
               </button>
               {openSection === 'layout' && (
                 <div className="p-4 pt-0 grid grid-cols-3 gap-2">
                    {[
                        { id: 'FULL_CAM', label: t.fullCam, icon: '📷' },
                        { id: 'PIP', label: t.pip, icon: '🖼️' },
                        { id: 'SPLIT', label: t.split, icon: '✂️' }
                    ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setBroadcastConfig(prev => ({ ...prev, layout: mode.id as any }))}
                          className={`p-2 rounded border text-center transition flex flex-col items-center gap-1 ${broadcastConfig.layout === mode.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                            <span className="text-lg">{mode.icon}</span>
                            <span className="text-[10px] font-bold">{mode.label}</span>
                        </button>
                    ))}
                 </div>
               )}
            </div>

            {/* 2. Logo Section */}
            <div className="border-b border-slate-800">
               <button onClick={() => toggleSection('logo')} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition">
                  <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-indigo-400">
                    <span>🖼️</span> {t.uploadLogo}
                  </h3>
                  <span className={`text-slate-500 text-xs transition-transform ${openSection === 'logo' ? 'rotate-180' : ''}`}>▼</span>
               </button>
               {openSection === 'logo' && (
                  <div className="p-4 pt-0">
                     <div className="flex items-center gap-3 bg-slate-800 p-2 rounded border border-slate-700 mb-2">
                        {broadcastConfig.logoUrl ? (
                            <img src={broadcastConfig.logoUrl} className="w-10 h-10 object-contain bg-black/50 rounded" />
                        ) : <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center text-xs text-slate-500">Logo</div>}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-xs text-slate-400 w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-white hover:file:bg-slate-600"/>
                     </div>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={broadcastConfig.showLogo} 
                          onChange={e => setBroadcastConfig(prev => ({...prev, showLogo: e.target.checked}))}
                          className="accent-blue-500 rounded"
                        />
                        <span className="text-xs text-slate-300 font-medium">{t.showLogo}</span>
                     </label>
                  </div>
               )}
            </div>

            {/* 3. Donations / QR Section (UPDATED) */}
            <div className="border-b border-slate-800">
                <button onClick={() => toggleSection('donations')} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition">
                  <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-pink-400">
                    <span>🎁</span> {t.donations}
                  </h3>
                  <span className={`text-slate-500 text-xs transition-transform ${openSection === 'donations' ? 'rotate-180' : ''}`}>▼</span>
               </button>

               {openSection === 'donations' && (
                  <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-2 mb-4">
                          <input 
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600"
                            placeholder={t.donationTitle}
                            value={newDonation.title}
                            onChange={e => setNewDonation({...newDonation, title: e.target.value})}
                          />
                          <input 
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600"
                            placeholder={t.donationDesc}
                            value={newDonation.description}
                            onChange={e => setNewDonation({...newDonation, description: e.target.value})}
                          />
                          <input 
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 font-mono"
                            placeholder={t.donationUrl}
                            value={newDonation.url}
                            onChange={e => setNewDonation({...newDonation, url: e.target.value})}
                          />
                          <div className="flex items-center gap-2">
                             <input 
                               type="number"
                               className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-center"
                               placeholder="30"
                               value={newDonation.duration}
                               onChange={e => setNewDonation({...newDonation, duration: parseInt(e.target.value) || 30})}
                             />
                             <span className="text-xs text-slate-400">{t.donationDuration}</span>
                          </div>
                          <button 
                            onClick={handleAddDonation}
                            disabled={!newDonation.title || !newDonation.url}
                            className="w-full bg-pink-600 hover:bg-pink-500 text-white py-1.5 rounded text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                          >
                            {t.addDonation}
                          </button>
                      </div>

                      <div className="space-y-2">
                          {broadcastConfig.donations.map((item) => (
                              <div key={item.id} className="bg-slate-900 border border-slate-700 rounded p-2 flex flex-col gap-2">
                                  <div className="flex justify-between items-start">
                                      <div className="min-w-0 pr-2">
                                          <div className="text-xs font-bold text-white truncate">{item.title}</div>
                                          <div className="text-[10px] text-slate-400 truncate">{item.url}</div>
                                      </div>
                                      <button onClick={() => handleDeleteDonation(item.id)} className="text-slate-600 hover:text-red-400">✕</button>
                                  </div>
                                  <div className="flex gap-2">
                                      <button 
                                        onClick={() => handleTriggerDonation(item.id, 'OVERLAY')}
                                        className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition ${broadcastConfig.activeDonationId === item.id && broadcastConfig.donationDisplayMode === 'OVERLAY' ? 'bg-green-500 text-black' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                                      >
                                          {t.modeCard}
                                      </button>
                                      <button 
                                        onClick={() => handleTriggerDonation(item.id, 'FULLSCREEN')}
                                        className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition ${broadcastConfig.activeDonationId === item.id && broadcastConfig.donationDisplayMode === 'FULLSCREEN' ? 'bg-pink-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                                      >
                                          {t.modeFull}
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
               )}
            </div>

            {/* 4. Prayer Wall Section (Accordion) */}
            <div className="border-b border-slate-800">
               <button onClick={() => toggleSection('prayer')} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition">
                  <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-emerald-400">
                    <span>🙏</span> {t.prayerWall}
                  </h3>
                  <span className={`text-slate-500 text-xs transition-transform ${openSection === 'prayer' ? 'rotate-180' : ''}`}>▼</span>
               </button>
               
               {openSection === 'prayer' && (
                 <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4 bg-slate-800 p-2 rounded">
                        <label className="flex items-center gap-2 cursor-pointer w-full">
                            <input 
                              type="checkbox" 
                              checked={broadcastConfig.showPrayerTicker} 
                              onChange={e => setBroadcastConfig(prev => ({...prev, showPrayerTicker: e.target.checked}))}
                              className="accent-emerald-500 rounded w-4 h-4"
                            />
                            <span className="text-xs font-bold text-white uppercase">{t.showPrayerWall}</span>
                        </label>
                    </div>

                    <div className="space-y-2 mb-4">
                         <input 
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600"
                            placeholder={t.requestNamePlaceholder}
                            value={newPrayerName}
                            onChange={e => setNewPrayerName(e.target.value)}
                         />
                         <textarea 
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 resize-none h-16"
                            placeholder={t.requestContentPlaceholder}
                            value={newPrayerContent}
                            onChange={e => setNewPrayerContent(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddPrayerRequest();
                                }
                            }}
                         />
                         <button 
                            onClick={handleAddPrayerRequest}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-xs font-bold uppercase tracking-wide"
                         >
                            {t.addRequest}
                         </button>
                    </div>

                    {broadcastConfig.prayerRequests.length > 0 && (
                        <div className="bg-slate-800/50 rounded border border-slate-700/50">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-700/50">{t.manageRequests} ({broadcastConfig.prayerRequests.length})</div>
                            <div className="max-h-32 overflow-y-auto p-1 space-y-1">
                                {broadcastConfig.prayerRequests.map((req, idx) => (
                                    <div key={idx} className="flex items-start justify-between p-2 rounded bg-slate-900 border border-slate-800 group hover:border-emerald-500/30 transition">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="text-emerald-400 text-[10px] font-bold truncate">{req.name}</div>
                                            <div className="text-slate-400 text-[10px] truncate">{req.content}</div>
                                        </div>
                                        <button onClick={() => handleDeletePrayerRequest(idx)} className="text-slate-600 hover:text-red-400 px-1 pt-1">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>
               )}
            </div>

            {/* 5. Lower Thirds Section */}
            <div className="border-b border-slate-800">
               <button onClick={() => toggleSection('lowerthird')} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition">
                   <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-yellow-400">
                     <span>📝</span> {t.infoOverlay}
                   </h3>
                   <span className={`text-slate-500 text-xs transition-transform ${openSection === 'lowerthird' ? 'rotate-180' : ''}`}>▼</span>
               </button>
               
               {openSection === 'lowerthird' && (
                 <div className="p-4 pt-0">
                    {/* Controls */}
                    <div className="flex flex-col gap-3 mb-4 bg-slate-800 p-2 rounded">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                type="checkbox" 
                                checked={broadcastConfig.showLowerThird} 
                                onChange={e => setBroadcastConfig(prev => ({...prev, showLowerThird: e.target.checked}))}
                                className="accent-yellow-500 rounded w-4 h-4"
                                />
                                <span className="text-xs font-bold text-white uppercase">{t.showOverlay}</span>
                            </label>
                            
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={broadcastConfig.isRotating} 
                                        onChange={e => setBroadcastConfig(prev => ({...prev, isRotating: e.target.checked}))}
                                        className="accent-emerald-500 rounded"
                                    />
                                    <span className="text-[10px] text-slate-300">{t.rotation}</span>
                                </label>
                                <input 
                                    type="number" 
                                    className="w-10 bg-slate-900 border border-slate-600 rounded text-[10px] text-center text-white py-0.5" 
                                    value={broadcastConfig.rotationInterval}
                                    onChange={e => setBroadcastConfig(prev => ({...prev, rotationInterval: parseInt(e.target.value) || 10}))}
                                />
                            </div>
                        </div>

                        {/* Size Selection */}
                        <div className="border-t border-slate-700 pt-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{t.size}:</span>
                            <div className="flex bg-slate-900 rounded overflow-hidden">
                                {['small', 'standard', 'large', 'xl'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setBroadcastConfig(prev => ({ ...prev, lowerThirdSize: s as LowerThirdSize }))}
                                        className={`px-2 py-1 text-[9px] font-bold uppercase transition ${broadcastConfig.lowerThirdSize === s ? 'bg-yellow-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {s === 'small' ? 'S' : s === 'standard' ? 'M' : s === 'large' ? 'L' : 'XL'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
                        {broadcastConfig.lowerThirds.map((item, idx) => (
                            <div key={item.id} className={`flex items-center gap-2 p-2 rounded border transition ${idx === broadcastConfig.activeLowerThirdIndex ? 'bg-slate-800 border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-slate-900 border-slate-800'}`}>
                                <div 
                                  className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 bg-cover bg-center border border-slate-600" 
                                  style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : 'none' }}
                                />
                                <div className="flex-1 min-w-0" onClick={() => setBroadcastConfig(prev => ({...prev, activeLowerThirdIndex: idx}))}>
                                    <div className="text-xs font-bold text-white truncate">{item.title}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                                </div>
                                <button onClick={() => handleDeleteItem(item.id)} className="text-slate-500 hover:text-red-400 px-1">✕</button>
                            </div>
                        ))}
                        {broadcastConfig.lowerThirds.length === 0 && (
                            <div className="text-center text-[10px] text-slate-500 italic py-2">No items added.</div>
                        )}
                    </div>

                    {/* Add New Form */}
                    <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t.addItem}</div>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                              <div className="w-10 h-10 rounded bg-slate-700 relative overflow-hidden flex-shrink-0 hover:ring-1 ring-white cursor-pointer group">
                                  {newItem.imageUrl ? <img src={newItem.imageUrl} className="w-full h-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">+</span>}
                                  <input type="file" accept="image/*" onChange={handleAddItemImage} className="absolute inset-0 opacity-0 cursor-pointer" />
                              </div>
                              <div className="flex-1 space-y-2">
                                  <div className="flex gap-1">
                                      <input 
                                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600"
                                          placeholder={t.title}
                                          value={newItem.title}
                                          onChange={e => setNewItem({...newItem, title: e.target.value})}
                                      />
                                      <button 
                                        onClick={handleTranslateNewItem}
                                        disabled={isTranslating || !newItem.title}
                                        className="bg-indigo-600 text-white px-2 rounded text-[10px] font-bold disabled:opacity-50 whitespace-nowrap"
                                      >
                                        {isTranslating ? '...' : t.autoTranslate}
                                      </button>
                                  </div>
                                  <input 
                                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600"
                                      placeholder={t.subtitle}
                                      value={newItem.subtitle}
                                      onChange={e => setNewItem({...newItem, subtitle: e.target.value})}
                                  />
                              </div>
                            </div>
                            <button 
                              onClick={handleAddLowerThird}
                              disabled={!newItem.title}
                              className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-1.5 rounded transition disabled:opacity-50"
                            >
                              + {t.addItem}
                            </button>
                        </div>
                    </div>
                 </div>
               )}
            </div>
            
            <button onClick={() => setShowSettings(false)} className="mt-auto m-4 text-center text-xs text-slate-500 hover:text-white">{t.close}</button>
         </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Main Preview Area */}
        <div className="flex-1 p-8 flex flex-col items-center justify-center relative bg-slate-950 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
          
          {/* Output Display Container */}
          <div className="aspect-video w-full max-w-5xl bg-black rounded-xl shadow-2xl relative overflow-hidden border border-slate-800 group ring-1 ring-white/5">
             
             {/* ================= LAYOUT RENDERING ================= */}
             
             {/* 1. BACKGROUND (Depending on Layout) */}
             <div className="absolute inset-0 z-0 bg-black">
                 {/* In Full Cam, Video is BG. In others, a Gradient is BG for slides. */}
                 {broadcastConfig.layout !== 'FULL_CAM' && (
                     <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-black">
                         {/* Optional subtle pattern */}
                         <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px'}}></div>
                     </div>
                 )}
                 
                 {/* Video Layer for FULL_CAM */}
                 {broadcastConfig.layout === 'FULL_CAM' && (
                     <video 
                       ref={ref => { if(ref) ref.srcObject = mediaStream }}
                       autoPlay 
                       muted 
                       className="absolute inset-0 w-full h-full object-cover opacity-100"
                     />
                 )}
             </div>

             {/* 2. SLIDE CONTENT LAYER */}
             <div className={`absolute transition-all duration-500 z-10 flex flex-col items-center justify-center
                 ${broadcastConfig.layout === 'FULL_CAM' ? 'inset-0 p-12' : ''}
                 ${broadcastConfig.layout === 'PIP' ? 'inset-0 p-12 pb-32' : ''}
                 ${broadcastConfig.layout === 'SPLIT' ? 'top-0 left-0 bottom-0 w-[70%] p-12 border-r border-slate-800' : ''}
             `}>
                {renderSlideContent()}
             </div>

             {/* 3. VIDEO PIP / SPLIT LAYER */}
             {broadcastConfig.layout !== 'FULL_CAM' && (
                 <div className={`absolute overflow-hidden shadow-2xl transition-all duration-500 z-20 bg-black border border-slate-700
                     ${broadcastConfig.layout === 'PIP' ? 'bottom-8 right-8 w-80 aspect-video rounded-xl ring-2 ring-white/10' : ''}
                     ${broadcastConfig.layout === 'SPLIT' ? 'top-0 right-0 bottom-0 w-[30%]' : ''}
                 `}>
                     <video 
                       ref={ref => { if(ref) ref.srcObject = mediaStream }}
                       autoPlay 
                       muted 
                       className="w-full h-full object-cover"
                     />
                 </div>
             )}

             {/* 4. OVERLAYS (Logo, Lower Thirds, Prayer Wall, Donations) */}
             <div className="absolute inset-0 z-30 pointer-events-none p-8 flex flex-col justify-between overflow-hidden">
                {/* Logo Area */}
                <div className="flex justify-between items-start">
                   <div></div> {/* Top Left Spacer */}
                   {/* Top Right Logo */}
                   {broadcastConfig.showLogo && broadcastConfig.logoUrl && (
                      <img 
                        src={broadcastConfig.logoUrl} 
                        className="h-16 w-auto object-contain drop-shadow-lg opacity-90 transition-opacity duration-500"
                        alt="Broadcast Logo"
                      />
                   )}
                </div>

                {/* Donation / QR Overlay (STANDARD CARD MODE) */}
                {activeDonation && broadcastConfig.donationDisplayMode === 'OVERLAY' && (
                    <div className={`absolute ${lang === 'fa' ? 'left-8' : 'right-8'} top-1/2 -translate-y-1/2 flex flex-col items-center bg-white/95 text-slate-900 p-4 rounded-xl shadow-2xl border-4 border-pink-500 animate-in zoom-in duration-300 origin-center max-w-xs z-50`}>
                        <div className="bg-white p-1 rounded-lg">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(activeDonation.url)}`}
                                alt="QR Code"
                                className="w-40 h-40 object-contain"
                            />
                        </div>
                        <h3 className={`mt-3 font-black text-xl text-center leading-tight ${lang === 'fa' ? 'font-sans-fa' : ''}`}>
                            {activeDonation.title}
                        </h3>
                        {activeDonation.description && (
                            <p className={`text-sm text-slate-600 font-medium text-center mt-1 ${lang === 'fa' ? 'font-sans-fa' : ''}`}>
                                {activeDonation.description}
                            </p>
                        )}
                        <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Scan to Give
                        </div>
                    </div>
                )}

                {/* Donation / QR Full Screen (FULL SCREEN MODE) */}
                {activeDonation && broadcastConfig.donationDisplayMode === 'FULLSCREEN' && (
                    <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                        {/* Background effects */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 opacity-80"></div>
                        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px'}}></div>
                        
                        {/* Content */}
                        <div className="relative z-10 p-8 max-w-2xl w-full flex flex-col items-center">
                            <h2 className={`text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-2 tracking-wider drop-shadow-lg ${lang === 'fa' ? 'font-sans-fa' : 'font-serif'}`}>
                                {activeDonation.title}
                            </h2>
                             {activeDonation.description && (
                                <p className={`text-xl text-indigo-100 mb-8 font-light italic opacity-90 max-w-lg ${lang === 'fa' ? 'font-sans-fa' : ''}`}>
                                    {activeDonation.description}
                                </p>
                            )}
                            
                            <div className="bg-white p-4 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.3)] mb-8 transform hover:scale-105 transition duration-500 border-4 border-amber-500/30">
                                 <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(activeDonation.url)}`}
                                    alt="QR Code"
                                    className="w-64 h-64 md:w-80 md:h-80 object-contain"
                                />
                            </div>
                            
                            <div className="text-sm font-bold text-amber-500/80 uppercase tracking-[0.3em] animate-pulse">
                                Scan to Give
                            </div>
                        </div>
                    </div>
                )}

                {/* Prayer Wall Ticker (Vertical on Side) */}
                {broadcastConfig.showPrayerTicker && broadcastConfig.prayerRequests.length > 0 && (
                   <div className={`absolute top-20 bottom-32 w-64 overflow-hidden rounded-xl border border-emerald-500/20 shadow-2xl backdrop-blur-sm bg-slate-900/40
                        ${lang === 'fa' ? 'left-8' : 'right-8'}
                        ${broadcastConfig.layout === 'PIP' || broadcastConfig.layout === 'SPLIT' ? 'opacity-0' : 'opacity-100'}
                        transition-opacity duration-500
                   `}>
                       <div className="bg-emerald-600 text-white text-[10px] font-bold uppercase text-center py-2 tracking-widest shadow-lg relative z-10 flex items-center justify-center gap-2">
                           <span>🙏</span> {t.prayerWall}
                       </div>
                       <div className="relative w-full h-full overflow-hidden mask-linear-fade">
                            <div className="absolute w-full animate-vertical-scroll flex flex-col gap-4 p-4 pb-24">
                                {broadcastConfig.prayerRequests.map((req, i) => (
                                    <div key={i} className="bg-slate-800/80 backdrop-blur-md rounded-lg overflow-hidden border-l-4 border-emerald-500 shadow-xl">
                                        <div className="bg-slate-900/50 px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
                                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                           <span className={`text-emerald-400 text-xs font-bold truncate ${lang === 'fa' ? 'font-sans-fa' : ''}`}>{req.name}</span>
                                        </div>
                                        <div className="p-3">
                                            <p className={`text-white text-xs leading-relaxed font-medium ${lang === 'fa' ? 'font-sans-fa' : ''}`}>
                                                {req.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {/* Duplicated for smooth scrolling loop */}
                                {broadcastConfig.prayerRequests.map((req, i) => (
                                    <div key={`dup-${i}`} className="bg-slate-800/80 backdrop-blur-md rounded-lg overflow-hidden border-l-4 border-emerald-500 shadow-xl">
                                        <div className="bg-slate-900/50 px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
                                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                           <span className={`text-emerald-400 text-xs font-bold truncate ${lang === 'fa' ? 'font-sans-fa' : ''}`}>{req.name}</span>
                                        </div>
                                        <div className="p-3">
                                            <p className={`text-white text-xs leading-relaxed font-medium ${lang === 'fa' ? 'font-sans-fa' : ''}`}>
                                                {req.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                       </div>
                   </div>
                )}

                {/* Advanced Lower Thirds */}
                <div className={`transition-all duration-700 transform ease-out ${broadcastConfig.showLowerThird && activeLowerThird ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    {activeLowerThird && (
                        <div key={activeLowerThird.id} className={`animate-in slide-in-from-bottom duration-700 fade-in fill-mode-forwards ${getLowerThirdSizeClass(broadcastConfig.lowerThirdSize)}`}>
                            <div className={`flex items-center gap-0 ${lang === 'fa' ? 'flex-row-reverse' : 'flex-row'}`}>
                                
                                {/* Profile Picture */}
                                {activeLowerThird.imageUrl && (
                                    <div className="w-20 h-20 rounded-full border-4 border-slate-900 shadow-2xl z-10 relative bg-cover bg-center shrink-0" 
                                         style={{ backgroundImage: `url(${activeLowerThird.imageUrl})` }}>
                                    </div>
                                )}
                                
                                {/* Text Container */}
                                <div className={`relative bg-gradient-to-r from-slate-900/95 to-slate-900/60 backdrop-blur-md border-y border-white/10 shadow-xl py-3 px-8 -ml-6 ${lang === 'fa' ? '-mr-6 rounded-l-xl pr-10' : '-ml-6 rounded-r-xl pl-10'}`}>
                                    <h2 className={`font-bold text-white leading-tight drop-shadow-md ${lang === 'fa' ? 'font-sans-fa' : ''} ${broadcastConfig.lowerThirdSize === 'large' ? 'text-4xl' : broadcastConfig.lowerThirdSize === 'xl' ? 'text-5xl' : 'text-2xl'}`}>
                                        {activeLowerThird.title}
                                    </h2>
                                    {activeLowerThird.subtitle && (
                                        <h3 className={`font-medium text-yellow-400 uppercase tracking-wider mt-1 ${lang === 'fa' ? 'font-sans-fa' : ''} ${broadcastConfig.lowerThirdSize === 'large' ? 'text-lg' : broadcastConfig.lowerThirdSize === 'xl' ? 'text-xl' : 'text-sm'}`}>
                                            {activeLowerThird.subtitle}
                                        </h3>
                                    )}
                                    {/* Accent Bar */}
                                    <div className={`absolute bottom-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-600 ${lang === 'fa' ? 'right-0 w-full rounded-bl-xl' : 'left-0 w-full rounded-br-xl'}`}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
             </div>
          </div>

          {/* Quick Controls */}
          <div className="mt-8 flex gap-4 w-full max-w-md">
            <button 
              disabled={activeSlideIndex === 0 && internalPageIndex === 0}
              onClick={handlePrev}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl disabled:opacity-50 transition font-bold shadow-lg border border-slate-700 relative overflow-hidden group"
            >
              <span className="relative z-10">{t.prev}</span>
              {/* Visual indicator if prev is internal page */}
              {session.slides[activeSlideIndex]?.type === SlideType.SCRIPTURE && internalPageIndex > 0 && (
                  <div className="absolute bottom-1 right-0 left-0 text-[9px] text-emerald-400 font-bold uppercase tracking-wider opacity-80">{t.prevPage}</div>
              )}
            </button>
            <button 
              disabled={activeSlideIndex === session.slides.length - 1 && (session.slides[activeSlideIndex]?.type !== SlideType.SCRIPTURE || internalPageIndex === ((session.slides[activeSlideIndex].content as any).pages?.length || 0) - 1)}
              onClick={handleNext}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-xl shadow-emerald-900/20 disabled:opacity-50 transition border border-emerald-500/50 relative overflow-hidden group"
            >
              <span className="relative z-10">{t.next}</span>
              {/* Visual indicator if next is internal page */}
              {session.slides[activeSlideIndex]?.type === SlideType.SCRIPTURE && internalPageIndex < ((session.slides[activeSlideIndex].content as any).pages?.length || 0) - 1 && (
                  <div className="absolute bottom-1 right-0 left-0 text-[9px] text-white font-bold uppercase tracking-wider opacity-80">{t.nextPage}</div>
              )}
            </button>
          </div>
        </div>

        {/* Presenter Notes (Teleprompter) */}
        <div className="w-80 bg-black border-s border-slate-800 p-6 overflow-y-auto shrink-0 z-10 shadow-xl">
          <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
              {t.presenterNotes}
          </h3>
          <div className={`text-white text-xl leading-relaxed ${lang === 'fa' ? 'font-sans-fa' : 'font-mono'}`}>
            <div className="mb-6">
              {activeSlide?.notes || (
                <span className="text-slate-700 italic text-base">{t.noNotes}</span>
              )}
            </div>

            {/* Lyrics Chords Section */}
            {activeSlide?.type === SlideType.LYRICS && (
               <div className="mt-10 pt-6 border-t border-slate-900">
                  <h4 className="text-yellow-600 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>🎵</span> {t.songChords}
                  </h4>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
                    <pre className="text-emerald-400 text-sm font-mono whitespace-pre-wrap leading-7">
                      {(activeSlide.content as any).chords || <span className="text-slate-700 italic">{t.noChords}</span>}
                    </pre>
                  </div>

                  {/* Audio Player for Backing Track */}
                  {(activeSlide.content as any).audioUrl && (
                      <div className="mt-6 pt-6 border-t border-slate-900">
                          <h4 className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                             <span>🔊</span> {t.audioTrack}
                          </h4>
                          <audio 
                            controls 
                            src={(activeSlide.content as any).audioUrl} 
                            className="w-full h-8" 
                          />
                      </div>
                  )}
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};