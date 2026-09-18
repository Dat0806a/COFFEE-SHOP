import React, { useState, useEffect } from 'react';
import { TableSessionProvider, useTableSession } from './context/TableSessionContext';
import { CartProvider } from './context/CartContext';
import { StoreProvider } from './context/StoreContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { DialogProvider } from './context/DialogContext';
import { TableSelectPage } from './pages/TableSelectPage/TableSelectPage';
import { HomePage } from './pages/HomePage';
import { CategoriesPage } from './pages/CategoriesPage/CategoriesPage';
import { CartPage } from './pages/CartPage/CartPage';
import { OffersPage } from './pages/OffersPage/OffersPage';
import { AccountPage } from './pages/AccountPage/AccountPage';
import { AdminLayout } from './pages/Admin/AdminLayout';
import { BottomNavigation, NavTab } from './components/common/BottomNavigation/BottomNavigation';
import './styles/global.css';

import { MyOrdersPage } from './pages/MyOrdersPage/MyOrdersPage';
import { CustomerToast } from './components/common/CustomerToast/CustomerToast';
import { CustomerOrderDetailModal } from './components/modals/CustomerOrderDetailModal/CustomerOrderDetailModal';
import { BootSequence } from './components/boot/BootSequence';
import { useStore } from './context/StoreContext';
import { useCart } from './context/CartContext';
import { OrderRecord } from './types';

export const AppContent: React.FC = () => {
  const { isTableSelected } = useTableSession();
  const { isAdmin } = useAdminAuth();
  const {
    customerToasts,
    dismissCustomerToast,
    selectedCustomerOrderId,
    openCustomerOrderDetail,
    closeCustomerOrderDetail,
    setEditingOrderId,
    products
  } = useStore();
  const { loadOrderIntoCart } = useCart();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);

  // Scroll to top when changing tab or account state
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, isAdmin, isMyOrdersOpen]);

  const handleStartEditOrder = (order: OrderRecord) => {
    loadOrderIntoCart(order, products);
    setEditingOrderId(order.id);
    setIsMyOrdersOpen(false);
    setActiveTab('cart');
    closeCustomerOrderDetail();
  };

  // 1. If currently logged in as ADMIN account
  if (isAdmin) {
    return <AdminLayout />;
  }

  // 2. When no table account is selected yet, gatekeep and show Table Selection screen
  if (!isTableSelected) {
    return <TableSelectPage />;
  }

  // 3. Customer Table Account view
  return (
    <div className="app-container">
      {/* Realtime Customer Toast Notifications */}
      <CustomerToast
        toasts={customerToasts}
        onDismiss={dismissCustomerToast}
        onViewOrder={openCustomerOrderDetail}
      />

      {/* Customer Order Detail & Stepper Tracker Modal */}
      <CustomerOrderDetailModal
        orderId={selectedCustomerOrderId}
        onClose={closeCustomerOrderDetail}
        onNavigateToMenu={() => {
          setIsMyOrdersOpen(false);
          setActiveTab('home');
        }}
        onStartEditOrder={handleStartEditOrder}
      />

      {/* 5 Main Screen Views or Dedicated My Orders View */}
      {isMyOrdersOpen ? (
        <MyOrdersPage
          onExploreMenu={() => {
            setIsMyOrdersOpen(false);
            setActiveTab('home');
          }}
          onOpenOrderDetail={openCustomerOrderDetail}
          onStartEditOrder={handleStartEditOrder}
          onBack={() => setIsMyOrdersOpen(false)}
        />
      ) : (
        <>
          {activeTab === 'home' && (
            <HomePage
              onNavigateToCart={() => setActiveTab('cart')}
              onNavigateToCategories={() => setActiveTab('categories')}
              onNavigateToAccount={() => setActiveTab('account')}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesPage
              onNavigateToCart={() => setActiveTab('cart')}
            />
          )}

          {activeTab === 'cart' && (
            <CartPage
              onExploreMenu={() => setActiveTab('categories')}
              onNavigateToMyOrders={() => setIsMyOrdersOpen(true)}
            />
          )}

          {activeTab === 'offers' && (
            <OffersPage
              onNavigateToCategories={() => setActiveTab('categories')}
              onNavigateToCart={() => setActiveTab('cart')}
            />
          )}

          {activeTab === 'account' && (
            <AccountPage
              onNavigateToOffers={() => setActiveTab('offers')}
              onNavigateToMyOrders={() => setIsMyOrdersOpen(true)}
              onOpenOrderDetail={openCustomerOrderDetail}
            />
          )}
        </>
      )}

      {/* Shared Global Bottom Navigation Bar */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setIsMyOrdersOpen(false);
          setActiveTab(tab);
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <StoreProvider>
      <AdminAuthProvider>
        <TableSessionProvider>
          <CartProvider>
            <DialogProvider>
              <BootSequence>
                <AppContent />
              </BootSequence>
            </DialogProvider>
          </CartProvider>
        </TableSessionProvider>
      </AdminAuthProvider>
    </StoreProvider>
  );
};

export default App;
