import React from 'react';
import { WhatsAppConnectView, WhatsAppConnectedStatus } from './WhatsAppConnectView';

interface WhatsAppEmbeddedSignupPageProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onAccountConnected?: (account: WhatsAppConnectedStatus) => void;
}

export const WhatsAppEmbeddedSignupPage: React.FC<WhatsAppEmbeddedSignupPageProps> = ({
  userId = 'default_workspace',
  userEmail = 'operator@flowpilot.app',
  onBackToDashboard,
  onAccountConnected,
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] py-8 px-4 sm:px-6 lg:px-8">
      <WhatsAppConnectView
        userId={userId}
        userEmail={userEmail}
        onBackToDashboard={onBackToDashboard}
        onAccountConnected={onAccountConnected}
      />
    </div>
  );
};
