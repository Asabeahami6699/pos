import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Maximize2,
  Minus,
  Plus,
  X,
  ZoomIn,
} from 'lucide-react';
import { ProductImage } from './ProductImage';
import { buildProductMediaSlides } from '../../lib/productMediaSlides';
import type { ProductMediaItem } from '../../stores/ecommerceCatalogStore';

interface ProductMediaGalleryProps {
  name: string;
  imageUrl?: string | null;
  media?: ProductMediaItem[];
  className?: string;
  autoPlay?: boolean;
  autoPlayIntervalMs?: number;
  /** Shorter gallery for product detail (not square) */
  compact?: boolean;
}

export const ProductMediaGallery: React.FC<ProductMediaGalleryProps> = ({
  name,
  imageUrl,
  media = [],
  className = '',
  autoPlay = false,
  autoPlayIntervalMs = 4000,
  compact = false,
}) => {
  const slides = buildProductMediaSlides(imageUrl, media);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageTimerRef = useRef<number | null>(null);

  const mediaKey = media?.map((m) => m.url).join('|') ?? '';

  useEffect(() => {
    setIndex(0);
  }, [imageUrl, mediaKey]);

  const current = slides[index];
  const hasMultiple = slides.length > 1;

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') setIndex((i) => (i === 0 ? slides.length - 1 : i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => (i === slides.length - 1 ? 0 : i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, slides.length]);

  useEffect(() => {
    const el = zoomContainerRef.current;
    if (!el || !lightboxOpen || current?.media_type === 'video') return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.15 : -0.15))));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [lightboxOpen, index, current?.media_type]);

  const advanceSlide = useCallback(() => {
    setIndex((i) => (i === slides.length - 1 ? 0 : i + 1));
  }, [slides.length]);

  useEffect(() => {
    if (!autoPlay || !hasMultiple || lightboxOpen) return;

    const slide = slides[index];
    if (slide?.media_type === 'video') return;

    imageTimerRef.current = window.setInterval(advanceSlide, autoPlayIntervalMs);
    return () => {
      if (imageTimerRef.current !== null) {
        window.clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
    };
  }, [autoPlay, autoPlayIntervalMs, hasMultiple, lightboxOpen, slides, index, advanceSlide]);

  useEffect(() => {
    const el = videoRef.current;
    if (!autoPlay || !hasMultiple || lightboxOpen || current?.media_type !== 'video') return;

    const onEnded = () => advanceSlide();
    el?.addEventListener('ended', onEnded);
    return () => el?.removeEventListener('ended', onEnded);
  }, [autoPlay, hasMultiple, lightboxOpen, index, current, advanceSlide]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || current?.media_type !== 'video') return;
    el.muted = true;
    el.currentTime = 0;
    void el.play().catch(() => {});
  }, [index, current?.url, current?.media_type]);

  const viewerClass = compact
    ? 'relative w-full aspect-[4/3] max-h-52 bg-secondary/80 overflow-hidden rounded-lg group'
    : 'relative w-full aspect-square bg-secondary/80 overflow-hidden rounded-lg group';

  const prev = useCallback(
    () => setIndex((i) => (i === 0 ? slides.length - 1 : i - 1)),
    [slides.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i === slides.length - 1 ? 0 : i + 1)),
    [slides.length],
  );

  const openLightbox = (slideIndex: number) => {
    setIndex(slideIndex);
    setZoom(1);
    setLightboxOpen(true);
  };

  if (slides.length === 0) {
    return (
      <div
        className={`w-full bg-secondary/80 flex items-center justify-center overflow-hidden ${
          compact ? 'aspect-[4/3] max-h-52' : 'aspect-square'
        } ${className}`}
      >
        <ProductImage name={name} iconClassName="text-5xl opacity-40" />
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        {/* Main viewer */}
        <div className={viewerClass}>
          {current.media_type === 'video' ? (
            <video
              ref={videoRef}
              key={current.url}
              src={current.url}
              controls
              autoPlay
              muted
              loop={!(autoPlay && hasMultiple)}
              playsInline
              preload="auto"
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <button
              type="button"
              onClick={() => openLightbox(index)}
              className="w-full h-full block"
              aria-label="View full size"
            >
              <img
                src={current.url}
                alt={name}
                className="w-full h-full object-contain cursor-zoom-in"
              />
            </button>
          )}

          {current.media_type !== 'video' && (
            <button
              type="button"
              onClick={() => openLightbox(index)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Expand image"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {current.media_type === 'video' && (
            <Film className="absolute top-2 left-2 w-4 h-4 text-white drop-shadow pointer-events-none" />
          )}

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                {slides.map((slide, i) => (
                  <button
                    key={`${slide.url}-${i}`}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === index ? 'bg-primary' : 'bg-white/50'
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {hasMultiple && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {slides.map((slide, i) => (
              <button
                key={`thumb-${slide.url}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
                  i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                aria-label={`View slide ${i + 1}`}
              >
                {slide.media_type === 'video' ? (
                  <div className="w-full h-full bg-black/80 flex items-center justify-center">
                    <Film className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <img src={slide.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox with zoom */}
      {lightboxOpen && current && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} gallery`}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <p className="text-sm font-medium truncate">
              {name} ({index + 1}/{slides.length})
            </p>
            <div className="flex items-center gap-2">
              {current.media_type === 'image' && (
                <>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                    className="p-2 rounded-lg hover:bg-white/10"
                    aria-label="Zoom out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
                    className="p-2 rounded-lg hover:bg-white/10"
                    aria-label="Zoom in"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4 min-h-0">
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {current.media_type === 'video' ? (
              <video
                key={`lb-${current.url}`}
                src={current.url}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div
                ref={zoomContainerRef}
                className="overflow-auto max-w-full max-h-full flex items-center justify-center"
              >
                <img
                  src={current.url}
                  alt={name}
                  style={{ transform: `scale(${zoom})` }}
                  className="max-w-[min(100vw-2rem,900px)] max-h-[70vh] object-contain transition-transform duration-150 cursor-zoom-in"
                  draggable={false}
                />
              </div>
            )}
          </div>

          {hasMultiple && (
            <div className="shrink-0 px-4 py-3 flex gap-2 overflow-x-auto justify-center scrollbar-thin">
              {slides.map((slide, i) => (
                <button
                  key={`lb-thumb-${slide.url}-${i}`}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setZoom(1);
                  }}
                  className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 ${
                    i === index ? 'border-primary' : 'border-white/30'
                  }`}
                >
                  {slide.media_type === 'video' ? (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <Film className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <img src={slide.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}

          {current.media_type === 'image' && zoom === 1 && (
            <p className="text-center text-[10px] text-white/50 pb-3 flex items-center justify-center gap-1">
              <ZoomIn className="w-3 h-3" />
              Scroll or use +/- to zoom
            </p>
          )}
        </div>
      )}
    </>
  );
};

/** @deprecated Use ProductMediaGallery */
export const ProductMediaCarousel = ProductMediaGallery;
