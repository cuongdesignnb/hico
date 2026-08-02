import type {
  ProviderOffer,
  ProviderProductType,
} from '../../../types/provider';

export const getProviderOfferTypeLabel = (offer: ProviderOffer) => {
  if (offer.providerProductType === 0) {
    return offer.leSIM
      ? 'eSIM Worldmove'
      : 'eSIM nhà mạng địa phương';
  }

  if (offer.providerProductType === 1) {
    return 'SIM vật lý';
  }

  return 'Top-up';
};

export const getProductTypeLabel = (
  productType: ProviderProductType,
) => {
  if (productType === 0) return 'Virtual SIM / eSIM';
  if (productType === 1) return 'SIM vật lý';
  return 'Top-up SIM';
};

export const formatTwd = (value: number) => (
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value)
);

export const formatProviderDate = (value: string) => (
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
);
