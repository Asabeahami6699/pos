import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import { validateBarcode } from '../hooks/useBarcodeScanner';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface BarcodeScannerInputProps {
  onScan: (barcode: string, type: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  showValidation?: boolean;
  onValidationChange?: (isValid: boolean, type?: string) => void;
  /** Show camera scan button (default true) */
  enableCamera?: boolean;
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  onScan,
  placeholder = 'Click here, then scan barcode...',
  className = '',
  autoFocus = true,
  showValidation = true,
  onValidationChange,
  enableCamera = true,
}) => {
  const [value, setValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [validation, setValidation] = useState<{ isValid: boolean; type?: string }>({
    isValid: false,
  });
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  const scanTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastKeyTime = useRef<number>(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cameraOpen) return;
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (timeDiff < 50 && e.key.length === 1) {
        setIsScanning(true);
      }

      if (e.key === 'Enter' && isScanning && value.length >= 3) {
        e.preventDefault();
        handleScan(value);
      }
    };

    const handleKeyUp = () => {
      if (isScanning) {
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          if (value.length >= 3) {
            handleScan(value);
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
  }, [value, isScanning, cameraOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const validationResult = validateBarcode(value);
    setValidation(validationResult);
    onValidationChange?.(validationResult.isValid, validationResult.type);
  }, [value, onValidationChange]);

  const handleScan = (barcode: string) => {
    const trimmedBarcode = barcode.trim();
    if (trimmedBarcode.length < 3) return;

    const validationResult = validateBarcode(trimmedBarcode);

    if (validationResult.isValid) {
      onScan(trimmedBarcode, validationResult.type || 'Unknown');
      setScanHistory((prev) => [trimmedBarcode, ...prev.slice(0, 4)]);
    } else {
      onScan(trimmedBarcode, 'Custom');
      setScanHistory((prev) => [trimmedBarcode, ...prev.slice(0, 4)]);
    }

    setValue('');
    setIsScanning(false);
  };

  const handleManualSubmit = () => {
    if (value.trim()) {
      handleScan(value);
    }
  };

  const clearValue = () => {
    setValue('');
    setIsScanning(false);
    clearTimeout(scanTimer.current);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus && !cameraOpen}
          className={`pr-28 ${isScanning ? 'border-green-500 ring-2 ring-green-200' : ''} ${
            !validation.isValid && value.length > 0 ? 'border-yellow-500' : ''
          }`}
        />

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1.5">
          {isScanning && (
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1" />
              <span className="text-xs font-medium">Scanning</span>
            </div>
          )}

          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={clearValue} className="h-7 px-2 text-xs">
              Clear
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleManualSubmit}
            disabled={!value.trim()}
            className="h-7 px-2 text-xs"
          >
            Lookup
          </Button>
        </div>
      </div>

      {enableCamera && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full gap-2"
          onClick={() => setCameraOpen(true)}
        >
          <Camera className="w-4 h-4" />
          Scan with camera
        </Button>
      )}

      {showValidation && value.length > 0 && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            validation.isValid ? 'bg-emerald-500/10 text-green-700' : 'bg-amber-500/10 text-yellow-700'
          }`}
        >
          {validation.isValid
            ? `✓ Valid ${validation.type} barcode`
            : '⚠ May not be standard barcode format'}
        </div>
      )}

      {scanHistory.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Recent scans:</span> {scanHistory.join(', ')}
        </div>
      )}

      <div className="text-xs text-muted-foreground flex items-start gap-2">
        <span>💡</span>
        <span>
          Use a USB/handheld scanner in this field, type a SKU, or open the camera to scan with your
          device.
        </span>
      </div>

      {cameraOpen && (
        <CameraBarcodeScanner
          onScan={(code) => handleScan(code)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
};
