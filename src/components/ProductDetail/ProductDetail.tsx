import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Star, Check, Plus, Minus, Clock, 
  ShieldCheck, Mail, Globe, Radio, Settings, Headphones, Users, CheckCircle2,
  MapPin, Calendar, Database, Zap, HardDrive
} from 'lucide-react';
import './ProductDetail.css';
import { updateSeoTags } from '../../utils/seo';

interface DataOption {
  id: string;
  label: string;
  type: 'daily' | 'total';
  baseDailyPrice: number;
  baseCompareDailyPrice: number;
  flatFee?: number;
  flatCompareFee?: number;
}

const DATA_OPTIONS: DataOption[] = [
  { id: '500mb-daily', label: '500 MB / Ngày', type: 'daily', baseDailyPrice: 15000, baseCompareDailyPrice: 20000 },
  { id: '1gb-daily', label: '1 GB / Ngày', type: 'daily', baseDailyPrice: 25000, baseCompareDailyPrice: 32000 },
  { id: '2gb-daily', label: '2 GB / Ngày', type: 'daily', baseDailyPrice: 40000, baseCompareDailyPrice: 52000 },
  { id: '3gb-daily', label: '3 GB / Ngày', type: 'daily', baseDailyPrice: 52000, baseCompareDailyPrice: 70000 },
  { id: '5gb-total', label: '5 GB tổng', type: 'total', baseDailyPrice: 7500, baseCompareDailyPrice: 10000, flatFee: 50000, flatCompareFee: 75000 },
  { id: '10gb-total', label: '10 GB tổng', type: 'total', baseDailyPrice: 10000, baseCompareDailyPrice: 15000, flatFee: 100000, flatCompareFee: 138000 },
  { id: '20gb-total', label: '20 GB tổng', type: 'total', baseDailyPrice: 15000, baseCompareDailyPrice: 20000, flatFee: 150000, flatCompareFee: 200000 },
  { id: '50gb-total', label: '50 GB tổng', type: 'total', baseDailyPrice: 25000, baseCompareDailyPrice: 35000, flatFee: 250000, flatCompareFee: 325000 },
];

const DURATIONS = [5, 7, 10, 15, 20, 30];

const COUNTRY_FACTORS: Record<string, number> = {
  'jp-esim': 1.0,
  'us-esim': 1.4,
  'th-esim': 0.8,
  'uk-esim': 1.2,
  'sg-esim': 0.9,
  'kr-esim': 1.0,
  'fr-esim': 1.3,
  'au-esim': 1.2,
};

const POPULAR_COMBINATIONS = [
  { dataId: '1gb-daily', duration: 7 },
  { dataId: '1gb-daily', duration: 15 },
  { dataId: '2gb-daily', duration: 10 },
  { dataId: '5gb-total', duration: 15 },
  { dataId: '10gb-total', duration: 30 },
  { dataId: '20gb-total', duration: 30 },
];

interface CountryDetail {
  id: string;
  name: string;
  flag: string;
  region: string;
  network: string;
  image: string;
  price?: number;
  compareAtPrice?: number;
  guide?: string;
  variants?: any[];
  images: { id: number; url: string; title: string }[];
}

const COUNTRIES: Record<string, CountryDetail> = {
  'jp-esim': {
    id: 'jp-esim',
    name: 'Nhật Bản',
    flag: '🇯🇵',
    region: 'Châu Á',
    network: 'NTT Docomo / SoftBank',
    image: '/images/dest_japan.png',
    images: [
      { id: 1, url: '/images/dest_japan.png', title: 'Núi Phú Sĩ & Chùa Pagoda' },
      { id: 2, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 3, url: '/images/dest_uk.png', title: 'Big Ben London' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: '/images/dest_japan.png', title: 'Fuji Autumn' },
    ]
  },
  'us-esim': {
    id: 'us-esim',
    name: 'Hoa Kỳ',
    flag: '🇺🇸',
    region: 'Bắc Mỹ',
    network: 'T-Mobile / AT&T',
    image: '/images/dest_usa.png',
    images: [
      { id: 1, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_uk.png', title: 'Big Ben London' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: '/images/dest_usa.png', title: 'New York Skyline' },
    ]
  },
  'th-esim': {
    id: 'th-esim',
    name: 'Thái Lan',
    flag: '🇹🇭',
    region: 'Đông Nam Á',
    network: 'AIS / TrueMove',
    image: '/images/dest_thailand.png',
    images: [
      { id: 1, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 4, url: '/images/dest_uk.png', title: 'Big Ben London' },
      { id: 5, url: '/images/dest_thailand.png', title: 'Bangkok River' },
    ]
  },
  'uk-esim': {
    id: 'uk-esim',
    name: 'Vương Quốc Anh',
    flag: '🇬🇧',
    region: 'Châu Âu',
    network: 'EE / Vodafone',
    image: '/images/dest_uk.png',
    images: [
      { id: 1, url: '/images/dest_uk.png', title: 'Big Ben London' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: '/images/dest_uk.png', title: 'London Eye' },
    ]
  },
  'sg-esim': {
    id: 'sg-esim',
    name: 'Singapore',
    flag: '🇸🇬',
    region: 'Đông Nam Á',
    network: 'Singtel / StarHub',
    image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=400&auto=format&fit=crop',
    images: [
      { id: 1, url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=400&auto=format&fit=crop', title: 'Marina Bay Sands' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=400&auto=format&fit=crop', title: 'Gardens by the Bay' },
    ]
  },
  'kr-esim': {
    id: 'kr-esim',
    name: 'Hàn Quốc',
    flag: '🇰🇷',
    region: 'Châu Á',
    network: 'SK Telecom / KT',
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=400&auto=format&fit=crop',
    images: [
      { id: 1, url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=400&auto=format&fit=crop', title: 'Seoul Street' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=400&auto=format&fit=crop', title: 'Gyeongbokgung' },
    ]
  },
  'fr-esim': {
    id: 'fr-esim',
    name: 'Pháp',
    flag: '🇫🇷',
    region: 'Châu Âu',
    network: 'Orange / SFR',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400&auto=format&fit=crop',
    images: [
      { id: 1, url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400&auto=format&fit=crop', title: 'Eiffel Tower' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400&auto=format&fit=crop', title: 'Louvre Museum' },
    ]
  },
  'au-esim': {
    id: 'au-esim',
    name: 'Australia',
    flag: '🇦🇺',
    region: 'Châu Đại Dương',
    network: 'Telstra / Optus',
    image: 'https://images.unsplash.com/photo-1523482596682-cd93a6e94dd4?q=80&w=400&auto=format&fit=crop',
    images: [
      { id: 1, url: 'https://images.unsplash.com/photo-1523482596682-cd93a6e94dd4?q=80&w=400&auto=format&fit=crop', title: 'Sydney Opera House' },
      { id: 2, url: '/images/dest_japan.png', title: 'Fuji Chùa Pagoda' },
      { id: 3, url: '/images/dest_usa.png', title: 'Statue of Liberty' },
      { id: 4, url: '/images/dest_thailand.png', title: 'Thailand Pagoda' },
      { id: 5, url: 'https://images.unsplash.com/photo-1523482596682-cd93a6e94dd4?q=80&w=400&auto=format&fit=crop', title: 'Melbourne Yarra' },
    ]
  }
};

const FALLBACK_PACKAGES_MAP: Record<string, any> = {
  'asia-pacific-esim': {
    id: 'asia-pacific-esim',
    name: 'Gói Châu Á - Thái Bình Dương',
    flag: '🌏',
    region: 'Khu vực',
    network: 'Singtel / SoftBank / AIS',
    image: '/images/dest_japan.png',
    images: [
      { id: 1, url: '/images/dest_uk.png', title: 'Asia Pacific' }
    ],
    variants: [
      { id: 'var-asia-7d-5gb', sku: 'PKG-ASIA-7D-5GB', dataLimit: '5 GB', duration: '7 Ngày', price: 370000, compareAtPrice: 490000, wmproductId: 'WM-e-ASIA-5GB' },
      { id: 'var-asia-15d-10gb', sku: 'PKG-ASIA-15D-10GB', dataLimit: '10 GB', duration: '15 Ngày', price: 620000, compareAtPrice: 740000, wmproductId: 'WM-e-ASIA-10GB' },
      { id: 'var-asia-30d-20gb', sku: 'PKG-ASIA-30D-20GB', dataLimit: '20 GB', duration: '30 Ngày', price: 990000, compareAtPrice: 1240000, wmproductId: 'WM-e-ASIA-20GB' },
    ]
  },
  'global-esim': {
    id: 'global-esim',
    name: 'Gói Toàn Cầu',
    flag: '🌐',
    region: 'Toàn cầu',
    network: 'Vodafone / Orange / AT&T',
    image: '/images/dest_usa.png',
    images: [
      { id: 1, url: '/images/dest_usa.png', title: 'Global' }
    ],
    variants: [
      { id: 'var-glob-10d-5gb', sku: 'PKG-GLOB-10D-5GB', dataLimit: '5 GB', duration: '10 Ngày', price: 740000, compareAtPrice: 990000, wmproductId: 'WM-e-GLOB-5GB' },
      { id: 'var-glob-30d-10gb', sku: 'PKG-GLOB-30D-10GB', dataLimit: '10 GB', duration: '30 Ngày', price: 1490000, compareAtPrice: 1990000, wmproductId: 'WM-e-GLOBAL-10GB' },
      { id: 'var-glob-30d-20gb', sku: 'PKG-GLOB-30D-20GB', dataLimit: '20 GB', duration: '30 Ngày', price: 2240000, compareAtPrice: 2740000, wmproductId: 'WM-e-GLOBAL-20GB' },
    ]
  }
};

export const ProductDetail: React.FC = () => {
  const { addToCart, setIsCartOpen, triggerNotification, isLoggedIn, currentUser } = useApp();
  
  const [resolvedId, setResolvedId] = useState(() => {
    const rawId = window.location.hash.replace('#/product/', '');
    return rawId === 'japan' ? 'jp-esim' : 
           rawId === 'usa' ? 'us-esim' : 
           rawId === 'thailand' ? 'th-esim' : 
           rawId === 'uk' ? 'uk-esim' : 
           rawId || 'jp-esim';
  });

  const [destinations, setDestinations] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  // Reviews state hooks
  const [reviews, setReviews] = useState<any[]>([]);
  const [sortOption, setSortOption] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newContent, setNewContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const fetchReviews = () => {
    fetch(`/api/products/${resolvedId}/reviews`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setReviews(data))
      .catch(err => console.error("Failed to fetch reviews:", err));
  };

  useEffect(() => {
    fetchReviews();
  }, [resolvedId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          const response = await fetch('/api/admin/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, base64Data })
          });
          if (response.ok) {
            const data = await response.json();
            setUploadedImages(prev => [...prev, data.url]);
          }
        } catch (err) {
          console.error("Image upload failed:", err);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortOption === 'highest') {
      return b.rating - a.rating;
    }
    if (sortOption === 'lowest') {
      return a.rating - b.rating;
    }
    // 'newest'
    const parseDate = (dStr: string) => {
      const parts = dStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    };
    return parseDate(b.createdAt) - parseDate(a.createdAt);
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/destinations').then(res => res.ok ? res.json() : []),
      fetch('/api/admin/packages').then(res => res.ok ? res.json() : [])
    ])
    .then(([destData, pkgData]) => {
      setDestinations(destData);
      setPackages(pkgData);
    })
    .catch((err) => {
      console.warn('Failed to fetch product details data:', err);
    });
  }, []);

  const dynamicItem = destinations.find(d => d.id === resolvedId) || packages.find(p => p.id === resolvedId);
  const getFallbackKey = (id: string) => {
  const lower = id.toLowerCase();
  if (lower.includes('asia') || lower.includes('chau-a') || lower.includes('apac') || lower.includes('dong-nam-a')) return 'asia-pacific-esim';
  if (lower.includes('global') || lower.includes('toan-cau') || lower.includes('multi')) return 'global-esim';
  if (lower.includes('nhat-ban') || lower.includes('japan') || lower.includes('jp')) return 'jp-esim';
  if (lower.includes('my') || lower.includes('usa') || lower.includes('us')) return 'us-esim';
  if (lower.includes('thai-lan') || lower.includes('thailand') || lower.includes('th')) return 'th-esim';
  if (lower.includes('anh') || lower.includes('uk') || lower.includes('vương quốc anh') || lower.includes('london')) return 'uk-esim';
  if (lower.includes('singapore') || lower.includes('sg')) return 'sg-esim';
  if (lower.includes('han-quoc') || lower.includes('korea') || lower.includes('kr')) return 'kr-esim';
  if (lower.includes('phap') || lower.includes('france') || lower.includes('fr')) return 'fr-esim';
  if (lower.includes('australia') || lower.includes('uc') || lower.includes('au') || lower.includes('zealand')) return 'au-esim';
  return 'jp-esim';
};

const fallbackKey = getFallbackKey(resolvedId);
const fallbackItem = COUNTRIES[fallbackKey] || FALLBACK_PACKAGES_MAP[fallbackKey] || COUNTRIES['jp-esim'];

  const currentCountry = dynamicItem ? {
    id: dynamicItem.id,
    name: dynamicItem.name,
    flag: dynamicItem.flag || (dynamicItem.iconType === 'global' ? '🌐' : '🌏'),
    region: fallbackItem?.region || 'Quốc tế',
    network: dynamicItem.network || fallbackItem?.network || 'Nhiều nhà mạng',
    image: dynamicItem.image || fallbackItem?.image,
    price: dynamicItem.price,
    compareAtPrice: dynamicItem.compareAtPrice,
    guide: dynamicItem.guide || dynamicItem.description || '',
    variants: dynamicItem.variants || fallbackItem?.variants || [],
    images: fallbackItem?.images || [
      { id: 1, url: dynamicItem.image || '/images/dest_japan.png', title: dynamicItem.name },
      { id: 2, url: '/images/dest_japan.png', title: 'Japan' },
      { id: 3, url: '/images/dest_usa.png', title: 'USA' },
      { id: 4, url: '/images/dest_uk.png', title: 'UK' },
      { id: 5, url: '/images/dest_thailand.png', title: 'Thailand' }
    ]
  } : fallbackItem;

  const [selectedDataId, setSelectedDataId] = useState<string>('1gb-daily');
  const [selectedDuration, setSelectedDuration] = useState<number>(10);

  // SIM types & dynamic database variants selection
  const [selectedSimType, setSelectedSimType] = useState<string>('eSIM');
  const [selectedVariantData, setSelectedVariantData] = useState<string>('');
  const [selectedVariantDuration, setSelectedVariantDuration] = useState<string>('');

  const hasVariants = Array.isArray(currentCountry?.variants) && currentCountry.variants.length > 0;

  // Find unique SIM types available for this country
  const availableSimTypes = hasVariants
    ? Array.from(new Set(currentCountry.variants.map((v: any) => v.simType || 'eSIM'))) as string[]
    : ['eSIM'];

  useEffect(() => {
    console.log('[DEBUG EFFECT] Running variant initialization effect. countryId:', currentCountry?.id, 'hasVariants:', hasVariants);
    if (currentCountry && hasVariants) {
      // Find all unique simTypes in variants
      const simTypes = Array.from(new Set(currentCountry.variants.map((v: any) => v.simType || 'eSIM'))) as string[];
      if (simTypes.length > 0) {
        const defaultType = simTypes.includes('eSIM') ? 'eSIM' : (simTypes.includes('leSIM') ? 'leSIM' : simTypes[0]);
        setSelectedSimType(defaultType);
        
        // Pick first variant of this default type
        const validVars = currentCountry.variants.filter((v: any) => (v.simType || 'eSIM') === defaultType);
        if (validVars.length > 0) {
          setSelectedVariantData(validVars[0].dataLimit);
          setSelectedVariantDuration(validVars[0].duration);
        }
      }
    } else {
      setSelectedSimType('eSIM');
      setSelectedVariantData('');
      setSelectedVariantDuration('');
    }
  }, [currentCountry?.id, hasVariants]);

  // Filter variants by chosen SIM type
  const filteredVariants = hasVariants
    ? currentCountry.variants.filter((v: any) => (v.simType || 'eSIM') === selectedSimType)
    : [];

  const uniqueDataLimits = hasVariants
    ? Array.from(new Set(filteredVariants.map((v: any) => v.dataLimit))) as string[]
    : [];

  const uniqueDurations = hasVariants
    ? Array.from(new Set(filteredVariants.map((v: any) => v.duration))) as string[]
    : [];

  const handleSimTypeClick = (type: string) => {
    setSelectedSimType(type);
    const validVars = currentCountry.variants.filter((v: any) => (v.simType || 'eSIM') === type);
    if (validVars.length > 0) {
      setSelectedVariantData(validVars[0].dataLimit);
      setSelectedVariantDuration(validVars[0].duration);
    }
  };

  const handleDataLimitClick = (dl: string) => {
    setSelectedVariantData(dl);
    const validVars = filteredVariants.filter((v: any) => v.dataLimit === dl);
    const hasSameDuration = validVars.some((v: any) => v.duration === selectedVariantDuration);
    if (!hasSameDuration && validVars.length > 0) {
      setSelectedVariantDuration(validVars[0].duration);
    }
  };

  const handleDurationClick = (dur: string) => {
    setSelectedVariantDuration(dur);
    const validVars = filteredVariants.filter((v: any) => v.duration === dur);
    const hasSameData = validVars.some((v: any) => v.dataLimit === selectedVariantData);
    if (!hasSameData && validVars.length > 0) {
      setSelectedVariantData(validVars[0].dataLimit);
    }
  };

  console.log('[DEBUG RENDER] countryId:', currentCountry?.id, 'hasVariants:', hasVariants, 'selectedSimType:', selectedSimType, 'selectedVariantData:', selectedVariantData, 'selectedVariantDuration:', selectedVariantDuration);
  const activeVariant = hasVariants
    ? filteredVariants.find((v: any) => v.dataLimit === selectedVariantData && v.duration === selectedVariantDuration) || filteredVariants[0]
    : null;

  const selectedData = DATA_OPTIONS.find(o => o.id === selectedDataId) || DATA_OPTIONS[1];
  const baseFactor = COUNTRY_FACTORS[resolvedId] || (currentCountry.price ? currentCountry.price / 490000 : 1.0);
  
  let calculatedPrice = 0;
  let calculatedCompareAtPrice = 0;
  
  if (selectedData.type === 'daily') {
    calculatedPrice = Math.round(selectedData.baseDailyPrice * selectedDuration * baseFactor);
    calculatedCompareAtPrice = Math.round(selectedData.baseCompareDailyPrice * selectedDuration * baseFactor);
  } else {
    calculatedPrice = Math.round(((selectedData.baseDailyPrice * selectedDuration) + (selectedData.flatFee || 0)) * baseFactor);
    calculatedCompareAtPrice = Math.round(((selectedData.baseCompareDailyPrice * selectedDuration) + (selectedData.flatCompareFee || 0)) * baseFactor);
  }

  const formatPrice = (p: number) => `${p.toLocaleString('vi-VN')}đ`;

  const selectedPkg = hasVariants && activeVariant
    ? {
        id: `${currentCountry.id}-var-${activeVariant.id}`,
        dataLimit: activeVariant.dataLimit,
        duration: activeVariant.duration,
        price: activeVariant.price,
        compareAtPrice: activeVariant.compareAtPrice,
        vndPrice: formatPrice(activeVariant.price)
      }
    : {
        id: `pkg-${selectedData.id}-${selectedDuration}d`,
        dataLimit: selectedData.label,
        duration: `${selectedDuration} ngày`,
        price: calculatedPrice,
        compareAtPrice: calculatedCompareAtPrice,
        vndPrice: formatPrice(calculatedPrice)
      };

  const [selectedImage, setSelectedImage] = useState(currentCountry.images[0].url);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'kythuat' | 'caidat' | 'tuongthich' | 'danhgia' | 'faq'>('kythuat');

  // Sync state on hash/route change
  useEffect(() => {
    const handleHash = () => {
      const rawId = window.location.hash.replace('#/product/', '');
      const newId = rawId === 'japan' ? 'jp-esim' : 
                    rawId === 'usa' ? 'us-esim' : 
                    rawId === 'thailand' ? 'th-esim' : 
                    rawId === 'uk' ? 'uk-esim' : 
                    rawId || 'jp-esim';
      setResolvedId(newId);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    if (currentCountry && currentCountry.images && currentCountry.images.length > 0) {
      setSelectedImage(currentCountry.images[0].url);
    }
    setQuantity(1);
    setIsDescExpanded(false);
    // Scroll to top of the window
    window.scrollTo({ top: 0, behavior: 'instant' as any });
  }, [resolvedId, destinations]);

  useEffect(() => {
    if (currentCountry) {
      const title = dynamicItem?.seoTitle || `eSIM ${currentCountry.name} Du Lịch Tốc Độ Cao - HICO`;
      const description = dynamicItem?.seoDescription || `Mua eSIM ${currentCountry.name} nhận ngay mã QR qua email trong 3 phút. Mạng ${currentCountry.network || '4G/5G'} tốc độ cao, hỗ trợ chia sẻ hotspot và chăm sóc khách hàng 24/7.`;
      const keywords = dynamicItem?.seoKeywords || `esim ${currentCountry.name.toLowerCase()}, esim di du lich ${currentCountry.name.toLowerCase()}, mua esim ${currentCountry.name.toLowerCase()}`;
      
      updateSeoTags({
        title,
        description,
        keywords
      });
    }
  }, [resolvedId, dynamicItem, currentCountry?.id]);


  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const handleAddToCart = () => {
    const currentSimType = hasVariants && activeVariant ? (activeVariant.simType || 'eSIM') : 'eSIM';
    const cartItemId = hasVariants && activeVariant
      ? `${currentCountry.id}-var-${activeVariant.id.replace('var-', '')}`
      : `${currentCountry.id}-${selectedPkg.id}`;

    const displayName = currentSimType === 'physical'
      ? `${currentCountry.name} SIM Vật Lý - Gói ${selectedPkg.dataLimit} (${selectedPkg.duration})`
      : `${currentCountry.name} eSIM - Gói ${selectedPkg.dataLimit} (${selectedPkg.duration})`;

    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: cartItemId,
        name: displayName,
        type: currentSimType === 'physical' ? 'physical' : 'esim',
        simType: currentSimType,
        price: selectedPkg.price,
        duration: selectedPkg.duration,
        dataLimit: selectedPkg.dataLimit,
        image: currentCountry.image
      });
    }
    
    const displayTypeName = currentSimType === 'physical' ? 'SIM Vật Lý' : 'eSIM';
    triggerNotification(`Đã thêm ${quantity} ${displayTypeName} vào giỏ hàng!`);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setIsCartOpen(true);
  };

  return (
    <div className="product-detail-page fade-in">
      <div className="container">
        {/* Breadcrumb row */}
        <div className="breadcrumb-row">
          <span>Trang chủ</span>
          <span className="breadcrumb-sep">&gt;</span>
          <span>Điểm đến</span>
          <span className="breadcrumb-sep">&gt;</span>
          <span>{currentCountry.region}</span>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-active">{currentCountry.name} eSIM</span>
        </div>

        {/* 3-Column main section */}
        <div className="product-main-grid">
          {/* Column 1: Gallery */}
          <div className="product-gallery-col">
            <div className="gallery-main-box">
              <img src={selectedImage} alt={`${currentCountry.name} eSIM`} className="gallery-main-img" />
              <div className="gallery-overlay">
                <div className="overlay-flag-title">
                  <span className="overlay-flag">{currentCountry.flag}</span>
                  <div>
                    <h2 className="overlay-title-large">{currentCountry.name.toUpperCase()}</h2>
                    <p className="overlay-subtitle-large">eSIM</p>
                  </div>
                </div>
              </div>
              <div className="gallery-badge-row">
                <span className="gallery-badge"><Check size={12} /> Nhanh chóng</span>
                <span className="gallery-badge"><Check size={12} /> Ổn định</span>
                <span className="gallery-badge"><Check size={12} /> Dễ sử dụng</span>
              </div>
            </div>

            <div className="gallery-thumb-list">
              {currentCountry.images.map((img) => (
                <div 
                  key={img.id} 
                  className={`gallery-thumb-item ${selectedImage === img.url ? 'active' : ''}`}
                  onClick={() => setSelectedImage(img.url)}
                >
                  <img src={img.url} alt={img.title} className="gallery-thumb-img" />
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Details & Packages selector */}
          <div className="product-info-col">
            <h1 className="product-title-text">{currentCountry.name} eSIM</h1>
            
            <div className="product-rating-row">
              <div className="star-rating">
                <Star size={14} fill="#FF9F00" stroke="#FF9F00" />
                <Star size={14} fill="#FF9F00" stroke="#FF9F00" />
                <Star size={14} fill="#FF9F00" stroke="#FF9F00" />
                <Star size={14} fill="#FF9F00" stroke="#FF9F00" />
                <Star size={14} fill="#FF9F00" stroke="#FF9F00" />
              </div>
              <span className="rating-score">4.9</span>
              <span className="rating-count">(2,568 đánh giá)</span>
            </div>

            <p className="product-short-desc">
              Kết nối tốc độ cao tại {currentCountry.name} với eSIM tiện lợi. Nhận eSIM ngay sau khi thanh toán qua email.
            </p>

            {/* Icons Grid */}
            <div className="features-grid">
              <div className="feature-item">
                <Globe size={18} className="feature-icon" />
                <div>
                  <span className="feat-lbl">Mạng</span>
                  <span className="feat-val">{currentCountry.network.split(' / ')[0]}</span>
                </div>
              </div>
              <div className="feature-item">
                <Clock size={18} className="feature-icon" />
                <div>
                  <span className="feat-lbl">Kích hoạt</span>
                  <span className="feat-val">Dễ dàng</span>
                </div>
              </div>
              <div className="feature-item">
                <Radio size={18} className="feature-icon" />
                <div>
                  <span className="feat-lbl">Chia sẻ</span>
                  <span className="feat-val">Hotspot</span>
                </div>
              </div>
              <div className="feature-item">
                <Headphones size={18} className="feature-icon" />
                <div>
                  <span className="feat-lbl">Hỗ trợ</span>
                  <span className="feat-val">24/7</span>
                </div>
              </div>
            </div>

            {/* Bộ chọn Loại SIM */}
            {hasVariants && availableSimTypes.length > 1 && (
              <div className="package-selector-section" style={{ marginBottom: '20px' }}>
                <div className="package-selector-header" style={{ marginBottom: '12px' }}>
                  <h3 className="package-selector-title">Chọn loại SIM</h3>
                  <span className="package-badge-info">Nhấp để xem cơ chế nhận</span>
                </div>
                <div className="packages-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {availableSimTypes.map((type) => {
                    let label = 'eSIM API';
                    let desc = 'Mã nhận qua email';
                    if (type === 'leSIM') {
                      label = 'leSIM Tự Động';
                      desc = 'Cấp phát tức thì qua webhook';
                    } else if (type === 'manual') {
                      label = 'eSIM Thủ Công';
                      desc = 'Mã QR tĩnh nạp sẵn';
                    } else if (type === 'physical') {
                      label = 'SIM Vật Lý';
                      desc = 'Giao hàng tận nơi';
                    }
                    return (
                      <div 
                        key={type} 
                        className={`package-card-option ${selectedSimType === type ? 'selected' : ''}`}
                        onClick={() => handleSimTypeClick(type)}
                        style={{ padding: '12px 10px', height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                      >
                        {selectedSimType === type && (
                          <div className="selected-check-indicator">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                        <span className="pkg-card-limit" style={{ fontSize: '13px', fontWeight: 'bold' }}>{label}</span>
                        <span className="pkg-card-duration" style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-light)', lineHeight: '1.2' }}>{desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gói dữ liệu Selector */}
            <div className="package-selector-section">
              <div className="package-selector-header" style={{ marginBottom: '12px' }}>
                <h3 className="package-selector-title">Chọn Dung lượng</h3>
                <span className="package-badge-info">Tốc độ cao 4G/5G</span>
              </div>

              {hasVariants && uniqueDataLimits.length > 8 ? (
                <div className="custom-select-wrapper" style={{ width: '100%' }}>
                  <select
                    value={selectedVariantData}
                    onChange={(e) => handleDataLimitClick(e.target.value)}
                    className="premium-select-dropdown"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      color: 'var(--text-main)',
                      fontSize: '14px',
                      fontWeight: '500',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23FF9F00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                      backgroundSize: '16px',
                      paddingRight: '44px'
                    }}
                  >
                    {uniqueDataLimits.map((limit) => (
                      <option 
                        key={limit} 
                        value={limit}
                        style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}
                      >
                        {limit}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="packages-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {hasVariants ? (
                    uniqueDataLimits.map((limit) => (
                      <div 
                        key={limit} 
                        className={`package-card-option ${selectedVariantData === limit ? 'selected' : ''}`}
                        onClick={() => handleDataLimitClick(limit)}
                        style={{ padding: '12px 10px', height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        {selectedVariantData === limit && (
                          <div className="selected-check-indicator">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                        <span className="pkg-card-limit" style={{ fontSize: '13px', fontWeight: 'bold' }}>{limit}</span>
                        <span className="pkg-card-duration" style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-light)' }}>
                          {limit.includes('/') || limit.includes('Ngày') ? 'Mỗi ngày' : 'Tổng dung lượng'}
                        </span>
                      </div>
                    ))
                  ) : (
                    DATA_OPTIONS.map((opt) => (
                      <div 
                        key={opt.id} 
                        className={`package-card-option ${selectedDataId === opt.id ? 'selected' : ''}`}
                        onClick={() => setSelectedDataId(opt.id)}
                        style={{ padding: '12px 10px', height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        {selectedDataId === opt.id && (
                          <div className="selected-check-indicator">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                        <span className="pkg-card-limit" style={{ fontSize: '13px', fontWeight: 'bold' }}>{opt.label}</span>
                        <span className="pkg-card-duration" style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-light)' }}>
                          {opt.type === 'daily' ? 'Mỗi ngày' : 'Tổng dung lượng'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Số ngày sử dụng Selector */}
            <div className="package-selector-section" style={{ marginTop: '20px' }}>
              <div className="package-selector-header" style={{ marginBottom: '12px' }}>
                <h3 className="package-selector-title">Chọn số ngày sử dụng</h3>
              </div>

              {hasVariants && uniqueDurations.length > 8 ? (
                <div className="custom-select-wrapper" style={{ width: '100%' }}>
                  <select
                    value={selectedVariantDuration}
                    onChange={(e) => handleDurationClick(e.target.value)}
                    className="premium-select-dropdown"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      color: 'var(--text-main)',
                      fontSize: '14px',
                      fontWeight: '500',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23FF9F00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                      backgroundSize: '16px',
                      paddingRight: '44px'
                    }}
                  >
                    {uniqueDurations.map((dur) => {
                      const isAvailable = filteredVariants.some(
                        (v: any) => v.dataLimit === selectedVariantData && v.duration === dur
                      );
                      return (
                        <option 
                          key={dur} 
                          value={dur}
                          disabled={!isAvailable}
                          style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}
                        >
                          {dur} {!isAvailable ? ' (Không hỗ trợ với dung lượng đã chọn)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="packages-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                  {hasVariants ? (
                    uniqueDurations.map((dur) => {
                      const isAvailable = filteredVariants.some(
                        (v: any) => v.dataLimit === selectedVariantData && v.duration === dur
                      );
                      return (
                        <div 
                          key={dur} 
                          className={`package-card-option ${selectedVariantDuration === dur ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}`}
                          onClick={() => isAvailable && handleDurationClick(dur)}
                          style={{ 
                            padding: '10px 8px', 
                            height: 'auto', 
                            display: 'flex', 
                            justifyContent: 'center',
                            opacity: isAvailable ? 1 : 0.4,
                            cursor: isAvailable ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {selectedVariantDuration === dur && (
                            <div className="selected-check-indicator">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          )}
                          <span className="pkg-card-limit" style={{ fontSize: '13px' }}>{dur}</span>
                        </div>
                      );
                    })
                  ) : (
                    DURATIONS.map((days) => (
                      <div 
                        key={days} 
                        className={`package-card-option ${selectedDuration === days ? 'selected' : ''}`}
                        onClick={() => setSelectedDuration(days)}
                        style={{ padding: '10px 8px', height: 'auto', display: 'flex', justifyContent: 'center' }}
                      >
                        {selectedDuration === days && (
                          <div className="selected-check-indicator">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                        <span className="pkg-card-limit" style={{ fontSize: '13px' }}>{days} Ngày</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <p className="package-disclaimer-note" style={{ marginTop: '12px' }}>
                ℹ️ Thời gian tính từ khi quét mã và kết nối vào mạng tại {currentCountry.name}.
              </p>
            </div>
          </div>

          {/* Column 3: Cart Checkout box */}
          <div className="product-checkout-col">
            <div className="checkout-card-box">
              <span className="checkout-tag-label">Gói đã chọn</span>
              {(() => {
                const priceToUse = selectedPkg.price;
                const comparePriceToUse = selectedPkg.compareAtPrice || 0;
                const discountPercent = comparePriceToUse > priceToUse
                  ? Math.round(((comparePriceToUse - priceToUse) / comparePriceToUse) * 100)
                  : 0;
                return (
                  <div className="checkout-price-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    {discountPercent > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span className="checkout-compare-at" style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: '0.85em' }}>
                          {formatPrice(comparePriceToUse * quantity)}
                        </span>
                        <span className="checkout-discount-tag" style={{
                          backgroundColor: 'var(--primary-orange)',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          -{discountPercent}% GIẢM
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span className="checkout-price">{formatPrice(priceToUse * quantity)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="checkout-meta-list">
                <div className="checkout-meta-item">
                  <Check size={14} className="meta-check-icon" />
                  <span>{selectedPkg.dataLimit}</span>
                </div>
                <div className="checkout-meta-item">
                  <Check size={14} className="meta-check-icon" />
                  <span>{selectedPkg.duration}</span>
                </div>
                <div className="checkout-meta-item">
                  <Check size={14} className="meta-check-icon" />
                  <span>Tốc độ 4G/5G</span>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="checkout-quantity-row">
                <span className="qty-label">Số lượng</span>
                <div className="qty-selectors">
                  <button className="qty-btn" onClick={decrementQuantity} disabled={quantity <= 1}>
                    <Minus size={14} />
                  </button>
                  <span className="qty-number">{quantity}</span>
                  <button className="qty-btn" onClick={incrementQuantity}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="checkout-actions">
                <button className="checkout-btn primary" onClick={handleAddToCart}>
                  Thêm vào giỏ hàng
                </button>
                <button className="checkout-btn secondary" onClick={handleBuyNow}>
                  Mua ngay
                </button>
              </div>

              <div className="checkout-footer-trust">
                <span className="trust-title">Thanh toán an toàn & bảo mật</span>
                <div className="payment-gateways-strip">
                  <span className="pay-tag visa-tag">VISA</span>
                  <span className="pay-tag mc-tag">Mastercard</span>
                  <span className="pay-tag paypal-tag">PayPal</span>
                  <span className="pay-tag apple-tag"> Pay</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Benefits block */}
        <div className="quick-benefits-strip">
          <div className="benefit-cell">
            <Mail className="benefit-icon" />
            <div>
              <span className="benefit-title">Nhận eSIM tức thì</span>
              <span className="benefit-desc">Qua email sau khi thanh toán</span>
            </div>
          </div>
          <div className="benefit-cell">
            <Globe className="benefit-icon" />
            <div>
              <span className="benefit-title">Không roaming</span>
              <span className="benefit-desc">Tiết kiệm hơn khi đi nước ngoài</span>
            </div>
          </div>
          <div className="benefit-cell">
            <Headphones className="benefit-icon" />
            <div>
              <span className="benefit-title">Hỗ trợ 24/7</span>
              <span className="benefit-desc">Đội ngũ sẵn sàng hỗ trợ</span>
            </div>
          </div>
          <div className="benefit-cell">
            <Settings className="benefit-icon" />
            <div>
              <span className="benefit-title">Kích hoạt dễ dàng</span>
              <span className="benefit-desc">Chỉ vài bước đơn giản</span>
            </div>
          </div>
        </div>

        {/* Information Tabs horizontal strip */}
        <div className="product-tabs-container">
          {/* Top: Description text */}
          <div className={`tab-info-block description-card-panel ${isDescExpanded ? 'expanded' : 'collapsed'}`} style={{ marginBottom: '28px' }}>
            <h4 className="tab-section-heading">Chi tiết gói cước</h4>
            <div className="description-collapse-wrapper">
              {currentCountry.guide ? (
                <div 
                  className="rich-description-content" 
                  dangerouslySetInnerHTML={{ __html: currentCountry.guide }} 
                  style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-medium)' }}
                />
              ) : (
                <>
                  <p className="tab-desc-paragraph">
                    eSIM {currentCountry.name} mang đến kết nối internet ổn định và tốc độ cao everywhere. Quét mã QR để cài đặt, không cần SIM vật lý, sử dụng ngay khi đến {currentCountry.name}.
                  </p>
                  <ul className="tab-checklist-orange">
                    <li><Check size={14} className="list-check-icon" /> Kết nối ổn định với mạng {currentCountry.network}</li>
                    <li><Check size={14} className="list-check-icon" /> Tốc độ cao 4G/5G</li>
                    <li><Check size={14} className="list-check-icon" /> Chia sẻ hotspot</li>
                    <li><Check size={14} className="list-check-icon" /> Giữ nguyên số WhatsApp, Zalo, iMessage</li>
                    <li><Check size={14} className="list-check-icon" /> Không cần đăng ký, không giấy tờ</li>
                  </ul>
                </>
              )}
            </div>
            
            {/* Expand action */}
            <div className="description-expand-action">
              <button className="expand-desc-btn" onClick={() => setIsDescExpanded(!isDescExpanded)}>
                {isDescExpanded ? 'Thu gọn' : 'Xem thêm chi tiết'}
              </button>
            </div>
          </div>

          <div className="tabs-header-strip">
            <button 
              className={`tab-btn-item ${activeTab === 'kythuat' ? 'active' : ''}`}
              onClick={() => setActiveTab('kythuat')}
            >
              Thông tin kỹ thuật
            </button>
            <button 
              className={`tab-btn-item ${activeTab === 'caidat' ? 'active' : ''}`}
              onClick={() => setActiveTab('caidat')}
            >
              Hướng dẫn cài đặt
            </button>
            <button 
              className={`tab-btn-item ${activeTab === 'tuongthich' ? 'active' : ''}`}
              onClick={() => setActiveTab('tuongthich')}
            >
              Tương thích
            </button>
            <button 
              className={`tab-btn-item ${activeTab === 'danhgia' ? 'active' : ''}`}
              onClick={() => setActiveTab('danhgia')}
            >
              Đánh giá (2,568)
            </button>
            <button 
              className={`tab-btn-item ${activeTab === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              Câu hỏi thường gặp
            </button>
          </div>

          <div className="tab-contents-panel">
            {activeTab === 'kythuat' && (
              <div className="tab-bottom-grid fade-in">
                {/* Left/Center: Selected package details card */}
                <div className="tab-specs-block">
                  <div className="specs-card-details">
                    <h4 className="specs-card-title">Thông tin gói đang chọn</h4>
                    <div className="specs-details-list">
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <MapPin size={14} className="specs-icon-inline" />
                          <span>Điểm đến</span>
                        </span>
                        <span className="specs-val">{currentCountry.name}</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <Globe size={14} className="specs-icon-inline" />
                          <span>Nhà mạng</span>
                        </span>
                        <span className="specs-val">{currentCountry.network}</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <Database size={14} className="specs-icon-inline" />
                          <span>Dung lượng</span>
                        </span>
                        <span className="specs-val">{selectedPkg.dataLimit}</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <Calendar size={14} className="specs-icon-inline" />
                          <span>Thời hạn sử dụng</span>
                        </span>
                        <span className="specs-val">{selectedPkg.duration}</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <HardDrive size={14} className="specs-icon-inline" />
                          <span>Loại gói</span>
                        </span>
                        <span className="specs-val">Dữ liệu</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <Zap size={14} className="specs-icon-inline" />
                          <span>Kích hoạt</span>
                        </span>
                        <span className="specs-val">Kích hoạt khi đến {currentCountry.name}</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <Radio size={14} className="specs-icon-inline" />
                          <span>Chia sẻ Hotspot</span>
                        </span>
                        <span className="specs-val">Có</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <Zap size={14} className="specs-icon-inline" />
                          <span>Tốc độ</span>
                        </span>
                        <span className="specs-val">4G/5G</span>
                      </div>
                      <div className="specs-detail-row">
                        <span className="specs-lbl">
                          <ShieldCheck size={14} className="specs-icon-inline" />
                          <span>Hiệu lực</span>
                        </span>
                        <span className="specs-val">Bắt đầu khi kết nối mạng</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Other Popular packages list */}
                <div className="tab-popular-block">
                  <div className="popular-card-box">
                    <h4 className="popular-card-title">Gói phổ biến khác</h4>
                    <div className="popular-card-list">
                      {hasVariants ? (
                        currentCountry.variants
                          .filter((v: any) => v.id !== activeVariant?.id)
                          .slice(0, 5)
                          .map((v: any, idx: number) => (
                            <div key={idx} className="popular-list-item" onClick={() => {
                              setSelectedVariantData(v.dataLimit);
                              setSelectedVariantDuration(v.duration);
                            }}>
                              <span className="pop-desc">{v.dataLimit} · {v.duration}</span>
                              <span className="pop-price">{formatPrice(v.price)}</span>
                            </div>
                          ))
                      ) : (
                        POPULAR_COMBINATIONS.filter(c => !(c.dataId === selectedDataId && c.duration === selectedDuration)).slice(0, 5).map((combo, idx) => {
                          const dataOpt = DATA_OPTIONS.find(o => o.id === combo.dataId)!;
                          let price = 0;
                          if (dataOpt.type === 'daily') {
                            price = Math.round(dataOpt.baseDailyPrice * combo.duration * baseFactor);
                          } else {
                            price = Math.round(((dataOpt.baseDailyPrice * combo.duration) + (dataOpt.flatFee || 0)) * baseFactor);
                          }
                          return (
                            <div key={idx} className="popular-list-item" onClick={() => {
                              setSelectedDataId(combo.dataId);
                              setSelectedDuration(combo.duration);
                            }}>
                              <span className="pop-desc">{dataOpt.label} · {combo.duration} ngày</span>
                              <span className="pop-price">{formatPrice(price)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <button className="view-all-packages-outline" onClick={() => triggerNotification('Xem tất cả các gói trong mục lục')}>
                      Xem tất cả gói
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab !== 'kythuat' && activeTab !== 'danhgia' && (
              <div className="tab-placeholder-info-panel fade-in">
                <h4 className="tab-section-heading">
                  {activeTab === 'caidat' && 'Hướng dẫn cài đặt'}
                  {activeTab === 'tuongthich' && 'Thiết bị tương thích'}
                  {activeTab === 'faq' && 'Câu hỏi thường gặp'}
                </h4>
                <p style={{ marginTop: '10px', color: 'var(--text-medium)', fontSize: '14px', lineHeight: '1.6' }}>
                  {activeTab === 'caidat' && 'Sau khi mua hàng, bạn sẽ nhận được một email chứa mã QR cài đặt. Đi tới Cài đặt > Di động > Thêm gói cước di động và quét mã QR này. Đảm bảo bạn đã kết nối WiFi khi cài đặt.'}
                  {activeTab === 'tuongthich' && 'Hỗ trợ các thiết bị iPhone XS trở lên, Google Pixel 3 trở lên, Samsung Galaxy S20 trở lên và các dòng máy tính bảng/thiết bị đeo thông minh hỗ trợ eSIM.'}
                  {activeTab === 'faq' && 'Có, bạn hoàn toàn có thể chia sẻ Hotspot cho các thiết bị khác sử dụng bình thường. Gói cước sẽ tự động kích hoạt khi bạn đáp xuống sân bay và bắt đầu kết nối mạng lần đầu tiên tại quốc gia điểm đến.'}
                </p>
              </div>
            )}

            {activeTab === 'danhgia' && (
              <div className="reviews-tab-container fade-in">
                {/* Summary Header */}
                <div className="reviews-summary-header">
                  <div className="summary-left">
                    <h3 className="average-score-title">4.9 / 5</h3>
                    <div className="summary-stars">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill="#FF9F00" stroke="#FF9F00" />)}
                    </div>
                    <p className="summary-count-text">({2568 + reviews.length} đánh giá khách hàng)</p>
                  </div>
                  
                  <div className="summary-right">
                    {/* Sort select */}
                    <div className="sort-filter-box">
                      <label style={{ fontSize: '13.5px', fontWeight: '600', marginRight: '8px', color: 'var(--hico-text-dark)' }}>Sắp xếp theo:</label>
                      <select 
                        value={sortOption} 
                        onChange={(e) => setSortOption(e.target.value as any)}
                        className="reviews-sort-select"
                      >
                        <option value="newest">Mới nhất</option>
                        <option value="highest">Số sao cao nhất</option>
                        <option value="lowest">Số sao thấp nhất</option>
                      </select>
                    </div>
                    
                    {/* Write review button */}
                    <button className="write-review-toggle-btn" onClick={() => setIsFormOpen(!isFormOpen)}>
                      {isFormOpen ? 'Đóng Form' : 'Viết Đánh Giá'}
                    </button>
                  </div>
                </div>

                {/* Write Review Form */}
                {isFormOpen && (
                  <div className="review-form-card">
                    <h4 className="review-form-title">Đánh giá của bạn về eSIM {currentCountry.name}</h4>
                    {isSubmitSuccess ? (
                      <div className="review-submit-success-banner">
                        <CheckCircle2 size={32} className="success-icon-banner" />
                        <p>Cảm ơn bạn! Đánh giá của bạn đã được gửi thành công và đang chờ ban quản trị phê duyệt.</p>
                      </div>
                    ) : (
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setIsSubmitting(true);
                        const payload = {
                          rating: newRating,
                          userName: isLoggedIn ? currentUser?.name : newName,
                          userPhone: isLoggedIn ? currentUser?.phone : newPhone,
                          userEmail: isLoggedIn ? currentUser?.email : '',
                          content: newContent,
                          images: uploadedImages
                        };
                        
                        try {
                          const res = await fetch(`/api/products/${resolvedId}/reviews`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                          });
                          if (res.ok) {
                            setIsSubmitSuccess(true);
                            setNewContent('');
                            setUploadedImages([]);
                            setNewName('');
                            setNewPhone('');
                            setTimeout(() => {
                              setIsSubmitSuccess(false);
                              setIsFormOpen(false);
                              fetchReviews();
                            }, 3000);
                          }
                        } catch (err) {
                          console.error("Failed to submit review:", err);
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}>
                        <div className="form-group-star-rating">
                          <label>Chọn số sao đánh giá:</label>
                          <div className="rating-input-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button 
                                type="button" 
                                key={star} 
                                className="star-btn-select"
                                onClick={() => setNewRating(star)}
                              >
                                <Star 
                                  size={24} 
                                  fill={star <= newRating ? "#FF9F00" : "none"} 
                                  stroke="#FF9F00" 
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* If guest, display name and phone number */}
                        {!isLoggedIn && (
                          <div className="review-form-grid-inputs">
                            <div className="review-form-input-group">
                              <label>Họ và tên <span className="req">*</span></label>
                              <input 
                                type="text" 
                                value={newName} 
                                onChange={e => setNewName(e.target.value)} 
                                required 
                                placeholder="Nhập họ và tên của bạn"
                              />
                            </div>
                            <div className="review-form-input-group">
                              <label>Số điện thoại <span className="req">*</span></label>
                              <input 
                                type="tel" 
                                value={newPhone} 
                                onChange={e => setNewPhone(e.target.value)} 
                                required 
                                placeholder="Nhập số điện thoại"
                              />
                            </div>
                          </div>
                        )}

                        {isLoggedIn && (
                          <div className="review-logged-in-badge-info">
                            <span>Đánh giá dưới tên: <b>{currentUser?.name}</b> ({currentUser?.email})</span>
                          </div>
                        )}

                        <div className="review-form-input-group full-width">
                          <label>Nội dung đánh giá <span className="req">*</span></label>
                          <textarea 
                            rows={4} 
                            value={newContent} 
                            onChange={e => setNewContent(e.target.value)} 
                            required 
                            placeholder="Nhập nội dung chia sẻ về chất lượng mạng di động, dịch vụ hỗ trợ..."
                          />
                        </div>

                        <div className="review-form-input-group full-width">
                          <label>Hình ảnh đính kèm (Tùy chọn)</label>
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            onChange={handleImageChange}
                            className="review-image-file-input"
                          />
                          {uploadedImages.length > 0 && (
                            <div className="review-uploaded-previews-list">
                              {uploadedImages.map((img, idx) => (
                                <div key={idx} className="review-uploaded-preview-item">
                                  <img src={img} alt="Uploaded review photo" />
                                  <button 
                                    type="button" 
                                    className="delete-preview-image-btn" 
                                    onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button type="submit" disabled={isSubmitting} className="review-form-submit-btn-action">
                          {isSubmitting ? 'Đang gửi...' : 'Gửi Đánh Giá Chờ Duyệt'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Reviews List */}
                <div className="reviews-feed-list">
                  {sortedReviews.length === 0 ? (
                    <div className="no-reviews-feed-placeholder">
                      <p>Chưa có đánh giá nào được phê duyệt cho sản phẩm này. Hãy là người đầu tiên gửi đánh giá của bạn!</p>
                    </div>
                  ) : (
                    sortedReviews.map((rev) => (
                      <div key={rev.id} className="review-item-card-feed">
                        <div className="review-item-header-feed">
                          <div className="reviewer-info-left">
                            <div className="reviewer-avatar-placeholder">
                              {rev.userName.substring(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <h5 className="reviewer-display-name">
                                {rev.userName} 
                                {rev.userEmail && <span className="verified-buyer-badge"><Check size={10} /> Đã xác minh</span>}
                              </h5>
                              <span className="review-item-date-feed">{rev.createdAt}</span>
                            </div>
                          </div>
                          <div className="reviewer-item-stars-feed">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star 
                                key={s} 
                                size={14} 
                                fill={s <= rev.rating ? "#FF9F00" : "none"} 
                                stroke="#FF9F00" 
                              />
                            ))}
                          </div>
                        </div>
                        
                        <p className="review-item-content-feed">{rev.content}</p>
                        
                        {rev.images && rev.images.length > 0 && (
                          <div className="review-item-gallery-images-feed">
                            {rev.images.map((imgUrl: string, idx: number) => (
                              <img 
                                key={idx} 
                                src={imgUrl} 
                                alt="Customer attachment" 
                                className="review-gallery-thumb"
                                onClick={() => window.open(imgUrl, '_blank')}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Brand metrics stats row */}
        <div className="brand-stats-row">
          <div className="stat-capsule-item">
            <Globe className="stat-capsule-icon" />
            <div>
              <span className="stat-capsule-val">200+</span>
              <span className="stat-capsule-lbl">Quốc gia & vùng lãnh thổ</span>
            </div>
          </div>
          <div className="stat-capsule-item">
            <Users className="stat-capsule-icon" />
            <div>
              <span className="stat-capsule-val">1 Triệu+</span>
              <span className="stat-capsule-lbl">Khách hàng tin dùng</span>
            </div>
          </div>
          <div className="stat-capsule-item">
            <Star className="stat-capsule-icon" />
            <div>
              <span className="stat-capsule-val">4.9/5</span>
              <span className="stat-capsule-lbl">Đánh giá trung bình</span>
            </div>
          </div>
          <div className="stat-capsule-item">
            <ShieldCheck className="stat-capsule-icon" />
            <div>
              <span className="stat-capsule-val">100%</span>
              <span className="stat-capsule-lbl">Hài lòng hoặc hoàn tiền</span>
            </div>
          </div>
        </div>

        {/* Registration Promotion box */}
        <div className="promo-register-section">
          <div className="promo-register-left">
            <Mail size={40} className="promo-mail-icon" />
            <div>
              <h3 className="promo-heading">Đăng ký nhận ưu đãi</h3>
              <p className="promo-sub">Nhận thông tin khuyến mãi và ưu đãi đặc biệt từ HICO.</p>
            </div>
          </div>
          <div className="promo-register-right">
            <form onSubmit={(e) => { e.preventDefault(); triggerNotification('Đăng ký email nhận ưu đãi thành công!'); }} className="promo-form-field">
              <input 
                type="email" 
                placeholder="Nhập email của bạn" 
                className="promo-input-email" 
                required 
              />
              <button type="submit" className="promo-submit-btn">Đăng ký</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
