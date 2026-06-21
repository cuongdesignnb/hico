import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  name: string;
  type: 'esim' | 'device' | 'physical';
  simType?: string;
  price: number; // In USD for eSIM, VND for devices
  originalPrice?: number;
  duration?: string;
  dataLimit?: string;
  image?: string;
  quantity: number;
}

interface AppContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isOnline: boolean;
  triggerNotification: (message: string, type?: 'success' | 'info' | 'error') => void;
  notification: { message: string; type: 'success' | 'info' | 'error' } | null;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
  currentUser: { name: string; email: string; phone: string } | null;
  setCurrentUser: (user: { name: string; email: string; phone: string } | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem('hico_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('hico_logged_in') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; phone: string } | null>(() => {
    const savedUser = localStorage.getItem('hico_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Save login state to localStorage
  useEffect(() => {
    localStorage.setItem('hico_logged_in', isLoggedIn ? 'true' : 'false');
    if (currentUser) {
      localStorage.setItem('hico_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('hico_user');
    }
  }, [isLoggedIn, currentUser]);

  // Default logged in user if state is true
  useEffect(() => {
    if (isLoggedIn && !currentUser) {
      setCurrentUser({
        name: 'Sơn Nguyễn',
        email: 'son.nguyen@gmail.com',
        phone: '0912345678'
      });
    }
  }, [isLoggedIn, currentUser]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerNotification('Bạn đã kết nối Internet trở lại!', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      triggerNotification('Đã mất kết nối. Đang hoạt động ở chế độ ngoại tuyến.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save cart to localstorage
  useEffect(() => {
    localStorage.setItem('hico_cart', JSON.stringify(cart));
  }, [cart]);

  const triggerNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const addToCart = (newItem: Omit<CartItem, 'quantity'>) => {
    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex((item) => item.id === newItem.id);
      if (existingItemIndex > -1) {
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        triggerNotification(`Đã cập nhật số lượng ${newItem.name} trong giỏ hàng!`);
        return updatedCart;
      }
      triggerNotification(`Đã thêm ${newItem.name} vào giỏ hàng!`);
      return [...prevCart, { ...newItem, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => {
      const itemToRemove = prevCart.find(item => item.id === id);
      if (itemToRemove) {
        triggerNotification(`Đã xóa ${itemToRemove.name} khỏi giỏ hàng!`, 'info');
      }
      return prevCart.filter((item) => item.id !== id);
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('hico_cart');
  };

  return (
    <AppContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        searchQuery,
        setSearchQuery,
        isOnline,
        triggerNotification,
        notification,
        isLoggedIn,
        setIsLoggedIn,
        currentUser,
        setCurrentUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
