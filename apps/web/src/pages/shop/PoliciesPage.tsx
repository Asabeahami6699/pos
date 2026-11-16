import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SeoHead } from '../../components/shop/SeoHead';

const CONTENT: Record<string, { title: string; sections: Array<{ heading: string; body: string }> }> = {
  shipping: {
    title: 'Shipping & delivery',
    sections: [
      {
        heading: 'Delivery areas',
        body: 'We deliver across Ghana. Accra/Tema typically 1–3 business days; other regions 3–7 business days depending on the seller.',
      },
      {
        heading: 'Shipping fees',
        body: 'Fees are calculated at checkout based on your region and order total. Orders over ₵500 may qualify for reduced delivery fees. Store pickup is always free.',
      },
      {
        heading: 'Tracking',
        body: 'Once your order ships, you can track it from My Orders. Guest buyers receive a tracking link after checkout.',
      },
    ],
  },
  returns: {
    title: 'Returns & refunds',
    sections: [
      {
        heading: 'Eligibility',
        body: 'Items may be returned within 7 days of delivery if damaged, defective, or not as described. Perishable goods and custom items may be excluded.',
      },
      {
        heading: 'How to request a return',
        body: 'Go to My Orders, open the order, and tap Request return. The seller will review and approve or reject within 48 hours.',
      },
      {
        heading: 'Refunds',
        body: 'Approved returns are refunded to your original payment method (Paystack) or marked for cash refund on pay-on-delivery orders.',
      },
    ],
  },
  faq: {
    title: 'FAQ',
    sections: [
      {
        heading: 'Do I need an account?',
        body: 'You can browse freely. Guest checkout is available for pay-on-delivery. Create an account to save addresses, track all orders, and earn loyalty points.',
      },
      {
        heading: 'Can I order from multiple stores?',
        body: 'Yes. Your cart can include items from different sellers. Each store is checked out separately — you will complete payment or placement per store.',
      },
      {
        heading: 'Wholesale pricing',
        body: 'Some products offer wholesale prices. Use the Wholesale tab on the home page or select wholesale on the product page when available.',
      },
      {
        heading: 'How do I contact a seller?',
        body: 'Use Chat with seller on the product or store page, or the floating messages button when signed in.',
      },
    ],
  },
  about: {
    title: 'About marketplace',
    sections: [
      {
        heading: 'What we are',
        body: 'A multi-vendor marketplace connecting local businesses with customers across Ghana. Sellers manage inventory via POS; buyers shop retail or wholesale.',
      },
      {
        heading: 'Secure payments',
        body: 'Pay with Paystack (card, MoMo, bank) or choose pay on delivery where offered. Orders are only created after successful online payment verification.',
      },
      {
        heading: 'For businesses',
        body: 'Want to sell? Contact us to onboard your company. Staff can manage inventory, online orders, and payouts from the admin dashboard.',
      },
    ],
  },
};

export const PoliciesPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const page = CONTENT[slug ?? ''] ?? CONTENT.faq;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SeoHead title={page.title} />
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Marketplace
      </Link>
      <h1 className="text-2xl font-bold">{page.title}</h1>
      <div className="space-y-6">
        {page.sections.map((s) => (
          <section key={s.heading} className="glass-card p-4">
            <h2 className="text-sm font-semibold mb-2">{s.heading}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.keys(CONTENT).map((key) => (
          <Link
            key={key}
            to={`/help/${key}`}
            className={`capitalize hover:text-primary ${slug === key ? 'text-primary font-medium' : 'text-muted-foreground'}`}
          >
            {key}
          </Link>
        ))}
      </div>
    </div>
  );
};
