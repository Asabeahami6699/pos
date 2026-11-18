import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  Building,
  ClipboardList,
  AlertCircle,
  Users,
  Warehouse,
  TrendingUp,
  Bell,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Menu,
  X,
  BarChart3,
  PieChart,
  ShoppingBag,
  Globe,
  User,
  Percent,
  Wallet,
  Palette,
  CircleDollarSign,
} from 'lucide-react';

interface AdjustableSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  companyName?: string;
  notificationCount?: number;
  onlineOrderCount?: number;
  onlineItemCount?: number;
  userName?: string;
  userRole?: string;
  inventoryModel?: 'warehouse' | 'branch_only';
  onRefresh?: () => void;
  refreshing?: boolean;
}

const SETTINGS_CHILDREN = [
  { id: 'settings-profile', label: 'Profile & store', icon: User },
  { id: 'settings-pos', label: 'POS & support', icon: Percent },
  { id: 'settings-payments', label: 'Payments', icon: Wallet },
  { id: 'settings-appearance', label: 'Appearance', icon: Palette },
] as const;

function isSettingsTab(tab: string) {
  return tab === 'settings' || tab.startsWith('settings-');
}

export const AdjustableSidebar: React.FC<AdjustableSidebarProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  companyName = 'Company Admin',
  notificationCount = 0,
  onlineOrderCount = 0,
  onlineItemCount = 0,
  inventoryModel = 'warehouse',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const [showExpandHint, setShowExpandHint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => isSettingsTab(activeTab));
  const sidebarRef = useRef<HTMLDivElement>(null);

  const minWidth = 168;
  const maxWidth = 260;
  const collapsedWidth = 80;

  type MenuItem = {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tourId?: string;
    group: 'main' | 'setup' | 'operations' | 'insights';
    children?: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
  };

  const menuItems: MenuItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, tourId: 'admin-overview', group: 'main' },
    { id: 'branches', label: 'Branches', icon: Building, tourId: 'admin-branches', group: 'setup' },
    { id: 'staff', label: 'Staff', icon: Users, tourId: 'admin-staff', group: 'setup' },
    ...(inventoryModel === 'warehouse'
      ? [{ id: 'warehouse', label: 'Warehouse', icon: Warehouse, tourId: 'admin-warehouse', group: 'setup' as const }]
      : []),
    { id: 'inventory', label: 'Inventory', icon: Package, tourId: 'admin-inventory', group: 'setup' },
    { id: 'online-items', label: 'Online Items', icon: Globe, group: 'operations' },
    { id: 'online-orders', label: 'Online Orders', icon: ShoppingBag, group: 'operations' },
    { id: 'customer-chat', label: 'Customer Chat', icon: MessageCircle, group: 'operations' },
    { id: 'requests', label: 'Requests', icon: ClipboardList, group: 'operations' },
    { id: 'alerts', label: 'Stock Alerts', icon: AlertCircle, group: 'operations' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'insights' },
    { id: 'profit', label: 'Profit', icon: CircleDollarSign, group: 'insights' },
    { id: 'price-history', label: 'Price History', icon: TrendingUp, group: 'insights' },
    { id: 'notifications', label: 'Notifications', icon: Bell, group: 'insights' },
    { id: 'guide', label: 'User Guide', icon: BookOpen, tourId: 'admin-guide', group: 'insights' },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      group: 'insights',
      children: [...SETTINGS_CHILDREN],
    },
  ];

  useEffect(() => {
    if (isSettingsTab(activeTab)) setSettingsOpen(true);
  }, [activeTab]);

  const groups: Array<{ id: MenuItem['group']; label: string }> = [
    { id: 'main', label: '' },
    { id: 'setup', label: 'Setup' },
    { id: 'operations', label: 'Operations' },
    { id: 'insights', label: 'Insights' },
  ];

  // Load saved preferences
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!Number.isNaN(width)) {
        setSidebarWidth(Math.min(maxWidth, Math.max(minWidth, width)));
      }
    }
    
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [sidebarWidth, isCollapsed]);

  // Show expand hint when sidebar is collapsed for more than 3 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (isCollapsed) {
      timer = setTimeout(() => {
        setShowExpandHint(true);
      }, 3000);
    } else {
      setShowExpandHint(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isCollapsed]);

  // Hide expand hint after 5 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (showExpandHint) {
      timer = setTimeout(() => {
        setShowExpandHint(false);
      }, 5000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showExpandHint]);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;
      
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
        setIsCollapsed(false); // Auto-expand when resizing
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isItemActive = (itemId: string, children?: MenuItem['children']) => {
    if (activeTab === itemId) return true;
    if (itemId === 'settings' && isSettingsTab(activeTab)) return true;
    return Boolean(children?.some((child) => child.id === activeTab));
  };

  const getItemClasses = (itemId: string, children?: MenuItem['children']) => {
    const baseClasses = 'flex items-center rounded-lg transition-all duration-200 cursor-pointer w-full';
    const activeClasses = 'bg-primary/10 text-primary font-semibold shadow-sm';
    const inactiveClasses = 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground';

    return `${baseClasses} ${isItemActive(itemId, children) ? activeClasses : inactiveClasses} ${
      isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'
    }`;
  };

  const getChildClasses = (itemId: string) => {
    const active = activeTab === itemId;
    return `flex items-center w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
      active
        ? 'bg-primary/10 text-primary font-semibold'
        : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
    }`;
  };

  const getItemIcon = (Icon: React.ComponentType<{ className?: string }>) => {
    return <Icon className={`w-4 h-4 shrink-0 ${isCollapsed ? '' : 'mr-2.5'}`} />;
  };

  // Handle analytics click from quick stats
  const handleAnalyticsClick = () => {
    onTabChange('analytics');
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed z-50 p-2.5 glass-card rounded-xl shadow-md"
        style={{ top: 'calc(0.75rem + var(--safe-top))', left: 'calc(0.75rem + var(--safe-left))' }}
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Floating Expand Button for collapsed sidebar */}
      {isCollapsed && (
        <>
          <button
            onClick={toggleCollapse}
            className="hidden md:flex fixed left-0 top-4 z-50 ml-1 h-10 w-10 items-center justify-center rounded-r-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:scale-105 active:scale-95"
            title="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          
          {/* Expand hint tooltip */}
          {showExpandHint && (
            <div className="hidden md:block fixed left-12 top-6 z-50 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg animate-pulse">
              Click to expand menu
              <div className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>
          )}
        </>
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`shrink-0 h-screen z-40 flex flex-col bg-card border-r border-border shadow-lg transition-all duration-300
          max-md:fixed max-md:inset-y-0 max-md:left-0
          md:sticky md:top-0 md:self-start
          ${isCollapsed ? 'w-20' : ''} ${isMobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}`}
        style={!isCollapsed ? { width: `${sidebarWidth}px` } : {}}
      >
        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-300 active:bg-indigo-500/100 transition-colors group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
              <div className="flex flex-col space-y-1">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {/* Company Header */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            {isCollapsed ? (
              <div 
                className="flex justify-center w-full cursor-pointer group"
                onClick={toggleCollapse}
                title="Click to expand"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500/100 to-purple-500/50 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform relative">
                  <span className="text-white font-bold text-lg">
                    {companyName.charAt(0)}
                  </span>
                  {/* Hint dot */}
                  <div className="absolute -right-1 -top-1 w-3 h-3 bg-emerald-500/100 rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-indigo-500/100 to-purple-500/50 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {companyName.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-foreground truncate" title={companyName}>
                      {companyName.length > 20 ? `${companyName.substring(0, 20)}...` : companyName}
                    </h2>
                    <p className="text-xs text-muted-foreground">Inventory System</p>
                  </div>
                </div>
                <button
                  onClick={toggleCollapse}
                  className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-2 px-1.5 overflow-y-auto">
          {groups.map((group) => {
            const items = menuItems.filter((m) => m.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id} className={group.id === 'main' ? 'mb-2' : 'mb-3'}>
                {!isCollapsed && group.label ? (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {group.label}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const hasChildren = Boolean(item.children?.length);
                    const showChildren = hasChildren && settingsOpen && !isCollapsed;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-tour={item.tourId}
                          onClick={() => {
                            if (hasChildren) {
                              if (isCollapsed) {
                                onTabChange(item.children![0].id);
                                setSettingsOpen(true);
                                setIsMobileMenuOpen(false);
                                return;
                              }
                              if (!settingsOpen) {
                                setSettingsOpen(true);
                                if (!isSettingsTab(activeTab)) {
                                  onTabChange(item.children![0].id);
                                }
                              } else if (!isSettingsTab(activeTab)) {
                                onTabChange(item.children![0].id);
                              } else {
                                setSettingsOpen(false);
                              }
                              return;
                            }
                            onTabChange(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={getItemClasses(item.id, item.children)}
                          title={isCollapsed ? item.label : ''}
                          aria-expanded={hasChildren ? settingsOpen : undefined}
                        >
                          {getItemIcon(item.icon)}
                          {!isCollapsed && (
                            <span className="font-medium flex-1 text-left text-sm">{item.label}</span>
                          )}
                          {!isCollapsed && item.id === 'notifications' && notificationCount > 0 && (
                            <span className="ml-auto bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-full min-w-6 text-center">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                          {!isCollapsed && item.id === 'online-items' && onlineItemCount > 0 && (
                            <span className="ml-auto bg-sky-500/15 text-sky-700 dark:text-sky-400 text-xs px-2 py-0.5 rounded-full min-w-6 text-center">
                              {onlineItemCount > 99 ? '99+' : onlineItemCount}
                            </span>
                          )}
                          {!isCollapsed && item.id === 'online-orders' && onlineOrderCount > 0 && (
                            <span className="ml-auto bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs px-2 py-0.5 rounded-full min-w-6 text-center">
                              {onlineOrderCount > 99 ? '99+' : onlineOrderCount}
                            </span>
                          )}
                          {!isCollapsed && hasChildren && (
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 opacity-60 transition-transform ${
                                settingsOpen ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </button>

                        {showChildren && (
                          <ul className="mt-0.5 mb-1 ml-3 pl-3 border-l border-border space-y-0.5">
                            {item.children!.map((child) => (
                              <li key={child.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onTabChange(child.id);
                                    setIsMobileMenuOpen(false);
                                  }}
                                  className={getChildClasses(child.id)}
                                >
                                  <child.icon className="w-3.5 h-3.5 mr-2 shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

         
          {/* Collapsed stats hint */}
          {isCollapsed && (
            <div className="mt-8 px-2">
              <div className="space-y-2">
                <button
                  onClick={handleAnalyticsClick}
                  className="w-full flex items-center justify-center p-3 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors cursor-pointer"
                  title="Analytics Dashboard"
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleAnalyticsClick}
                  className="w-full flex items-center justify-center p-3 rounded-lg text-blue-600 hover:bg-blue-500/100/10 transition-colors cursor-pointer"
                  title="View Reports"
                >
                  <PieChart className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* User Section — logout only */}
        <div className="p-3 border-t border-border bg-secondary/40">
          <button
            onClick={onLogout}
            className={`flex items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${
              isCollapsed ? 'justify-center p-2.5 w-full' : 'gap-2 px-3 py-2 w-full'
            }`}
            title="Logout"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>

      {/* Resizing Overlay */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-25 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};