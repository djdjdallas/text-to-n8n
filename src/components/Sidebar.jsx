import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Badge from './ui/Badge';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const [activeTab, setActiveTab] = useState('history');
  
  const sidebarWidth = isCollapsed ? 'w-12' : 'w-64';
  
  const tabs = [
    { id: 'history', label: 'History', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </svg>
    ) },
    { id: 'templates', label: 'Templates', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 4H20V20H4V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M4 9H20" stroke="currentColor" strokeWidth="2" />
        <path d="M9 9V20" stroke="currentColor" strokeWidth="2" />
      </svg>
    ) },
    { id: 'tips', label: 'Tips', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </svg>
    ) },
  ];
  
  const historyItems = [
    { id: 1, title: 'Gmail to Drive workflow', timestamp: '2 hours ago', platform: 'n8n' },
    { id: 2, title: 'Weekly report generator', timestamp: '5 hours ago', platform: 'zapier' },
    { id: 3, title: 'Slack notification system', timestamp: '1 day ago', platform: 'make' },
  ];
  
  const templateItems = [
    { id: 1, title: 'Email Parser', description: 'Extract data from emails automatically', category: 'Communication' },
    { id: 2, title: 'Social Media Scheduler', description: 'Schedule posts across platforms', category: 'Marketing' },
    { id: 3, title: 'Lead Capture', description: 'Capture and process new leads', category: 'Sales' },
  ];
  
  const tipItems = [
    { id: 1, tip: 'Use specific action verbs like "extract", "filter", or "transform" for better results.' },
    { id: 2, tip: 'Mention specific apps by name (Gmail, Slack, etc.) for more accurate integrations.' },
    { id: 3, tip: 'Include timing details like "every Monday" or "when new data arrives" for triggers.' },
  ];
  
  const renderTabContent = () => {
    if (isCollapsed) return null;
    
    switch (activeTab) {
      case 'history':
        return (
          <div className="space-y-2">
            {historyItems.map((item) => (
              <Card key={item.id} className="cursor-pointer hover:bg-card/80">
                <CardContent className="p-3">
                  <h4 className="font-medium">{item.title}</h4>
                  <div className="mt-1 flex justify-between text-xs text-muted">
                    <span>{item.timestamp}</span>
                    <Badge variant="outline">{item.platform}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      case 'templates':
        return (
          <div className="space-y-2">
            {templateItems.map((item) => (
              <Card key={item.id} className="cursor-pointer hover:bg-card/80">
                <CardContent className="p-3">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-xs text-muted">{item.description}</p>
                  <Badge variant="secondary" className="mt-2">{item.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      case 'tips':
        return (
          <div className="space-y-2">
            {tipItems.map((item) => (
              <Card key={item.id} className="hover:bg-card/80">
                <CardContent className="p-3">
                  <p className="text-sm">{item.tip}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className={`${sidebarWidth} flex-shrink-0 border-r border-border transition-all duration-300 h-full`}>
      <div className="flex h-full flex-col">
        <div className="flex justify-end p-2 border-b border-border">
          <button 
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-card/50"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none"
              className={`transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            >
              <path 
                d="M15 6L9 12L15 18" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
          </button>
        </div>
        
        <nav className="flex border-b border-border">
          {isCollapsed ? (
            <div className="flex flex-col w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`p-3 ${activeTab === tab.id ? 'text-primary bg-card/50' : 'text-muted hover:text-foreground hover:bg-card/30'}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                >
                  {tab.icon}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`flex items-center px-4 py-2 text-sm font-medium ${activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-foreground'}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </nav>
        
        <div className="flex-1 overflow-auto p-4">
          {renderTabContent()}
        </div>
        
        {!isCollapsed && (
          <div className="border-t border-border p-4">
            <div className="rounded-md bg-card/50 p-3">
              <div className="flex items-center">
                <div className="relative mr-2 h-3 w-3">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                  <span className="absolute h-full w-full rounded-full bg-green-500"></span>
                </div>
                <span className="text-sm font-medium">All systems operational</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;