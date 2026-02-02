import React, { useState, useEffect } from 'react';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ isOpen, onClose, images, initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Update internal state if prop changes (when opening)
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  if (!isOpen) return null;

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <span className="material-symbols-outlined text-2xl">close</span>
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/80 font-bold text-sm bg-black/50 px-3 py-1 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Left Arrow */}
      {images.length > 1 && (
        <button
          onClick={prevImage}
          disabled={currentIndex === 0}
          className={`absolute left-4 md:left-8 p-3 rounded-full text-white transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 cursor-pointer'
            }`}
        >
          <span className="material-symbols-outlined text-3xl md:text-4xl">chevron_left</span>
        </button>
      )}

      {/* Image Container */}
      <div
        className="relative max-w-7xl max-h-screen p-4 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
      >
        <img
          src={images[currentIndex]}
          alt={`View ${currentIndex + 1}`}
          className="max-h-[90vh] max-w-full object-contain rounded-lg shadow-2xl animate-[scale-in_0.3s_ease-out]"
        />
      </div>

      {/* Right Arrow */}
      {images.length > 1 && (
        <button
          onClick={nextImage}
          disabled={currentIndex === images.length - 1}
          className={`absolute right-4 md:right-8 p-3 rounded-full text-white transition-all ${currentIndex === images.length - 1 ? 'opacity-30 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 cursor-pointer'
            }`}
        >
          <span className="material-symbols-outlined text-3xl md:text-4xl">chevron_right</span>
        </button>
      )}
    </div>
  );
};