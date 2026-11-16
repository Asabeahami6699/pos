import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { toast } from 'sonner';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Return `false` to keep the modal open (e.g. product not found). */
  onScan: (barcode: string) => boolean | void;
  title?: string;
  description?: string;
  enableCamera?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
  description = 'Use a barcode scanner, camera, or enter manually',
  enableCamera = true,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastKeyTime = useRef<number>(Date.now());

  useEffect(() => {
    if (!isOpen) {
      setCameraOpen(false);
      setInputValue('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (cameraOpen) return;
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (timeDiff < 50 && e.key.length === 1) {
        setIsScanning(true);
      }

      if (e.key === 'Enter' && isScanning && inputValue.length >= 3) {
        e.preventDefault();
        handleBarcode(inputValue);
      }
    };

    const handleKeyUp = () => {
      if (isScanning) {
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          if (inputValue.length >= 3) {
            handleBarcode(inputValue);
          }
          setIsScanning(false);
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearTimeout(scanTimer.current);
    };
  }, [isOpen, inputValue, isScanning, cameraOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBarcode = (barcode: string) => {
    const trimmed = barcode.trim();
    if (trimmed.length < 3) {
      toast.error('Barcode too short', { description: 'Enter at least 3 characters' });
      return;
    }

    const result = onScan(trimmed);
    setInputValue('');
    setIsScanning(false);

    if (result === false) return;

    setTimeout(() => onClose(), 200);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen && !cameraOpen} onClose={onClose} title={title} size="md">
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="relative">
            <Input
              id="barcode-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Click here, then scan barcode..."
              autoFocus
              className={`pr-10 ${isScanning ? 'border-green-500 ring-2 ring-green-200' : ''}`}
            />
          </div>

          {enableCamera && (
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="w-4 h-4" />
              Scan with camera
            </Button>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleBarcode(inputValue)}
              disabled={inputValue.length < 3}
            >
              Submit
            </Button>
          </div>
        </div>
      </Modal>

      {cameraOpen && (
        <CameraBarcodeScanner
          onScan={(code) => handleBarcode(code)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
};
