import { useState, useEffect, useRef, useCallback } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  delay?: number;
  enableEnterKey?: boolean;
  enableTimeout?: boolean;
}

interface BarcodeScannerReturn {
  inputValue: string;
  isScanning: boolean;
  handleInputChange: (value: string) => void;
  clearScan: () => void;
  setInputValue: (value: string) => void;
}

/**
 * Custom hook for detecting barcode scanner input
 * @param options Configuration options
 * @returns Object containing scanner state and handlers
 */
export const useBarcodeScanner = ({
  onScan,
  minLength = 8,
  delay = 100,
  enableEnterKey = true,
  enableTimeout = true
}: BarcodeScannerOptions): BarcodeScannerReturn => {
  const [inputValue, setInputValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scanTimer = useRef<NodeJS.Timeout>();
  const lastKeyTime = useRef<number>(Date.now());
  const isManualInput = useRef<boolean>(false);

  // Detect scanner input (fast typing vs manual typing)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const now = Date.now();
    const timeDiff = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // Skip if it's a control key or Enter
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // If keys are coming very fast (less than 50ms apart), it's likely a scanner
      if (timeDiff < 50) {
        setIsScanning(true);
        isManualInput.current = false;
      } else {
        // If slower, it's likely manual typing
        isManualInput.current = true;
        setIsScanning(false);
      }
    }

    // Handle Enter key from scanner
    if (enableEnterKey && e.key === 'Enter' && isScanning && !isManualInput.current) {
      e.preventDefault();
      if (inputValue.length >= minLength) {
        onScan(inputValue.trim());
        setInputValue('');
        setIsScanning(false);
        isManualInput.current = false;
      }
    }
  }, [inputValue, isScanning, minLength, onScan, enableEnterKey]);

  const handleKeyUp = useCallback(() => {
    if (isScanning && !isManualInput.current && enableTimeout) {
      clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => {
        if (inputValue.length >= minLength) {
          onScan(inputValue.trim());
          setInputValue('');
        }
        setIsScanning(false);
        isManualInput.current = false;
      }, delay);
    }
  }, [inputValue, isScanning, minLength, onScan, delay, enableTimeout]);

  // Add event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearTimeout(scanTimer.current);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Reset scanning state after manual input pause
  useEffect(() => {
    if (isManualInput.current) {
      const timer = setTimeout(() => {
        isManualInput.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [inputValue]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // If user manually types and then pastes, reset scanning state
    if (value.length > inputValue.length + 1) {
      setIsScanning(false);
      isManualInput.current = true;
    }
  };

  const clearScan = () => {
    setInputValue('');
    setIsScanning(false);
    isManualInput.current = false;
    clearTimeout(scanTimer.current);
  };

  return {
    inputValue,
    isScanning,
    handleInputChange,
    clearScan,
    setInputValue
  };
};

/**
 * Helper function to validate barcode formats
 */
export const validateBarcode = (barcode: string): { isValid: boolean; type?: string } => {
  const trimmed = barcode.trim();
  
  // UPC-A (12 digits)
  if (/^\d{12}$/.test(trimmed)) {
    return { isValid: true, type: 'UPC-A' };
  }
  
  // EAN-13 (13 digits)
  if (/^\d{13}$/.test(trimmed)) {
    return { isValid: true, type: 'EAN-13' };
  }
  
  // EAN-8 (8 digits)
  if (/^\d{8}$/.test(trimmed)) {
    return { isValid: true, type: 'EAN-8' };
  }
  
  // Code 128 (variable length, alphanumeric)
  if (/^[A-Za-z0-9\-\.\ \$\/\+\%]{4,}$/.test(trimmed)) {
    return { isValid: true, type: 'Code 128' };
  }
  
  // Code 39 (starts and ends with *, alphanumeric)
  if (/^\*[A-Z0-9\-\.\ \$\/\+\%]+\*$/.test(trimmed)) {
    return { isValid: true, type: 'Code 39' };
  }
  
  // SKU format (alphanumeric with dashes)
  if (/^[A-Z0-9]+([-_\s][A-Z0-9]+)*$/i.test(trimmed) && trimmed.length >= 3) {
    return { isValid: true, type: 'SKU' };
  }
  
  return { isValid: false };
};

/**
 * Hook specifically for scanning physical barcode scanners
 * This version focuses on physical scanner detection
 */
export const usePhysicalBarcodeScanner = (onScan: (barcode: string) => void, options?: {
  minLength?: number;
  endCharacter?: string;
}) => {
  const { minLength = 3, endCharacter = 'Enter' } = options || {};
  const [scannedValue, setScannedValue] = useState('');
  const [isScannerActive, setIsScannerActive] = useState(false);
  const scannerBuffer = useRef('');
  const scannerTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleScannerInput = (e: KeyboardEvent) => {
      // Ignore if it's a modifier key
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      
      // Start scanning if it's the first character and not Enter/Tab
      if (scannerBuffer.current === '' && key !== 'Enter' && key !== 'Tab') {
        setIsScannerActive(true);
      }

      // Add character to buffer
      if (key.length === 1) {
        scannerBuffer.current += key;
      }

      // Clear any existing timeout
      clearTimeout(scannerTimeout.current);

      // Check for end character (usually Enter or Tab)
      if (key === endCharacter && scannerBuffer.current.length >= minLength) {
        e.preventDefault();
        const barcode = scannerBuffer.current;
        scannerBuffer.current = '';
        setIsScannerActive(false);
        onScan(barcode);
      } else {
        // Set timeout to auto-detect end of scan (for scanners without Enter)
        scannerTimeout.current = setTimeout(() => {
          if (scannerBuffer.current.length >= minLength) {
            const barcode = scannerBuffer.current;
            scannerBuffer.current = '';
            setIsScannerActive(false);
            onScan(barcode);
          } else {
            // If not enough characters, assume manual typing
            scannerBuffer.current = '';
            setIsScannerActive(false);
          }
        }, 150);
      }
    };

    window.addEventListener('keydown', handleScannerInput);

    return () => {
      window.removeEventListener('keydown', handleScannerInput);
      clearTimeout(scannerTimeout.current);
    };
  }, [onScan, minLength, endCharacter]);

  return {
    scannedValue,
    isScannerActive,
    clearScanner: () => {
      scannerBuffer.current = '';
      setIsScannerActive(false);
      clearTimeout(scannerTimeout.current);
    }
  };
};

/**
 * Hook for camera-based barcode scanning
 */
export const useCameraBarcodeScanner = () => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCameraScan = async () => {
    try {
      // Check for camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      setIsCameraActive(true);
      setCameraError(null);
      
      return stream;
    } catch (error: any) {
      setCameraError(error.message);
      throw error;
    }
  };

  const stopCameraScan = (stream?: MediaStream) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  return {
    isCameraActive,
    cameraError,
    startCameraScan,
    stopCameraScan
  };
};