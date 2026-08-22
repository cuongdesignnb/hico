import React, { useCallback, useEffect, useState } from 'react';
import { AppContext, type CartItem, type CurrentUser } from './contextValue';

const normalizeCartItem = (value: unknown): CartItem | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string'
    || typeof record.productId !== 'string'
    || typeof record.variantId !== 'string'
    || typeof record.slug !== 'string'
    || typeof record.name !== 'string'
    || typeof record.currency !== 'string'
    || typeof record.price !== 'number'
    || typeof record.quantity !== 'number') return null;
  const operation = record.operation === 'topup' || record.operation === 'device_sale' || record.operation === 'new_subscription'
    ? record.operation
    : record.type === 'device' ? 'device_sale' : 'new_subscription';
  const medium = record.medium === 'esim' || record.medium === 'physical_sim'
    ? record.medium
    : record.type === 'physical' ? 'physical_sim' : record.type === 'esim' ? 'esim' : undefined;
  const type = operation === 'device_sale' ? 'device' : medium === 'physical_sim' ? 'physical' : 'esim';
  return { ...record, operation, medium, type, quantity: Math.max(1, Math.floor(record.quantity)) } as CartItem;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart: unknown = JSON.parse(localStorage.getItem('hico_cart') || 'null');
      if (!Array.isArray(savedCart)) return [];
      return savedCart.map(normalizeCartItem).filter((item): item is CartItem => item !== null);
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const triggerNotification = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }, []);

  const handleSetIsLoggedIn = useCallback((value: boolean) => setIsLoggedIn(value), []);

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
  }, [triggerNotification]);

  // Save cart to localstorage
  useEffect(() => {
    localStorage.setItem('hico_cart', JSON.stringify(cart));
  }, [cart]);

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
        setIsLoggedIn: handleSetIsLoggedIn,
        currentUser,
        setCurrentUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
