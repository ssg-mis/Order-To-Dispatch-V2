/**
 * API Configuration
 */

export const API_CONFIG = {
  // Always use relative '/api/v1' on client-side so Next.js rewrites proxy requests to backend
  baseURL: typeof window !== 'undefined' ? '/api/v1' : (process.env.NEXT_PUBLIC_API_URL || '/api/v1'),
  timeout: 30000, // 30 seconds
};

export const API_ENDPOINTS = {
  // Order Dispatch Endpoints
  orders: {
    create: '/orders',
    getAll: '/orders',
    getByOrderNumber: (orderNo: string) => `/orders/lookup/number?orderNo=${encodeURIComponent(orderNo)}`,
    update: (id: number) => `/orders/update/${id}`,
    delete: (id: number) => `/orders/delete/${id}`,
    getSuffixes: (prefix: string) => `/orders/suffixes?prefix=${encodeURIComponent(prefix)}`,
    upload: '/upload',
  },
  
  // Pre-Approval Endpoints
  preApproval: {
    pending: '/pre-approval/pending',
    history: '/pre-approval/history',
    submit: (id: number) => `/pre-approval/submit/${id}`,
  },
  
  // Approval Endpoints (Stage 3)
  approval: {
    pending: '/approval/pending',
    history: '/approval/history',
    submit: (id: number) => `/approval/submit/${id}`,
    getById: (id: number) => `/approval/${id}`,
  },
  
  // Dispatch Planning Endpoints (Stage 4)
  dispatchPlanning: {
    pending: '/dispatch-planning/pending',
    history: '/dispatch-planning/history',
    submit: (id: number) => `/dispatch-planning/submit/${id}`,
  },
  
  // Actual Dispatch Endpoints (Stage 7)
  actualDispatch: {
    pending: '/actual-dispatch/pending',
    history: '/actual-dispatch/history',
    submit: (dsrNumber: string) => `/actual-dispatch/submit/${dsrNumber}`,
  },
  
  // Reach Vehicle Endpoints (Stage 13)
  reachVehicle: {
    pending: '/reach-vehicle/pending',
    history: '/reach-vehicle/history',
    submit: (id: number) => `/reach-vehicle/submit/${id}`,
    revert: (id: number) => `/reach-vehicle/revert/${id}`,
  },
  
  // Dashboard Endpoints
  dashboard: {
    stats: '/dashboard/stats',
    overview: '/dashboard/overview',
  },

  // Owner Dashboard
  ownerDashboard: {
    full:           '/owner-dashboard',
    userDetail:     '/owner-dashboard/user-detail',
    customerOrders: '/owner-dashboard/customer-orders',
    orderJourney:   '/owner-dashboard/order-journey',
    stageOrders:    '/owner-dashboard/stage-orders',
    oilTypeOrders:  '/owner-dashboard/oiltype-orders',
  },

  // Reports Endpoints
  reports: {
    get: '/reports',
    dispatchReport: '/reports/dispatch-report',
    pendingSauda: '/reports/pending-sauda',
    pendingSaudaCustomer: '/reports/pending-sauda-customer',
    pendingSaudaDetailed: '/reports/pending-sauda-detailed',
    pendingSaudaSku: '/reports/pending-sauda-sku',
    oilDispatchVoucher: '/reports/oil-dispatch-voucher',
    dailyDispatch: '/reports/daily-dispatch',
    transitLoss: '/reports/transit-loss',
  },
};
