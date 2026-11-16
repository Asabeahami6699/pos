import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, type Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { Camera, CameraOff, SwitchCamera, X } from 'lucide-react';
import { Button } from './Button';
import { toast } from 'sonner';

interface CameraBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  /** Prefer rear camera on phones */
  facingMode?: 'environment' | 'user';
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  onClose,
  facingMode = 'environment',
}) => {
  const reactId = useId().replace(/:/g, '');
  const readerId = `camera-barcode-reader-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>(facingMode);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    const config: Html5QrcodeCameraScanConfig = {
      fps: 10,
      qrbox: (viewW, viewH) => {
        const edge = Math.min(viewW, viewH);
        const size = Math.max(180, Math.floor(edge * 0.72));
        return { width: size, height: Math.floor(size * 0.55) };
      },
      aspectRatio: 1.777,
      disableFlip: false,
    };

    const start = async () => {
      setStarting(true);
      setError(null);
      try {
        await scanner.start(
          { facingMode: facing },
          config,
          (decoded) => {
            if (handlingRef.current || cancelled) return;
            const code = decoded.trim();
            if (code.length < 3) return;
            handlingRef.current = true;
            void (async () => {
              try {
                if (scanner.isScanning) await scanner.stop();
              } catch {
                /* ignore */
              }
              onScan(code);
              onClose();
            })();
          },
          () => {
            /* ignore frame decode misses */
          },
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : 'Could not start the camera. Check browser permissions.';
        if (!cancelled) {
          setError(message);
          setStarting(false);
          toast.error('Camera unavailable', { description: message });
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const active = scannerRef.current;
      scannerRef.current = null;
      if (!active) return;
      void (async () => {
        try {
          if (active.isScanning) await active.stop();
        } catch {
          /* ignore */
        }
        try {
          active.clear();
        } catch {
          /* ignore */
        }
      })();
    };
  }, [facing, onClose, onScan, readerId]);

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;
    try {
      // html5-qrcode exposes applyVideoConstraints on the running instance
      const next = !torchOn;
      await (scanner as unknown as { applyVideoConstraints: (c: unknown) => Promise<void> }).applyVideoConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      toast.info('Torch not supported on this device');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/90">
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Scan with camera</p>
          <p className="text-[11px] text-white/70">Point at a barcode or QR code</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative px-3 pb-3">
        <div
          id={readerId}
          className="w-full h-full max-w-lg mx-auto overflow-hidden rounded-xl bg-black [&_video]:object-cover [&_video]:rounded-xl"
        />
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto rounded-xl bg-destructive/15 border border-destructive/40 p-4 text-sm text-red-100 space-y-3">
            <div className="flex items-start gap-2">
              <CameraOff className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
            <p className="text-xs text-white/70">
              Allow camera access in your browser settings, then try again. You can still type or use a USB scanner.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-6 pt-2 flex items-center justify-center gap-2 flex-wrap">
        <Button type="button" variant="secondary" size="sm" onClick={toggleFacing} className="gap-1.5">
          <SwitchCamera className="w-4 h-4" />
          Flip camera
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => void toggleTorch()} className="gap-1.5">
          <Camera className="w-4 h-4" />
          {torchOn ? 'Torch off' : 'Torch'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10">
          Cancel
        </Button>
      </div>
    </div>
  );
};
