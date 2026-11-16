import React, { useState } from 'react';
import { shopApi } from '../../lib/shopApi';
import { Button } from '../Button';
import { ProductRatingStars } from './ProductRatingStars';
import { toast } from 'sonner';

interface OrderItemRatingProps {
  companyId: string;
  productId: string;
  productName: string;
  onRated: () => void;
}

export const OrderItemRating: React.FC<OrderItemRatingProps> = ({
  companyId,
  productId,
  productName,
  onRated,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await shopApi.submitRating(companyId, productId, {
        rating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Rating submitted');
      onRated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{productName}</span> — thanks for your review!
        <ProductRatingStars rating={rating} showCount={false} size="sm" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">{productName}</p>
      <p className="text-[10px] text-muted-foreground">Rate this product</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`text-lg leading-none ${star <= rating ? 'text-amber-400' : 'text-muted-foreground/30'}`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        className="input-modern py-1.5 text-xs"
        placeholder="Short review (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" onClick={handleSubmit} loading={submitting}>
        Submit rating
      </Button>
    </div>
  );
};
