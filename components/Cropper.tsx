
import React, { useRef, useState, useEffect } from 'react';
import { PhotoSize } from '../types';

interface CropperProps {
  imageSrc: string;
  targetSize: PhotoSize;
  onCropComplete: (croppedImage: string) => void;
  onBack: () => void;
}

export const Cropper: React.FC<CropperProps> = ({ imageSrc, targetSize, onCropComplete, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const ASPECT_RATIO = targetSize.width / targetSize.height;

  useEffect(() => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      setImg(image);
      if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const initialScale = Math.min(cw / image.width, ch / image.height) * 1.5;
        setScale(initialScale);
      }
    };
  }, [imageSrc]);

  useEffect(() => {
    if (!img || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current.clientWidth;
    const height = width / ASPECT_RATIO;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

  }, [img, offset, scale, ASPECT_RATIO]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const pos = 'touches' in e ? e.touches[0] : e;
    setDragStart({ x: pos.clientX - offset.x, y: pos.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const pos = 'touches' in e ? e.touches[0] : e;
    setOffset({
      x: pos.clientX - dragStart.x,
      y: pos.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleExport = () => {
    if (!canvasRef.current) return;
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    if (!ctx || !img) return;

    // Use 300DPI calculation for quality (1mm = 11.81 pixels at 300DPI)
    const exportWidth = Math.round(targetSize.width * 11.81);
    const exportHeight = Math.round(targetSize.height * 11.81);
    
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    const scaleFactor = exportWidth / canvasRef.current.width;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.save();
    ctx.translate(exportCanvas.width / 2 + offset.x * scaleFactor, exportCanvas.height / 2 + offset.y * scaleFactor);
    ctx.scale(scale * scaleFactor, scale * scaleFactor);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    onCropComplete(exportCanvas.toDataURL('image/jpeg', 0.95));
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Crop: {targetSize.name}</h2>
        <p className="text-sm text-gray-500">{targetSize.width}mm x {targetSize.height}mm</p>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-gray-100 border-2 border-dashed border-gray-300 overflow-hidden cursor-move touch-none"
        style={{ width: '100%', maxWidth: '350px', aspectRatio: ASPECT_RATIO }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center space-x-4">
          <label className="text-xs font-black text-slate-400 uppercase">Zoom</label>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.01" 
            value={scale} 
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>

      <div className="flex space-x-4 w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleExport}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          Confirm Crop
        </button>
      </div>
    </div>
  );
};
