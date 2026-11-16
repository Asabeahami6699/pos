import React, { useState, useRef } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  showCameraButton?: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClear,
  placeholder = 'Click here, then scan barcode...',
  className = '',
  showCameraButton = true
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [usingCamera, setUsingCamera] = useState(false);
  const scanTimer = useRef<NodeJS.Timeout>();
  const lastKeyTime = useRef<number>(Date.now());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const now = Date.now();
    const timeDiff = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // Detect scanner input (fast typing)
    if (timeDiff < 50 && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      setIsScanning(true);
    }

    // Handle Enter key from scanner
    if (e.key === 'Enter' && isScanning) {
      e.preventDefault();
      if (inputValue.length >= 8) {
        onScan(inputValue);
        setInputValue('');
        setIsScanning(false);
      }
    }
  };

  const handleKeyUp = () => {
    if (isScanning) {
      clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => {
        if (inputValue.length >= 8) {
          onScan(inputValue);
          setInputValue('');
        }
        setIsScanning(false);
      }, 100);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const clearInput = () => {
    setInputValue('');
    setIsScanning(false);
    clearTimeout(scanTimer.current);
    onClear?.();
  };

  const startCameraScan = () => {
    setUsingCamera(true);
    // Camera scanning implementation would go here
    // Could use libraries like html5-qrcode or react-qr-reader
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Barcode Scanner
        </label>
        {isScanning && (
          <div className="flex items-center text-green-600">
            <div className="w-2 h-2 bg-emerald-500/100 rounded-full animate-pulse mr-1"></div>
            <span className="text-xs font-medium">Scanning...</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder={placeholder}
            className={`pr-10 ${isScanning ? 'border-green-500 ring-1 ring-green-500' : ''}`}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {isScanning ? (
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="text-muted-foreground">📷</span>
            )}
          </div>
        </div>
        
        <Button
          type="button"
          variant="secondary"
          onClick={clearInput}
        >
          Clear
        </Button>
        
        {showCameraButton && (
          <Button
            type="button"
            variant="outline"
            onClick={startCameraScan}
          >
            Camera
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Scan barcode to auto-fill details. Most scanners send "Enter" after scanning.
        {usingCamera && (
          <span className="text-blue-600 ml-1">Camera mode activated</span>
        )}
      </p>
    </div>
  );
};