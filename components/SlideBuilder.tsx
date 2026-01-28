import React, { useState } from 'react';
import { Slide, SlideType, Session, SlideContentScripture, SlideContentMedia, SlideContentLyrics, ScripturePage } from '../types';
import { generateSermonContent, translateText, fetchScripture } from '../services/geminiService';
import { AppLanguage } from '../App';

interface SlideBuilderProps {
  session: Session;
  setSession: React.Dispatch<React.SetStateAction<Session>>;
  lang: AppLanguage;
  activeSlideIndex: number;
  onSlideSelect: (index: number) => void;
}

// Simple Dictionary for UI
const DICT = {
    en: {
        smartBuilder: "Smart Builder",
        aiAssistant: "AI Assistant",
        aiPlaceholder: "e.g., Sermon outline on 'Hope'...",
        generate: "Generate Slide",
        thinking: "Thinking...",
        addScripture: "Scripture",
        addLyrics: "Lyrics",
        addMedia: "Media",
        noSlides: "No slides yet. Add one above.",
        modalTitleLyrics: "Add Worship Song",
        modalTitleScripture: "Add Scripture (Multi-Page)",
        modalTitleMedia: "Add Media",
        songTitle: "Song Title",
        lyricsLabel: "Lyrics (Main Screen)",
        chordsLabel: "Leader Chords",
        audioLabel: "Backing Track / Audio",
        uploadAudio: "Upload Audio File",
        audioLink: "Or Audio URL",
        book: "Book",
        chapter: "Chapter",
        verse: "Verses",
        textPrimary: "Primary Text (FA)",
        textSecondary: "Secondary Text (EN)",
        mediaType: "Media Type",
        image: "Image",
        video: "Video",
        audio: "Audio",
        uploadFile: "Upload File",
        fileUrl: "File URL",
        settings: "Settings",
        loop: "Loop",
        autoplay: "Auto Play",
        cancel: "Cancel",
        add: "Add Slide",
        translate: "Auto Translate",
        translating: "Translating...",
        quickSearch: "Quick Search (AI Database)",
        searchPlaceholder: "e.g. John 3:16 or Psalm 23",
        fetch: "Fetch",
        fetching: "Fetching...",
        pages: "Slide Pages",
        addPage: "Add Page",
        remove: "Remove",
        preview: "Page Preview"
    },
    fa: {
        smartBuilder: "اسلاید ساز هوشمند",
        aiAssistant: "دستیار هوش مصنوعی",
        aiPlaceholder: "مثال: طرح خطبه در مورد 'امید'...",
        generate: "تولید اسلاید",
        thinking: "در حال فکر...",
        addScripture: "آیه کتاب مقدس",
        addLyrics: "متن سرود",
        addMedia: "رسانه",
        noSlides: "هنوز اسلایدی نیست. یکی اضافه کنید.",
        modalTitleLyrics: "افزودن سرود پرستشی",
        modalTitleScripture: "افزودن آیه (چند صفحه ای)",
        modalTitleMedia: "افزودن رسانه",
        songTitle: "عنوان سرود",
        lyricsLabel: "متن سرود (صفحه اصلی)",
        chordsLabel: "آکوردهای رهبر",
        audioLabel: "فایل صوتی / بک ترک",
        uploadAudio: "آپلود فایل صوتی",
        audioLink: "یا لینک فایل صوتی",
        book: "کتاب",
        chapter: "باب",
        verse: "آیات",
        textPrimary: "متن اصلی (فارسی)",
        textSecondary: "متن دوم (انگلیسی)",
        mediaType: "نوع رسانه",
        image: "تصویر",
        video: "ویدیو",
        audio: "صدا",
        uploadFile: "آپلود فایل",
        fileUrl: "لینک فایل",
        settings: "تنظیمات",
        loop: "تکرار (Loop)",
        autoplay: "پخش خودکار",
        cancel: "لغو",
        add: "افزودن اسلاید",
        translate: "ترجمه خودکار",
        translating: "در حال ترجمه...",
        quickSearch: "جستجوی سریع (هوش مصنوعی)",
        searchPlaceholder: "مثال: یوحنا ۳:۱۶ یا مزمور ۲۳",
        fetch: "دریافت",
        fetching: "در حال دریافت...",
        pages: "صفحات اسلاید",
        addPage: "افزودن صفحه",
        remove: "حذف",
        preview: "پیش نمایش صفحه"
    }
};

type ModalType = 'NONE' | 'SCRIPTURE' | 'LYRICS' | 'MEDIA';

export const SlideBuilder: React.FC<SlideBuilderProps> = ({ session, setSession, lang, activeSlideIndex, onSlideSelect }) => {
  const t = DICT[lang];
  const [activeModal, setActiveModal] = useState<ModalType>('NONE');
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isFetchingScripture, setIsFetchingScripture] = useState(false);
  const [scriptureSearch, setScriptureSearch] = useState('');

  // Drag State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Forms
  const [scripturePages, setScripturePages] = useState<ScripturePage[]>([]);
  // Temp state for the page currently being edited/added
  const [currentPage, setCurrentPage] = useState<ScripturePage>({
      id: '', book: '', chapter: '', verses: '', textPrimary: '', textSecondary: ''
  });
  
  const [formLyrics, setFormLyrics] = useState<SlideContentLyrics>({
      title: '', lines: [], chords: '', audioUrl: ''
  });
  const [lyricsTextRaw, setLyricsTextRaw] = useState(''); // Helper for textarea

  const [formMedia, setFormMedia] = useState<SlideContentMedia>({
      url: '', mediaType: 'image', isLoop: false, isAutoPlay: true
  });

  const addSlide = (type: SlideType, content: any) => {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      order: session.slides.length,
      type,
      content,
      notes: ''
    };
    setSession({
      ...session,
      slides: [...session.slides, newSlide]
    });
    setActiveModal('NONE');
    resetForms();
  };

  const resetForms = () => {
      setScripturePages([]);
      setCurrentPage({ id: '', book: '', chapter: '', verses: '', textPrimary: '', textSecondary: '' });
      setFormLyrics({ title: '', lines: [], chords: '', audioUrl: '' });
      setLyricsTextRaw('');
      setFormMedia({ url: '', mediaType: 'image', isLoop: false, isAutoPlay: true });
  };

  // --- Handlers ---
  
  const handleScriptureSubmit = () => {
      // Add the currently edited page if it has content, or rely on pages array
      let finalPages = [...scripturePages];
      if (currentPage.book && currentPage.textPrimary) {
          finalPages.push({ ...currentPage, id: crypto.randomUUID() });
      }

      if (finalPages.length === 0) return;

      const content: SlideContentScripture = { pages: finalPages };
      addSlide(SlideType.SCRIPTURE, content);
  };

  const handleAddPageToScripture = () => {
      if (!currentPage.book) return;
      setScripturePages([...scripturePages, { ...currentPage, id: crypto.randomUUID() }]);
      setCurrentPage({ id: '', book: currentPage.book, chapter: currentPage.chapter, verses: '', textPrimary: '', textSecondary: '' }); // Keep book/chapter for convenience
  };

  const handleFetchScripture = async () => {
      if (!scriptureSearch) return;
      setIsFetchingScripture(true);
      const result = await fetchScripture(scriptureSearch);
      if (result) {
          setCurrentPage({
              id: '',
              book: result.book,
              chapter: result.chapter,
              verses: result.verses,
              textPrimary: result.textPrimary,
              textSecondary: result.textSecondary
          });
      }
      setIsFetchingScripture(false);
  };

  const handleLyricsSubmit = () => {
      const lines = lyricsTextRaw.split('\n').filter(l => l.trim() !== '');
      addSlide(SlideType.LYRICS, { ...formLyrics, lines });
  };

  const handleMediaSubmit = () => {
      if(!formMedia.url) return;
      addSlide(SlideType.MEDIA, formMedia);
  };

  const handleTranslateLyrics = async () => {
      if (!lyricsTextRaw) return;
      setIsTranslating(true);
      const target = lang === 'fa' ? 'en' : 'fa';
      const result = await translateText(lyricsTextRaw, target);
      if (result) {
          setLyricsTextRaw(result);
      }
      setIsTranslating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'lyrics') => {
      const file = e.target.files?.[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      
      if (type === 'media') {
          setFormMedia(prev => ({ ...prev, url: objectUrl }));
      } else {
          setFormLyrics(prev => ({ ...prev, audioUrl: objectUrl }));
      }
  };

  // Drag and Drop Logic
  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === session.slides.length - 1)) return;
    const newSlides = [...session.slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    newSlides.forEach((s, i) => s.order = i);
    setSession({ ...session, slides: newSlides });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const newSlides = [...session.slides];
    const [draggedItem] = newSlides.splice(draggedIndex, 1);
    newSlides.splice(dropIndex, 0, draggedItem);
    newSlides.forEach((s, i) => s.order = i);
    setSession({ ...session, slides: newSlides });
    setDraggedIndex(null);
  };

  const handleAiGeneration = async () => {
    if (!aiPrompt) return;
    setIsThinking(true);
    try {
      const result = await generateSermonContent(aiPrompt, 'bilingual');
      if (result) {
        const page: ScripturePage = {
            id: crypto.randomUUID(),
            book: result.scriptureReference || "Reference",
            chapter: "0",
            verses: "",
            textPrimary: result.mainTextPrimary || "Content",
            textSecondary: result.mainTextSecondary || "Content",
        };
        addSlide(SlideType.SCRIPTURE, { pages: [page] });
      }
    } catch (e) {
      alert("Failed to generate content.");
    } finally {
      setIsThinking(false);
    }
  };

  // --- Render Helpers ---

  const renderThumbnail = (slide: Slide) => {
    switch (slide.type) {
      case SlideType.SCRIPTURE: {
        const content = slide.content as SlideContentScripture;
        const firstPage = content.pages?.[0];
        if (!firstPage) return <div className="bg-slate-900 w-full h-full" />;
        
        return (
          <div className="w-full h-full bg-slate-900 p-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-black opacity-50" />
            <div className="relative z-10 w-full">
                <div className="text-[6px] font-bold text-emerald-400 leading-none mb-0.5 truncate">
                {firstPage.book} {firstPage.chapter}:{firstPage.verses}
                </div>
                <div className="text-[5px] text-slate-300 leading-[1.1] line-clamp-3 break-words whitespace-normal font-sans-fa">
                {firstPage.textPrimary || "Scripture Text"}
                </div>
                {content.pages.length > 1 && (
                    <div className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[5px] px-1 rounded-tl">
                        {content.pages.length} PGS
                    </div>
                )}
            </div>
          </div>
        );
      }
      case SlideType.LYRICS: {
        const content = slide.content as SlideContentLyrics;
        return (
          <div className="w-full h-full bg-slate-800 p-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
             <div className="absolute inset-0 bg-blue-900/20" />
             <div className="relative z-10 w-full">
                <div className="text-[6px] font-bold text-yellow-500 leading-none mb-0.5 truncate font-sans-fa">
                    {content.title}
                </div>
                <div className="text-[5px] text-white leading-[1.1] line-clamp-2 break-words whitespace-normal font-sans-fa">
                    {content.lines?.[0] || "Lyrics..."}
                </div>
                {content.audioUrl && <div className="text-[6px] absolute bottom-0 right-0 p-0.5 opacity-50">🎵</div>}
             </div>
          </div>
        );
      }
      case SlideType.MEDIA: {
         const content = slide.content as SlideContentMedia;
         if (content.mediaType === 'image' && content.url) {
             return <img src={content.url} className="w-full h-full object-cover" alt="slide thumbnail" />;
         }
         if (content.mediaType === 'video') {
             return <video src={content.url} className="w-full h-full object-cover" muted />;
         }
         return (
             <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500">
                 <span className="text-lg">🔊</span>
             </div>
         );
      }
      default:
        return <div className="w-full h-full bg-slate-900" />;
    }
  };

  return (
    <>
      {/* -------------------- LYRICS MODAL -------------------- */}
      {activeModal === 'LYRICS' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className={`bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${lang === 'fa' ? 'font-sans-fa' : 'font-sans-en'}`} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                 <h3 className="text-white font-bold text-lg flex items-center gap-2">
                   <span className="text-yellow-500">🎵</span> {t.modalTitleLyrics}
                 </h3>
                 <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-white transition">✕</button>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto">
                 {/* Title */}
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.songTitle}</label>
                    <input 
                      autoFocus
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-yellow-500 outline-none transition"
                      placeholder={lang === 'fa' ? "مثال: راه ساز" : "e.g. Way Maker"}
                      value={formLyrics.title}
                      onChange={(e) => setFormLyrics({...formLyrics, title: e.target.value})}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    {/* Lyrics Text */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase">{t.lyricsLabel}</label>
                            <button 
                                onClick={handleTranslateLyrics}
                                disabled={isTranslating || !lyricsTextRaw}
                                className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded flex items-center gap-1 transition disabled:opacity-50"
                            >
                                <span>{isTranslating ? '↻' : 'A文'}</span> {isTranslating ? t.translating : t.translate}
                            </button>
                        </div>
                        <textarea 
                          className="w-full h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-yellow-500 outline-none resize-none"
                          value={lyricsTextRaw}
                          onChange={(e) => setLyricsTextRaw(e.target.value)}
                        />
                    </div>
                    {/* Chords */}
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-yellow-500/80 uppercase mb-1">
                          🔒 {t.chordsLabel}
                        </label>
                        <textarea 
                          className="w-full h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 text-yellow-100 font-mono text-xs focus:border-yellow-500 outline-none resize-none"
                          value={formLyrics.chords}
                          onChange={(e) => setFormLyrics({...formLyrics, chords: e.target.value})}
                        />
                    </div>
                 </div>

                 {/* Audio Section */}
                 <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.audioLabel}</label>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                             <div className="relative overflow-hidden">
                                <button className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded border border-slate-600">
                                    {t.uploadAudio}
                                </button>
                                <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'lyrics')} />
                             </div>
                             <input 
                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 text-xs text-white"
                                placeholder={t.audioLink}
                                value={formLyrics.audioUrl}
                                onChange={(e) => setFormLyrics({...formLyrics, audioUrl: e.target.value})}
                             />
                        </div>
                        {formLyrics.audioUrl && (
                            <audio controls src={formLyrics.audioUrl} className="w-full h-8 mt-1" />
                        )}
                    </div>
                 </div>
              </div>

              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                 <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">{t.cancel}</button>
                 <button onClick={handleLyricsSubmit} disabled={!formLyrics.title} className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50">{t.add}</button>
              </div>
           </div>
        </div>
      )}

      {/* -------------------- SCRIPTURE MODAL -------------------- */}
      {activeModal === 'SCRIPTURE' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className={`bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh] ${lang === 'fa' ? 'font-sans-fa' : 'font-sans-en'}`} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                 <h3 className="text-white font-bold text-lg flex items-center gap-2">
                   <span className="text-emerald-500">📖</span> {t.modalTitleScripture}
                 </h3>
                 <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* LEFT: Pages List */}
                <div className="w-1/3 border-e border-slate-800 bg-slate-900/50 flex flex-col">
                    <div className="p-3 bg-slate-950/50 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase">
                        {t.pages}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {scripturePages.map((page, idx) => (
                            <div key={page.id || idx} className="bg-slate-800 p-2 rounded border border-slate-700 relative group hover:border-emerald-500/50 transition">
                                <div className="text-xs font-bold text-emerald-400">{page.book} {page.chapter}:{page.verses}</div>
                                <div className="text-[10px] text-slate-400 line-clamp-1 mt-1">{page.textPrimary}</div>
                                <button 
                                  onClick={() => setScripturePages(scripturePages.filter((_, i) => i !== idx))}
                                  className="absolute top-1 right-1 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                >✕</button>
                            </div>
                        ))}
                        {/* Current Editing Preview */}
                        {currentPage.book && (
                            <div className="bg-emerald-900/20 p-2 rounded border border-emerald-500/50 border-dashed relative">
                                <div className="text-[9px] text-emerald-500 uppercase font-bold mb-1">Editing...</div>
                                <div className="text-xs font-bold text-white">{currentPage.book} {currentPage.chapter}:{currentPage.verses}</div>
                                <div className="text-[10px] text-slate-400 line-clamp-1 mt-1">{currentPage.textPrimary || "..."}</div>
                            </div>
                        )}
                        {scripturePages.length === 0 && !currentPage.book && (
                            <div className="text-center text-slate-600 text-xs py-10 italic">No pages added</div>
                        )}
                    </div>
                    <div className="p-3 border-t border-slate-800">
                        <button 
                          onClick={handleAddPageToScripture}
                          disabled={!currentPage.book || !currentPage.textPrimary}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded transition border border-slate-700 disabled:opacity-50"
                        >
                            + {t.addPage}
                        </button>
                    </div>
                </div>

                {/* RIGHT: Editor */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">
                  
                  {/* Quick Search */}
                  <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                     <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">{t.quickSearch}</label>
                     <div className="flex gap-2">
                        <input 
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                            placeholder={t.searchPlaceholder}
                            value={scriptureSearch}
                            onChange={(e) => setScriptureSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFetchScripture()}
                        />
                        <button 
                            onClick={handleFetchScripture}
                            disabled={isFetchingScripture || !scriptureSearch}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-bold text-xs disabled:opacity-50 min-w-[80px]"
                        >
                            {isFetchingScripture ? t.fetching : t.fetch}
                        </button>
                     </div>
                  </div>

                  {/* Manual Entry */}
                  <div className="flex gap-4">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{t.book}</label>
                          <input className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" value={currentPage.book} onChange={e => setCurrentPage({...currentPage, book: e.target.value})} />
                      </div>
                      <div className="w-20">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{t.chapter}</label>
                          <input className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center" value={currentPage.chapter} onChange={e => setCurrentPage({...currentPage, chapter: e.target.value})} />
                      </div>
                      <div className="w-24">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{t.verse}</label>
                          <input className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center" value={currentPage.verses} onChange={e => setCurrentPage({...currentPage, verses: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-4">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{t.textPrimary}</label>
                          <textarea className="w-full h-full min-h-[100px] bg-slate-800 border border-slate-700 rounded p-3 text-white font-sans-fa text-lg leading-relaxed resize-none" value={currentPage.textPrimary} onChange={e => setCurrentPage({...currentPage, textPrimary: e.target.value})} />
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{t.textSecondary}</label>
                          <textarea className="w-full h-full min-h-[100px] bg-slate-800 border border-slate-700 rounded p-3 text-white font-sans-en text-lg leading-relaxed resize-none" value={currentPage.textSecondary} onChange={e => setCurrentPage({...currentPage, textSecondary: e.target.value})} />
                      </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                 <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">{t.cancel}</button>
                 <button onClick={handleScriptureSubmit} disabled={!currentPage.book && scripturePages.length === 0} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50">{t.add}</button>
              </div>
           </div>
        </div>
      )}

      {/* -------------------- MEDIA MODAL -------------------- */}
      {activeModal === 'MEDIA' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className={`bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col ${lang === 'fa' ? 'font-sans-fa' : 'font-sans-en'}`} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                 <h3 className="text-white font-bold text-lg flex items-center gap-2">
                   <span className="text-blue-500">📷</span> {t.modalTitleMedia}
                 </h3>
                 <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                  {/* Type Selector */}
                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">{t.mediaType}</label>
                      <div className="flex bg-slate-800 p-1 rounded-lg">
                          {(['image', 'video', 'audio'] as const).map(type => (
                              <button 
                                key={type}
                                onClick={() => setFormMedia({...formMedia, mediaType: type})}
                                className={`flex-1 py-1.5 rounded text-xs font-bold capitalize transition ${formMedia.mediaType === type ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                              >
                                {t[type]}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Upload / URL */}
                  <div>
                      <div className="flex gap-2 mb-2">
                            <div className="relative overflow-hidden">
                            <button className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded border border-slate-600">
                                {t.uploadFile}
                            </button>
                            <input type="file" accept={formMedia.mediaType === 'image' ? "image/*" : formMedia.mediaType === 'video' ? "video/*" : "audio/*"} className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'media')} />
                            </div>
                            <input 
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 text-xs text-white"
                            placeholder={t.fileUrl}
                            value={formMedia.url}
                            onChange={(e) => setFormMedia({...formMedia, url: e.target.value})}
                            />
                      </div>
                      
                      {/* Preview */}
                      {formMedia.url && (
                          <div className="mt-4 bg-black rounded border border-slate-700 overflow-hidden flex items-center justify-center h-40">
                              {formMedia.mediaType === 'image' && <img src={formMedia.url} className="h-full object-contain" />}
                              {formMedia.mediaType === 'video' && <video src={formMedia.url} controls className="h-full" />}
                              {formMedia.mediaType === 'audio' && <audio src={formMedia.url} controls className="w-full px-4" />}
                          </div>
                      )}
                  </div>
                  
                  {/* Settings */}
                  <div className="flex gap-4 pt-2 border-t border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={formMedia.isLoop} onChange={e => setFormMedia({...formMedia, isLoop: e.target.checked})} className="rounded accent-blue-500" />
                          <span className="text-xs text-slate-300">{t.loop}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={formMedia.isAutoPlay} onChange={e => setFormMedia({...formMedia, isAutoPlay: e.target.checked})} className="rounded accent-blue-500" />
                          <span className="text-xs text-slate-300">{t.autoplay}</span>
                      </label>
                  </div>
              </div>
              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
                 <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">{t.cancel}</button>
                 <button onClick={handleMediaSubmit} disabled={!formMedia.url} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50">{t.add}</button>
              </div>
           </div>
        </div>
      )}


      {/* Main Builder Sidebar */}
      <div className="h-full flex flex-col bg-slate-900 border-e border-slate-800 w-96 shrink-0 relative z-10">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-500">◈</span> {t.smartBuilder}
          </h2>
          
          {/* AI Assistant */}
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-4 rounded-xl border border-indigo-500/20 mb-6 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-indigo-400 text-lg">✨</span>
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">{t.aiAssistant}</span>
            </div>
            <textarea
              className="w-full bg-slate-950/50 text-sm text-white p-3 rounded-lg border border-slate-700 mb-3 focus:border-indigo-500 outline-none placeholder-slate-600 resize-none transition-colors"
              placeholder={t.aiPlaceholder}
              rows={2}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <button 
              onClick={handleAiGeneration}
              disabled={isThinking}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all hover:scale-[1.02]"
            >
              {isThinking ? (
                  <>
                  <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                  {t.thinking}
                  </>
              ) : t.generate}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => setActiveModal('SCRIPTURE')}
              className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition border border-slate-700 hover:border-slate-500"
            >
              <span className="text-xl mb-1 text-emerald-400">📖</span>
              <span className="text-[10px] text-slate-300 font-medium">{t.addScripture}</span>
            </button>
            <button 
              onClick={() => setActiveModal('LYRICS')}
              className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition border border-slate-700 hover:border-slate-500"
            >
              <span className="text-xl mb-1 text-yellow-400">🎵</span>
              <span className="text-[10px] text-slate-300 font-medium">{t.addLyrics}</span>
            </button>
            <button 
              onClick={() => setActiveModal('MEDIA')}
              className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition border border-slate-700 hover:border-slate-500"
            >
              <span className="text-xl mb-1 text-blue-400">📷</span>
              <span className="text-[10px] text-slate-300 font-medium">{t.addMedia}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {session.slides.map((slide, idx) => (
            <div 
              key={slide.id} 
              draggable
              onClick={() => onSlideSelect(idx)}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              className={`p-2 rounded-lg flex items-center gap-3 group relative border transition-all cursor-pointer 
                ${activeSlideIndex === idx 
                    ? 'bg-slate-800/80 border-emerald-500/50 ring-1 ring-emerald-500/30' 
                    : 'bg-slate-800 border-transparent hover:border-emerald-500/30'
                }
                ${draggedIndex === idx ? 'opacity-50' : 'opacity-100'}`}
            >
              <div className="flex flex-col gap-0.5 items-center">
                 <button 
                   onClick={(e) => { e.stopPropagation(); moveSlide(idx, 'up'); }}
                   disabled={idx === 0}
                   className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-20 transition"
                 >
                   ▲
                 </button>
                 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-move border 
                    ${activeSlideIndex === idx ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                    {idx + 1}
                 </div>
                 <button 
                   onClick={(e) => { e.stopPropagation(); moveSlide(idx, 'down'); }}
                   disabled={idx === session.slides.length - 1}
                   className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-20 transition"
                 >
                   ▼
                 </button>
              </div>

              {/* Thumbnail */}
              <div className="w-20 h-11 border border-slate-700 rounded bg-black flex-shrink-0 overflow-hidden select-none relative shadow-md">
                {renderThumbnail(slide)}
              </div>

              <div className="flex-1 overflow-hidden cursor-move min-w-0">
                <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">{slide.type}</div>
                <div className={`text-sm truncate font-medium font-sans-fa ${activeSlideIndex === idx ? 'text-white' : 'text-slate-200'}`}>
                  {slide.type === SlideType.SCRIPTURE && (slide.content as any).pages?.[0]?.book}
                  {slide.type === SlideType.LYRICS && (slide.content as any).title}
                  {slide.type === SlideType.MEDIA && (slide.content as any).mediaType}
                </div>
              </div>
              <button 
                className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1.5 hover:bg-slate-700 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  setSession({ ...session, slides: session.slides.filter(s => s.id !== slide.id) })
                }}
              >
                ✕
              </button>
            </div>
          ))}
          
          {session.slides.length === 0 && (
            <div className="flex flex-col items-center justify-center text-slate-600 mt-20 opacity-60">
              <span className="text-3xl mb-2">📂</span>
              <p className="text-sm">{t.noSlides}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};