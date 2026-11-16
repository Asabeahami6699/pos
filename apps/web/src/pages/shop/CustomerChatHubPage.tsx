import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CustomerInboxList } from '../../components/shop/CustomerInboxList';
import { shopRoutes } from '../../lib/roleRedirect';

export const CustomerChatHubPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(shopRoutes.home)}
          className="p-2 rounded-lg hover:bg-secondary"
          aria-label="Back to marketplace"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Messages</h1>
          <p className="text-xs text-muted-foreground">Your encrypted conversations with sellers.</p>
        </div>
      </div>
      <CustomerInboxList />
    </div>
  );
};
