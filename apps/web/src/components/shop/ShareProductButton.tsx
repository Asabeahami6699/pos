import React from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareProductButtonProps {
  title: string;
  url: string;
  className?: string;
}

export const ShareProductButton: React.FC<ShareProductButtonProps> = ({
  title,
  url,
  className = '',
}) => {
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  const text = `Check out ${title} on Marketplace`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: fullUrl });
        return;
      } catch {
        /* cancelled */
      }
    }

    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${fullUrl}`)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
    toast.success('Opening share…');
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ${className}`}
    >
      <Share2 className="w-3.5 h-3.5" />
      Share
    </button>
  );
};
