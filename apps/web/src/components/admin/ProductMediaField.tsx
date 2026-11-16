import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, X, Film, Star } from 'lucide-react';
import { getMediaKind, validateProductMedia } from '../../lib/productMediaUpload';

export interface MediaPreview {
  file: File;
  previewUrl: string;
  kind: 'image' | 'video';
}

export interface ExistingMediaItem {
  id?: string;
  url: string;
  media_type: 'image' | 'video';
}

type SlideItem =
  | { key: string; source: 'existing'; url: string; mediaType: 'image' | 'video' }
  | { key: string; source: 'new'; previewUrl: string; kind: 'image' | 'video'; index: number };

interface ProductMediaFieldProps {
  value: MediaPreview[];
  onChange: (items: MediaPreview[]) => void;
  existingUrls?: ExistingMediaItem[];
  coverKey?: string | null;
  onCoverChange?: (key: string) => void;
}

export const ProductMediaField: React.FC<ProductMediaFieldProps> = ({
  value,
  onChange,
  existingUrls = [],
  coverKey = null,
  onCoverChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo<SlideItem[]>(() => {
    const items: SlideItem[] = existingUrls.map((item) => ({
      key: item.url,
      source: 'existing',
      url: item.url,
      mediaType: item.media_type,
    }));
    value.forEach((item, index) => {
      items.push({
        key: item.previewUrl,
        source: 'new',
        previewUrl: item.previewUrl,
        kind: item.kind,
        index,
      });
    });
    return items;
  }, [existingUrls, value]);

  const safeIndex = slides.length === 0 ? 0 : Math.min(activeIndex, slides.length - 1);
  const current = slides[safeIndex];

  const slideKey = (slide: SlideItem) => (slide.source === 'existing' ? slide.url : slide.previewUrl);
  const slideIsImage = (slide: SlideItem) =>
    slide.source === 'existing' ? slide.mediaType === 'image' : slide.kind === 'image';

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next = [...value];
    let firstNewImageKey: string | null = null;

    for (const file of Array.from(fileList)) {
      const validationError = validateProductMedia(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      const kind = getMediaKind(file);
      if (!kind) continue;
      const previewUrl = URL.createObjectURL(file);
      if (kind === 'image' && !firstNewImageKey) firstNewImageKey = previewUrl;
      next.push({ file, previewUrl, kind });
    }

    setError(null);
    onChange(next);
    setActiveIndex(existingUrls.length + next.length - 1);

    if (onCoverChange && !coverKey && firstNewImageKey) {
      onCoverChange(firstNewImageKey);
    }
  };

  const removeNew = (index: number) => {
    const removed = value[index];
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    if (onCoverChange && coverKey === removed.previewUrl) {
      const fallback =
        existingUrls.find((e) => e.media_type === 'image')?.url ??
        next.find((n) => n.kind === 'image')?.previewUrl ??
        null;
      if (fallback) onCoverChange(fallback);
    }
    setActiveIndex((i) => Math.max(0, i - 1));
  };

  const selectSlide = (index: number) => {
    setActiveIndex(index);
    const slide = slides[index];
    if (!slide || !slideIsImage(slide) || !onCoverChange) return;
    onCoverChange(slideKey(slide));
  };

  const renderCoverBadge = (key: string) =>
    coverKey === key ? (
      <span className="absolute bottom-0 inset-x-0 bg-primary text-primary-foreground text-[8px] font-bold text-center py-0.5 flex items-center justify-center gap-0.5">
        <Star className="w-2.5 h-2.5 fill-current" />
        Cover
      </span>
    ) : null;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Product photos & videos</label>

      {/* Preview carousel */}
      {slides.length > 0 && current && (
        <div className="space-y-2">
          <div className="relative w-full aspect-[4/3] max-h-44 rounded-lg overflow-hidden bg-secondary/80 border border-border">
            {current.source === 'existing' ? (
              current.mediaType === 'video' ? (
                <video
                  src={current.url}
                  controls
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <img src={current.url} alt="" className="w-full h-full object-contain" />
              )
            ) : current.kind === 'video' ? (
              <video
                src={current.previewUrl}
                controls
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <img src={current.previewUrl} alt="" className="w-full h-full object-contain" />
            )}

            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => (i === 0 ? slides.length - 1 : i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => (i === slides.length - 1 ? 0 : i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white"
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                  {slides.map((_, i) => (
                    <button
                      key={`dot-${i}`}
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i === safeIndex ? 'bg-primary' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {slideIsImage(current) && onCoverChange && (
            <button
              type="button"
              onClick={() => onCoverChange(slideKey(current))}
              className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                coverKey === slideKey(current)
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {coverKey === slideKey(current) ? 'Cover image' : 'Set as cover image'}
            </button>
          )}
        </div>
      )}

      {/* Thumbnails */}
      <div className="flex flex-wrap gap-2">
        {slides.map((slide, index) => {
          const key = slideKey(slide);
          const isCover = coverKey === key;
          const isActive = index === safeIndex;
          const isImage = slideIsImage(slide);

          return (
            <div
              key={key}
              className={`w-20 h-20 rounded-lg bg-secondary/80 border overflow-hidden relative group ${
                isCover ? 'border-primary ring-2 ring-primary/30' : isActive ? 'border-primary/60' : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => selectSlide(index)}
                className="w-full h-full block"
                title={isImage ? (isCover ? 'Cover image' : 'View & set as cover') : 'View video'}
              >
                {slide.source === 'existing' ? (
                  slide.mediaType === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-6 h-6 text-muted-foreground" />
                    </div>
                  ) : (
                    <img src={slide.url} alt="" className="w-full h-full object-cover" />
                  )
                ) : slide.kind === 'video' ? (
                  <video src={slide.previewUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={slide.previewUrl} alt="" className="w-full h-full object-cover" />
                )}
              </button>
              {renderCoverBadge(key)}
              {slide.source === 'new' && (
                <button
                  type="button"
                  onClick={() => removeNew(slide.index)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <ImagePlus className="w-5 h-5" />
          <span className="text-[9px] mt-1">Add</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-[11px] text-muted-foreground">
        Slide through previews above. Click an image thumbnail or use &quot;Set as cover&quot; for the marketplace icon.
      </p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
};
