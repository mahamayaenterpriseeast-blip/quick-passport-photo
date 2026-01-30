
import React, { useState, useEffect, useRef } from 'react';
import { AppStep, ImageState, Adjustments, PHOTO_SIZES, PhotoSize } from './types';
import { StepIndicator } from './components/StepIndicator';
import { Cropper } from './components/Cropper';
import { removeBackground } from './services/geminiService';

const MAX_SLOTS = 30; // Standard 5x6 grid for A4

interface SlotItem {
  src: string;
  size: PhotoSize;
  id: string;
}

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [showA4Preview, setShowA4Preview] = useState(false);
  const [selectedSize, setSelectedSize] = useState<PhotoSize>(PHOTO_SIZES[0]);
  
  const [slots, setSlots] = useState<(SlotItem | null)[]>(new Array(MAX_SLOTS).fill(null));
  const [quantity, setQuantity] = useState(1);
  const [images, setImages] = useState<ImageState>({
    original: null,
    noBg: null,
    cropped: null,
    final: null,
  });
  const [adjustments, setAdjustments] = useState<Adjustments>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });
  
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const occupiedSlotsCount = slots.filter(s => s !== null).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages({
          original: event.target?.result as string,
          noBg: null,
          cropped: null,
          final: null
        });
        setQuantity(1);
        setStep(AppStep.SIZE_SELECT);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBg = async () => {
    if (!images.original) return;
    setLoading(true);
    setError(null);
    try {
      const result = await removeBackground(images.original);
      setImages(prev => ({ ...prev, noBg: result }));
      setStep(AppStep.CROP);
    } catch (err: any) {
      setError("AI processing failed. Please try a clearer photo or use the original backdrop.");
    } finally {
      setLoading(false);
    }
  };

  const handleCropComplete = (cropped: string) => {
    setImages(prev => ({ ...prev, cropped }));
    setStep(AppStep.ADJUST);
  };

  const handleAddToSheet = () => {
    const finalImage = images.final || images.cropped;
    if (finalImage) {
      setSlots(prev => {
        const nextSlots = [...prev];
        let added = 0;
        for (let i = 0; i < MAX_SLOTS && added < quantity; i++) {
          if (nextSlots[i] === null) {
            nextSlots[i] = { 
              src: finalImage, 
              size: selectedSize, 
              id: `${Date.now()}-${added}` 
            };
            added++;
          }
        }
        return nextSlots;
      });
      setStep(AppStep.DOWNLOAD);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsImage = async () => {
    if (occupiedSlotsCount === 0) return;
    setIsSaving(true);
    try {
      const DPI = 300;
      const mmToPx = (mm: number) => Math.round(mm * (DPI / 25.4));
      const canvas = document.createElement('canvas');
      canvas.width = mmToPx(210);
      canvas.height = mmToPx(297);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const marginX = mmToPx(7);
      const marginY = mmToPx(7);
      const gap = mmToPx(2);
      
      let currentX = marginX;
      let currentY = marginY;
      let maxRowHeight = 0;

      for (let i = 0; i < MAX_SLOTS; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const w = mmToPx(slot.size.width);
        const h = mmToPx(slot.size.height);

        if (currentX + w > canvas.width - marginX) {
          currentX = marginX;
          currentY += maxRowHeight + gap;
          maxRowHeight = 0;
        }

        const img = new Image();
        img.src = slot.src;
        await new Promise((resolve) => { img.onload = resolve; });
        ctx.drawImage(img, currentX, currentY, w, h);
        maxRowHeight = Math.max(maxRowHeight, h);
        currentX += w + gap;
      }

      const link = document.createElement('a');
      link.download = `QuickPassport_A4_Sheet_${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (err) {
      setError("Failed to generate download file.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (step === AppStep.ADJUST && images.cropped) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = images.cropped;
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        if (ctx) {
          ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
          ctx.drawImage(img, 0, 0);
          setImages(prev => ({ ...prev, final: canvas.toDataURL('image/jpeg', 1.0) }));
        }
      };
    }
  }, [adjustments, images.cropped, step]);

  const PhotoGrid = ({ isInteractive = false }: { isInteractive?: boolean }) => {
    return (
      <div className="grid grid-cols-5 gap-[2mm] justify-start content-start" style={{ width: '190mm', margin: '0 auto' }}>
        {slots.map((slot, index) => (
          <div
            key={index}
            draggable={isInteractive && slot !== null}
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
                if (draggedIndex === null) return;
                setSlots(prev => {
                  const next = [...prev];
                  const temp = next[index];
                  next[index] = next[draggedIndex];
                  next[draggedIndex] = temp;
                  return next;
                });
                setDraggedIndex(null);
            }}
            className={`relative group flex items-center justify-center bg-white border ${
              isInteractive ? 'cursor-move hover:border-blue-400 hover:shadow-xl transition-all' : ''
            } ${slot === null && isInteractive ? 'border-dashed border-slate-200 bg-slate-50/50' : 'border-slate-100'}`}
            style={{ width: '35mm', height: '45mm' }}
          >
            {slot ? (
              <img src={slot.src} className="w-full h-full object-cover pointer-events-none" />
            ) : isInteractive ? (
              <div className="flex flex-col items-center">
                  <span className="text-[14px] text-slate-200">Empty</span>
                  <span className="text-[8px] font-black text-slate-300 uppercase">Slot {index + 1}</span>
              </div>
            ) : null}
            
            {isInteractive && slot && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSlots(prev => {
                    const next = [...prev];
                    next[index] = null;
                    return next;
                  });
                }}
                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-[12px] font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110 active:scale-95"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (showA4Preview) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="print-only">
           <PhotoGrid />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between mb-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 no-print gap-6">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Final Print Sheet</h1>
              <p className="text-slate-500 font-medium">A4 Layout • {occupiedSlotsCount} of {MAX_SLOTS} slots used</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 w-full lg:w-auto">
              <button onClick={() => setShowA4Preview(false)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all">Edit More</button>
              <button onClick={handleSaveAsImage} disabled={isSaving || occupiedSlotsCount === 0} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-blue-200">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>Download JPEG</span>}
              </button>
              <button onClick={handlePrint} disabled={occupiedSlotsCount === 0} className="px-8 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                <span>Print Directly</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 no-print">
            <div className="w-full lg:w-72 flex-shrink-0 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 h-fit">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Sheet Controls</h2>
              <div className="space-y-4">
                <button onClick={() => setSlots(new Array(MAX_SLOTS).fill(null))} className="w-full py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl hover:bg-red-100 transition-colors">Clear All Slots</button>
                <button onClick={() => { setShowA4Preview(false); setStep(AppStep.UPLOAD); }} className="w-full py-4 text-blue-600 font-bold text-sm bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors flex items-center justify-center space-x-2">
                    <span>+ Add New Photo</span>
                </button>
              </div>
              <div className="mt-8 p-6 bg-blue-600 rounded-3xl text-white">
                <p className="text-[10px] font-black uppercase mb-2 opacity-80 tracking-widest">Helpful Tip</p>
                <p className="text-sm font-medium leading-relaxed">Drag any photo to move it to a different slot. Useful for saving paper!</p>
              </div>
            </div>

            <div className="a4-preview-container flex-1 bg-slate-200 p-8 rounded-3xl flex justify-center shadow-inner overflow-auto">
              <div className="a4-preview-screen shadow-2xl origin-top scale-[0.5] md:scale-[0.8] lg:scale-[1.0] transition-transform">
                  <PhotoGrid isInteractive />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="print-only"><PhotoGrid /></div>

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-5 md:px-8 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
              <span className="text-white font-black text-2xl italic">QP</span>
            </div>
            <div>
                <h1 className="text-xl font-black text-slate-900 leading-none">QuickPassport India</h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Professional Studio v2.0</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             {occupiedSlotsCount > 0 && (
                <button onClick={() => setShowA4Preview(true)} className="px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-full hover:bg-slate-800 transition-all shadow-xl flex items-center space-x-3">
                  <span className="bg-blue-600 px-2 py-0.5 rounded-full text-[10px]">{occupiedSlotsCount}</span>
                  <span>Review Sheet</span>
                </button>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-12">
        <StepIndicator currentStep={step} />

        <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-white p-6 md:p-16 min-h-[600px] flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/50 rounded-full blur-3xl -mr-40 -mt-40 -z-10 animate-pulse"></div>

          {error && (
            <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center text-sm font-bold animate-fade-in">
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          {step === AppStep.UPLOAD && (
            <div className="text-center animate-fade-in py-10">
              <div className="mb-12">
                <div className="w-32 h-32 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 border-4 border-dashed border-blue-200">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Create Professional Photos</h2>
                <p className="text-slate-500 max-w-md mx-auto text-xl font-medium leading-relaxed">Instantly format passport and visa photos with AI background removal.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-2xl mx-auto">
                <div className="p-4 bg-slate-50 rounded-2xl text-center">
                    <span className="text-2xl mb-2 block">✨</span>
                    <p className="text-[10px] font-black uppercase text-slate-400">AI Background</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl text-center">
                    <span className="text-2xl mb-2 block">📏</span>
                    <p className="text-[10px] font-black uppercase text-slate-400">Perfect Size</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl text-center">
                    <span className="text-2xl mb-2 block">🖨️</span>
                    <p className="text-[10px] font-black uppercase text-slate-400">A4 Print Ready</p>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-12 py-6 rounded-3xl font-black text-2xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 active:scale-95 flex items-center space-x-4 mx-auto"
              >
                <span>Get Started Now</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>
          )}

          {step === AppStep.SIZE_SELECT && (
            <div className="animate-fade-in flex flex-col items-center">
              <h2 className="text-3xl font-black text-slate-900 mb-10 text-center">Select Document Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
                {PHOTO_SIZES.map((size) => {
                  const cmW = (size.width / 10).toFixed(1);
                  const cmH = (size.height / 10).toFixed(1);
                  const inW = (size.width / 25.4).toFixed(2);
                  const inH = (size.height / 25.4).toFixed(2);
                  const isActive = selectedSize.id === size.id;

                  return (
                    <button
                      key={size.id}
                      onClick={() => { setSelectedSize(size); setStep(AppStep.REMOVE_BG); }}
                      className={`p-8 rounded-[32px] border-4 text-left transition-all relative overflow-hidden group ${isActive ? 'border-blue-600 bg-blue-50/50 shadow-xl' : 'border-slate-50 bg-slate-50/30 hover:border-slate-200 hover:bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                         <span className={`font-black text-xl ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>{size.name}</span>
                         <span className="text-[10px] font-black bg-white px-2 py-1 rounded-full shadow-sm text-slate-500 uppercase">{size.width}x{size.height} mm</span>
                      </div>
                      <p className="text-sm text-slate-500 font-bold mb-4">{size.description}</p>
                      
                      <div className="flex gap-6 border-t border-slate-100 pt-4">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CM</span>
                            <span className="text-xs font-black text-slate-600">{cmW} x {cmH}</span>
                         </div>
                         <div className="flex flex-col border-l border-slate-100 pl-6">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inches</span>
                            <span className="text-xs font-black text-slate-600">{inW} x {inH}</span>
                         </div>
                      </div>
                      <div className={`absolute bottom-0 right-0 p-4 transition-transform duration-300 translate-x-12 group-hover:translate-x-0 ${isActive ? 'translate-x-0' : ''}`}>
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">→</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(AppStep.UPLOAD)} className="mt-12 text-slate-400 font-bold hover:text-slate-600 tracking-tight">Go Back</button>
            </div>
          )}

          {step === AppStep.REMOVE_BG && (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="relative mb-12">
                <img src={images.original!} alt="Original" className="max-h-96 rounded-3xl shadow-3xl border-8 border-white ring-1 ring-slate-100" />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Original Image</div>
              </div>
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 border-8 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-8 shadow-inner"></div>
                  <p className="text-blue-600 font-black text-2xl tracking-tight">AI is cleaning background...</p>
                  <p className="text-slate-400 font-bold mt-2">Making it professional white</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-4 w-full max-w-md">
                  <button onClick={handleRemoveBg} className="w-full bg-blue-600 text-white px-8 py-5 rounded-[24px] font-black text-xl hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all flex items-center justify-center space-x-3">
                    <span className="text-2xl">✨</span>
                    <span>Auto-Fix Background</span>
                  </button>
                  <button onClick={() => setStep(AppStep.CROP)} className="w-full bg-slate-100 text-slate-600 px-8 py-5 rounded-[24px] font-black text-lg hover:bg-slate-200 transition-all">Continue with Current Background</button>
                </div>
              )}
            </div>
          )}

          {step === AppStep.CROP && (
            <div className="animate-fade-in">
                <Cropper 
                    imageSrc={images.noBg || images.original!} 
                    targetSize={selectedSize}
                    onCropComplete={handleCropComplete}
                    onBack={() => setStep(AppStep.REMOVE_BG)}
                />
            </div>
          )}

          {step === AppStep.ADJUST && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-16 animate-fade-in">
              <div className="flex-shrink-0 p-1.5 bg-white border-8 border-white shadow-2xl rounded-sm overflow-hidden" style={{ width: '200px', height: `${200 / (selectedSize.width / selectedSize.height)}px` }}>
                   <img src={images.final || images.cropped!} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 w-full max-w-sm space-y-10">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brightness</label>
                        <span className="text-xs font-bold text-blue-600">{adjustments.brightness}%</span>
                    </div>
                    <input type="range" min="50" max="150" value={adjustments.brightness} onChange={(e) => setAdjustments(p => ({...p, brightness: parseInt(e.target.value)}))} className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contrast</label>
                        <span className="text-xs font-bold text-blue-600">{adjustments.contrast}%</span>
                    </div>
                    <input type="range" min="50" max="150" value={adjustments.contrast} onChange={(e) => setAdjustments(p => ({...p, contrast: parseInt(e.target.value)}))} className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 shadow-sm">
                  <p className="text-sm font-black text-slate-900 mb-5">Number of copies (Max {MAX_SLOTS - occupiedSlotsCount}):</p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-white border-2 border-slate-100 rounded-2xl p-1.5 shadow-sm">
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-12 h-12 font-black text-slate-400 hover:text-blue-600 text-2xl transition-colors">-</button>
                      <span className="w-10 text-center font-black text-xl text-slate-900">{quantity}</span>
                      <button onClick={() => setQuantity(q => Math.min(MAX_SLOTS - occupiedSlotsCount, q + 1))} className="w-12 h-12 font-black text-slate-400 hover:text-blue-600 text-2xl transition-colors">+</button>
                    </div>
                    <button onClick={handleAddToSheet} disabled={occupiedSlotsCount >= MAX_SLOTS} className="flex-1 bg-blue-600 text-white h-16 rounded-2xl font-black text-lg disabled:opacity-50 shadow-xl shadow-blue-100 active:scale-95 transition-all">Add to Sheet</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === AppStep.DOWNLOAD && (
            <div className="text-center animate-fade-in py-10">
              <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-50 border-4 border-white">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-4">Photos Ready!</h2>
              <p className="text-slate-500 mb-12 max-w-xs mx-auto text-lg font-medium">Added to slot {occupiedSlotsCount-quantity+1} to {occupiedSlotsCount} of your A4 sheet.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-md mx-auto">
                <button onClick={() => { setImages({ original: null, noBg: null, cropped: null, final: null }); setStep(AppStep.UPLOAD); }} className="p-8 bg-blue-50 text-blue-600 rounded-[32px] font-black border-4 border-blue-100 hover:bg-blue-100 transition-all flex flex-col items-center group">
                  <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">+</span>
                  <span className="text-sm">Add Another Person</span>
                </button>
                <button onClick={() => setShowA4Preview(true)} className="p-8 bg-slate-900 text-white rounded-[32px] font-black hover:bg-slate-800 transition-all flex flex-col items-center group shadow-2xl shadow-slate-200">
                  <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                  <span className="text-sm">Finalize & Print</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 pt-20 pb-10 px-6 mt-20">
        <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
                <div>
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-black italic">QP</span>
                        </div>
                        <h4 className="font-black text-slate-900">QuickPassport India</h4>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                        The easiest way to generate professional passport and visa photos from home. AI-powered precision for official documents.
                    </p>
                </div>
                <div>
                    <h5 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6">Standards Supported</h5>
                    <ul className="space-y-3 text-sm font-bold text-slate-700">
                        <li className="flex items-center space-x-2">
                            <span className="text-blue-600">✓</span>
                            <span>Indian Passport (51x51mm)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                            <span className="text-blue-600">✓</span>
                            <span>Standard ID (35x45mm)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                            <span className="text-blue-600">✓</span>
                            <span>PAN Card Photo</span>
                        </li>
                    </ul>
                </div>
                <div>
                    <h5 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6">Quick Guide</h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        1. Upload a clear face photo.<br/>
                        2. Use AI to fix background.<br/>
                        3. Align face in the crop box.<br/>
                        4. Add to A4 sheet and print!
                    </p>
                </div>
            </div>
            <div className="pt-8 border-t border-slate-50 text-center">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  © 2025 QuickPassport India • Built for Professional Speed
                </p>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
