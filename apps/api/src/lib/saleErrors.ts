export function parseInsufficientStock(error: unknown): {
  productId: string;
  need: number;
  have: number;
} | null {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message ?? '')
        : String(error ?? '');

  const match = message.match(/INSUFFICIENT_STOCK:([^:]+):(\d+):(\d+)/);
  if (!match) return null;
  return {
    productId: match[1],
    need: Number(match[2]),
    have: Number(match[3]),
  };
}
