import React from 'react';
import { ConnectWhatsAppPage, EvolutionConnectionStatus } from './ConnectWhatsAppPage';

interface WhatsAppEmbeddedSignupPageProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onAccountConnected?: (account: { instanceName?: string; number?: string; status?: EvolutionConnectionStatus }) => void;
  onOpenAuth?: () => void;
}

export const WhatsAppEmbeddedSignupPage: React.FC<WhatsAppEmbeddedSignupPageProps> = ({
  onBackToDashboard,
  onAccountConnected,
  onOpenAuth,
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16]">
      <ConnectWhatsAppPage
        onBackToDashboard={onBackToDashboard}
        onOpenAuth={onOpenAuth}
        onAccountConnected={(details) => {
          const number = details.ownerJid
            ? details.ownerJid.split('@')[0].replace(/[^0-9+]/g, '')
            : undefined;
          onAccountConnected?.({
            instanceName: details.instanceName,
            status: details.status,
            number,
          });
        }}
      />
    </div>
  );
};
