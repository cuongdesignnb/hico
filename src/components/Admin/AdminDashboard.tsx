import React, { useCallback, useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Radio, Library, Globe, Users, Gift, FileText, 
  HelpCircle, BarChart3, Wallet, Box, Users2, Settings, Mail, Phone,
  Search, Plus, Bell, ChevronDown, Calendar, Download, DollarSign, ShoppingBag, 
  CheckCircle2, AlertTriangle, Menu, Info, RotateCw, Lock, Inbox, Clock,
  Image, Trash2, FolderOpen, Upload, Copy, ExternalLink, X, MessageSquare, Star, Cpu, Sparkles,
  PackageSearch
} from 'lucide-react';
import './AdminDashboard.css';
import RichTextEditor from './RichTextEditor';
import { MediaAssetField } from './media/MediaAssetField';
import CatalogTab from './Catalog/CatalogTab';
import ProviderCatalogTab from './Providers/ProviderCatalogTab';
import { CatalogSheetSync } from './CatalogSheetSync/CatalogSheetSync';
import { SheetVariantReconciliation } from './Catalog/SheetVariantReconciliation';
import { GoogleSheetSettings } from './Settings/Integrations/GoogleSheetSettings';
import SePaySettingsPanel from './Payments/SePaySettingsPanel';
import { createLegacyVariantId } from '../../utils/ids';
import { useAuth } from '../../auth/useAuth';
import { useAdminToast } from '../../hooks/useAdminToast';
import type {
  AdminArticle,
  AdminCatalogItem,
  AdminCustomer,
  AdminMediaFile,
  AdminOrder,
  AdminOrderItem,
  AdminPromo,
  AdminTicket,
  AdminTicketMessage,
  AdminUser,
  LegacyVariant,
  ManualQr,
  ProductReview,
} from '../../types/legacy';

// Helper functions for price input formatting
const formatNumberInput = (val: string | number) => {
  if (val === undefined || val === null || val === '') return '';
  // Remove all non-digit characters
  const clean = val.toString().replace(/\D/g, '');
  if (!clean) return '';
  return parseInt(clean, 10).toLocaleString('vi-VN');
};

const parseFormattedNumber = (val: string) => {
  // Remove all non-digit characters to save clean numeric string
  return val.replace(/\D/g, '');
};

const getSimTypeBadge = (simType?: string, leSIM?: boolean | null) => {
  const type = simType || (leSIM !== false ? 'leSIM' : 'eSIM');
  let bg = '#E0F2FE';
  let color = '#0369A1';
  let border = '1px solid #BAE6FD';
  let text = type;

  if (type === 'leSIM') {
    bg = '#FFF0E6';
    color = '#FF4F00';
    border = '1px solid #FFD8C2';
  } else if (type === 'manual') {
    bg = '#F3E8FF';
    color = '#7E22CE';
    border = '1px solid #E9D5FF';
    text = 'eSIM Thủ công';
  } else if (type === 'physical') {
    bg = '#DCFCE7';
    color = '#15803D';
    border = '1px solid #BBF7D0';
    text = 'SIM Vật lý';
  } else {
    text = 'eSIM (API)';
  }

  return (
    <span style={{ 
      backgroundColor: bg, 
      color: color, 
      padding: '2px 6px', 
      borderRadius: '4px', 
      fontSize: '9px', 
      fontWeight: 'bold', 
      border: border 
    }}>
      {text}
    </span>
  );
};

const getOrderStatusTextAndClass = (status?: string) => {
  let text = 'Đang xử lý';
  let className = 'pending';

  switch (status) {
    case 'PROVISIONED':
      text = 'Đã cấp eSIM';
      className = 'active';
      break;
    case 'SHIPPED':
      text = 'Đã giao SIM cứng';
      className = 'active';
      break;
    case 'PENDING_SHIP':
      text = 'Chờ giao SIM cứng';
      className = 'pending';
      break;
    case 'PENDING_QR_ASSIGN':
      text = 'Chờ cấp QR';
      className = 'pending';
      break;
    case 'PENDING_CALLBACK':
      text = 'Chờ Callback';
      className = 'pending';
      break;
    case 'CANCELLED':
      text = 'Đã huỷ';
      className = 'cancelled';
      break;
  }
  return { text, className };
};

interface NavItem {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface CatalogSourceStatus {
  readSource: 'legacy' | 'canonical';
  legacyWriteEnabled: boolean;
  canonicalVersion: string | null;
  canonicalChecksum: string | null;
  rollbackAvailable: boolean;
}

export const AdminDashboard: React.FC = () => {
  const { hasPermission } = useAuth();
  const toast = useAdminToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const ITEMS_PER_PAGE = 10;
  const [currentPageOrders, setCurrentPageOrders] = useState(1);
  const [currentPageDevices, setCurrentPageDevices] = useState(1);
  const [currentPagePackages, setCurrentPagePackages] = useState(1);
  const [currentPageCoverage, setCurrentPageCoverage] = useState(1);
  const [currentPageCustomers, setCurrentPageCustomers] = useState(1);
  const [currentPagePromos, setCurrentPagePromos] = useState(1);
  const [currentPageArticles, setCurrentPageArticles] = useState(1);
  const [currentPageReviews, setCurrentPageReviews] = useState(1);
  const [currentPageWarehouse, setCurrentPageWarehouse] = useState(1);

  // Reset all page numbers when search query or active tab changes
  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPageOrders(1);
      setCurrentPageDevices(1);
      setCurrentPagePackages(1);
      setCurrentPageCoverage(1);
      setCurrentPageCustomers(1);
      setCurrentPagePromos(1);
      setCurrentPageArticles(1);
      setCurrentPageReviews(1);
      setCurrentPageWarehouse(1);
    });
  }, [searchQuery, activeTab]);

  const [selectedLanguage, setSelectedLanguage] = useState<'vi' | 'en'>('vi');

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [devices, setDevices] = useState<AdminCatalogItem[]>([]);
  const [packages, setPackages] = useState<AdminCatalogItem[]>([]);
  const [destinations, setDestinations] = useState<AdminCatalogItem[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [catalogSourceStatus, setCatalogSourceStatus] =
    useState<CatalogSourceStatus | null>(null);
  const legacyCatalogReadOnly =
    catalogSourceStatus?.legacyWriteEnabled === false;

  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [editingCustomerEmail, setEditingCustomerEmail] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', status: 'Hoạt động' });

  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState({ code: '', discount: '', description: '', expiry: '', status: 'Hoạt động' });

  // Media Library state
  const [mediaFiles, setMediaFiles] = useState<AdminMediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [selectedImageCallback, setSelectedImageCallback] = useState<((url: string) => void) | null>(null);

  // Form states and editing states
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);

  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState({ 
    sku: '', name: '', category: 'pocket', specs: '', price: '', 
    compareAtPrice: '', stock: '50', description: '', badge: '', 
    bestSeller: false, image: '', imageMediaId: null as string | null, seoTitle: '', seoDescription: '', seoKeywords: ''
  });
  
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [packageForm, setPackageForm] = useState({ 
    sku: '', name: '', coverage: '', dataLimit: '', duration: '', price: '', 
    compareAtPrice: '', wmproductId: '', network: '', description: '', 
    featured: false, iconType: 'region', leSIM: true, seoTitle: '', seoDescription: '', seoKeywords: ''
  });

  const [isAddingDestination, setIsAddingDestination] = useState(false);
  const [destinationForm, setDestinationForm] = useState({ 
    sku: '', name: '', flag: '', dataLimit: '', duration: '', price: '', 
    compareAtPrice: '', wmproductId: '', image: '', imageMediaId: null as string | null, network: '',
    featured: false, guide: '', leSIM: true, seoTitle: '', seoDescription: '', seoKeywords: ''
  });

  const [isAddingArticle, setIsAddingArticle] = useState(false);
  const [articleForm, setArticleForm] = useState({ 
    title: '', category: '', image: '', imageMediaId: null as string | null, date: '', content: '', seoTitle: '', seoDescription: '', seoKeywords: '',
    status: 'published', scheduledDate: ''
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', role: 'CSKH', status: 'Offline' });

  // API Configuration state
  const [apiConfig, setApiConfig] = useState({
    merchantId: '',
    deptId: '',
    token: '',
    apiUrl: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    openaiApiKey: '',
    openaiModel: 'ChatGPT 5.4 mini',
    openaiImageModel: 'chatGPT image 2',
    openaiApiUrl: 'https://api.openai.com/v1'
  });

  const [orderTracking, setOrderTracking] = useState<{[key: string]: string}>({});

  // AI Bulk Writing state
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [bulkStatus, setBulkStatus] = useState('published');
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [bulkInterval, setBulkInterval] = useState('2');
  const [bulkIntervalUnit, setBulkIntervalUnit] = useState('hours');
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkLogs, setBulkLogs] = useState<string[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

  // Variant Manager state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantTarget, setVariantTarget] = useState<{ type: 'destination' | 'package'; item: AdminCatalogItem } | null>(null);
  const [manualQrs, setManualQrs] = useState<ManualQr[]>([]);
  const [newVariantForm, setNewVariantForm] = useState({
    sku: '',
    dataLimit: '',
    duration: '',
    price: '',
    compareAtPrice: '',
    wmproductId: '',
    simType: 'eSIM'
  });

  const fetchManualQrs = async () => {
    try {
      const res = await fetch('/api/admin/manual-qrs');
      if (res.ok) setManualQrs(await res.json());
    } catch (e) {
      console.warn("Failed to fetch manual QRs:", e);
    }
  };

  const handleUploadQrToPool = async (variantId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch('/api/admin/manual-qrs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId, base64Data, filename: file.name })
        });
        if (res.ok) {
          toast.success('Nạp mã QR thành công!');
          fetchManualQrs();
        } else {
          toast.error('Nạp mã QR thất bại!');
        }
      } catch (err) {
        console.error(err);
        toast.error('Gặp lỗi khi tải ảnh QR lên!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenVariantManager = (type: 'destination' | 'package', item: AdminCatalogItem) => {
    if (legacyCatalogReadOnly) return;
    setVariantTarget({ type, item });
    setNewVariantForm({
      sku: '',
      dataLimit: '',
      duration: '',
      price: '',
      compareAtPrice: '',
      wmproductId: '',
      simType: 'eSIM'
    });
    fetchManualQrs();
    setIsVariantModalOpen(true);
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantTarget || legacyCatalogReadOnly) return;

    const { type, item } = variantTarget;
    const currentVariants = Array.isArray(item.variants) ? item.variants : [];

    const newVar = {
      id: createLegacyVariantId(),
      sku: newVariantForm.sku || `${type === 'destination' ? 'DEST' : 'PKG'}-${item.id.toUpperCase()}-${newVariantForm.duration.replace(/\s+/g, '')}-${newVariantForm.dataLimit.replace(/\s+/g, '')}`.toUpperCase(),
      dataLimit: newVariantForm.dataLimit,
      duration: newVariantForm.duration,
      price: parseFloat(newVariantForm.price) || 0,
      compareAtPrice: newVariantForm.compareAtPrice ? parseFloat(newVariantForm.compareAtPrice) : null,
      wmproductId: newVariantForm.wmproductId,
      simType: newVariantForm.simType,
      leSIM: newVariantForm.simType === 'leSIM'
    };

    const updatedVariants = [...currentVariants, newVar];

    try {
      const endpoint = type === 'destination' ? `/api/admin/destinations/${item.id}` : `/api/admin/packages/${item.id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: updatedVariants })
      });

      if (res.ok) {
        const updatedItem = await res.json();
        setVariantTarget({ type, item: updatedItem }); // update local modal state
        setNewVariantForm({
          sku: '',
          dataLimit: '',
          duration: '',
          price: '',
          compareAtPrice: '',
          wmproductId: '',
          simType: 'eSIM'
        });
        fetchData(type === 'destination' ? 'coverage' : 'packages'); // reload main table lists
      } else {
        toast.error('Không thể lưu biến thể!');
      }
    } catch (err) {
      console.error('Failed to add variant:', err);
    }
  };

  const handleDeleteVariant = async (varId: string) => {
    if (!variantTarget || legacyCatalogReadOnly) return;
    if (!confirm('Xoá biến thể này?')) return;

    const { type, item } = variantTarget;
    const currentVariants = Array.isArray(item.variants) ? item.variants : [];
    const updatedVariants = currentVariants.filter((v: LegacyVariant) => v.id !== varId);

    try {
      const endpoint = type === 'destination' ? `/api/admin/destinations/${item.id}` : `/api/admin/packages/${item.id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: updatedVariants })
      });

      if (res.ok) {
        const updatedItem = await res.json();
        setVariantTarget({ type, item: updatedItem }); // update local modal state
        fetchData(type === 'destination' ? 'coverage' : 'packages'); // reload main table lists
      } else {
        toast.error('Không thể xoá biến thể!');
      }
    } catch (err) {
      console.error('Failed to delete variant:', err);
    }
  };

  const fetchData = useCallback(async (tab: string) => {
    try {
      if (tab === 'orders' || tab === 'reports' || tab === 'payments') {
        const res = await fetch('/api/admin/orders');
        if (res.ok) setOrders(await res.json());
      } else if (tab === 'devices') {
        const res = await fetch('/api/admin/devices');
        if (res.ok) setDevices(await res.json());
      } else if (tab === 'packages') {
        const res = await fetch('/api/admin/packages');
        if (res.ok) setPackages(await res.json());
      } else if (tab === 'coverage') {
        const res = await fetch('/api/admin/destinations');
        if (res.ok) setDestinations(await res.json());
      } else if (tab === 'warehouse') {
        const resDest = await fetch('/api/admin/destinations');
        if (resDest.ok) setDestinations(await resDest.json());
        const resQr = await fetch('/api/admin/manual-qrs');
        if (resQr.ok) setManualQrs(await resQr.json());
      } else if (tab === 'customers') {
        const res = await fetch('/api/admin/customers');
        if (res.ok) setCustomers(await res.json());
      } else if (tab === 'promos') {
        const res = await fetch('/api/admin/promos');
        if (res.ok) setPromos(await res.json());
      } else if (tab === 'articles') {
        const res = await fetch('/api/admin/articles');
        if (res.ok) setArticles(await res.json());
      } else if (tab === 'support') {
        const res = await fetch('/api/admin/tickets');
        if (res.ok) {
          const ticketsList = await res.json();
          setTickets(ticketsList);
          if (ticketsList.length > 0) {
            setSelectedTicketId((currentTicketId) => currentTicketId ?? ticketsList[0].ticketCode);
          }
        }
      } else if (tab === 'personnel') {
        const res = await fetch('/api/admin/users');
        if (res.ok) setUsers(await res.json());
      } else if (tab === 'reviews') {
        const res = await fetch('/api/admin/reviews');
        if (res.ok) setReviews(await res.json());
      } else if (tab === 'media') {
        const res = await fetch('/api/admin/media');
        if (res.ok) setMediaFiles(await res.json());
      } else if (tab === 'settings') {
        const res = await fetch('/api/admin/config');
        if (res.ok) setApiConfig(await res.json());
      }
    } catch (e) {
      console.warn('Failed to fetch admin tab data:', e);
    }
  }, []);

  const handleStartBulkGeneration = async () => {
    const list = bulkKeywords.split('\n').map(k => k.trim()).filter(Boolean);
    if (list.length === 0) {
      toast.warning('Vui lòng nhập danh sách từ khóa (mỗi dòng một từ)!');
      return;
    }
    
    setIsGeneratingBulk(true);
    setBulkProgress(0);
    setBulkLogs([`[${new Date().toLocaleTimeString()}] Bắt đầu quy trình viết bài hàng loạt (${list.length} từ khóa)...`]);

    const addLog = (msg: string) => {
      setBulkLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    let countSuccess = 0;
    
    const intervalVal = parseInt(bulkInterval, 10) || 2;
    const baseTime = new Date(bulkStartDate).getTime();
    let intervalMs = 0;
    if (bulkIntervalUnit === 'minutes') intervalMs = intervalVal * 60 * 1000;
    else if (bulkIntervalUnit === 'hours') intervalMs = intervalVal * 60 * 60 * 1000;
    else if (bulkIntervalUnit === 'days') intervalMs = intervalVal * 24 * 60 * 60 * 1000;

    for (let i = 0; i < list.length; i++) {
      const keyword = list[i];
      addLog(`[${i+1}/${list.length}] Đang xử lý từ khóa: "${keyword}"...`);
      
      try {
        const res = await fetch('/api/admin/articles/generate-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: keyword })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Server error');
        }
        
        const data = await res.json();
        addLog(`  -> Đã tạo nội dung & ảnh bìa thành công.`);

        const targetStatus = bulkStatus;
        let targetScheduledDate = '';
        let targetDate = 'Hôm nay';

        if (bulkStatus === 'scheduled') {
          const scheduledTime = new Date(baseTime + i * intervalMs);
          targetScheduledDate = scheduledTime.toISOString().slice(0, 16);
          targetDate = scheduledTime.toLocaleDateString('vi-VN');
          addLog(`  -> Lên lịch đăng vào lúc: ${scheduledTime.toLocaleString('vi-VN')}`);
        } else if (bulkStatus === 'draft') {
          addLog(`  -> Đặt trạng thái: Lưu nháp`);
        } else {
          addLog(`  -> Đặt trạng thái: Đăng ngay`);
        }

        const saveRes = await fetch('/api/admin/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: keyword,
            image: data.image,
            imageMediaId: data.imageMediaId,
            date: targetDate,
            content: data.content,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
            seoKeywords: data.seoKeywords,
            status: targetStatus,
            scheduledDate: targetScheduledDate
          })
        });

        if (saveRes.ok) {
          addLog(`  -> Đã lưu bài viết thành công.`);
          countSuccess++;
        } else {
          throw new Error('Không thể lưu bài viết vào database.');
        }

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định';
        addLog(`  [LỖI] Thất bại khi xử lý "${keyword}": ${errorMessage}`);
      }

      const prog = Math.round(((i + 1) / list.length) * 100);
      setBulkProgress(prog);
    }

    addLog(`Quy trình hoàn tất. Thành công: ${countSuccess}/${list.length} bài viết.`);
    setIsGeneratingBulk(false);
    fetchData('articles');
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  useEffect(() => {
    let active = true;
    const loadSourceStatus = async () => {
      try {
        const response = await fetch('/api/admin/catalog/source-status');
        if (response.ok && active) {
          setCatalogSourceStatus(await response.json());
        }
      } catch (error) {
        console.warn('Failed to fetch catalog source status:', error);
      }
    };
    loadSourceStatus();
    return () => {
      active = false;
    };
  }, []);

  const sidebarNavItems: NavItem[] = [
    { id: 'overview', name: 'Tổng quan', icon: <LayoutDashboard className="admin-nav-icon" /> },
    { id: 'catalog', name: 'Sản phẩm', icon: <ShoppingBag className="admin-nav-icon" /> },
    { id: 'providers', name: 'Nguồn hàng', icon: <PackageSearch className="admin-nav-icon" /> },
    { id: 'orders', name: 'Đơn hàng eSIM', icon: <ShoppingCart className="admin-nav-icon" /> },
    { id: 'devices', name: 'Thiết bị 4G/5G', icon: <Radio className="admin-nav-icon" /> },
    { id: 'packages', name: 'Gói cước', icon: <Library className="admin-nav-icon" /> },
    { id: 'coverage', name: 'Quốc gia & vùng phủ', icon: <Globe className="admin-nav-icon" /> },
    { id: 'customers', name: 'Khách hàng', icon: <Users className="admin-nav-icon" /> },
    { id: 'promos', name: 'Khuyến mãi', icon: <Gift className="admin-nav-icon" /> },
    { id: 'articles', name: 'Bài viết', icon: <FileText className="admin-nav-icon" /> },
    { id: 'ai-bulk-writing', name: 'Viết bài hàng loạt AI', icon: <Cpu className="admin-nav-icon" /> },
    { id: 'reviews', name: 'Đánh giá', icon: <MessageSquare className="admin-nav-icon" /> },
    { id: 'media', name: 'Thư viện ảnh', icon: <Image className="admin-nav-icon" /> },
    { id: 'support', name: 'Hỗ trợ', icon: <HelpCircle className="admin-nav-icon" /> },
    { id: 'reports', name: 'Báo cáo', icon: <BarChart3 className="admin-nav-icon" /> },
    { id: 'payments', name: 'Thanh toán', icon: <Wallet className="admin-nav-icon" /> },
    { id: 'warehouse', name: 'Kho hàng', icon: <Box className="admin-nav-icon" /> },
    { id: 'personnel', name: 'Nhân sự & phân quyền', icon: <Users2 className="admin-nav-icon" /> },
    { id: 'settings', name: 'Cài đặt', icon: <Settings className="admin-nav-icon" /> },
    { id: 'catalog-sheet-sync', name: 'Đồng bộ Sheet', icon: <PackageSearch className="admin-nav-icon" /> },
    { id: 'catalog-sheet-reconciliation', name: 'Sheet variant identity', icon: <PackageSearch className="admin-nav-icon" /> },
  ];
  const tabPermissions: Record<string, string | string[]> = {
    overview: 'admin.dashboard.read', catalog: 'catalog.product.read', providers: 'provider.read', orders: 'orders.read',
    devices: 'catalog.product.read', packages: 'catalog.product.read', coverage: 'catalog.product.read', customers: 'orders.read',
    promos: 'catalog.product.update', articles: 'articles.read', 'ai-bulk-writing': 'articles.manage', reviews: 'articles.manage',
    media: 'media.upload', support: 'orders.update', reports: 'orders.read', payments: ['payments.settings.read', 'payments.transactions.read'], warehouse: 'inventory.stock.read',
    personnel: 'admin.users.read', settings: ['system.config.read_masked', 'catalog.sheet.settings.read'], 'catalog-sheet-sync': 'catalog.sheet_sync', 'catalog-sheet-reconciliation': 'catalog.sheet.reconcile.read',
  };
  const visibleSidebarNavItems = sidebarNavItems.filter((item) => {
    const required = tabPermissions[item.id];
    return Array.isArray(required) ? required.some((permission) => hasPermission(permission)) : hasPermission(required);
  });

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch('/api/admin/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64Data })
        });
        if (res.ok) {
          const uploaded = await res.json();
          // Reload media list
          const mediaRes = await fetch('/api/admin/media');
          if (mediaRes.ok) setMediaFiles(await mediaRes.json());
          // If we were selecting an image via modal, trigger callback
          if (selectedImageCallback) {
            selectedImageCallback(uploaded.url);
            setIsMediaModalOpen(false);
            setSelectedImageCallback(null);
          }
        }
      } catch (err) {
        console.error('Failed to upload media:', err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMediaDelete = async (filename: string) => {
    if (confirm('Xoá hình ảnh này khỏi thư viện?')) {
      const res = await fetch(`/api/admin/media/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const mediaRes = await fetch('/api/admin/media');
        if (mediaRes.ok) setMediaFiles(await mediaRes.json());
      }
    }
  };

    const renderPagination = (
    totalItems: number,
    currentPage: number,
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
    itemsPerPage: number = 10
  ) => {
    if (totalItems <= itemsPerPage) return null;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="admin-pagination-container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        borderTop: '1px solid var(--border-light, rgba(255,255,255,0.08))',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        borderBottomLeftRadius: '12px',
        borderBottomRightRadius: '12px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ fontSize: '13px', color: 'var(--admin-text-light, #9CA3AF)', fontWeight: '500' }}>
          Hiển thị <span style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>{startItem}-{endItem}</span> trong tổng số <span style={{ fontWeight: 'bold' }}>{totalItems}</span> mục
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            type="button"
            className="admin-pagination-btn"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: currentPage === 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
              color: currentPage === 1 ? 'rgba(255, 255, 255, 0.25)' : 'var(--admin-text, #F3F4F6)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            Đầu
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            type="button"
            className="admin-pagination-btn"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: currentPage === 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
              color: currentPage === 1 ? 'rgba(255, 255, 255, 0.25)' : 'var(--admin-text, #F3F4F6)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            Trước
          </button>
          <span style={{ 
            fontSize: '12px', 
            color: 'var(--admin-text, #F3F4F6)', 
            padding: '0 8px', 
            fontWeight: '600',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            height: '20px',
            display: 'flex',
            alignItems: 'center'
          }}>
            Trang <strong style={{ color: 'var(--primary-orange)', margin: '0 4px' }}>{currentPage}</strong> / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            type="button"
            className="admin-pagination-btn"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: currentPage === totalPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
              color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.25)' : 'var(--admin-text, #F3F4F6)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            Sau
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            type="button"
            className="admin-pagination-btn"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: currentPage === totalPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
              color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.25)' : 'var(--admin-text, #F3F4F6)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            Cuối
          </button>
        </div>
      </div>
    );
  };

  // Filtered and paginated lists
  const filteredOrders = orders.filter(o => 
    o.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.status?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedOrders = filteredOrders.slice(
    (currentPageOrders - 1) * ITEMS_PER_PAGE,
    currentPageOrders * ITEMS_PER_PAGE
  );

  const filteredDevices = devices.filter(d => 
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedDevices = filteredDevices.slice(
    (currentPageDevices - 1) * ITEMS_PER_PAGE,
    currentPageDevices * ITEMS_PER_PAGE
  );

  const filteredPackages = packages.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.coverage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const paginatedPackages = filteredPackages.slice(
    (currentPagePackages - 1) * ITEMS_PER_PAGE,
    currentPagePackages * ITEMS_PER_PAGE
  );

  const filteredDestinations = destinations.filter(d => 
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.network?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedDestinations = filteredDestinations.slice(
    (currentPageCoverage - 1) * ITEMS_PER_PAGE,
    currentPageCoverage * ITEMS_PER_PAGE
  );

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedCustomers = filteredCustomers.slice(
    (currentPageCustomers - 1) * ITEMS_PER_PAGE,
    currentPageCustomers * ITEMS_PER_PAGE
  );

  const filteredPromos = promos.filter(p => 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedPromos = filteredPromos.slice(
    (currentPagePromos - 1) * ITEMS_PER_PAGE,
    currentPagePromos * ITEMS_PER_PAGE
  );

  const filteredArticles = articles.filter(art => 
    art.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedArticles = filteredArticles.slice(
    (currentPageArticles - 1) * ITEMS_PER_PAGE,
    currentPageArticles * ITEMS_PER_PAGE
  );

  const filteredReviews = reviews.filter(rev => 
    rev.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rev.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rev.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedReviews = filteredReviews.slice(
    (currentPageReviews - 1) * ITEMS_PER_PAGE,
    currentPageReviews * ITEMS_PER_PAGE
  );

  const warehouseItems = destinations.flatMap(d => 
    (d.variants || []).map((v: LegacyVariant) => ({
      ...v,
      destinationName: d.name
    }))
  );
  const filteredWarehouseItems = warehouseItems.filter(item => 
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.destinationName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.simType?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedWarehouseItems = filteredWarehouseItems.slice(
    (currentPageWarehouse - 1) * ITEMS_PER_PAGE,
    currentPageWarehouse * ITEMS_PER_PAGE
  );

  return (
    <div className="admin-layout">
      {/* Sidebar Section */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <Menu className="admin-sidebar-toggle-icon" size={20} />
          {/* SVG HICO logo matching the mockup */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="95" height="32" style={{ marginLeft: '10px' }}>
            <text x="5" y="28" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="24" fill="#111827">HIC</text>
            <text x="45" y="28" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="24" fill="#FF4F00">O</text>
            <path d="M63,16 A8,8 0 0,1 69,22" fill="none" stroke="#FF4F00" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M63,11 A14,14 0 0,1 74,22" fill="none" stroke="#FF4F00" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M63,6 A20,20 0 0,1 79,22" fill="none" stroke="#FF4F00" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <nav className="admin-sidebar-nav">
          {visibleSidebarNavItems.map((item) => (
            <div
              key={item.id}
              className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.name}</span>
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-version-info">
            <div className="admin-version-title-row">
              <span className="admin-version-title">HICO eSIM Admin</span>
              <Info size={13} className="admin-version-info-icon" />
            </div>
            <span className="admin-version-num">Phiên bản 2.5.0</span>
          </div>
          <div className="admin-support-box">
            <div className="admin-support-title-row">
              <HelpCircle size={13} className="admin-support-title-icon" />
              <span className="admin-support-title">Hỗ trợ quản trị</span>
            </div>
            <a href="mailto:admin@hico.vn" className="admin-support-link">
              <Mail size={12} />
              <span>admin@hico.vn</span>
            </a>
            <a href="tel:19009999" className="admin-support-link">
              <Phone size={12} />
              <span>1900 9999</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Panel Section */}
      <main className="admin-main">
        {/* Header Block */}
        <header className="admin-header">
          <div className="admin-header-left">
            <h1 className="admin-header-title">
              {visibleSidebarNavItems.find(item => item.id === activeTab)?.name || 'Tổng quan'}
            </h1>
            <span className="admin-header-subtitle">Bảng điều khiển quản trị</span>
          </div>

          <div className="admin-header-middle">
            <div className="admin-search-wrapper">
              <Search size={16} className="admin-search-icon" />
              <input
                type="text"
                placeholder="Tìm kiếm đơn hàng, khách hàng, eSIM..."
                className="admin-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="admin-search-badge">⌘K</span>
            </div>
          </div>

          <div className="admin-header-right">
            <button className="admin-create-btn" onClick={() => toast.info('Tạo nhanh sẽ được bổ sung trong phiên bản tiếp theo.')}>
              <Plus size={14} />
              <span>Tạo nhanh</span>
            </button>

            <button className="admin-header-icon-btn">
              <Bell size={18} />
              <span className="admin-btn-badge">12</span>
            </button>

            <button className="admin-header-icon-btn">
              <HelpCircle size={18} />
            </button>

            <div 
              className="admin-lang-select" 
              onClick={() => setSelectedLanguage(selectedLanguage === 'vi' ? 'en' : 'vi')}
            >
              <span className="admin-lang-flag">{selectedLanguage === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
              <span>{selectedLanguage === 'vi' ? 'VI' : 'EN'}</span>
              <ChevronDown size={12} />
            </div>

            <div className="admin-user-profile">
              <img src="/images/avatar_admin.png" alt="Admin Avatar" className="admin-avatar" />
              <div className="admin-user-info">
                <span className="admin-username">Admin HICO</span>
                <span className="admin-role">Quản trị viên</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <div className="admin-container">
          {activeTab === 'catalog' && (
            <CatalogTab searchQuery={searchQuery} />
          )}

          {activeTab === 'providers' && (
            <ProviderCatalogTab searchQuery={searchQuery} />
          )}
          {activeTab === 'catalog-sheet-sync' && <CatalogSheetSync />}
          {activeTab === 'catalog-sheet-reconciliation' && <SheetVariantReconciliation />}
          {activeTab === 'payments' && <SePaySettingsPanel />}
          
          {activeTab === 'overview' && (
            <>
              {/* Secondary Control Row */}
              <div className="admin-controls-row">
                <div className="admin-date-picker">
                  <Calendar size={14} />
                  <span>Hôm nay: 15/05/2024</span>
                  <ChevronDown size={12} />
                </div>

                <button className="admin-export-btn" onClick={() => toast.info('Đang chuẩn bị xuất báo cáo...')}>
                  <Download size={14} />
                  <span>Xuất báo cáo</span>
                </button>
              </div>

              {/* Row 1: 4 Mini Stat Cards */}
              <div className="admin-stats-grid">
                {/* Stat Card 1 */}
                <div className="admin-stat-card">
                  <div className="admin-stat-details">
                    <span className="admin-stat-title">Doanh thu hôm nay</span>
                    <span className="admin-stat-value">2.241.250.000đ</span>
                    <span className="admin-stat-growth positive">
                      <span>↑ +18.6%</span>
                      <span className="admin-stat-label">so với hôm qua</span>
                    </span>
                  </div>
                  <div className="admin-stat-visual">
                    <div className="admin-stat-icon-circle">
                      <DollarSign size={18} />
                    </div>
                    {/* SVG sparkline */}
                    <svg className="admin-stat-sparkline" viewBox="0 0 90 24" fill="none">
                      <path d="M 0,20 Q 15,10 30,16 T 60,12 T 90,8" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M 0,20 Q 15,10 30,16 T 60,12 T 90,8 L 90,24 L 0,24 Z" fill="url(#spark-grad)" opacity="0.1" />
                      <defs>
                        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF4F00" />
                          <stop offset="100%" stopColor="#FF4F00" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                {/* Stat Card 2 */}
                <div className="admin-stat-card">
                  <div className="admin-stat-details">
                    <span className="admin-stat-title">Đơn hàng mới</span>
                    <span className="admin-stat-value">1,248</span>
                    <span className="admin-stat-growth positive">
                      <span>↑ +12.4%</span>
                      <span className="admin-stat-label">so với hôm qua</span>
                    </span>
                  </div>
                  <div className="admin-stat-visual">
                    <div className="admin-stat-icon-circle">
                      <ShoppingBag size={18} />
                    </div>
                    <svg className="admin-stat-sparkline" viewBox="0 0 90 24" fill="none">
                      <path d="M 0,22 Q 15,18 30,10 T 60,14 T 90,6" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M 0,22 Q 15,18 30,10 T 60,14 T 90,6 L 90,24 L 0,24 Z" fill="url(#spark-grad)" opacity="0.1" />
                    </svg>
                  </div>
                </div>

                {/* Stat Card 3 */}
                <div className="admin-stat-card">
                  <div className="admin-stat-details">
                    <span className="admin-stat-title">eSIM đã kích hoạt</span>
                    <span className="admin-stat-value">2,536</span>
                    <span className="admin-stat-growth positive">
                      <span>↑ +15.3%</span>
                      <span className="admin-stat-label">so với hôm qua</span>
                    </span>
                  </div>
                  <div className="admin-stat-visual">
                    <div className="admin-stat-icon-circle">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M18 20a2 2 0 0 0 2-2V9l-5-5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                        <path d="M16 10h.01" />
                        <path d="M12 10h.01" />
                        <path d="M8 10h.01" />
                        <path d="M16 14h.01" />
                        <path d="M12 14h.01" />
                        <path d="M8 14h.01" />
                      </svg>
                    </div>
                    <svg className="admin-stat-sparkline" viewBox="0 0 90 24" fill="none">
                      <path d="M 0,18 Q 15,15 30,12 T 60,18 T 90,4" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M 0,18 Q 15,15 30,12 T 60,18 T 90,4 L 90,24 L 0,24 Z" fill="url(#spark-grad)" opacity="0.1" />
                    </svg>
                  </div>
                </div>

                {/* Stat Card 4 */}
                <div className="admin-stat-card">
                  <div className="admin-stat-details">
                    <span className="admin-stat-title">Thiết bị sắp hết hàng</span>
                    <span className="admin-stat-value">23</span>
                    <span className="admin-stat-growth negative">
                      <span>Cần nhập thêm</span>
                    </span>
                  </div>
                  <div className="admin-stat-visual">
                    <div className="admin-stat-icon-circle" style={{ color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <svg className="admin-stat-sparkline" viewBox="0 0 90 24" fill="none">
                      <path d="M 0,20 Q 15,16 30,22 T 60,16 T 90,22" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M 0,20 Q 15,16 30,22 T 60,16 T 90,22 L 90,24 L 0,24 Z" fill="url(#spark-grad)" opacity="0.1" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Row 2: 3 Analytics Columns */}
              <div className="admin-analytics-grid">
                {/* Chart Area Left */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Doanh thu & Đơn hàng</h2>
                    <div className="admin-card-actions">
                      <select className="admin-select-sm">
                        <option>7 ngày qua</option>
                        <option>30 ngày qua</option>
                      </select>
                      <button className="admin-btn-text-sm">Chi tiết</button>
                    </div>
                  </div>
                  <div className="admin-chart-legend">
                    <div className="legend-item">
                      <span className="legend-color rev"></span>
                      <span>Doanh thu (USD)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color ord"></span>
                      <span>Đơn hàng</span>
                    </div>
                  </div>
                  {/* SVG Main chart area */}
                  <div className="admin-area-chart-container">
                    <svg className="admin-chart-svg" viewBox="0 0 500 180" fill="none">
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="#F3F4F6" strokeWidth="1" />
                      <line x1="0" y1="60" x2="500" y2="60" stroke="#F3F4F6" strokeWidth="1" />
                      <line x1="0" y1="100" x2="500" y2="100" stroke="#F3F4F6" strokeWidth="1" />
                      <line x1="0" y1="140" x2="500" y2="140" stroke="#F3F4F6" strokeWidth="1" />
                      
                      {/* Axes labels on Y-axis (Left: Doanh thu) */}
                      <text x="5" y="24" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF">2.5Tỷ</text>
                      <text x="5" y="64" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF">2Tỷ</text>
                      <text x="5" y="104" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF">1.5Tỷ</text>
                      <text x="5" y="144" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF">1Tỷ</text>
                      <text x="5" y="174" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF">0</text>

                      {/* Axes labels on Y-axis (Right: Đơn hàng) */}
                      <text x="495" y="24" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="end">1.5K</text>
                      <text x="495" y="64" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="end">1.2K</text>
                      <text x="495" y="104" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="end">900</text>
                      <text x="495" y="144" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="end">600</text>
                      <text x="495" y="174" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="end">0</text>

                      {/* Doanh thu path line (Gradient filled area) */}
                      <path d="M 50,110 Q 100,105 150,115 T 250,90 T 350,120 T 450,85 T 500,75 L 500,170 L 50,170 Z" fill="url(#chart-fill-grad)" opacity="0.1" />
                      <path d="M 50,110 Q 100,105 150,115 T 250,90 T 350,120 T 450,85 T 500,75" stroke="#FF4F00" strokeWidth="2.5" strokeLinecap="round" />

                      {/* Đơn hàng dotted line path */}
                      <path d="M 50,140 Q 100,130 150,135 T 250,110 T 350,150 T 450,120 T 500,105" stroke="#111827" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />

                      {/* Tooltip vertical line anchor */}
                      <line x1="285" y1="20" x2="285" y2="170" stroke="#E5E7EB" strokeWidth="1" />
                      <circle cx="285" cy="98" r="4.5" fill="#FF4F00" stroke="#FFFFFF" strokeWidth="1.5" />
                      <circle cx="285" cy="116" r="3.5" fill="#111827" stroke="#FFFFFF" strokeWidth="1.5" />

                      {/* Dates horizontal labels */}
                      <text x="50" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">09/05</text>
                      <text x="125" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">10/05</text>
                      <text x="200" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">11/05</text>
                      <text x="275" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">12/05</text>
                      <text x="350" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">13/05</text>
                      <text x="425" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">14/05</text>
                      <text x="490" y="178" fontFamily="var(--font-family)" fontSize="8" fill="#9CA3AF" textAnchor="middle">15/05</text>

                      <defs>
                        <linearGradient id="chart-fill-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF4F00" />
                          <stop offset="100%" stopColor="#FF4F00" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Tooltip Overlay matching mockup date 13/05 */}
                    <div className="admin-chart-tooltip" style={{ left: '290px', top: '10px' }}>
                      <span className="tooltip-date">13/05/2024</span>
                      <div className="tooltip-row">
                        <span className="tooltip-dot rev"></span>
                        <span>Doanh thu: <strong>1.960.500.000đ</strong></span>
                      </div>
                      <div className="tooltip-row">
                        <span className="tooltip-dot ord"></span>
                        <span>Đơn hàng: <strong>1,154</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Donut Chart Product Sales */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Doanh số theo loại sản phẩm</h2>
                    <select className="admin-select-sm">
                      <option>7 ngày qua</option>
                    </select>
                  </div>
                  
                  <div className="admin-donut-container">
                    <div className="donut-visual-box">
                      {/* SVG Circle Donut */}
                      <svg width="130" height="130" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="#E5E7EB" strokeWidth="4.5" />
                        {/* eSIM Quốc tế (50.9%) -> stroke-dasharray="50.9 49.1" offset="25" */}
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="#FF4F00" strokeWidth="4.5" strokeDasharray="50.9 49.1" strokeDashoffset="25" />
                        {/* eSIM Nội địa (20.6%) -> stroke-dasharray="20.6 79.4" offset="-25.9" */}
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="#3B82F6" strokeWidth="4.5" strokeDasharray="20.6 79.4" strokeDashoffset="-25.9" />
                        {/* Router 4G/5G (17.9%) -> stroke-dasharray="17.9 82.1" offset="-46.5" */}
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="#E086D3" strokeWidth="4.5" strokeDasharray="17.9 82.1" strokeDashoffset="-46.5" />
                        {/* USB LTE (10.6%) -> stroke-dasharray="10.6 89.4" offset="-64.4" */}
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="#10B981" strokeWidth="4.5" strokeDasharray="10.6 89.4" strokeDashoffset="-64.4" />
                      </svg>
                      
                      <div className="donut-center-text">
                        <span className="donut-center-label">Tổng doanh thu</span>
                        <span className="donut-center-val">15.635.750.000đ</span>
                        <span className="donut-center-pct">100%</span>
                      </div>
                    </div>

                    <div className="admin-donut-legend">
                      <div className="donut-legend-item">
                        <div className="donut-legend-left">
                          <span className="donut-legend-color" style={{ backgroundColor: '#FF4F00' }}></span>
                          <span>eSIM quốc tế</span>
                        </div>
                        <span className="donut-legend-right">7.956.250.000đ<span className="donut-legend-pct">(50.9%)</span></span>
                      </div>
                      <div className="donut-legend-item">
                        <div className="donut-legend-left">
                          <span className="donut-legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                          <span>eSIM nội địa</span>
                        </div>
                        <span className="donut-legend-right">3.218.750.000đ<span className="donut-legend-pct">(20.6%)</span></span>
                      </div>
                      <div className="donut-legend-item">
                        <div className="donut-legend-left">
                          <span className="donut-legend-color" style={{ backgroundColor: '#E086D3' }}></span>
                          <span>Router 4G/5G</span>
                        </div>
                        <span className="donut-legend-right">2.805.750.000đ<span className="donut-legend-pct">(17.9%)</span></span>
                      </div>
                      <div className="donut-legend-item">
                        <div className="donut-legend-left">
                          <span className="donut-legend-color" style={{ backgroundColor: '#10B981' }}></span>
                          <span>USB LTE</span>
                        </div>
                        <span className="donut-legend-right">1.655.000.000đ<span className="donut-legend-pct">(10.6%)</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Methods Progress Bars */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Phương thức thanh toán</h2>
                    <select className="admin-select-sm">
                      <option>7 ngày qua</option>
                    </select>
                  </div>

                  <div className="admin-payment-list">
                    {/* Method 1 */}
                    <div className="payment-item">
                      <div className="payment-item-header">
                        <span className="payment-brand">
                          <span className="payment-brand-icon">💳</span>
                          <span>Thẻ tín dụng/ghi nợ</span>
                        </span>
                        <span className="payment-val-share">
                          <span className="payment-value">$256,430</span>
                          <span className="payment-share">41.0%</span>
                        </span>
                      </div>
                      <div className="payment-progress-bar">
                        <div className="payment-progress-fill visa" style={{ width: '41%' }}></div>
                      </div>
                    </div>

                    {/* Method 2 */}
                    <div className="payment-item">
                      <div className="payment-item-header">
                        <span className="payment-brand">
                          <span className="payment-brand-icon" style={{ color: '#C2185B' }}>M</span>
                          <span>Ví điện tử (MoMo, ZaloPay)</span>
                        </span>
                        <span className="payment-val-share">
                          <span className="payment-value">$185,220</span>
                          <span className="payment-share">29.6%</span>
                        </span>
                      </div>
                      <div className="payment-progress-bar">
                        <div className="payment-progress-fill momo" style={{ width: '29.6%' }}></div>
                      </div>
                    </div>

                    {/* Method 3 */}
                    <div className="payment-item">
                      <div className="payment-item-header">
                        <span className="payment-brand">
                          <span className="payment-brand-icon">🏦</span>
                          <span>Chuyển khoản ngân hàng</span>
                        </span>
                        <span className="payment-val-share">
                          <span className="payment-value">$112,540</span>
                          <span className="payment-share">18.0%</span>
                        </span>
                      </div>
                      <div className="payment-progress-bar">
                        <div className="payment-progress-fill bank" style={{ width: '18%' }}></div>
                      </div>
                    </div>

                    {/* Method 4 */}
                    <div className="payment-item">
                      <div className="payment-item-header">
                        <span className="payment-brand">
                          <span className="payment-brand-icon" style={{ color: '#003087' }}>P</span>
                          <span>PayPal</span>
                        </span>
                        <span className="payment-val-share">
                          <span className="payment-value">$41,240</span>
                          <span className="payment-share">6.6%</span>
                        </span>
                      </div>
                      <div className="payment-progress-bar">
                        <div className="payment-progress-fill paypal" style={{ width: '6.6%' }}></div>
                      </div>
                    </div>

                    {/* Method 5 */}
                    <div className="payment-item">
                      <div className="payment-item-header">
                        <span className="payment-brand">
                          <span className="payment-brand-icon">📲</span>
                          <span>Apple Pay / Google Pay</span>
                        </span>
                        <span className="payment-val-share">
                          <span className="payment-value">$29,000</span>
                          <span className="payment-share">4.6%</span>
                        </span>
                      </div>
                      <div className="payment-progress-bar">
                        <div className="payment-progress-fill wallet" style={{ width: '4.6%' }}></div>
                      </div>
                    </div>

                    {/* Total box */}
                    <div className="payment-footer">
                      <span>Tổng doanh thu</span>
                      <span>$625,430</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Recent Orders & Leaderboard */}
              <div className="admin-table-leaderboard-grid">
                {/* Orders Table Column */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Đơn hàng mới nhất</h2>
                    <a href="#orders" className="admin-card-header-link" onClick={() => setActiveTab('orders')}>
                      Xem tất cả đơn hàng →
                    </a>
                  </div>

                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Mã đơn</th>
                          <th>Khách hàng</th>
                          <th>Sản phẩm</th>
                          <th>Quốc gia</th>
                          <th>Trạng thái</th>
                          <th>Thanh toán</th>
                          <th>Tổng tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><a href="#view" className="order-code-link">#ESM-2024-0515-1268</a></td>
                          <td className="order-customer">Nguyễn Minh Anh</td>
                          <td>eSIM Châu Âu 10GB - 15 Ngày</td>
                          <td className="country-flag-cell">🇫🇷 <span>Pháp</span></td>
                          <td><span className="admin-badge active">Đã kích hoạt</span></td>
                          <td>
                            <span className="pay-method-badge visa">
                              <span className="pay-method-icon">💳</span>Thẻ tín dụng
                            </span>
                          </td>
                          <td>$19.90</td>
                        </tr>
                        <tr>
                          <td><a href="#view" className="order-code-link">#ESM-2024-0515-1267</a></td>
                          <td className="order-customer">Trần Hoàng Nam</td>
                          <td>eSIM Nhật Bản 10GB - 15 Ngày</td>
                          <td className="country-flag-cell">🇯🇵 <span>Nhật Bản</span></td>
                          <td><span className="admin-badge active">Đã kích hoạt</span></td>
                          <td>
                            <span className="pay-method-badge momo">
                              <span className="pay-method-icon">m</span>Ví MoMo
                            </span>
                          </td>
                          <td>$19.90</td>
                        </tr>
                        <tr>
                          <td><a href="#view" className="order-code-link">#ESM-2024-0515-1266</a></td>
                          <td className="order-customer">Lê Thị Thu Hà</td>
                          <td>Router WiFi 4G Mini</td>
                          <td className="country-flag-cell">🇻🇳 <span>Việt Nam</span></td>
                          <td><span className="admin-badge pending">Đang xử lý</span></td>
                          <td>
                            <span className="pay-method-badge bank">
                              <span className="pay-method-icon">🏦</span>Chuyển khoản
                            </span>
                          </td>
                          <td>$89.00</td>
                        </tr>
                        <tr>
                          <td><a href="#view" className="order-code-link">#ESM-2024-0515-1265</a></td>
                          <td className="order-customer">Phạm Gia Bảo</td>
                          <td>eSIM Thái Lan 15GB - 10 Ngày</td>
                          <td className="country-flag-cell">🇹🇭 <span>Thái Lan</span></td>
                          <td><span className="admin-badge active" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10B981' }}>Đã thanh toán</span></td>
                          <td>
                            <span className="pay-method-badge zalopay">
                              <span className="pay-method-icon">Z</span>Ví ZaloPay
                            </span>
                          </td>
                          <td>$15.90</td>
                        </tr>
                        <tr>
                          <td><a href="#view" className="order-code-link">#ESM-2024-0515-1264</a></td>
                          <td className="order-customer">Đỗ Quang Huy</td>
                          <td>USB 4G LTE</td>
                          <td className="country-flag-cell">🇰🇷 <span>Hàn Quốc</span></td>
                          <td><span className="admin-badge pending">Đang xử lý</span></td>
                          <td>
                            <span className="pay-method-badge visa">
                              <span className="pay-method-icon">💳</span>Thẻ tín dụng
                            </span>
                          </td>
                          <td>$69.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table pagination footer */}
                  <div className="table-pagination-row">
                    <span>Hiển thị 1 - 5 của 1,248 đơn hàng</span>
                    <div className="table-pagination-controls">
                      <button className="pagination-btn">&lt;</button>
                      <button className="pagination-btn active">1</button>
                      <button className="pagination-btn">2</button>
                      <button className="pagination-btn">3</button>
                      <button className="pagination-btn">4</button>
                      <button className="pagination-btn">5</button>
                      <button className="pagination-btn">...</button>
                      <button className="pagination-btn">&gt;</button>
                    </div>
                  </div>
                </div>

                {/* Leaderboard Column */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Top 5 eSIM bán chạy</h2>
                    <select className="admin-select-sm">
                      <option>7 ngày qua</option>
                    </select>
                  </div>

                  <div className="leaderboard-list">
                    <div className="leaderboard-item">
                      <span className="leaderboard-rank">1</span>
                      <div className="leaderboard-details">
                        <span className="leaderboard-title">eSIM Châu Á 10GB - 15 Ngày</span>
                        <div className="leaderboard-sales-rev">
                          <span className="leaderboard-sales">1,256</span>
                          <span className="leaderboard-revenue">$23,870</span>
                        </div>
                      </div>
                    </div>

                    <div className="leaderboard-item">
                      <span className="leaderboard-rank">2</span>
                      <div className="leaderboard-details">
                        <span className="leaderboard-title">eSIM Nhật Bản 10GB - 15 Ngày</span>
                        <div className="leaderboard-sales-rev">
                          <span className="leaderboard-sales">1,032</span>
                          <span className="leaderboard-revenue">$20,557</span>
                        </div>
                      </div>
                    </div>

                    <div className="leaderboard-item">
                      <span className="leaderboard-rank">3</span>
                      <div className="leaderboard-details">
                        <span className="leaderboard-title">eSIM Thái Lan 10GB - 15 Ngày</span>
                        <div className="leaderboard-sales-rev">
                          <span className="leaderboard-sales">842</span>
                          <span className="leaderboard-revenue">$13,378</span>
                        </div>
                      </div>
                    </div>

                    <div className="leaderboard-item">
                      <span className="leaderboard-rank">4</span>
                      <div className="leaderboard-details">
                        <span className="leaderboard-title">eSIM Hàn Quốc 10GB - 15 Ngày</span>
                        <div className="leaderboard-sales-rev">
                          <span className="leaderboard-sales">621</span>
                          <span className="leaderboard-revenue">$9,879</span>
                        </div>
                      </div>
                    </div>

                    <div className="leaderboard-item">
                      <span className="leaderboard-rank">5</span>
                      <div className="leaderboard-details">
                        <span className="leaderboard-title">eSIM Mỹ 20GB - 30 Ngày</span>
                        <div className="leaderboard-sales-rev">
                          <span className="leaderboard-sales">512</span>
                          <span className="leaderboard-revenue">$11,264</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <a href="#packages" className="admin-card-header-link" style={{ marginTop: '16px', display: 'block', textAlign: 'center' }} onClick={() => setActiveTab('packages')}>
                    Xem tất cả gói cước →
                  </a>
                </div>
              </div>

              {/* Row 4: 5 Mini Widgets */}
              <div className="admin-widgets-grid">
                {/* Widget 1 */}
                <div className="widget-card">
                  <div className="widget-card-header">
                    <span className="widget-card-title">Thiết bị bán chạy</span>
                    <select className="admin-select-sm" style={{ padding: '2px 4px', fontSize: '10px' }}>
                      <option>7 ngày qua</option>
                    </select>
                  </div>
                  <div className="widget-list">
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_wifi_mini.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Router WiFi 4G Mini</span>
                          <span className="widget-item-desc">Đã bán: 356</span>
                        </div>
                      </div>
                      <span className="widget-item-right">$31,684</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_wifi_5g.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Router WiFi 5G Tốc độ cao</span>
                          <span className="widget-item-desc">Đã bán: 214</span>
                        </div>
                      </div>
                      <span className="widget-item-right">$47,080</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_usb_4g.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">USB 4G LTE</span>
                          <span className="widget-item-desc">Đã bán: 189</span>
                        </div>
                      </div>
                      <span className="widget-item-right">$13,041</span>
                    </div>
                  </div>
                  <a href="#devices" className="widget-footer-link" onClick={() => setActiveTab('devices')}>Xem tất cả thiết bị →</a>
                </div>

                {/* Widget 2 */}
                <div className="widget-card">
                  <div className="widget-card-header">
                    <span className="widget-card-title">Cảnh báo tồn kho</span>
                  </div>
                  <div className="widget-list">
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_wifi_mini.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Router WiFi 4G Mini</span>
                        </div>
                      </div>
                      <span className="widget-badge-mini red">12</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_wifi_5g.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Router WiFi 5G Tốc độ cao</span>
                        </div>
                      </div>
                      <span className="widget-badge-mini red">8</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_usb_4g.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">USB 4G LTE</span>
                        </div>
                      </div>
                      <span className="widget-badge-mini orange">15</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/device_wifi_home.png" alt="Device" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Bộ phát WiFi 4G</span>
                        </div>
                      </div>
                      <span className="widget-badge-mini red">7</span>
                    </div>
                  </div>
                  <a href="#warehouse" className="widget-footer-link" onClick={() => setActiveTab('warehouse')}>Quản lý kho hàng →</a>
                </div>

                {/* Widget 3 */}
                <div className="widget-card">
                  <div className="widget-card-header">
                    <span className="widget-card-title">Tổng quan hỗ trợ</span>
                    <select className="admin-select-sm" style={{ padding: '2px 4px', fontSize: '10px' }}>
                      <option>Hôm nay</option>
                    </select>
                  </div>
                  <div className="widget-list">
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-icon">
                        <Inbox size={14} className="support-status-icon all" />
                        <span className="widget-item-title" style={{ fontWeight: '500' }}>Tổng ticket</span>
                      </div>
                      <span className="widget-item-right" style={{ fontWeight: '800' }}>68</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-icon">
                        <Clock size={14} className="support-status-icon pending" style={{ color: '#F59E0B' }} />
                        <span className="widget-item-title" style={{ fontWeight: '500' }}>Chờ phản hồi</span>
                      </div>
                      <span className="widget-item-right" style={{ color: '#F59E0B', fontWeight: '700' }}>18</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-icon">
                        <RotateCw size={14} className="support-status-icon processing" style={{ color: '#3B82F6' }} />
                        <span className="widget-item-title" style={{ fontWeight: '500' }}>Đang xử lý</span>
                      </div>
                      <span className="widget-item-right" style={{ color: '#3B82F6', fontWeight: '700' }}>32</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-icon">
                        <CheckCircle2 size={14} className="support-status-icon resolved" style={{ color: '#10B981' }} />
                        <span className="widget-item-title" style={{ fontWeight: '500' }}>Đã giải quyết</span>
                      </div>
                      <span className="widget-item-right" style={{ color: '#10B981', fontWeight: '700' }}>15</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-icon">
                        <Lock size={14} className="support-status-icon closed" style={{ color: '#9CA3AF' }} />
                        <span className="widget-item-title" style={{ fontWeight: '500' }}>Đã đóng</span>
                      </div>
                      <span className="widget-item-right" style={{ color: '#9CA3AF', fontWeight: '700' }}>3</span>
                    </div>
                  </div>
                  <a href="#support" className="widget-footer-link" onClick={() => setActiveTab('support')}>Xem tất cả ticket →</a>
                </div>

                {/* Widget 4 */}
                <div className="widget-card">
                  <div className="widget-card-header">
                    <span className="widget-card-title">Chiến dịch khuyến mãi</span>
                  </div>
                  <div className="widget-list">
                    <div className="widget-list-item">
                      <div className="widget-item-left">
                        <span className="widget-item-title">HÈ RỰC RỠ - Giảm 20% eSIM</span>
                        <span className="widget-item-desc">15/05 - 31/05/2024</span>
                      </div>
                      <span className="widget-badge-mini active" style={{ fontSize: '9px', backgroundColor: 'var(--admin-success-light)', color: 'var(--admin-success)' }}>Đang diễn ra</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left">
                        <span className="widget-item-title">Ưu đãi Router 5G - Giảm 15%</span>
                        <span className="widget-item-desc">01/05 - 31/05/2024</span>
                      </div>
                      <span className="widget-badge-mini active" style={{ fontSize: '9px', backgroundColor: 'var(--admin-success-light)', color: 'var(--admin-success)' }}>Đang diễn ra</span>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left">
                        <span className="widget-item-title">Flash Sale USB 4G - 10%</span>
                        <span className="widget-item-desc">15/05 - 19/05/2024</span>
                      </div>
                      <span className="widget-badge-mini orange" style={{ fontSize: '9px', backgroundColor: 'var(--admin-warning-light)', color: 'var(--admin-warning)' }}>Sắp kết thúc</span>
                    </div>
                  </div>
                  <a href="#promos" className="widget-footer-link" onClick={() => setActiveTab('promos')}>Quản lý khuyến mãi →</a>
                </div>

                {/* Widget 5 */}
                <div className="widget-card">
                  <div className="widget-card-header">
                    <span className="widget-card-title">Bài viết mới nhất</span>
                  </div>
                  <div className="widget-list">
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/art_travel_tips.png" alt="Article" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Kinh nghiệm du lịch Nhật Bản tự túc</span>
                          <span className="widget-item-desc">15/05/2024</span>
                        </div>
                      </div>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/art_esim_intro.png" alt="Article" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Hướng dẫn sử dụng eSIM HICO</span>
                          <span className="widget-item-desc">14/05/2024</span>
                        </div>
                      </div>
                    </div>
                    <div className="widget-list-item">
                      <div className="widget-item-left-with-thumb">
                        <img src="/images/art_sim_compare.png" alt="Article" className="widget-item-thumb" />
                        <div className="widget-item-left">
                          <span className="widget-item-title">Top 10 điểm đến Châu Âu nên đi</span>
                          <span className="widget-item-desc">13/05/2024</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <a href="#articles" className="widget-footer-link" onClick={() => setActiveTab('articles')}>Quản lý bài viết →</a>
                </div>
              </div>

              {/* Row 5: Detailed grids */}
              <div className="admin-detailed-grid">
                {/* Global Distribution Map widget */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Phân bố vùng phủ eSIM</h2>
                  </div>
                  <div className="map-dist-box">
                    <div className="map-dist-map">
                      {/* SVG map placeholder */}
                      <svg className="map-svg" viewBox="0 0 200 100" fill="none">
                        {/* World outlines simplified (Eurasia, Americas, Africa, Australia) */}
                        <path d="M10,25 Q20,15 35,22 T50,30 T45,45 T30,50 T15,35 Z" fill="#E5E7EB" opacity="0.6" />
                        <path d="M40,50 Q48,55 45,75 T35,90 T30,70 T35,55 Z" fill="#E5E7EB" opacity="0.6" />
                        <path d="M35,10 Q45,8 48,15 T38,18 Z" fill="#E5E7EB" opacity="0.6" />
                        <path d="M80,45 Q95,40 105,52 T115,75 T100,85 T90,70 T82,58 Z" fill="#E5E7EB" opacity="0.6" />
                        <path d="M75,30 Q90,15 120,20 T155,18 T175,25 T160,50 T135,45 T110,48 T95,35 Z" fill="#E5E7EB" opacity="0.6" />
                        <path d="M150,65 Q165,60 175,70 T160,82 T150,75 Z" fill="#E5E7EB" opacity="0.6" />
                        
                        {/* Glowing dots with rings */}
                        <g className="map-glow-dot">
                          <circle cx="32" cy="28" r="3.5" fill="#FF4F00" />
                          <circle cx="32" cy="28" r="8" fill="#FF4F00" opacity="0.3" className="pulse-ring" />
                        </g>
                        <g className="map-glow-dot">
                          <circle cx="95" cy="30" r="4" fill="#FF4F00" />
                          <circle cx="95" cy="30" r="9" fill="#FF4F00" opacity="0.3" className="pulse-ring" />
                        </g>
                        <g className="map-glow-dot">
                          <circle cx="120" cy="55" r="3" fill="#FF4F00" />
                          <circle cx="120" cy="55" r="7" fill="#FF4F00" opacity="0.3" className="pulse-ring" />
                        </g>
                        <g className="map-glow-dot">
                          <circle cx="148" cy="45" r="4" fill="#FF4F00" />
                          <circle cx="148" cy="45" r="9" fill="#FF4F00" opacity="0.3" className="pulse-ring" />
                        </g>
                        <g className="map-glow-dot">
                          <circle cx="160" cy="68" r="3" fill="#FF4F00" />
                          <circle cx="160" cy="68" r="7" fill="#FF4F00" opacity="0.3" className="pulse-ring" />
                        </g>
                      </svg>
                    </div>
                    <div className="map-dist-stats">
                      <div className="map-stat-item">
                        <span className="map-stat-num">200+</span>
                        <span className="map-stat-label">Quốc gia & vùng lãnh thổ</span>
                      </div>
                      <div className="map-stat-item">
                        <span className="map-stat-num">10,000+</span>
                        <span className="map-stat-label">Vùng phủ sóng</span>
                      </div>
                      <div className="map-stat-item">
                        <span className="map-stat-num">500+</span>
                        <span className="map-stat-label">Nhà mạng hợp tác</span>
                      </div>
                    </div>
                  </div>
                  <a href="#coverage" className="admin-card-header-link" style={{ marginTop: '12px', display: 'block', textAlign: 'center' }} onClick={() => setActiveTab('coverage')}>
                    Quản lý vùng phủ →
                  </a>
                </div>

                {/* Conversion rate */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Tỷ lệ chuyển đổi</h2>
                    <select className="admin-select-sm">
                      <option>7 ngày qua</option>
                    </select>
                  </div>

                  <div className="conversion-stat-row">
                    <span className="conversion-rate-value">3.24%</span>
                    <span className="conversion-rate-growth">↑ +0.68% <span style={{ color: '#9CA3AF', fontWeight: '500', fontSize: '9px' }}>so với tuần trước</span></span>
                  </div>

                  {/* Sparkline for conversion */}
                  <div className="conversion-rate-chart">
                    <svg width="100%" height="100%" viewBox="0 0 200 40">
                      <path d="M 0,35 Q 25,25 50,30 T 100,15 T 150,25 T 200,8" fill="none" stroke="#FF4F00" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div className="conversion-mini-stats">
                    <div className="conv-mini-cell">
                      <span className="conv-mini-label">Lượt truy cập</span>
                      <span className="conv-mini-val">76,350</span>
                      <span className="conv-mini-growth positive">↑ +12.5%</span>
                    </div>
                    <div className="conv-mini-cell">
                      <span className="conv-mini-label">Đơn hàng</span>
                      <span className="conv-mini-val">2,472</span>
                      <span className="conv-mini-growth positive">↑ +15.3%</span>
                    </div>
                    <div className="conv-mini-cell">
                      <span className="conv-mini-label">Tỷ lệ giỏ hàng</span>
                      <span className="conv-mini-val">8.62%</span>
                      <span className="conv-mini-growth positive">↑ +1.12%</span>
                    </div>
                  </div>
                </div>

                {/* System Users Table */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Người dùng hệ thống</h2>
                    <a href="#personnel" className="admin-card-header-link" onClick={() => setActiveTab('personnel')}>Xem tất cả →</a>
                  </div>

                  <div className="admin-table-wrapper" style={{ marginTop: '0' }}>
                    <table className="admin-table" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr>
                          <th>Người dùng</th>
                          <th>Vai trò</th>
                          <th>Trạng thái</th>
                          <th>Đăng nhập cuối</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div className="user-email-cell">
                              <img src="/images/avatar_admin.png" alt="Avatar" className="user-avatar-mini" />
                              <span>admin@hico.vn</span>
                            </div>
                          </td>
                          <td><span className="user-role-badge admin">Admin</span></td>
                          <td className="user-status-cell">
                            <span className="user-status-dot online"></span>
                            <span>Online</span>
                          </td>
                          <td style={{ color: '#9CA3AF' }}>15/05/2024 09:44</td>
                        </tr>
                        <tr>
                          <td>
                            <div className="user-email-cell">
                              <img src="/images/avatar_thu_huong.png" alt="Avatar" className="user-avatar-mini" />
                              <span>cskh@hico.vn</span>
                            </div>
                          </td>
                          <td><span className="user-role-badge cskh">CSKH</span></td>
                          <td className="user-status-cell">
                            <span className="user-status-dot online"></span>
                            <span>Online</span>
                          </td>
                          <td style={{ color: '#9CA3AF' }}>15/05/2024 09:22</td>
                        </tr>
                        <tr>
                          <td>
                            <div className="user-email-cell">
                              <img src="/images/avatar_quoc_bao.png" alt="Avatar" className="user-avatar-mini" />
                              <span>sales@hico.vn</span>
                            </div>
                          </td>
                          <td><span className="user-role-badge sales">Sales</span></td>
                          <td className="user-status-cell">
                            <span className="user-status-dot online"></span>
                            <span>Online</span>
                          </td>
                          <td style={{ color: '#9CA3AF' }}>15/05/2024 08:57</td>
                        </tr>
                        <tr>
                          <td>
                            <div className="user-email-cell">
                              <img src="/images/avatar_minh_anh.png" alt="Avatar" className="user-avatar-mini" />
                              <span>content@hico.vn</span>
                            </div>
                          </td>
                          <td><span className="user-role-badge content">Content</span></td>
                          <td className="user-status-cell">
                            <span className="user-status-dot offline"></span>
                            <span>Offline</span>
                          </td>
                          <td style={{ color: '#9CA3AF' }}>14/05/2024 17:33</td>
                        </tr>
                        <tr>
                          <td>
                            <div className="user-email-cell">
                              <img src="/images/avatar_admin.png" alt="Avatar" className="user-avatar-mini" />
                              <span>kho@hico.vn</span>
                            </div>
                          </td>
                          <td><span className="user-role-badge warehouse">Warehouse</span></td>
                          <td className="user-status-cell">
                            <span className="user-status-dot online"></span>
                            <span>Online</span>
                          </td>
                          <td style={{ color: '#9CA3AF' }}>15/05/2024 08:31</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab: orders (Đơn hàng eSIM) */}
          {activeTab === 'orders' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Đơn hàng eSIM</h2>
                <button className="admin-btn-text-sm" onClick={() => fetchData('orders')}><RotateCw size={14} /> Làm mới</button>
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã đơn hàng</th>
                      <th>Email</th>
                      <th>Mã sản phẩm</th>
                      <th>Số lượng</th>
                      <th>Ngày đặt</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map(o => (
                      <tr key={o.orderId}>
                        <td className="order-code-text">
                          <span style={{ fontWeight: 'bold' }}>{o.orderId}</span>
                          {o.simType === 'physical' && o.shippingAddress && (
                            <div style={{ fontSize: '11px', color: '#4B5563', backgroundColor: '#F3F4F6', padding: '8px', borderRadius: '6px', marginTop: '6px', fontWeight: 'normal', lineHeight: '1.4', border: '1px solid #E5E7EB' }}>
                              <div style={{ fontWeight: '600', color: '#1F2937', marginBottom: '2px' }}>Địa chỉ nhận hàng:</div>
                              <strong>Họ tên:</strong> {o.shippingAddress.name || 'Khách hàng'}<br/>
                              <strong>SĐT:</strong> {o.shippingAddress.phone || ''}<br/>
                              <strong>Địa chỉ:</strong> {o.shippingAddress.address || ''}, {o.shippingAddress.ward || ''}, {o.shippingAddress.district || ''}, {o.shippingAddress.city || ''}
                            </div>
                          )}
                          {o.items && o.items.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#4B5563', marginTop: '6px', fontWeight: 'normal' }}>
                              {o.items.map((item: AdminOrderItem, i: number) => (
                                <div key={i} style={{ backgroundColor: '#F0FDF4', padding: '6px', borderRadius: '6px', border: '1px solid #DCFCE7', marginBottom: '4px' }}>
                                  <strong>ICCID:</strong> {item.iccid}<br/>
                                  {item.redemptionCode && <span><strong>Mã kích hoạt:</strong> {item.redemptionCode}<br/></span>}
                                  {item.qrcode && (
                                    <a href={item.qrcode} target="_blank" rel="noopener noreferrer" style={{ color: '#FF4F00', fontWeight: '600', textDecoration: 'underline', display: 'inline-block', marginTop: '2px' }}>
                                      Xem ảnh QR Code
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{o.email}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{o.wmproductId || o.productId}</span>
                            {getSimTypeBadge(o.simType)}
                          </div>
                        </td>
                        <td>{o.qty}</td>
                        <td>{o.createdAt}</td>
                        <td>
                          {(() => {
                            const badgeInfo = getOrderStatusTextAndClass(o.status);
                            return (
                              <span className={`status-badge ${badgeInfo.className}`}>
                                {badgeInfo.text}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {o.status === 'PENDING_CALLBACK' && (
                              <button 
                                className="admin-action-btn-mini primary"
                                onClick={async () => {
                                  const res = await fetch('/api/admin/orders/trigger-activation', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ orderId: o.orderId })
                                  });
                                  if (res.ok) {
                                    toast.success('Đã gửi yêu cầu kích hoạt giả lập! Chờ vài giây để Worldmove callback.');
                                    setTimeout(() => fetchData('orders'), 1000);
                                  }
                                }}
                              >
                                Kích hoạt giả lập
                              </button>
                            )}
                            
                            {o.status === 'PENDING_QR_ASSIGN' && (
                              <button 
                                className="admin-action-btn-mini primary"
                                onClick={async () => {
                                  const res = await fetch(`/api/admin/orders/${encodeURIComponent(o.orderId)}/assign-qr`, {
                                    method: 'POST'
                                  });
                                  if (res.ok) {
                                    toast.success('Cấp phát mã QR thành công!');
                                    fetchData('orders');
                                  } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Cấp phát mã QR thất bại! Vui lòng nạp ảnh QR vào kho trước.');
                                  }
                                }}
                              >
                                Cấp phát QR
                              </button>
                            )}

                            {o.simType === 'physical' && o.status === 'PENDING_SHIP' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#F9FAFB', padding: '6px', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                                <input 
                                  type="text" 
                                  placeholder="Mã vận đơn..." 
                                  value={orderTracking[o.orderId] || ''}
                                  onChange={e => setOrderTracking({...orderTracking, [o.orderId]: e.target.value})}
                                  style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #D1D5DB', width: '120px' }}
                                />
                                <button 
                                  className="admin-action-btn-mini primary"
                                  style={{ width: '100%' }}
                                  onClick={async () => {
                                    const tracking = orderTracking[o.orderId];
                                    if (!tracking) {
                                      toast.warning('Vui lòng nhập mã vận đơn!');
                                      return;
                                    }
                                    const res = await fetch(`/api/admin/orders/${encodeURIComponent(o.orderId)}/ship`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ trackingCode: tracking })
                                    });
                                    if (res.ok) {
                                      toast.success('Đã cập nhật giao hàng và gửi email!');
                                      fetchData('orders');
                                    } else {
                                      toast.error('Thao tác thất bại!');
                                    }
                                  }}
                                >
                                  Xác nhận giao
                                </button>
                              </div>
                            )}

                            {o.simType === 'physical' && o.status === 'SHIPPED' && (
                              <span style={{ fontSize: '11px', color: '#15803D', fontWeight: '500' }}>
                                Vận đơn: <strong>{o.trackingCode}</strong>
                              </span>
                            )}

                            {o.status !== 'CANCELLED' && o.status !== 'SHIPPED' && o.status !== 'PROVISIONED' && (
                              <button 
                                className="admin-action-btn-mini danger"
                                onClick={async () => {
                                  const res = await fetch(`/api/admin/orders/${encodeURIComponent(o.orderId)}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'CANCELLED' })
                                  });
                                  if (res.ok) fetchData('orders');
                                }}
                              >
                                Huỷ đơn
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredOrders.length, currentPageOrders, setCurrentPageOrders)}
              </div>
            </div>
          )}

          {/* Tab: devices (Thiết bị 4G/5G) */}
          {activeTab === 'devices' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Thiết bị 4G/5G</h2>
                <button className="admin-create-btn" onClick={() => {
                  if (isAddingDevice) {
                    setDeviceForm({ 
                      sku: '', name: '', category: 'pocket', specs: '', price: '', 
                      compareAtPrice: '', stock: '50', description: '', badge: '', 
                      bestSeller: false, image: '', imageMediaId: null, seoTitle: '', seoDescription: '', seoKeywords: ''
                    });
                    setEditingDeviceId(null);
                  }
                  setIsAddingDevice(!isAddingDevice);
                }}>
                  <Plus size={14} />
                  <span>{isAddingDevice ? 'Đóng form' : 'Thêm thiết bị mới'}</span>
                </button>
              </div>

              {isAddingDevice && (
                <form className="admin-form-box" onSubmit={async (e) => {
                  e.preventDefault();
                  const url = editingDeviceId ? `/api/admin/devices/${editingDeviceId}` : '/api/admin/devices';
                  const method = editingDeviceId ? 'PUT' : 'POST';
                  const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(deviceForm)
                  });
                  if (res.ok) {
                    setIsAddingDevice(false);
                    setEditingDeviceId(null);
                    setDeviceForm({ 
                      sku: '', name: '', category: 'pocket', specs: '', price: '', 
                      compareAtPrice: '', stock: '50', description: '', badge: '', 
                      bestSeller: false, image: '', imageMediaId: null, seoTitle: '', seoDescription: '', seoKeywords: ''
                    });
                    fetchData('devices');
                  }
                }}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mã SKU</label>
                      <input type="text" value={deviceForm.sku} onChange={e => setDeviceForm({...deviceForm, sku: e.target.value})} placeholder="e.g. HW-WIFI-MINI" />
                    </div>
                    <div className="form-group">
                      <label>Tên thiết bị</label>
                      <input type="text" value={deviceForm.name} onChange={e => setDeviceForm({...deviceForm, name: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Phân loại</label>
                      <select value={deviceForm.category} onChange={e => setDeviceForm({...deviceForm, category: e.target.value})}>
                        <option value="pocket">Bộ phát di động</option>
                        <option value="home">WiFi gia đình</option>
                        <option value="office">Thiết bị văn phòng</option>
                        <option value="usb">USB 4G</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Giá bán (VNĐ)</label>
                      <input type="text" value={formatNumberInput(deviceForm.price)} onChange={e => setDeviceForm({...deviceForm, price: parseFormattedNumber(e.target.value)})} required />
                    </div>
                    <div className="form-group">
                      <label>Giá gốc / Giá so sánh (VNĐ)</label>
                      <input type="text" value={formatNumberInput(deviceForm.compareAtPrice)} onChange={e => setDeviceForm({...deviceForm, compareAtPrice: parseFormattedNumber(e.target.value)})} placeholder="e.g. 1.200.000" />
                    </div>
                    <div className="form-group">
                      <label>Số lượng tồn kho</label>
                      <input type="number" value={deviceForm.stock} onChange={e => setDeviceForm({...deviceForm, stock: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Nhãn (Mới/Bán chạy...)</label>
                      <input type="text" value={deviceForm.badge} onChange={e => setDeviceForm({...deviceForm, badge: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <MediaAssetField value={deviceForm.imageMediaId} legacyUrl={deviceForm.image} label="Hình ảnh thiết bị" onChange={(imageMediaId) => setDeviceForm((prev) => ({ ...prev, imageMediaId }))} />
                    </div>
                    <div className="form-group full-width">
                      <label>Thông số kỹ thuật (Mỗi dòng một thông số)</label>
                      <textarea rows={3} value={deviceForm.specs} onChange={e => setDeviceForm({...deviceForm, specs: e.target.value})} placeholder="Pin 3000mAh&#10;Kết nối 10 máy" required />
                    </div>
                    <div className="form-group full-width">
                      <label>Mô tả chi tiết sản phẩm</label>
                      <RichTextEditor
                        value={deviceForm.description}
                        onChange={(val) => setDeviceForm(prev => ({ ...prev, description: val }))}
                        placeholder="Nhập mô tả chi tiết sản phẩm..."
                        onInsertImageClick={(callback) => {
                          setSelectedImageCallback(() => callback);
                          setIsMediaModalOpen(true);
                        }}
                      />
                    </div>
                    <div className="form-group full-width" style={{ marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
                      <h4 style={{ color: 'var(--primary-orange)', margin: '0 0 12px 0' }}>Tối ưu hóa SEO (Chuẩn SEO)</h4>
                    </div>
                    <div className="form-group">
                      <label>SEO Tiêu đề (Meta Title)</label>
                      <input type="text" value={deviceForm.seoTitle} onChange={e => setDeviceForm({...deviceForm, seoTitle: e.target.value})} placeholder="e.g. Bộ phát WiFi 4G mini HICO chính hãng | HICO" />
                    </div>
                    <div className="form-group">
                      <label>SEO Từ khóa (Meta Keywords)</label>
                      <input type="text" value={deviceForm.seoKeywords} onChange={e => setDeviceForm({...deviceForm, seoKeywords: e.target.value})} placeholder="e.g. bo phat wifi, wifi mini, thiet bi 4g" />
                    </div>
                    <div className="form-group full-width">
                      <label>SEO Mô tả (Meta Description)</label>
                      <textarea rows={2} value={deviceForm.seoDescription} onChange={e => setDeviceForm({...deviceForm, seoDescription: e.target.value})} placeholder="e.g. Mua bộ phát WiFi 4G mini HICO chính hãng, pin trâu 3000mAh, kết nối cùng lúc 10 thiết bị. Giao hàng nhanh toàn quốc." />
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn" style={{ marginTop: '16px' }}>
                    {editingDeviceId ? 'Cập nhật thiết bị' : 'Lưu thiết bị'}
                  </button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Hình ảnh</th>
                      <th>SKU</th>
                      <th>Tên thiết bị</th>
                      <th>Phân loại</th>
                      <th>Tồn kho</th>
                      <th>Giá bán</th>
                      <th>Giá gốc</th>
                      <th>Nhãn</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDevices.map(d => (
                      <tr key={d.id}>
                        <td>
                          <img src={d.image || `/images/${d.id.replace(/-/g, '_')}.png`} alt={d.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).src = '/images/device_wifi_mini.png'; }} />
                        </td>
                        <td style={{ fontSize: '11px', fontFamily: 'var(--font-family)', fontWeight: '600' }}>{d.sku}</td>
                        <td style={{ fontWeight: '600' }}>{d.name}</td>
                        <td>{d.category === 'pocket' ? 'Bộ phát di động' : (d.category === 'home' ? 'WiFi gia đình' : (d.category === 'office' ? 'Văn phòng' : 'USB 4G'))}</td>
                        <td>
                          <span className={`status-badge-mini ${d.stock <= 0 ? 'cancelled' : (d.stock < 10 ? 'pending' : 'active')}`}>
                            {d.stock <= 0 ? 'Hết hàng' : `${d.stock} cái`}
                          </span>
                        </td>
                         <td style={{ fontWeight: 'bold' }}>{parseInt(String(d.price), 10).toLocaleString('vi-VN')}đ</td>
                        <td style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>
                           {d.compareAtPrice ? `${parseInt(String(d.compareAtPrice), 10).toLocaleString('vi-VN')}đ` : '-'}
                        </td>
                        <td>{d.badge && <span className="status-badge active">{d.badge}</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              onClick={() => {
                                setDeviceForm({
                                  sku: d.sku || '',
                                  name: d.name || '',
                                  category: d.category || 'pocket',
                                  specs: Array.isArray(d.specs) ? d.specs.join('\n') : (d.specs || ''),
                                  price: d.price ? d.price.toString() : '',
                                  compareAtPrice: d.compareAtPrice ? d.compareAtPrice.toString() : '',
                                  stock: d.stock ? d.stock.toString() : '50',
                                  description: d.description || '',
                                  badge: d.badge || '',
                                  bestSeller: !!d.bestSeller,
                                  image: d.image || '',
                                  imageMediaId: d.imageMediaId || null,
                                  seoTitle: d.seoTitle || '',
                                  seoDescription: d.seoDescription || '',
                                  seoKeywords: d.seoKeywords || ''
                                });
                                setEditingDeviceId(d.id);
                                setIsAddingDevice(true);
                                window.scrollTo(0, 0);
                              }}
                            >
                              Sửa
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              onClick={async () => {
                                if (confirm('Xoá thiết bị này?')) {
                                  await fetch(`/api/admin/devices/${encodeURIComponent(d.id)}`, { method: 'DELETE' });
                                  fetchData('devices');
                                }
                              }}
                            >
                              Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredDevices.length, currentPageDevices, setCurrentPageDevices)}
              </div>
            </div>
          )}

          {/* Tab: packages (Gói cước) */}
          {activeTab === 'packages' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Gói cước eSIM</h2>
                <button
                  className="admin-create-btn"
                  disabled={legacyCatalogReadOnly}
                  onClick={() => {
                  if (isAddingPackage) {
                    setPackageForm({ 
                      sku: '', name: '', coverage: '', dataLimit: '', duration: '', price: '', 
                      compareAtPrice: '', wmproductId: '', network: '', description: '', 
                      featured: false, iconType: 'region', leSIM: true, seoTitle: '', seoDescription: '', seoKeywords: ''
                    });
                    setEditingPackageId(null);
                  }
                  setIsAddingPackage(!isAddingPackage);
                }}>
                  <Plus size={14} />
                  <span>{isAddingPackage ? 'Đóng form' : 'Tạo gói cước mới'}</span>
                </button>
              </div>

              {legacyCatalogReadOnly && (
                <div className="admin-canonical-readonly" role="status">
                  <Lock size={16} />
                  <span>
                    Catalog đang dùng nguồn canonical. Chức năng chỉnh sửa cũ đã được khóa.
                  </span>
                </div>
              )}

              {isAddingPackage && !legacyCatalogReadOnly && (
                <form className="admin-form-box" onSubmit={async (e) => {
                  e.preventDefault();
                  const url = editingPackageId ? `/api/admin/packages/${editingPackageId}` : '/api/admin/packages';
                  const method = editingPackageId ? 'PUT' : 'POST';
                  const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(packageForm)
                  });
                  if (res.ok) {
                    setIsAddingPackage(false);
                    setEditingPackageId(null);
                    setPackageForm({ 
                      sku: '', name: '', coverage: '', dataLimit: '', duration: '', price: '', 
                      compareAtPrice: '', wmproductId: '', network: '', description: '', 
                      featured: false, iconType: 'region', leSIM: true, seoTitle: '', seoDescription: '', seoKeywords: ''
                    });
                    fetchData('packages');
                  }
                }}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mã SKU</label>
                      <input type="text" value={packageForm.sku} onChange={e => setPackageForm({...packageForm, sku: e.target.value})} placeholder="e.g. PKG-ASIA" />
                    </div>
                    <div className="form-group">
                      <label>Tên gói cước</label>
                      <input type="text" value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Vùng phủ sóng (Số quốc gia)</label>
                      <input type="text" value={packageForm.coverage} onChange={e => setPackageForm({...packageForm, coverage: e.target.value})} placeholder="e.g. 12 Quốc gia" required />
                    </div>
                    <div className="form-group">
                      <label>Giới hạn dữ liệu</label>
                      <input type="text" value={packageForm.dataLimit} onChange={e => setPackageForm({...packageForm, dataLimit: e.target.value})} placeholder="e.g. 20 GB" required />
                    </div>
                    <div className="form-group">
                      <label>Thời hạn sử dụng</label>
                      <input type="text" value={packageForm.duration} onChange={e => setPackageForm({...packageForm, duration: e.target.value})} placeholder="e.g. 30 Ngày" required />
                    </div>
                    <div className="form-group">
                      <label>Giá bán (VNĐ)</label>
                      <input type="text" value={formatNumberInput(packageForm.price)} onChange={e => setPackageForm({...packageForm, price: parseFormattedNumber(e.target.value)})} required />
                    </div>
                    <div className="form-group">
                      <label>Giá gốc (VNĐ)</label>
                      <input type="text" value={formatNumberInput(packageForm.compareAtPrice)} onChange={e => setPackageForm({...packageForm, compareAtPrice: parseFormattedNumber(e.target.value)})} placeholder="e.g. 1.240.000" />
                    </div>
                    <div className="form-group">
                      <label>Mã gói Worldmove (wmproductId)</label>
                      <input type="text" value={packageForm.wmproductId} onChange={e => setPackageForm({...packageForm, wmproductId: e.target.value})} placeholder="e.g. WM-e-JP-10GB" required />
                    </div>
                    <div className="form-group">
                      <label>Nhà mạng đối tác</label>
                      <input type="text" value={packageForm.network} onChange={e => setPackageForm({...packageForm, network: e.target.value})} placeholder="e.g. NTT Docomo / Softbank" required />
                    </div>
                    <div className="form-group">
                      <label>Loại Icon</label>
                      <select value={packageForm.iconType} onChange={e => setPackageForm({...packageForm, iconType: e.target.value})}>
                        <option value="region">Bản đồ khu vực</option>
                        <option value="global">Quả địa cầu</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '30px' }}>
                      <input type="checkbox" id="package-featured" checked={packageForm.featured} onChange={e => setPackageForm({...packageForm, featured: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                      <label htmlFor="package-featured" style={{ margin: 0, cursor: 'pointer' }}>Gói cước nổi bật (Featured)</label>
                    </div>
                    <div className="form-group">
                      <label>Loại SIM (Nguồn cung cấp)</label>
                      <select value={packageForm.leSIM ? 'true' : 'false'} onChange={e => setPackageForm({...packageForm, leSIM: e.target.value === 'true'})}>
                        <option value="true">leSIM (Worldmove eSIM)</option>
                        <option value="false">eSIM (Nhà mạng địa phương)</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label>Mô tả chi tiết gói cước</label>
                      <RichTextEditor
                        value={packageForm.description}
                        onChange={(val) => setPackageForm(prev => ({ ...prev, description: val }))}
                        placeholder="Nhập mô tả chi tiết gói cước..."
                        onInsertImageClick={(callback) => {
                          setSelectedImageCallback(() => callback);
                          setIsMediaModalOpen(true);
                        }}
                      />
                    </div>
                    <div className="form-group full-width" style={{ marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
                      <h4 style={{ color: 'var(--primary-orange)', margin: '0 0 12px 0' }}>Tối ưu hóa SEO (Chuẩn SEO)</h4>
                    </div>
                    <div className="form-group">
                      <label>SEO Tiêu đề (Meta Title)</label>
                      <input type="text" value={packageForm.seoTitle} onChange={e => setPackageForm({...packageForm, seoTitle: e.target.value})} placeholder="e.g. Gói eSIM Châu Á - Thái Bình Dương Giá Rẻ | HICO" />
                    </div>
                    <div className="form-group">
                      <label>SEO Từ khóa (Meta Keywords)</label>
                      <input type="text" value={packageForm.seoKeywords} onChange={e => setPackageForm({...packageForm, seoKeywords: e.target.value})} placeholder="e.g. esim chau a, esim du lich chau a" />
                    </div>
                    <div className="form-group full-width">
                      <label>SEO Mô tả (Meta Description)</label>
                      <textarea rows={2} value={packageForm.seoDescription} onChange={e => setPackageForm({...packageForm, seoDescription: e.target.value})} placeholder="e.g. eSIM Châu Á - Thái Bình Dương của HICO hỗ trợ 12 quốc gia, dung lượng 20GB tốc độ cao trong 30 ngày. Đặt mua nhận QR ngay." />
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn" style={{ marginTop: '16px' }}>
                    {editingPackageId ? 'Cập nhật gói cước' : 'Tạo gói cước'}
                  </button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Tên gói cước</th>
                      <th>Loại SIM</th>
                      <th>Mã Worldmove</th>
                      <th>Vùng phủ</th>
                      <th>Dung lượng</th>
                      <th>Thời hạn</th>
                      <th>Giá bán</th>
                      <th>Giá gốc</th>
                      <th>Nổi bật</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPackages.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontSize: '11px', fontFamily: 'var(--font-family)', fontWeight: '600' }}>{p.sku}</td>
                        <td style={{ fontWeight: '600' }}>{p.name}</td>
                        <td>
                          <span style={{ 
                            backgroundColor: p.leSIM !== false ? '#FFF0E6' : '#E0F2FE', 
                            color: p.leSIM !== false ? '#FF4F00' : '#0369A1', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: 'bold', 
                            border: p.leSIM !== false ? '1px solid #FFD8C2' : '1px solid #BAE6FD' 
                          }}>
                            {p.leSIM !== false ? 'leSIM' : 'eSIM'}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{p.wmproductId}</td>
                        <td>{p.coverage}</td>
                        <td>{p.dataLimit}</td>
                        <td>{p.duration}</td>
                        <td style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>{parseFloat(String(p.price)).toLocaleString('vi-VN')}đ</td>
                        <td style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>
                          {p.compareAtPrice ? `${parseFloat(String(p.compareAtPrice)).toLocaleString('vi-VN')}đ` : '-'}
                        </td>
                        <td>
                          <span className={`status-badge-mini ${p.featured ? 'active' : 'cancelled'}`}>
                            {p.featured ? 'Có' : 'Không'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              disabled={legacyCatalogReadOnly}
                              onClick={() => {
                                setPackageForm({
                                  sku: p.sku || '',
                                  name: p.name || '',
                                  coverage: p.coverage || '',
                                  dataLimit: p.dataLimit || '',
                                  duration: p.duration || '',
                                  price: p.price ? p.price.toString() : '',
                                  compareAtPrice: p.compareAtPrice ? p.compareAtPrice.toString() : '',
                                  wmproductId: p.wmproductId || '',
                                  network: p.network || '',
                                  description: p.description || '',
                                  featured: !!p.featured,
                                  iconType: p.iconType || 'region',
                                  leSIM: p.leSIM !== false,
                                  seoTitle: p.seoTitle || '',
                                  seoDescription: p.seoDescription || '',
                                  seoKeywords: p.seoKeywords || ''
                                });
                                setEditingPackageId(p.id);
                                setIsAddingPackage(true);
                                window.scrollTo(0, 0);
                              }}
                            >
                              Sửa
                            </button>
                            <button 
                              className="admin-action-btn-mini primary"
                              disabled={legacyCatalogReadOnly}
                              onClick={() => handleOpenVariantManager('package', p)}
                            >
                              Biến thể ({p.variants?.length || 0})
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              disabled={legacyCatalogReadOnly}
                              onClick={async () => {
                                if (confirm('Xoá gói cước này?')) {
                                  await fetch(`/api/admin/packages/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
                                  fetchData('packages');
                                }
                              }}
                            >
                              Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredPackages.length, currentPagePackages, setCurrentPagePackages)}
              </div>
            </div>
          )}

          {/* Tab: coverage (Quốc gia & vùng phủ) */}
          {activeTab === 'coverage' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Quốc gia & Vùng phủ eSIM</h2>
                <button
                  className="admin-create-btn"
                  disabled={legacyCatalogReadOnly}
                  onClick={() => {
                  if (isAddingDestination) {
                    setDestinationForm({ 
                      sku: '', name: '', flag: '', dataLimit: '', duration: '', price: '', 
                      compareAtPrice: '', wmproductId: '', image: '', imageMediaId: null, network: '',
                      featured: false, guide: '', leSIM: true, seoTitle: '', seoDescription: '', seoKeywords: ''
                    });
                    setEditingDestinationId(null);
                  }
                  setIsAddingDestination(!isAddingDestination);
                }}>
                  <Plus size={14} />
                  <span>{isAddingDestination ? 'Đóng form' : 'Thêm quốc gia mới'}</span>
                </button>
              </div>

              {legacyCatalogReadOnly && (
                <div className="admin-canonical-readonly" role="status">
                  <Lock size={16} />
                  <span>
                    Catalog đang dùng nguồn canonical. Chức năng chỉnh sửa cũ đã được khóa.
                  </span>
                </div>
              )}

              {isAddingDestination && !legacyCatalogReadOnly && (
                <form className="admin-form-box" onSubmit={async (e) => {
                  e.preventDefault();
                  const url = editingDestinationId ? `/api/admin/destinations/${editingDestinationId}` : '/api/admin/destinations';
                  const method = editingDestinationId ? 'PUT' : 'POST';
                  const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(destinationForm)
                  });
                  if (res.ok) {
                    setIsAddingDestination(false);
                    setEditingDestinationId(null);
                    setDestinationForm({ 
                      sku: '', name: '', flag: '', dataLimit: '', duration: '', price: '', 
                      compareAtPrice: '', wmproductId: '', image: '', imageMediaId: null, network: '',
                      featured: false, guide: '', leSIM: true, seoTitle: '', seoDescription: '', seoKeywords: ''
                    });
                    fetchData('coverage');
                  }
                }}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mã SKU</label>
                      <input type="text" value={destinationForm.sku} onChange={e => setDestinationForm({...destinationForm, sku: e.target.value})} placeholder="e.g. DEST-JAPAN" />
                    </div>
                    <div className="form-group">
                      <label>Tên quốc gia/vùng</label>
                      <input type="text" value={destinationForm.name} onChange={e => setDestinationForm({...destinationForm, name: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Cờ (Emoji)</label>
                      <input type="text" value={destinationForm.flag} onChange={e => setDestinationForm({...destinationForm, flag: e.target.value})} placeholder="e.g. 🇯🇵" required />
                    </div>
                    <div className="form-group">
                      <label>Dung lượng mẫu</label>
                      <input type="text" value={destinationForm.dataLimit} onChange={e => setDestinationForm({...destinationForm, dataLimit: e.target.value})} placeholder="e.g. 10 GB" required />
                    </div>
                    <div className="form-group">
                      <label>Thời hạn mẫu</label>
                      <input type="text" value={destinationForm.duration} onChange={e => setDestinationForm({...destinationForm, duration: e.target.value})} placeholder="e.g. 15 Ngày" required />
                    </div>
                    <div className="form-group">
                      <label>Giá gói mẫu (VNĐ)</label>
                      <input type="text" value={formatNumberInput(destinationForm.price)} onChange={e => setDestinationForm({...destinationForm, price: parseFormattedNumber(e.target.value)})} required />
                    </div>
                    <div className="form-group">
                      <label>Giá gốc (VNĐ)</label>
                      <input type="text" value={formatNumberInput(destinationForm.compareAtPrice)} onChange={e => setDestinationForm({...destinationForm, compareAtPrice: parseFormattedNumber(e.target.value)})} placeholder="e.g. 620.000" />
                    </div>
                    <div className="form-group">
                      <label>Mã gói Worldmove (wmproductId)</label>
                      <input type="text" value={destinationForm.wmproductId} onChange={e => setDestinationForm({...destinationForm, wmproductId: e.target.value})} placeholder="e.g. WM-e-JP-10GB" required />
                    </div>
                    <div className="form-group">
                      <label>Nhà mạng</label>
                      <input type="text" value={destinationForm.network} onChange={e => setDestinationForm({...destinationForm, network: e.target.value})} placeholder="e.g. NTT Docomo / Softbank" required />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '30px' }}>
                      <input type="checkbox" id="destination-featured" checked={destinationForm.featured} onChange={e => setDestinationForm({...destinationForm, featured: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                      <label htmlFor="destination-featured" style={{ margin: 0, cursor: 'pointer' }}>Nổi bật (Featured)</label>
                    </div>
                    <div className="form-group">
                      <label>Loại SIM (Nguồn cung cấp)</label>
                      <select value={destinationForm.leSIM ? 'true' : 'false'} onChange={e => setDestinationForm({...destinationForm, leSIM: e.target.value === 'true'})}>
                        <option value="true">leSIM (Worldmove eSIM)</option>
                        <option value="false">eSIM (Nhà mạng địa phương)</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <MediaAssetField value={destinationForm.imageMediaId} legacyUrl={destinationForm.image} label="Ảnh nền điểm đến" required onChange={(imageMediaId) => setDestinationForm((prev) => ({ ...prev, imageMediaId }))} />
                    </div>
                    <div className="form-group full-width">
                      <label>Cẩm nang du lịch & Hướng dẫn kích hoạt (guide)</label>
                      <RichTextEditor
                        value={destinationForm.guide}
                        onChange={(val) => setDestinationForm(prev => ({ ...prev, guide: val }))}
                        placeholder="Nhập cẩm nang du lịch & hướng dẫn kích hoạt..."
                        onInsertImageClick={(callback) => {
                          setSelectedImageCallback(() => callback);
                          setIsMediaModalOpen(true);
                        }}
                      />
                    </div>
                    <div className="form-group full-width" style={{ marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
                      <h4 style={{ color: 'var(--primary-orange)', margin: '0 0 12px 0' }}>Tối ưu hóa SEO (Chuẩn SEO)</h4>
                    </div>
                    <div className="form-group">
                      <label>SEO Tiêu đề (Meta Title)</label>
                      <input type="text" value={destinationForm.seoTitle} onChange={e => setDestinationForm({...destinationForm, seoTitle: e.target.value})} placeholder="e.g. eSIM Du Lịch Nhật Bản Tốc Độ Cao | HICO" />
                    </div>
                    <div className="form-group">
                      <label>SEO Từ khóa (Meta Keywords)</label>
                      <input type="text" value={destinationForm.seoKeywords} onChange={e => setDestinationForm({...destinationForm, seoKeywords: e.target.value})} placeholder="e.g. esim nhat ban, esim du lich nhat ban" />
                    </div>
                    <div className="form-group full-width">
                      <label>SEO Mô tả (Meta Description)</label>
                      <textarea rows={2} value={destinationForm.seoDescription} onChange={e => setDestinationForm({...destinationForm, seoDescription: e.target.value})} placeholder="e.g. eSIM du lịch Nhật Bản của HICO kết nối trực tiếp nhà mạng lớn Docomo, Softbank. Đặt mua online nhận ngay QR Code." />
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn" style={{ marginTop: '16px' }}>
                    {editingDestinationId ? 'Cập nhật quốc gia' : 'Thêm quốc gia'}
                  </button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Hình ảnh</th>
                      <th>Quốc gia</th>
                      <th>Loại SIM</th>
                      <th>Mã Worldmove</th>
                      <th>Nhà mạng</th>
                      <th>Thông số mẫu</th>
                      <th>Giá bán mẫu</th>
                      <th>Giá gốc mẫu</th>
                      <th>Nổi bật</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDestinations.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontSize: '11px', fontFamily: 'var(--font-family)', fontWeight: '600' }}>{d.sku}</td>
                        <td>
                          <img src={d.image} alt={d.name} style={{ width: '50px', height: '35px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { (e.target as HTMLImageElement).src = '/images/dest_japan.png'; }} />
                        </td>
                        <td style={{ fontWeight: '600' }}><span style={{ marginRight: '8px', fontSize: '16px' }}>{d.flag}</span>{d.name}</td>
                        <td>
                          <span style={{ 
                            backgroundColor: d.leSIM !== false ? '#FFF0E6' : '#E0F2FE', 
                            color: d.leSIM !== false ? '#FF4F00' : '#0369A1', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: 'bold', 
                            border: d.leSIM !== false ? '1px solid #FFD8C2' : '1px solid #BAE6FD' 
                          }}>
                            {d.leSIM !== false ? 'leSIM' : 'eSIM'}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{d.wmproductId}</td>
                        <td>{d.network}</td>
                        <td>{d.dataLimit} - {d.duration}</td>
                        <td style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>{parseFloat(String(d.price)).toLocaleString('vi-VN')}đ</td>
                        <td style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>
                          {d.compareAtPrice ? `${parseFloat(String(d.compareAtPrice)).toLocaleString('vi-VN')}đ` : '-'}
                        </td>
                        <td>
                          <span className={`status-badge-mini ${d.featured ? 'active' : 'cancelled'}`}>
                            {d.featured ? 'Có' : 'Không'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              disabled={legacyCatalogReadOnly}
                              onClick={() => {
                                setDestinationForm({
                                  sku: d.sku || '',
                                  name: d.name || '',
                                  flag: d.flag || '',
                                  dataLimit: d.dataLimit || '',
                                  duration: d.duration || '',
                                  price: d.price ? d.price.toString() : '',
                                  compareAtPrice: d.compareAtPrice ? d.compareAtPrice.toString() : '',
                                  wmproductId: d.wmproductId || '',
                                  image: d.image || '',
                                  imageMediaId: d.imageMediaId || null,
                                  network: d.network || '',
                                  featured: !!d.featured,
                                  guide: d.guide || '',
                                  leSIM: d.leSIM !== false,
                                  seoTitle: d.seoTitle || '',
                                  seoDescription: d.seoDescription || '',
                                  seoKeywords: d.seoKeywords || ''
                                });
                                setEditingDestinationId(d.id);
                                setIsAddingDestination(true);
                                window.scrollTo(0, 0);
                              }}
                            >
                              Sửa
                            </button>
                            <button 
                              className="admin-action-btn-mini primary"
                              disabled={legacyCatalogReadOnly}
                              onClick={() => handleOpenVariantManager('destination', d)}
                            >
                              Biến thể ({d.variants?.length || 0})
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              disabled={legacyCatalogReadOnly}
                              onClick={async () => {
                                if (confirm('Xoá quốc gia này?')) {
                                  await fetch(`/api/admin/destinations/${encodeURIComponent(d.id)}`, { method: 'DELETE' });
                                  fetchData('coverage');
                                }
                              }}
                            >
                              Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredDestinations.length, currentPageCoverage, setCurrentPageCoverage)}
              </div>
            </div>
          )}

          {/* Tab: customers (Khách hàng) */}
          {activeTab === 'customers' && (
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Khách hàng</h2>
                <button 
                  className="admin-create-btn" 
                  onClick={() => {
                    if (isAddingCustomer || editingCustomerEmail) {
                      setCustomerForm({ name: '', phone: '', email: '', status: 'Hoạt động' });
                      setEditingCustomerEmail(null);
                      setIsAddingCustomer(false);
                    } else {
                      setIsAddingCustomer(true);
                    }
                  }}
                >
                  <Plus size={14} />
                  <span>{isAddingCustomer || editingCustomerEmail ? 'Đóng form' : 'Thêm khách hàng mới'}</span>
                </button>
              </div>

              {(isAddingCustomer || editingCustomerEmail) && (
                <form 
                  className="admin-form-box" 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const url = editingCustomerEmail 
                        ? `/api/admin/customers/${encodeURIComponent(editingCustomerEmail)}` 
                        : '/api/admin/customers';
                      const method = editingCustomerEmail ? 'PUT' : 'POST';
                      const res = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(customerForm)
                      });
                      if (res.ok) {
                        setCustomerForm({ name: '', phone: '', email: '', status: 'Hoạt động' });
                        setEditingCustomerEmail(null);
                        setIsAddingCustomer(false);
                        fetchData('customers');
                      } else {
                        toast.error('Thao tác thất bại!');
                      }
                    } catch (err) {
                      console.error('Failed to submit customer form:', err);
                    }
                  }}
                >
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Họ và tên khách hàng</label>
                      <input 
                        type="text" 
                        value={customerForm.name} 
                        onChange={e => setCustomerForm({...customerForm, name: e.target.value})} 
                        placeholder="e.g. Nguyễn Văn A" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Số điện thoại</label>
                      <input 
                        type="text" 
                        value={customerForm.phone} 
                        onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} 
                        placeholder="e.g. +84 912 345 678" 
                      />
                    </div>
                    <div className="form-group">
                      <label>Địa chỉ email</label>
                      <input 
                        type="email" 
                        value={customerForm.email} 
                        onChange={e => setCustomerForm({...customerForm, email: e.target.value})} 
                        placeholder="e.g. email@domain.com" 
                        required 
                        disabled={!!editingCustomerEmail}
                      />
                    </div>
                    <div className="form-group">
                      <label>Trạng thái tài khoản</label>
                      <select 
                        value={customerForm.status} 
                        onChange={e => setCustomerForm({...customerForm, status: e.target.value})}
                      >
                        <option value="Hoạt động">Hoạt động</option>
                        <option value="Tạm khóa">Tạm khóa</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn">
                    {editingCustomerEmail ? 'Cập nhật khách hàng' : 'Lưu khách hàng'}
                  </button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Số điện thoại</th>
                      <th>Địa chỉ email</th>
                      <th>Ngày tham gia</th>
                      <th>Trạng thái hoạt động</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCustomers.map(c => (
                      <tr key={c.email}>
                        <td style={{ fontWeight: '600' }}>{c.name}</td>
                        <td>{c.phone || '-'}</td>
                        <td>{c.email}</td>
                        <td style={{ color: '#6B7280' }}>{c.createdAt || '-'}</td>
                        <td>
                          <span className={`status-badge ${c.status === 'Hoạt động' ? 'active' : 'cancelled'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              onClick={() => {
                                setCustomerForm({
                                   name: c.name || '',
                                  phone: c.phone || '',
                                  email: c.email,
                                   status: c.status || 'Hoạt động'
                                });
                                setEditingCustomerEmail(c.email);
                                setIsAddingCustomer(false);
                              }}
                            >
                              Sửa
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              onClick={async () => {
                                if (confirm(`Bạn có chắc chắn muốn xóa khách hàng ${c.name}?`)) {
                                  const res = await fetch(`/api/admin/customers/${encodeURIComponent(c.email)}`, {
                                    method: 'DELETE'
                                  });
                                  if (res.ok) {
                                    fetchData('customers');
                                  } else {
                                    toast.error('Xóa khách hàng thất bại!');
                                  }
                                }
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredCustomers.length, currentPageCustomers, setCurrentPageCustomers)}
              </div>
            </div>
          )}

          {/* Tab: promos (Khuyến mãi) */}
          {activeTab === 'promos' && (
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Mã Khuyến Mãi</h2>
                <button 
                  className="admin-create-btn" 
                  onClick={() => {
                    if (isAddingPromo || editingPromoCode) {
                      setPromoForm({ code: '', discount: '', description: '', expiry: '', status: 'Hoạt động' });
                      setEditingPromoCode(null);
                      setIsAddingPromo(false);
                    } else {
                      setIsAddingPromo(true);
                    }
                  }}
                >
                  <Plus size={14} />
                  <span>{isAddingPromo || editingPromoCode ? 'Đóng form' : 'Thêm mã khuyến mãi'}</span>
                </button>
              </div>

              {(isAddingPromo || editingPromoCode) && (
                <form 
                  className="admin-form-box" 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const url = editingPromoCode 
                        ? `/api/admin/promos/${encodeURIComponent(editingPromoCode)}` 
                        : '/api/admin/promos';
                      const method = editingPromoCode ? 'PUT' : 'POST';
                      const res = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(promoForm)
                      });
                      if (res.ok) {
                        setPromoForm({ code: '', discount: '', description: '', expiry: '', status: 'Hoạt động' });
                        setEditingPromoCode(null);
                        setIsAddingPromo(false);
                        fetchData('promos');
                      } else {
                        toast.error('Thao tác thất bại!');
                      }
                    } catch (err) {
                      console.error('Failed to submit promo form:', err);
                    }
                  }}
                >
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mã giảm giá (Code)</label>
                      <input 
                        type="text" 
                        value={promoForm.code} 
                        onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} 
                        placeholder="e.g. HICO50" 
                        required 
                        disabled={!!editingPromoCode}
                      />
                    </div>
                    <div className="form-group">
                      <label>Tỷ lệ giảm giá (%)</label>
                      <input 
                        type="number" 
                        min="1"
                        max="100"
                        value={promoForm.discount} 
                        onChange={e => setPromoForm({...promoForm, discount: e.target.value})} 
                        placeholder="e.g. 50" 
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Ngày hết hạn</label>
                      <input 
                        type="text" 
                        value={promoForm.expiry} 
                        onChange={e => setPromoForm({...promoForm, expiry: e.target.value})} 
                        placeholder="e.g. 31/12/2026" 
                      />
                    </div>
                    <div className="form-group">
                      <label>Trạng thái hoạt động</label>
                      <select 
                        value={promoForm.status} 
                        onChange={e => setPromoForm({...promoForm, status: e.target.value})}
                      >
                        <option value="Hoạt động">Hoạt động</option>
                        <option value="Tạm dừng">Tạm dừng</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Mô tả chương trình</label>
                      <input 
                        type="text" 
                        value={promoForm.description} 
                        onChange={e => setPromoForm({...promoForm, description: e.target.value})} 
                        placeholder="e.g. Giảm giá 50% cho toàn bộ sản phẩm..." 
                      />
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn">
                    {editingPromoCode ? 'Cập nhật mã' : 'Lưu mã'}
                  </button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã Code</th>
                      <th>Giảm Giá (%)</th>
                      <th>Mô Tả</th>
                      <th>Ngày Hết Hạn</th>
                      <th>Trạng Thái</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPromos.map(p => (
                      <tr key={p.code}>
                        <td style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--primary-orange)', fontSize: '14px' }}>{p.code}</td>
                        <td style={{ fontWeight: '600' }}>{p.discount}%</td>
                        <td>{p.description || '-'}</td>
                        <td>{p.expiry || 'Vô thời hạn'}</td>
                        <td>
                          <span className={`status-badge ${p.status === 'Hoạt động' ? 'active' : 'cancelled'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              onClick={() => {
                                setPromoForm({
                                  code: p.code,
                                   discount: p.discount?.toString() || '',
                                  description: p.description || '',
                                  expiry: p.expiry || '',
                                   status: p.status || 'Hoạt động'
                                });
                                setEditingPromoCode(p.code);
                                setIsAddingPromo(false);
                              }}
                            >
                              Sửa
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              onClick={async () => {
                                if (confirm(`Bạn có chắc chắn muốn xóa mã ${p.code}?`)) {
                                  const res = await fetch(`/api/admin/promos/${encodeURIComponent(p.code)}`, {
                                    method: 'DELETE'
                                  });
                                  if (res.ok) {
                                    fetchData('promos');
                                  } else {
                                    toast.error('Xóa thất bại!');
                                  }
                                }
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredPromos.length, currentPagePromos, setCurrentPagePromos)}
              </div>
            </div>
          )}

          {/* Tab: reports (Báo cáo) */}
          {activeTab === 'reports' && (
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Báo cáo & Thống kê chi tiết</h2>
              </div>

              <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="admin-stat-card">
                  <span className="stat-card-title">Doanh thu tổng hóa đơn</span>
                  <span className="stat-card-value" style={{ color: 'var(--primary-orange)' }}>
                    {orders.reduce((sum, o) => {
                      let orderSum = 0;
                      if (o.status !== 'CANCELLED') {
                        orderSum += (o.qty || 1) * 350000; 
                      }
                      return sum + orderSum;
                    }, 1450000000).toLocaleString('vi-VN')}đ
                  </span>
                  <span className="stat-card-trend positive">↑ +14.2% so với tháng trước</span>
                </div>
                <div className="admin-stat-card">
                  <span className="stat-card-title">Tổng đơn hàng đã xử lý</span>
                  <span className="stat-card-value">{orders.length + 2470}</span>
                  <span className="stat-card-trend positive">↑ +8.3% so với tháng trước</span>
                </div>
                <div className="admin-stat-card">
                  <span className="stat-card-title">Giá trị đơn hàng trung bình</span>
                  <span className="stat-card-value">365.000đ</span>
                  <span className="stat-card-trend negative">↓ -1.2% so với tháng trước</span>
                </div>
                <div className="admin-stat-card">
                  <span className="stat-card-title">Số lượng eSIM đang hoạt động</span>
                  <span className="stat-card-value">1,894</span>
                  <span className="stat-card-trend positive">↑ +21.4% so với tháng trước</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                <div className="admin-card" style={{ background: '#FAF9F9', border: '1px solid #E5E7EB' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Doanh số theo Loại SIM</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'leSIM (Worldmove Auto-Redeem)', share: '45%', amount: '652.500.000đ', color: '#FF4F00' },
                      { label: 'eSIM (Worldmove Direct Mail)', share: '30%', amount: '435.000.000đ', color: '#0369A1' },
                      { label: 'eSIM Thủ công (Static QR)', share: '15%', amount: '217.500.000đ', color: '#7E22CE' },
                      { label: 'SIM Vật lý (Physical SIM)', share: '10%', amount: '145.000.000đ', color: '#15803D' }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ fontWeight: '500' }}>{item.label}</span>
                          <span style={{ fontWeight: '700' }}>{item.amount} ({item.share})</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: item.share, height: '100%', backgroundColor: item.color, borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-card" style={{ background: '#FAF9F9', border: '1px solid #E5E7EB' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Doanh số theo Điểm đến phổ biến</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Nhật Bản 🇯🇵', share: '40%', amount: '580.000.000đ', color: '#FF4F00' },
                      { label: 'Hàn Quốc 🇰🇷', share: '25%', amount: '362.500.000đ', color: '#F59E0B' },
                      { label: 'Hoa Kỳ 🇺🇸', share: '20%', amount: '290.000.000đ', color: '#3B82F6' },
                      { label: 'Thái Lan 🇹🇭', share: '15%', amount: '217.500.000đ', color: '#10B981' }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ fontWeight: '500' }}>{item.label}</span>
                          <span style={{ fontWeight: '700' }}>{item.amount} ({item.share})</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: item.share, height: '100%', backgroundColor: item.color, borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: warehouse (Kho hàng) */}
          {activeTab === 'warehouse' && (
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Kho hàng & Tồn kho SIM</h2>
              </div>

              <div className="admin-alert-banner" style={{ background: '#FFFBEB', border: '1px solid #FCD34D', padding: '12px', borderRadius: '6px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertTriangle size={18} style={{ color: '#D97706' }} />
                <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '500' }}>
                  Cảnh báo: Có 1 loại eSIM thủ công đang hết mã QR trong kho. Vui lòng tải thêm ảnh QR để tiếp tục giao hàng tự động.
                </span>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã sản phẩm</th>
                      <th>Tên gói cước</th>
                      <th>Loại SIM</th>
                      <th>Mã Worldmove</th>
                      <th>Số lượng tồn kho / QR còn lại</th>
                      <th>Tình trạng</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWarehouseItems.map((v: LegacyVariant & { destinationName?: string }) => {
                      const availQrCount = manualQrs.filter((q: ManualQr) => q.variantId === v.id && !q.assignedOrderId).length;
                      let stockText: string;
                      let statusBadge = <span className="status-badge active">Sẵn sàng</span>;
                      
                      if (v.simType === 'manual') {
                        stockText = `${availQrCount} mã QR`;
                        statusBadge = availQrCount === 0 
                          ? <span className="status-badge cancelled">Hết mã QR</span> 
                          : (availQrCount < 3 ? <span className="status-badge pending">Sắp hết</span> : <span className="status-badge active">Đủ kho</span>);
                      } else if (v.simType === 'physical') {
                        stockText = `100 chiếc (Cố định)`;
                      } else {
                        stockText = 'Không giới hạn (API)';
                      }

                      return (
                        <tr key={v.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{v.sku}</td>
                          <td>{destinations.find(d => d.variants?.some((varItem: LegacyVariant) => varItem.id === v.id))?.name || 'eSIM Vùng phủ'} ({v.dataLimit} - {v.duration})</td>
                          <td>{getSimTypeBadge(v.simType, v.leSIM)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{v.wmproductId || '-'}</td>
                          <td style={{ fontWeight: '600' }}>{stockText}</td>
                          <td>{statusBadge}</td>
                          <td>
                            {v.simType === 'manual' && (
                              <button 
                                className="admin-action-btn-mini primary"
                                onClick={() => {
                                  const parentDest = destinations.find(d => d.variants?.some((varItem: LegacyVariant) => varItem.id === v.id));
                                  if (parentDest) {
                                    handleOpenVariantManager('destination', parentDest);
                                  }
                                }}
                              >
                                Nạp QR vào kho
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  {renderPagination(filteredWarehouseItems.length, currentPageWarehouse, setCurrentPageWarehouse)}
              </div>
            </div>
          )}

          {/* Tab: articles (Bài viết) */}
          {activeTab === 'articles' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Bài viết Cẩm nang</h2>
                <button className="admin-create-btn" onClick={() => {
                  if (isAddingArticle) {
                    setArticleForm({ title: '', category: '', image: '', imageMediaId: null, date: '', content: '', seoTitle: '', seoDescription: '', seoKeywords: '', status: 'published', scheduledDate: '' });
                    setEditingArticleId(null);
                  }
                  setIsAddingArticle(!isAddingArticle);
                }}>
                  <Plus size={14} />
                  <span>{isAddingArticle ? 'Đóng form' : 'Viết bài mới'}</span>
                </button>
              </div>

              {isAddingArticle && (
                <form className="admin-form-box" onSubmit={async (e) => {
                  e.preventDefault();
                  const url = editingArticleId ? `/api/admin/articles/${editingArticleId}` : '/api/admin/articles';
                  const method = editingArticleId ? 'PUT' : 'POST';
                  const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(articleForm)
                  });
                  if (res.ok) {
                    setIsAddingArticle(false);
                    setEditingArticleId(null);
                    setArticleForm({ title: '', category: '', image: '', imageMediaId: null, date: '', content: '', seoTitle: '', seoDescription: '', seoKeywords: '', status: 'published', scheduledDate: '' });
                    fetchData('articles');
                  }
                }}>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Tiêu đề bài viết</label>
                      <div className="form-input-with-button">
                        <input 
                          type="text" 
                          value={articleForm.title} 
                          onChange={e => setArticleForm({...articleForm, title: e.target.value})} 
                          placeholder="Nhập tiêu đề hoặc từ khóa bài viết..."
                          required 
                        />
                        <button 
                          type="button" 
                          className="admin-action-btn-mini primary" 
                          style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px' }} 
                          disabled={isGeneratingAi}
                          onClick={async () => {
                            if (!articleForm.title) {
                              toast.warning('Vui lòng nhập tiêu đề bài viết trước!');
                              return;
                            }
                            setIsGeneratingAi(true);
                            try {
                              const res = await fetch('/api/admin/articles/generate-ai', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ title: articleForm.title })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setArticleForm(prev => ({
                                  ...prev,
                                  content: data.content,
                                  image: data.image,
                                  seoTitle: data.seoTitle,
                                  seoDescription: data.seoDescription,
                                  seoKeywords: data.seoKeywords
                                }));
                                toast.success('Sinh bài viết AI thành công!');
                              } else {
                                const data = await res.json();
                                toast.error(`Lỗi AI: ${data.error}`);
                              }
                            } catch {
                              toast.error('Lỗi kết nối máy chủ!');
                            } finally {
                              setIsGeneratingAi(false);
                            }
                          }}
                        >
                          {isGeneratingAi ? <RotateCw className="animate-spin" style={{ width: '14px', height: '14px' }} /> : <Sparkles style={{ width: '14px', height: '14px' }} />}
                          <span>{isGeneratingAi ? 'Đang viết...' : 'Viết bằng AI'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Danh mục bài viết</label>
                      <input type="text" value={articleForm.category} onChange={e => setArticleForm({...articleForm, category: e.target.value})} placeholder="Ví dụ: Hướng dẫn eSIM" />
                    </div>
                    <div className="form-group">
                      <MediaAssetField value={articleForm.imageMediaId} legacyUrl={articleForm.image} label="Ảnh bìa bài viết" required onChange={(imageMediaId) => setArticleForm((prev) => ({ ...prev, imageMediaId }))} />
                    </div>
                    <div className="form-group">
                      <label>Trạng thái bài viết</label>
                      <select 
                        value={articleForm.status || 'published'} 
                        onChange={e => {
                          const val = e.target.value;
                          setArticleForm(prev => ({ 
                            ...prev, 
                            status: val,
                            scheduledDate: val === 'scheduled' && !prev.scheduledDate 
                              ? new Date(Date.now() + 3600000).toISOString().slice(0, 16) 
                              : prev.scheduledDate
                          }));
                        }}
                      >
                        <option value="published">Đăng ngay</option>
                        <option value="draft">Lưu nháp</option>
                        <option value="scheduled">Đặt lịch đăng</option>
                      </select>
                    </div>

                    {articleForm.status === 'scheduled' ? (
                      <div className="form-group">
                        <label>Thời gian đặt lịch đăng</label>
                        <input 
                          type="datetime-local" 
                          value={articleForm.scheduledDate || ''} 
                          onChange={e => setArticleForm({...articleForm, scheduledDate: e.target.value, date: new Date(e.target.value).toLocaleDateString('vi-VN')})} 
                          required 
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Ngày hiển thị (Date Label)</label>
                        <input type="text" value={articleForm.date} onChange={e => setArticleForm({...articleForm, date: e.target.value})} placeholder="e.g. Hôm nay" />
                      </div>
                    )}
                    <div className="form-group full-width">
                      <label>Nội dung chi tiết bài viết (Trình soạn thảo cao cấp)</label>
                      <RichTextEditor 
                        value={articleForm.content} 
                        onChange={html => setArticleForm(prev => ({ ...prev, content: html }))} 
                        onInsertImageClick={(callback) => {
                          setSelectedImageCallback(() => callback);
                          setIsMediaModalOpen(true);
                        }}
                      />
                    </div>
                    <div className="form-group full-width" style={{ marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
                      <h4 style={{ color: 'var(--primary-orange)', margin: '0 0 12px 0' }}>Tối ưu hóa SEO (Chuẩn SEO)</h4>
                    </div>
                    <div className="form-group">
                      <label>SEO Tiêu đề (Meta Title)</label>
                      <input type="text" value={articleForm.seoTitle} onChange={e => setArticleForm({...articleForm, seoTitle: e.target.value})} placeholder="e.g. Hướng dẫn sử dụng eSIM chi tiết từ A-Z | HICO" />
                    </div>
                    <div className="form-group">
                      <label>SEO Từ khóa (Meta Keywords)</label>
                      <input type="text" value={articleForm.seoKeywords} onChange={e => setArticleForm({...articleForm, seoKeywords: e.target.value})} placeholder="e.g. cach dung esim, huong dan esim, esim hico" />
                    </div>
                    <div className="form-group full-width">
                      <label>SEO Mô tả (Meta Description)</label>
                      <textarea rows={2} value={articleForm.seoDescription} onChange={e => setArticleForm({...articleForm, seoDescription: e.target.value})} placeholder="e.g. Tìm hiểu cách cài đặt và sử dụng eSIM cực kỳ đơn giản cho mọi dòng điện thoại. Cẩm nang du lịch và công nghệ HICO." />
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn" style={{ marginTop: '16px' }}>
                    {editingArticleId ? 'Cập nhật bài viết' : 'Đăng bài viết'}
                  </button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ảnh bìa</th>
                      <th>Tiêu đề bài viết</th>
                      <th>Ngày đăng</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedArticles.map(art => (
                      <tr key={art.id}>
                        <td>
                          <img src={art.image} alt={art.title} style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { (e.target as HTMLImageElement).src = '/images/art_esim_intro.png'; }} />
                        </td>
                        <td style={{ fontWeight: '600' }}>{art.title}</td>
                        <td>{art.date}</td>
                        <td>
                          {(() => {
                            const status = art.status || 'published';
                            if (status === 'draft') return <span className="status-badge inactive">Lưu nháp</span>;
                            if (status === 'scheduled') return <span className="status-badge warning" style={{ whiteSpace: 'nowrap', background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>Hẹn giờ: {art.scheduledDate ? art.scheduledDate.replace('T', ' ') : ''}</span>;
                            return <span className="status-badge active">Đã đăng</span>;
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              onClick={() => {
                                setArticleForm({
                                  title: art.title || '',
                                  category: art.category || '',
                                  image: art.image || '',
                                  imageMediaId: art.imageMediaId || null,
                                  date: art.date || '',
                                  content: art.content || '',
                                  seoTitle: art.seoTitle || '',
                                  seoDescription: art.seoDescription || '',
                                  seoKeywords: art.seoKeywords || '',
                                  status: art.status || 'published',
                                  scheduledDate: art.scheduledDate || ''
                                });
                                setEditingArticleId(art.id);
                                setIsAddingArticle(true);
                                window.scrollTo(0, 0);
                              }}
                            >
                              Sửa
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              onClick={async () => {
                                if (confirm('Xoá bài viết này?')) {
                                  await fetch(`/api/admin/articles/${encodeURIComponent(art.id)}`, { method: 'DELETE' });
                                  fetchData('articles');
                                }
                              }}
                            >
                              Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {renderPagination(filteredArticles.length, currentPageArticles, setCurrentPageArticles)}
              </div>
            </div>
          )}

          {/* Tab: ai-bulk-writing (Viết bài hàng loạt AI) */}
          {activeTab === 'ai-bulk-writing' && (
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header">
                <div>
                  <h2 className="admin-card-title">Viết bài chuẩn SEO hàng loạt bằng AI</h2>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-light)', marginTop: '4px' }}>
                    Nhập danh sách các từ khóa hoặc tiêu đề. AI sẽ tự động sinh bài viết và ảnh bìa tương ứng, sau đó lưu nháp hoặc lên lịch đăng tự động.
                  </p>
                </div>
              </div>

              <div className="admin-form-box" style={{ background: 'transparent', padding: '24px 0 0 0' }}>
                <div className="form-grid" style={{ gap: '20px' }}>
                  <div className="form-group full-width">
                    <label style={{ fontWeight: '600', color: 'var(--admin-text-dark)', marginBottom: '6px', display: 'block' }}>
                      Danh sách từ khóa / tiêu đề bài viết (Mỗi dòng một từ khóa)
                    </label>
                    <textarea 
                      rows={6} 
                      value={bulkKeywords} 
                      onChange={e => setBulkKeywords(e.target.value)} 
                      placeholder="e.g.&#10;eSIM du lịch Singapore tốt nhất&#10;Kinh nghiệm du lịch tự túc Thái Lan&#10;Cách cài đặt eSIM trên iPhone 15"
                      disabled={isGeneratingBulk}
                      style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-bg-card)', color: 'var(--admin-text-dark)', fontSize: '14px', width: '100%', lineHeight: '1.5' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: 'var(--admin-text-dark)', marginBottom: '6px', display: 'block' }}>
                      Trạng thái xuất bản mặc định
                    </label>
                    <select 
                      value={bulkStatus} 
                      onChange={e => setBulkStatus(e.target.value)}
                      disabled={isGeneratingBulk}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-bg-card)', color: 'var(--admin-text-dark)', fontSize: '14px', width: '100%' }}
                    >
                      <option value="published">Đăng ngay lập tức</option>
                      <option value="draft">Lưu nháp</option>
                      <option value="scheduled">Đặt lịch đăng tự động</option>
                    </select>
                  </div>

                  {bulkStatus === 'scheduled' && (
                    <>
                      <div className="form-group">
                        <label style={{ fontWeight: '600', color: 'var(--admin-text-dark)', marginBottom: '6px', display: 'block' }}>
                          Thời gian bắt đầu đăng bài đầu tiên
                        </label>
                        <input 
                          type="datetime-local" 
                          value={bulkStartDate} 
                          onChange={e => setBulkStartDate(e.target.value)}
                          disabled={isGeneratingBulk}
                          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-bg-card)', color: 'var(--admin-text-dark)', fontSize: '14px', width: '100%' }}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label style={{ fontWeight: '600', color: 'var(--admin-text-dark)', marginBottom: '6px', display: 'block' }}>
                          Khoảng cách thời gian giữa các bài viết
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="number" 
                            min="1"
                            value={bulkInterval} 
                            onChange={e => setBulkInterval(e.target.value)}
                            disabled={isGeneratingBulk}
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-bg-card)', color: 'var(--admin-text-dark)', fontSize: '14px', width: '70px' }}
                          />
                          <select 
                            value={bulkIntervalUnit} 
                            onChange={e => setBulkIntervalUnit(e.target.value)}
                            disabled={isGeneratingBulk}
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-bg-card)', color: 'var(--admin-text-dark)', fontSize: '14px', flex: 1 }}
                          >
                            <option value="minutes">Phút</option>
                            <option value="hours">Giờ</option>
                            <option value="days">Ngày</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button 
                    type="button" 
                    className="admin-submit-btn" 
                    onClick={handleStartBulkGeneration} 
                    disabled={isGeneratingBulk}
                    style={{ width: 'auto', padding: '12px 30px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: isGeneratingBulk ? 'not-allowed' : 'pointer' }}
                  >
                    {isGeneratingBulk ? <RotateCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    <span>{isGeneratingBulk ? 'Đang viết bài hàng loạt...' : 'Bắt đầu viết bài hàng loạt'}</span>
                  </button>
                </div>

                {(isGeneratingBulk || bulkLogs.length > 0) && (
                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--admin-text-dark)' }}>
                        Tiến trình hoàn thành: {bulkProgress}%
                      </span>
                    </div>
                    <div className="admin-progress-bar-bg" style={{ width: '100%', height: '8px', background: 'rgba(255,107,0,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                      <div className="admin-progress-bar-fill" style={{ width: `${bulkProgress}%`, height: '100%', background: 'linear-gradient(90deg, #FF6B00, #FF8F00)', transition: 'width 0.3s ease' }}></div>
                    </div>

                    <div className="admin-bulk-console" style={{ background: '#1E1E2E', border: '1px solid #313244', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '12.5px', color: '#A6ADC8', height: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', scrollBehavior: 'smooth' }}>
                      {bulkLogs.map((log, idx) => {
                        let color = '#CDD6F4';
                        if (log.includes('[LỖI]')) color = '#F38BA8';
                        else if (log.includes('-> Đã')) color = '#A6E3A1';
                        else if (log.includes('Bắt đầu') || log.includes('hoàn tất')) color = '#FAB387';
                        return (
                          <div key={idx} style={{ color, whiteSpace: 'pre-wrap' }}>
                            {log}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: reviews (Quản lý Đánh giá) */}
          {activeTab === 'reviews' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Đánh giá của Khách hàng</h2>
                <button className="admin-btn-text-sm" onClick={() => fetchData('reviews')}>
                  <RotateCw size={14} /> Làm mới
                </button>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Người gửi</th>
                      <th>Liên hệ (SĐT/Email)</th>
                      <th>Đánh giá sao</th>
                      <th style={{ width: '35%' }}>Nội dung đánh giá</th>
                      <th>Hình ảnh</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviews.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--admin-text-light)' }}>
                          Chưa có đánh giá nào được gửi.
                        </td>
                      </tr>
                    ) : (
                      paginatedReviews.map(rev => (
                        <tr key={rev.id}>
                          <td style={{ fontWeight: '600' }}>
                            {rev.productName}
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--admin-text-light)' }}>
                              ID: {rev.productId}
                            </span>
                          </td>
                          <td style={{ fontWeight: '500' }}>{rev.userName}</td>
                          <td>
                            {rev.userPhone && <span style={{ display: 'block', fontSize: '12px' }}>📞 {rev.userPhone}</span>}
                            {rev.userEmail && <span style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-light)' }}>✉️ {rev.userEmail}</span>}
                            {!rev.userPhone && !rev.userEmail && <span style={{ color: 'var(--admin-text-light)' }}>-</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '2px', color: '#F59E0B' }}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={14}
                                  fill={i < rev.rating ? '#F59E0B' : 'none'}
                                  stroke={i < rev.rating ? '#F59E0B' : 'currentColor'}
                                />
                              ))}
                            </div>
                          </td>
                          <td style={{ fontSize: '13px', lineHeight: '1.4', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {rev.content}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {Array.isArray(rev.images) && rev.images.map((imgUrl: string, index: number) => (
                                <a href={imgUrl} target="_blank" rel="noreferrer" key={index}>
                                  <img
                                    src={imgUrl}
                                    alt="review-attachment"
                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--admin-border)' }}
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/art_esim_intro.png'; }}
                                  />
                                </a>
                              ))}
                              {(!Array.isArray(rev.images) || rev.images.length === 0) && '-'}
                            </div>
                          </td>
                          <td>{rev.createdAt}</td>
                          <td>
                            <span className={`status-badge ${rev.status === 'approved' ? 'active' : (rev.status === 'rejected' ? 'cancelled' : 'pending')}`}>
                              {rev.status === 'approved' ? 'Đã duyệt' : (rev.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt')}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {rev.status !== 'approved' && (
                                <button
                                  className="admin-action-btn-mini primary"
                                  onClick={async () => {
                                    const res = await fetch(`/api/admin/reviews/${rev.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'approved' })
                                    });
                                    if (res.ok) {
                                      fetchData('reviews');
                                    } else {
                                      toast.error('Lỗi phê duyệt đánh giá!');
                                    }
                                  }}
                                >
                                  Phê duyệt
                                </button>
                              )}
                              <button
                                className="admin-action-btn-mini danger"
                                onClick={async () => {
                                  if (confirm('Xoá vĩnh viễn đánh giá này?')) {
                                    const res = await fetch(`/api/admin/reviews/${rev.id}`, {
                                      method: 'DELETE'
                                    });
                                    if (res.ok) {
                                      fetchData('reviews');
                                    } else {
                                      toast.error('Lỗi khi xóa đánh giá!');
                                    }
                                  }
                                }}
                              >
                                Xoá
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                  {renderPagination(filteredReviews.length, currentPageReviews, setCurrentPageReviews)}
              </div>
            </div>
          )}

          {/* Tab: media (Thư viện ảnh) */}
          {activeTab === 'media' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Thư viện hình ảnh hệ thống</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {isUploading && (
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-light)' }}>
                      Đang tải lên...
                    </span>
                  )}
                  <label className="admin-create-btn" style={{ cursor: 'pointer' }}>
                    <Upload size={14} />
                    <span>Tải ảnh lên</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleMediaUpload} 
                    />
                  </label>
                </div>
              </div>

              {mediaFiles.length === 0 ? (
                <div className="no-media-files-box">
                  <FolderOpen size={48} className="no-media-icon" />
                  <p>Chưa có hình ảnh nào trong thư viện.</p>
                  <p className="subtext">Tải hình ảnh lên để chèn vào gói cước, bài viết hoặc thiết bị.</p>
                </div>
              ) : (
                <div className="media-library-grid">
                  {mediaFiles.map((file, idx) => (
                    <div key={idx} className="media-item-card">
                      <div className="media-preview-box">
                        <img src={file.url} alt={file.filename} />
                      </div>
                      <div className="media-details-box">
                        <span className="media-filename" title={file.filename}>{file.filename}</span>
                        <span className="media-meta">
                          {(file.size / 1024).toFixed(1)} KB • {new Date(file.date).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="media-actions-overlay">
                        <button 
                          className="media-action-icon-btn copy"
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin + file.url);
                            toast.success('Đã sao chép liên kết ảnh: ' + file.url);
                          }}
                          title="Sao chép liên kết"
                        >
                          <Copy size={13} />
                        </button>
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="media-action-icon-btn view"
                          title="Xem ảnh gốc"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button 
                          className="media-action-icon-btn delete"
                          onClick={() => handleMediaDelete(file.filename)}
                          title="Xoá ảnh"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: support (Hỗ trợ) */}
          {activeTab === 'support' && (
            <div className="admin-card" style={{ padding: '0' }}>
              <div className="admin-support-split-panel">
                {/* Left List of Tickets */}
                <div className="support-tickets-list-side">
                  <div className="support-side-header">Yêu cầu hỗ trợ</div>
                  <div className="support-side-list">
                    {tickets.map(t => (
                      <div 
                        key={t.ticketCode} 
                        className={`support-ticket-item-card ${selectedTicketId === t.ticketCode ? 'active' : ''}`}
                        onClick={() => setSelectedTicketId(t.ticketCode)}
                      >
                        <div className="ticket-item-row">
                          <span className="ticket-item-code">{t.ticketCode}</span>
                          <span className={`status-badge-mini ${t.status === 'Đang xử lý' ? 'pending' : 'resolved'}`}>
                            {t.status}
                          </span>
                        </div>
                        <h4 className="ticket-item-title-text">{t.title}</h4>
                        <span className="ticket-item-email">{t.customer}</span>
                        <span className="ticket-item-time">{t.updateTime}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Chat Pane */}
                <div className="support-chat-pane">
                  {selectedTicketId ? (() => {
                    const activeTicket = tickets.find(t => t.ticketCode === selectedTicketId);
                    if (!activeTicket) return <div className="no-chat-selected">Không tìm thấy ticket</div>;
                    return (
                      <>
                        <div className="chat-pane-header">
                          <div>
                            <h3>{activeTicket.title}</h3>
                            <span>Mã yêu cầu: {activeTicket.ticketCode} • Khách hàng: {activeTicket.customer}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="admin-action-btn-mini primary"
                              onClick={async () => {
                                const res = await fetch(`/api/admin/tickets/${encodeURIComponent(activeTicket.ticketCode)}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'Đã giải quyết' })
                                });
                                if (res.ok) fetchData('support');
                              }}
                            >
                              Đã giải quyết
                            </button>
                            <button 
                              className="admin-action-btn-mini danger"
                              onClick={async () => {
                                const res = await fetch(`/api/admin/tickets/${encodeURIComponent(activeTicket.ticketCode)}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'Đã đóng' })
                                });
                                if (res.ok) fetchData('support');
                              }}
                            >
                              Đóng yêu cầu
                            </button>
                          </div>
                        </div>

                        {/* Chat Message Logs */}
                        <div className="chat-messages-log-box">
                          {activeTicket.messages?.map((msg: AdminTicketMessage, idx: number) => (
                            <div key={idx} className={`chat-bubble-container ${msg.sender === 'admin' ? 'admin' : 'customer'}`}>
                              <div className="chat-bubble-meta">
                                <span>{msg.sender === 'admin' ? 'HICO Admin' : 'Khách hàng'}</span>
                                <span>{msg.time}</span>
                              </div>
                              <div className="chat-bubble-content">{msg.text}</div>
                            </div>
                          ))}
                        </div>

                        {/* Message Reply Form */}
                        <form className="chat-reply-input-box" onSubmit={async (e) => {
                          e.preventDefault();
                          if (!replyText.trim()) return;
                          const res = await fetch(`/api/admin/tickets/${encodeURIComponent(activeTicket.ticketCode)}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reply: replyText, status: 'Đang xử lý' })
                          });
                          if (res.ok) {
                            setReplyText('');
                            fetchData('support');
                          }
                        }}>
                          <input 
                            type="text" 
                            placeholder="Nhập nội dung phản hồi khách hàng..." 
                            value={replyText} 
                            onChange={e => setReplyText(e.target.value)}
                            className="chat-reply-input"
                            required
                          />
                          <button type="submit" className="chat-reply-send-btn">Gửi phản hồi</button>
                        </form>
                      </>
                    );
                  })() : (
                    <div className="no-chat-selected">Vui lòng chọn một yêu cầu hỗ trợ từ danh sách bên trái để phản hồi.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: personnel (Nhân sự & phân quyền) */}
          {activeTab === 'personnel' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Quản lý Nhân sự & Phân quyền</h2>
                <button className="admin-create-btn" onClick={() => setIsAddingUser(!isAddingUser)}>
                  <Plus size={14} />
                  <span>{isAddingUser ? 'Đóng form' : 'Thêm nhân sự mới'}</span>
                </button>
              </div>

              {isAddingUser && (
                <form className="admin-form-box" onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userForm)
                  });
                  if (res.ok) {
                    setIsAddingUser(false);
                    setUserForm({ email: '', role: 'CSKH', status: 'Offline' });
                    fetchData('personnel');
                  }
                }}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Địa chỉ email nhân viên</label>
                      <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Vai trò chức vụ</label>
                      <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                        <option value="Admin">Admin</option>
                        <option value="CSKH">CSKH</option>
                        <option value="Sales">Sales</option>
                        <option value="Content">Content</option>
                        <option value="Warehouse">Warehouse</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="admin-submit-btn">Lưu nhân sự</button>
                </form>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Đăng nhập cuối</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.email}>
                        <td>
                          <div className="user-email-cell">
                            <img src={u.avatar} alt="Avatar" className="user-avatar-mini" onError={(e) => { (e.target as HTMLImageElement).src = '/images/avatar_admin.png'; }} />
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td><span className={`user-role-badge ${u.role.toLowerCase()}`}>{u.role}</span></td>
                        <td className="user-status-cell">
                          <span className={`user-status-dot ${u.status.toLowerCase()}`}></span>
                          <span>{u.status}</span>
                        </td>
                        <td style={{ color: '#9CA3AF' }}>{u.lastLogin}</td>
                        <td>
                          {u.email !== 'admin@hico.vn' && (
                            <button 
                              className="admin-action-btn-mini danger"
                              onClick={async () => {
                                if (confirm('Xoá tài khoản nhân sự này?')) {
                                  await fetch(`/api/admin/users/${encodeURIComponent(u.email)}`, { method: 'DELETE' });
                                  fetchData('personnel');
                                }
                              }}
                            >
                              Xoá
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: settings (Cài đặt hệ thống & API) */}
          {activeTab === 'settings' && (
            <>
            <GoogleSheetSettings />
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header" style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '16px' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                    Cài đặt Hệ thống & Kết nối API
                  </h2>
                  <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                    Quản lý thông số kết nối tới đối tác viễn thông eSIM Worldmove.
                  </p>
                </div>
              </div>
              
              <form 
                className="admin-form-box" 
                style={{ padding: '24px 0 0 0', background: 'transparent' }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await fetch('/api/admin/config', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(apiConfig)
                    });
                    if (res.ok) {
                      toast.success('Cập nhật cấu hình API Worldmove thành công!');
                      fetchData('settings');
                    } else {
                      toast.error('Không thể cập nhật cấu hình API.');
                    }
                  } catch (err) {
                    console.error('Failed to update config:', err);
                    toast.error('Lỗi kết nối máy chủ!');
                  }
                }}
              >
                <div className="form-grid" style={{ gap: '20px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      Worldmove Merchant ID (merchantId)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.merchantId} 
                      onChange={e => setApiConfig({...apiConfig, merchantId: e.target.value})} 
                      placeholder="e.g. HICO_MCH_001" 
                      required 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      Worldmove Department ID (deptId)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.deptId} 
                      onChange={e => setApiConfig({...apiConfig, deptId: e.target.value})} 
                      placeholder="e.g. HICO_DEPT_001" 
                      required 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      API Token / Secret Key (token)
                    </label>
                    <input 
                      type="password" 
                      value={apiConfig.token} 
                      onChange={e => setApiConfig({...apiConfig, token: e.target.value})} 
                      placeholder="Nhập secret token..." 
                      required 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      Đường dẫn API Gateway (apiUrl)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.apiUrl} 
                      onChange={e => setApiConfig({...apiConfig, apiUrl: e.target.value})} 
                      placeholder="e.g. http://localhost:4000 hoặc https://tfmshippingsys.fastmove.com.tw" 
                      required 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginTop: '24px', marginBottom: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                  Cấu hình Máy chủ Gửi Email (SMTP Settings)
                </h3>
                <div className="form-grid" style={{ gap: '20px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      SMTP Host (smtpHost)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.smtpHost || ''} 
                      onChange={e => setApiConfig({...apiConfig, smtpHost: e.target.value})} 
                      placeholder="e.g. smtp.gmail.com hoặc mail.hico.vn" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      SMTP Port (smtpPort)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.smtpPort || '587'} 
                      onChange={e => setApiConfig({...apiConfig, smtpPort: e.target.value})} 
                      placeholder="e.g. 587 hoặc 465" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      SMTP Username / Email (smtpUser)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.smtpUser || ''} 
                      onChange={e => setApiConfig({...apiConfig, smtpUser: e.target.value})} 
                      placeholder="e.g. your-email@gmail.com" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      SMTP Password / App Password (smtpPass)
                    </label>
                    <input 
                      type="password" 
                      value={apiConfig.smtpPass || ''} 
                      onChange={e => setApiConfig({...apiConfig, smtpPass: e.target.value})} 
                      placeholder="Mật khẩu SMTP..." 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      Email Người Gửi (smtpFrom)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.smtpFrom || ''} 
                      onChange={e => setApiConfig({...apiConfig, smtpFrom: e.target.value})} 
                      placeholder="e.g. HICO eSIM <noreply@hico-esim.com>" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginTop: '24px', marginBottom: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                  Cấu hình OpenAI AI (Viết bài AI & Sinh ảnh)
                </h3>
                <div className="form-grid" style={{ gap: '20px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      OpenAI API Key (openaiApiKey)
                    </label>
                    <input 
                      type="password" 
                      value={apiConfig.openaiApiKey || ''} 
                      onChange={e => setApiConfig({...apiConfig, openaiApiKey: e.target.value})} 
                      placeholder="e.g. sk-proj-..." 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      ChatGPT Chat Model (openaiModel)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.openaiModel || 'ChatGPT 5.4 mini'} 
                      onChange={e => setApiConfig({...apiConfig, openaiModel: e.target.value})} 
                      placeholder="e.g. ChatGPT 5.4 mini" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      DALL-E Image Model (openaiImageModel)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.openaiImageModel || 'chatGPT image 2'} 
                      onChange={e => setApiConfig({...apiConfig, openaiImageModel: e.target.value})} 
                      placeholder="e.g. chatGPT image 2" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                      OpenAI API URL Gateway (openaiApiUrl)
                    </label>
                    <input 
                      type="text" 
                      value={apiConfig.openaiApiUrl || 'https://api.openai.com/v1'} 
                      onChange={e => setApiConfig({...apiConfig, openaiApiUrl: e.target.value})} 
                      placeholder="e.g. https://api.openai.com/v1" 
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '30px', display: 'flex', gap: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
                  <button type="submit" className="admin-submit-btn" style={{ width: 'auto', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>
                    Lưu cấu hình API
                  </button>
                  <button 
                    type="button" 
                    className="admin-create-btn" 
                    style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
                    onClick={() => {
                      if (confirm('Khôi phục cấu hình về giả lập mặc định (Local Mock Server)?')) {
                        setApiConfig({
                          merchantId: 'HICO_MCH_001',
                          deptId: 'HICO_DEPT_001',
                          token: 'HICO_SECRET_TOKEN',
                          apiUrl: 'http://localhost:4000',
                          smtpHost: '',
                          smtpPort: '587',
                          smtpUser: '',
                          smtpPass: '',
                          smtpFrom: 'HICO eSIM <noreply@hico-esim.com>',
                          openaiApiKey: '',
                          openaiModel: 'ChatGPT 5.4 mini',
                          openaiImageModel: 'chatGPT image 2',
                          openaiApiUrl: 'https://api.openai.com/v1'
                        });
                      }
                    }}
                  >
                    Cài đặt mặc định
                  </button>
                </div>
              </form>
            </div>
            </>
          )}

          {/* Media Selector Modal Pop-up */}
          {isMediaModalOpen && (
            <div className="media-selector-modal-overlay">
              <div className="media-selector-modal-content">
                <div className="modal-header">
                  <h3>Chọn hình ảnh từ thư viện</h3>
                  <button 
                    type="button" 
                    className="modal-close-btn"
                    onClick={() => {
                      setIsMediaModalOpen(false);
                      setSelectedImageCallback(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="modal-body">
                  <div className="modal-upload-row">
                    <span>Bạn muốn tải hình ảnh mới?</span>
                    <label className="admin-create-btn" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Upload size={12} />
                      <span>Tải ảnh lên</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleMediaUpload} 
                      />
                    </label>
                  </div>

                  {mediaFiles.length === 0 ? (
                    <div className="no-media-files-box modal-view">
                      <FolderOpen size={36} className="no-media-icon" style={{ color: 'var(--admin-text-light)' }} />
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>Chưa có hình ảnh nào trong thư viện.</p>
                    </div>
                  ) : (
                    <div className="media-selector-grid">
                      {mediaFiles.map((file, idx) => (
                        <div 
                          key={idx} 
                          className="media-selector-card"
                          onClick={() => {
                            if (selectedImageCallback) {
                              selectedImageCallback(file.url);
                            }
                            setIsMediaModalOpen(false);
                            setSelectedImageCallback(null);
                          }}
                        >
                          <img src={file.url} alt={file.filename} />
                          <div className="selector-card-overlay">
                            <span className="selector-card-name" title={file.filename}>{file.filename}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Variant Manager Modal Pop-up */}
          {isVariantModalOpen && variantTarget && !legacyCatalogReadOnly && (
            <div className="media-selector-modal-overlay">
              <div className="media-selector-modal-content" style={{ maxWidth: '800px', width: '90%' }}>
                <div className="modal-header">
                  <h3>Quản lý biến thể: {variantTarget.item.name}</h3>
                  <button 
                    type="button" 
                    className="modal-close-btn"
                    onClick={() => {
                      setIsVariantModalOpen(false);
                      setVariantTarget(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                  <h4 style={{ marginBottom: '10px' }}>Danh sách biến thể hiện tại</h4>
                  
                  {(!variantTarget.item.variants || variantTarget.item.variants.length === 0) ? (
                    <div className="no-media-files-box modal-view" style={{ padding: '20px 0' }}>
                      <p style={{ color: 'var(--admin-text-light)', fontSize: '13px' }}>Chưa có biến thể nào được cấu hình cho gói này.</p>
                    </div>
                  ) : (
                    <div className="admin-table-wrapper" style={{ margin: '0 0 20px 0', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
                      <table className="admin-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Loại SIM</th>
                            <th>Dung lượng</th>
                            <th>Số ngày</th>
                            <th>Giá bán</th>
                            <th>Giá gốc</th>
                            <th>Mã Worldmove</th>
                            <th>Kho QR</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variantTarget.item.variants.map((v: LegacyVariant) => (
                            <tr key={v.id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{v.sku}</td>
                              <td>{getSimTypeBadge(v.simType, v.leSIM)}</td>
                              <td>{v.dataLimit}</td>
                              <td>{v.duration}</td>
                              <td style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>{parseFloat(String(v.price)).toLocaleString('vi-VN')}đ</td>
                              <td style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>
                                {v.compareAtPrice ? `${parseFloat(String(v.compareAtPrice)).toLocaleString('vi-VN')}đ` : '-'}
                              </td>
                              <td style={{ fontFamily: 'monospace' }}>{v.wmproductId || '-'}</td>
                              <td>
                                {v.simType === 'manual' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                    <span style={{ fontWeight: '600', color: '#7E22CE' }}>
                                      Sẵn có: {manualQrs.filter((q: ManualQr) => q.variantId === v.id && !q.assignedOrderId).length} mã
                                    </span>
                                    <label style={{
                                      display: 'inline-block',
                                      padding: '2px 6px',
                                      backgroundColor: '#F3E8FF',
                                      border: '1px solid #D8B4FE',
                                      color: '#6B21A8',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      width: 'fit-content'
                                    }}>
                                      + Nạp QR
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        style={{ display: 'none' }} 
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleUploadQrToPool(v.id, e.target.files[0]);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                ) : '-'}
                              </td>
                              <td>
                                <button 
                                  type="button" 
                                  className="admin-action-btn-mini danger"
                                  onClick={() => handleDeleteVariant(v.id)}
                                >
                                  Xoá
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
 
                  <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #E5E7EB' }} />
                  
                  <h4 style={{ marginBottom: '15px' }}>Thêm biến thể mới</h4>
                  <form onSubmit={handleAddVariant} className="admin-form-box" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px' }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Dung lượng</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 5 GB hoặc 1 GB / Ngày" 
                          value={newVariantForm.dataLimit} 
                          onChange={e => setNewVariantForm({...newVariantForm, dataLimit: e.target.value})} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Số ngày sử dụng</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 7 Ngày hoặc 30 Ngày" 
                          value={newVariantForm.duration} 
                          onChange={e => setNewVariantForm({...newVariantForm, duration: e.target.value})} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Giá bán (VNĐ)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 370.000" 
                          value={formatNumberInput(newVariantForm.price)} 
                          onChange={e => setNewVariantForm({...newVariantForm, price: parseFormattedNumber(e.target.value)})} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Giá gốc / So sánh (VNĐ)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 490.000" 
                          value={formatNumberInput(newVariantForm.compareAtPrice)} 
                          onChange={e => setNewVariantForm({...newVariantForm, compareAtPrice: parseFormattedNumber(e.target.value)})} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Mã gói Worldmove (wmproductId)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. WM-e-JP-5GB" 
                          value={newVariantForm.wmproductId} 
                          onChange={e => setNewVariantForm({...newVariantForm, wmproductId: e.target.value})} 
                          required={newVariantForm.simType === 'leSIM' || newVariantForm.simType === 'eSIM'} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Mã SKU biến thể (Tùy chọn)</label>
                        <input 
                          type="text" 
                          placeholder="Tự động sinh nếu để trống" 
                          value={newVariantForm.sku} 
                          onChange={e => setNewVariantForm({...newVariantForm, sku: e.target.value})} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Loại SIM</label>
                        <select 
                          value={newVariantForm.simType} 
                          onChange={e => setNewVariantForm({...newVariantForm, simType: e.target.value})}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', width: '100%' }}
                        >
                          <option value="leSIM">leSIM (Worldmove Auto-Redeem)</option>
                          <option value="eSIM">eSIM (Worldmove Direct Mail)</option>
                          <option value="manual">eSIM Thủ công (Static QR Pool)</option>
                          <option value="physical">SIM Vật lý (Physical SIM)</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="admin-submit-btn" style={{ marginTop: '16px', width: 'auto', padding: '10px 24px' }}>Thêm biến thể</button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
