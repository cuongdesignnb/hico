import { createContext } from 'react';

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  operation: 'new_subscription' | 'topup' | 'device_sale';
  type: 'esim' | 'device' | 'physical';
  medium?: 'esim' | 'physical_sim';
  simType?: string;
  price: number;
  displayedPrice?: number;
  currency: 'VND' | 'USD';
  originalPrice?: number;
  duration?: string;
  dataLimit?: string;
  topupDays?: number;
  topupSimAssetId?: string;
  image?: string;
  quantity: number;
}

export interface CurrentUser {
  name: string;
  email: string;
  phone: string;
}

export interface AppContextType {
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
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
