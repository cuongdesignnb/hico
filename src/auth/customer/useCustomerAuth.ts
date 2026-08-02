import { useContext } from 'react';
import { CustomerAuthContext } from './CustomerAuthContext';

export const useCustomerAuth = () => {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error('useCustomerAuth must be used within CustomerAuthProvider.');
  return value;
};
