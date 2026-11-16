import { Toaster } from './Toaster';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={theme}
      richColors
      closeButton
    />
  );
}
