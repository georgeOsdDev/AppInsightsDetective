import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { QueryPanel } from '../components/QueryPanel';
import { TemplatePanel } from '../components/TemplatePanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { SettingsModal } from '../components/SettingsModal';
import { APIClient } from '../services/api';

export type PanelType = 'query' | 'templates' | 'history';

const Home: React.FC = () => {
  const [currentPanel, setCurrentPanel] = useState<PanelType>('query');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('Initializing...');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize API client and start session
      const apiClient = new APIClient();
      await apiClient.startSession();
      
      setSessionStatus('Connected');
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setSessionStatus('Connection Failed');
    }
  };

  const handlePanelChange = (panel: PanelType) => {
    setCurrentPanel(panel);
  };

  const renderCurrentPanel = () => {
    switch (currentPanel) {
      case 'templates':
        return <TemplatePanel />;
      case 'history':
        return <HistoryPanel />;
      default:
        return <QueryPanel />;
    }
  };

  return (
    <>
      <Head>
        <title>AppInsights Detective - Web UI</title>
        <meta name="description" content="Query Azure Application Insights with natural language using AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="app">
        <Header 
          sessionStatus={sessionStatus}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />
        
        <div className="main-layout">
          <Sidebar 
            currentPanel={currentPanel}
            onPanelChange={handlePanelChange}
          />
          
          <main className="main-content">
            {renderCurrentPanel()}
          </main>
        </div>
        
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </>
  );
};

export default Home;