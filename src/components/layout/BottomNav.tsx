import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shield, QrCode, FileBarChart, Menu } from 'lucide-react';
import { useAppStore, type Tab } from '../../store';

type BottomNavProps = {
  onOpenSideMenu: () => void;
};

const tabs = [
  { id: 'dashboard' as const, label: 'Home', icon: LayoutDashboard, path: '/' },
  { id: 'equipamentos' as const, label: 'Equipamentos', icon: Shield, path: '/equipamentos' },
  { id: 'scan' as const, label: '', icon: QrCode, path: '/scan', isScanner: true },
  { id: 'relatorios' as const, label: 'Relatórios', icon: FileBarChart, path: '/relatorios' },
  { id: 'menu' as const, label: 'Menu', icon: Menu, path: '', isMenu: true },
];

export function BottomNav({ onOpenSideMenu }: BottomNavProps) {
  const navigate = useNavigate();
  const { currentTab, setCurrentTab } = useAppStore();

  const handleClick = (tab: typeof tabs[number]) => {
    if (tab.isMenu) {
      onOpenSideMenu();
      return;
    }
    if (tab.isScanner) {
      setCurrentTab('inspecionar');
    } else {
      setCurrentTab(tab.id as Tab);
    }
    navigate(tab.path);
  };

  return (
    <nav className="app-bottom-nav">
      {tabs.map((tab) => {
        if (tab.isScanner) {
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab)}
              className="bottom-nav-fab"
              aria-label="Escanear QR Code"
            >
              <div className="bottom-nav-fab__inner">
                <QrCode className="w-6 h-6 text-white" />
              </div>
            </button>
          );
        }

        if (tab.isMenu) {
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab)}
              className="bottom-nav-tab"
              aria-label={tab.label}
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span className="bottom-nav-tab__label">{tab.label}</span>
            </button>
          );
        }

        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleClick(tab)}
            className={`bottom-nav-tab ${isActive ? 'bottom-nav-tab--active' : ''}`}
            aria-label={tab.label}
          >
            <tab.icon className="w-5 h-5 mb-0.5" />
            <span className="bottom-nav-tab__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
