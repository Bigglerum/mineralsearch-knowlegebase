import { useState } from 'react';
import { Search, Grid3x3, MapPin, Settings, Moon, Sun, Layers } from 'lucide-react';
import { useLocation } from 'wouter';

interface WheelMenuItem {
  id: string;
  icon: typeof Search;
  label: string;
  route: string;
}

const menuItems: WheelMenuItem[] = [
  { id: 'search', icon: Search, label: 'Mineral Search', route: '/search' },
  { id: 'groups-series', icon: Layers, label: 'Groups & Series', route: '/groups-series' },
  { id: 'strunz', icon: Grid3x3, label: 'Strunz', route: '/strunz' },
  { id: 'locality', icon: MapPin, label: 'Locality', route: '/locality' },
  { id: 'settings', icon: Settings, label: 'Settings', route: '/settings' },
];

export default function WheelMenu() {
  const [expanded, setExpanded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [location, navigate] = useLocation();

  const toggleWheel = () => {
    setExpanded(!expanded);
  };

  const handleItemClick = (route: string) => {
    navigate(route);
    setExpanded(false);
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const getItemPosition = (index: number, total: number) => {
    const angle = (index * 360) / total;
    const radius = 90;
    const radians = (angle - 90) * (Math.PI / 180);
    const x = radius * Math.cos(radians);
    const y = radius * Math.sin(radians);
    
    return {
      top: `calc(50% + ${y}px - 19px)`,
      left: `calc(50% + ${x}px - 19px)`,
    };
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t-4 border-primary shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-50" style={{ bottom: '-40px' }}>
      <div className="flex justify-center items-center py-6 relative h-[150px]">
        
        <div className={`absolute w-[220px] h-[220px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 ${expanded ? 'scale-110' : 'scale-100'}`}>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const position = getItemPosition(index, menuItems.length);
            const isActive = location === item.route;
            
            return (
              <button
                key={item.id}
                data-testid={`button-wheel-${item.id}`}
                className={`absolute w-[38px] h-[38px] rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer transition-all duration-500 ${
                  expanded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.3]'
                } ${
                  isActive && expanded
                    ? 'bg-gradient-to-br from-[#FF6B35] to-primary border-2 border-white scale-[1.3] shadow-[0_0_25px_rgba(255,107,53,0.8)]'
                    : 'bg-gradient-to-br from-[#3A3A3A] to-[#2A2A2A]'
                }`}
                style={position}
                onClick={() => handleItemClick(item.route)}
                title={item.label}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <button
          data-testid="button-wheel-center"
          onClick={toggleWheel}
          className={`w-20 h-20 bg-gradient-to-br from-primary to-[#B73316] rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(210,68,28,0.4)] z-10 relative hover:scale-105 hover:shadow-[0_6px_25px_rgba(210,68,28,0.5)] ${
            expanded ? 'rotate-180 scale-110' : ''
          }`}
        >
          MENU
        </button>

        <button
          data-testid="button-theme-toggle"
          onClick={toggleTheme}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-muted flex items-center justify-center hover-elevate active-elevate-2 transition-colors"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
}
