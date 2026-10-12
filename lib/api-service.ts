/**
 * API Service
 * Centralized API calls for the application
 */

import { API_CONFIG, API_ENDPOINTS } from './api-config';
import {
  adaptList,
  flattenOrderItemStage,
  flattenDispatchStage,
  flattenSecurityStage,
  flattenInvoiceStage,
  flattenGateOutStage,
  flattenUnloadingStage,
  flattenDamageStage,
  flattenGroupedOrderApproval,
} from './v2-adapter';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp: string;
}

/**
 * Build a query string from params, omitting null/undefined/empty values.
 * Avoids the URLSearchParams pitfall where `undefined` serializes to the
 * literal string "undefined" (which would break server-side filters).
 */
function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined && v !== null && v !== '') sp.append(key, String(v));
      });
    } else {
      sp.append(key, String(value));
    }
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// v2 schema: one order_items row per SKU line. Real FK ids, not name strings.
export interface OrderItem {
  skuId: number;
  uom?: string;
  orderQuantity?: number;
  rateOfMaterial?: number;
  alternateUom?: string;
  alternateQtyKg?: number;
  oilType?: string;
  ratePer15kg?: number;
  ratePerLtr?: number;
}

export interface CreateOrderRequest {
  customerId: number;
  orderType: 'regular' | 'pre-approval';
  depotId?: number;
  brokerId?: number;
  salespersonId?: number;
  orderCategory?: 'Sales' | 'Stock Transfer' | 'Sales Return';
  deliveryPurpose?: 'week-on-week' | 'future-period';
  orderThrough?: 'Direct' | 'Broker' | 'Salesperson';
  items: OrderItem[];
  [key: string]: any;
}

export interface CreateOrderResponse {
  order: any;
  items: any[];
}

/**
 * Active master tab context — set by the Master page so the backend
 * middleware can enforce tab-level permissions. Null when outside the master page.
 */
let _masterTabContext: string | null = null;

export function setMasterTabContext(tab: string | null): void {
  _masterTabContext = tab;
}

/**
 * Make HTTP request
 */
async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string = API_CONFIG.baseURL
): Promise<T> {
  const url = `${baseUrl}${endpoint}`;

  const headers: any = {
    ...options.headers,
  };

  // Inject master tab context so backend can enforce tab-level permissions.
  // Only present for master-page requests; workflow pages never set this.
  if (_masterTabContext) {
    headers['X-Master-Tab'] = _masterTabContext;
  }

  // Only set Content-Type to application/json if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  try {
    const response = await fetch(url, config);

    // Not every response is JSON. A reverse proxy (nginx) rejecting an
    // oversized upload returns a 413 with an HTML/text body — calling
    // response.json() on that throws a SyntaxError and masks the real
    // cause. Parse defensively and fall back to a meaningful message.
    let data: any;
    try {
      data = await response.json();
    } catch {
      if (response.status === 413) {
        data = { success: false, message: 'File too large — the server rejected the upload. Please use a smaller file.' };
      } else {
        data = { success: false, message: `Request failed (${response.status} ${response.statusText || 'error'})` };
      }
    }

    // Token expired or invalid — force logout (skip redirect if already on login page)
    if (response.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw data;
    }

    if (!response.ok) {
      throw data;
    }

    return data;
  } catch (error: any) {
    // Expected, already-formatted API errors (validation failures, business rules)
    // are handled by callers via toast — don't pollute the console with them.
    if (error?.success === false || error?.message !== undefined) {
      throw error;
    }
    // Only log genuinely unexpected failures (network/parse errors)
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Order Dispatch API
 */
export const orderApi = {
  create: async (orderData: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>> => {
    return request(API_ENDPOINTS.orders.create, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  uploadFile: async (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);

    return request(API_ENDPOINTS.orders.upload, {
      method: 'POST',
      body: formData,
    });
  },

  getAll: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    order_type?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(API_ENDPOINTS.orders.getAll + queryString);
  },

  getByOrderNumber: async (orderNo: string): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.orders.getByOrderNumber(orderNo));
  },

  /** Order Punch screen's DO list - computed totals + Stage 3 rollup + 48h visibility rule, all server-side. */
  getPunchList: async (params?: {
    search?: string;
    do_date?: string;
    start_date?: string;
    end_date?: string;
    depot_id?: number;
    customer_id?: number;
  }): Promise<ApiResponse> => {
    return request(`/orders/punch-list${buildQuery(params)}`);
  },

  /** One order's full header + line items, by orders.id (numeric PK) - for the detail/Modify view. */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/orders/${id}`);
  },

  update: async (id: number, updateData: Partial<CreateOrderRequest>): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.orders.update(id), {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  /** Order Punch Modify: replace the order's line items. items: [{ id?, sku_id, order_quantity, rate_of_material }] */
  updateItems: async (id: number, items: any[]): Promise<ApiResponse> => {
    return request(`/orders/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.orders.delete(id), {
      method: 'DELETE',
    });
  },

  getSuffixes: async (prefix: string): Promise<ApiResponse<string[]>> => {
    return request(API_ENDPOINTS.orders.getSuffixes(prefix));
  },
};

export const orderLookupApi = {
  lookup: async (search: string): Promise<ApiResponse<{
    orderNo: string;
    customerName: string;
    depoName: string;
    manualSaudaNo: string | null;
    createdAt: string;
    currentStage: string;
    isCompleted: boolean;
  }[]>> => {
    return request(`/order-lookup${buildQuery({ search })}`);
  },
};

export const preApprovalApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return adaptList(await request(`/pre-approval/pending${queryString}`), 'orders', flattenOrderItemStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return adaptList(await request(`/pre-approval/history${queryString}`), 'orders', flattenOrderItemStage);
  },

  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/pre-approval/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  deductBudget: async (id: number, data: { orderQuantity: number }): Promise<ApiResponse> => {
    return request(`/pre-approval/deduct-budget/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  submitBatch: async (payload: {
    approvals: Array<{ id: number; [key: string]: any }>;
    cascadeBudgets?: Array<{ base_do: string; oil_type: string; qty: number }>;
    deductions?: Array<{ id: number; orderQuantity: number }>;
    skipIds?: number[];
    newItems?: Array<{ orderId: number; skuId: number; [key: string]: any }>;
  }): Promise<ApiResponse> => {
    return request(`/pre-approval/submit-batch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const approvalApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    // Pending is grouped one row per DO (order), not per order_item - see
    // orderApprovalService._groupRowsByOrder on the backend.
    return adaptList(await request(`/approval/pending${queryString}`), 'orders', flattenGroupedOrderApproval);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return adaptList(await request(`/approval/history${queryString}`), 'orders', flattenGroupedOrderApproval);
  },

  getFilters: async (): Promise<ApiResponse> => {
    return request('/approval/filters');
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/approval/${id}`);
  },

  // One full order (all items + invoice-style tax breakdown) for the
  // single-DO Approval detail form.
  getByOrderId: async (orderId: number): Promise<ApiResponse> => {
    return request(`/approval/order/${orderId}`);
  },

  // Replace an order's extra taxable-amount charge lines (e.g. Transporting
  // Expenses). Call once per order submit, not once per item.
  setOrderCharges: async (orderId: number, charges: Array<{ ledgerId: number; amount: number }>, userId?: number | null): Promise<ApiResponse> => {
    return request(`/approval/order/${orderId}/charges`, {
      method: 'PUT',
      body: JSON.stringify({ charges, userId }),
    });
  },

  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/approval/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

export const dispatchPlanningApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    manual_sauda_no?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/dispatch-planning/pending${buildQuery(params)}`), 'dispatches', flattenOrderItemStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    manual_sauda_no?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/dispatch-planning/history${buildQuery(params)}`), 'dispatches', flattenOrderItemStage);
  },

  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/dispatch-planning/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  revert: async (id: number, userId: number | null, remarks?: string): Promise<ApiResponse> => {
    return request(`/dispatch-planning/revert/${id}`, {
      method: 'POST',
      body: JSON.stringify({ userId, remarks }),
    });
  },

  cancel: async (id: number, userId: number | null, remarks: string): Promise<ApiResponse> => {
    return request(`/dispatch-planning/cancel/${id}`, {
      method: 'POST',
      body: JSON.stringify({ userId, remarks }),
    });
  },

  updateTransferDetails: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/dispatch-planning/update-transfer/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  preclose: async (id: number, data: { precloseQty: number, userId: number | null, action: string, precloseRemarks: string }): Promise<ApiResponse> => {
    return request(`/dispatch-planning/preclose/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const actualDispatchApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/actual-dispatch/pending${buildQuery(params)}`), 'dispatches', flattenDispatchStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/actual-dispatch/history${buildQuery(params)}`), 'dispatches', flattenDispatchStage);
  },

  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/actual-dispatch/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  revert: async (id: number, userId: number | null, remarks?: string): Promise<ApiResponse> => {
    return request(`/actual-dispatch/revert/${id}`, {
      method: 'POST',
      body: JSON.stringify({ userId, remarks }),
    });
  },

  revertToDispatchPlanning: async (id: number, userId: number | null, remarks?: string): Promise<ApiResponse> => {
    return request(`/actual-dispatch/revert-to-planning/${id}`, {
      method: 'POST',
      body: JSON.stringify({ userId, remarks }),
    });
  },

  getFilters: async (): Promise<ApiResponse> => {
    return request('/actual-dispatch/filters');
  },

  cancelUnselected: async (dispatchIds: number[]): Promise<ApiResponse> => {
    return request('/actual-dispatch/cancel-unselected', {
      method: 'POST',
      body: JSON.stringify({ dispatchIds }),
    });
  },
};

export const reachVehicleApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    party_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return request(`/reach-vehicle/pending${buildQuery(params)}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return request(`/reach-vehicle/history${buildQuery(params)}`);
  },

  submit: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/reach-vehicle/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  revert: async (id: number, userId: number | null, remarks?: string): Promise<ApiResponse> => {
    return request(`/reach-vehicle/revert/${id}`, {
      method: 'POST',
      body: JSON.stringify({ userId, remarks }),
    });
  },
};

// Stage 5 (carved out of Actual Dispatch): consolidate DOs, assign a vehicle/
// transporter, generate the gate pass. Same row shape as actual-dispatch's
// pending/history rows (dispatches.id space) — reuses flattenDispatchStage as-is.
export const planVehicleApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/plan-vehicle/pending${buildQuery(params)}`), 'dispatches', flattenDispatchStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/plan-vehicle/history${buildQuery(params)}`), 'dispatches', flattenDispatchStage);
  },

  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/plan-vehicle/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  // One stage back: the shipment returns to Dispatch Planning.
  revertToDispatchPlanning: async (id: number, userId: number | null, remarks?: string): Promise<ApiResponse> => {
    return request(`/plan-vehicle/revert-to-planning/${id}`, {
      method: "POST",
      body: JSON.stringify({ userId, remarks }),
    });
  },

  revert: async (id: number, userId: number | null, remarks?: string): Promise<ApiResponse> => {
    return request(`/plan-vehicle/revert/${id}`, {
      method: 'POST',
      body: JSON.stringify({ userId, remarks }),
    });
  },
};

export const gateInApi = {
  getPending: (params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse> => {
    return request(`/gate-in/pending${buildQuery(params)}`);
  },

  getHistory: (params?: { page?: number; limit?: number }): Promise<ApiResponse> => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/gate-in/history${qs}`);
  },

  submit: (data: {
    orderKey: string;
    username: string;
    frontVehicleImage?: string;
    backVehicleImage?: string;
    driverPhoto?: string;
    gatepassPhoto?: string;
    vehicleNumber?: string;
    driverName?: string;
  }): Promise<ApiResponse> =>
    request('/gate-in/submit', { method: 'POST', body: JSON.stringify(data) }),

  check: (orderKey: string): Promise<ApiResponse> =>
    request(`/gate-in/check?order_key=${encodeURIComponent(orderKey)}`),
};

export const draftApi = {
  save: (username: string, orderKey: string, data: any): Promise<ApiResponse> =>
    request('/drafts', {
      method: 'POST',
      body: JSON.stringify({ username, orderKey, data }),
    }),

  get: (orderKey: string): Promise<ApiResponse> =>
    request(`/drafts?orderKey=${encodeURIComponent(orderKey)}`),

  delete: (orderKey: string): Promise<ApiResponse> =>
    request(`/drafts?orderKey=${encodeURIComponent(orderKey)}`, {
      method: 'DELETE',
    }),
};

export const securityGuardApprovalApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    customer_name?: string;
    depo_names?: string[];
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    let url = '/security-approval/pending?';
    if (params) {
      const { page, limit, search, customer_name, depo_names, manual_sauda_no, do_date_from, do_date_to } = params;
      if (page) url += `page=${page}&`;
      if (limit) url += `limit=${limit}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (manual_sauda_no) url += `manual_sauda_no=${encodeURIComponent(manual_sauda_no)}&`;
      if (do_date_from) url += `do_date_from=${encodeURIComponent(do_date_from)}&`;
      if (do_date_to) url += `do_date_to=${encodeURIComponent(do_date_to)}&`;
      if (customer_name) url += `customer_name=${encodeURIComponent(customer_name)}&`;
      if (depo_names && depo_names.length > 0) {
        depo_names.forEach(d => url += `depo_names=${encodeURIComponent(d)}&`);
      }
    }
    return adaptList(await request(url.endsWith('&') || url.endsWith('?') ? url.slice(0, -1) : url), 'approvals', flattenSecurityStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    customer_name?: string;
    depo_names?: string[];
    start_date?: string;
    end_date?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    let url = '/security-approval/history?';
    if (params) {
      const { page, limit, search, customer_name, depo_names, start_date, end_date, manual_sauda_no, do_date_from, do_date_to } = params;
      if (page) url += `page=${page}&`;
      if (limit) url += `limit=${limit}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (manual_sauda_no) url += `manual_sauda_no=${encodeURIComponent(manual_sauda_no)}&`;
      if (do_date_from) url += `do_date_from=${encodeURIComponent(do_date_from)}&`;
      if (do_date_to) url += `do_date_to=${encodeURIComponent(do_date_to)}&`;
      if (customer_name) url += `customer_name=${encodeURIComponent(customer_name)}&`;
      if (depo_names && depo_names.length > 0) {
        depo_names.forEach(d => url += `depo_names=${encodeURIComponent(d)}&`);
      }
      if (start_date) url += `start_date=${start_date}&`;
      if (end_date) url += `end_date=${end_date}&`;
    }
    return adaptList(await request(url.endsWith('&') || url.endsWith('?') ? url.slice(0, -1) : url), 'approvals', flattenSecurityStage);
  },

  getFilters: async (): Promise<ApiResponse> => {
    return request('/security-approval/filters');
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/security-approval/${id}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/security-approval/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const makeInvoiceApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/make-invoice/pending${buildQuery(params)}`), 'invoices', flattenInvoiceStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/make-invoice/history${buildQuery(params)}`), 'invoices', flattenInvoiceStage);
  },

  getById: async (id: number | string): Promise<ApiResponse> => {
    return request(`/make-invoice/${id}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/make-invoice/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const checkInvoiceApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/check-invoice/pending${buildQuery(params)}`), 'invoices', flattenInvoiceStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/check-invoice/history${buildQuery(params)}`), 'invoices', flattenInvoiceStage);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/check-invoice/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const collectionApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    invoice_no?: string;
    customer_name?: string;
    view?: "receivable" | "disputed" | "all";
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return request(`/collections/pending${buildQuery(params)}`);
  },

  getSuggestion: async (params: {
    invoiceId: number;
    receiptDate?: string;
    tdsRuleId?: number;
    gstPercent?: number;
  }): Promise<ApiResponse> => {
    return request(`/collections/suggestion${buildQuery(params)}`);
  },

  getInvoiceReceipts: async (invoiceId: number): Promise<ApiResponse> => {
    return request(`/collections/receipts/${invoiceId}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    customer_name?: string;
    from?: string;
    to?: string;
    entry?: "receipts" | "disputes" | "cleared";
  }): Promise<ApiResponse> => {
    return request(`/collections/history${buildQuery(params)}`);
  },

  setDispute: async (data: { invoiceId: number; disputed: boolean; remarks: string }): Promise<ApiResponse> => {
    return request(`/collections/dispute`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  addReceipt: async (data: any): Promise<ApiResponse> => {
    return request(`/collections/add-receipt`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const finalInvoiceApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    return request(`/final-invoice/pending${buildQuery(params)}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    return request(`/final-invoice/history${buildQuery(params)}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/final-invoice/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const gateOutApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/gate-out/pending${buildQuery(params)}`), 'orders', flattenGateOutStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/gate-out/history${buildQuery(params)}`), 'orders', flattenGateOutStage);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/gate-out/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const unloadingApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    depo_names?: string[];
    search?: string;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/unloading/pending${buildQuery(params)}`), 'orders', flattenUnloadingStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    depo_names?: string[];
    search?: string;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/unloading/history${buildQuery(params)}`), 'orders', flattenUnloadingStage);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/unloading/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Losses reported at Unloading that wait for Company Admin approval.
  getApprovals: async (params?: { page?: number; limit?: number }): Promise<ApiResponse> => {
    return adaptList(await request(`/unloading/approvals${buildQuery(params)}`), 'orders', flattenUnloadingStage);
  },

  // Company Admin only. decision: 'approve' | 'reject' (reject needs remarks).
  review: async (id: number | string, data: {
    decision: 'approve' | 'reject';
    remarks?: string;
    shortageBorneBy?: string;
    containerBorneBy?: Record<number, string>;
  }): Promise<ApiResponse> => {
    return request(`/unloading/review/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const returnApi = {
  getOptions: async (): Promise<ApiResponse> => request(`/returns/options`),

  // Order Punch (category = Sales Return)
  getReturnableInvoices: async (customerId: number | string): Promise<ApiResponse> =>
    request(`/returns/invoices${buildQuery({ customer_id: customerId })}`),

  getInvoiceLines: async (customerId: number | string, invoiceNo: string): Promise<ApiResponse> =>
    request(`/returns/invoices/${encodeURIComponent(invoiceNo)}/lines${buildQuery({ customer_id: customerId })}`),

  // Stock Return (Cases I / II): transfers whose stock reached a depot and can still be returned
  getReturnableTransfers: async (depotId: number | string): Promise<ApiResponse> =>
    request(`/returns/stock/transfers${buildQuery({ depot_id: depotId })}`),
  getStockReturns: async (): Promise<ApiResponse> => request(`/returns/stock/list`),
  getSalesReturns: async (): Promise<ApiResponse> => request(`/returns/sales/list`),

  // Main Gate "Stock Return" gate pass
  createGatePass: async (data: any): Promise<ApiResponse> =>
    request(`/returns/gate-pass`, { method: "POST", body: JSON.stringify(data) }),
  getGatePasses: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/returns/gate-pass${buildQuery(params)}`),

  // Stage 17 - Credit Note
  getPendingCreditNotes: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/returns/credit-notes/pending${buildQuery(params)}`),
  getCreditNoteHistory: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/returns/credit-notes/history${buildQuery(params)}`),
  getCreditNoteInvoiceOptions: async (id: number | string): Promise<ApiResponse> =>
    request(`/returns/credit-notes/${id}/invoice-options`),
  submitCreditNote: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/returns/credit-notes/submit/${id}`, { method: "POST", body: JSON.stringify(data) }),

  // Stage 18 - Unload Returned Stock
  getPendingUnloadings: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/returns/unloading/pending${buildQuery(params)}`),
  getUnloadingHistory: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/returns/unloading/history${buildQuery(params)}`),
  submitUnloading: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/returns/unloading/submit/${id}`, { method: "POST", body: JSON.stringify(data) }),
};

// Stage 20 - Transport Bills
export const transportBillApi = {
  getPending: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/transport-bills/pending${buildQuery(params)}`),
  getHistory: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/transport-bills/history${buildQuery(params)}`),
  getAccess: async (): Promise<ApiResponse> => request(`/transport-bills/access`),
  getDetail: async (id: number | string): Promise<ApiResponse> => request(`/transport-bills/${id}`),
  saveActuals: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/transport-bills/${id}/actuals`, { method: "POST", body: JSON.stringify(data) }),
  approve: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/transport-bills/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  recordVoucher: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/transport-bills/${id}/voucher`, { method: "POST", body: JSON.stringify(data) }),
};

// Stage 21 - Diesel Bills
export const dieselBillApi = {
  getPending: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/diesel-bills/pending${buildQuery(params)}`),
  getHistory: async (params?: Record<string, any>): Promise<ApiResponse> =>
    request(`/diesel-bills/history${buildQuery(params)}`),
  getAccess: async (): Promise<ApiResponse> => request(`/diesel-bills/access`),
  getDetail: async (id: number | string): Promise<ApiResponse> => request(`/diesel-bills/${id}`),
  save: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/diesel-bills/${id}/save`, { method: "POST", body: JSON.stringify(data) }),
  approve: async (id: number | string, data: any): Promise<ApiResponse> =>
    request(`/diesel-bills/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  createLedger: async (data: any): Promise<ApiResponse> =>
    request(`/diesel-bills/ledger`, { method: "POST", body: JSON.stringify(data) }),
};

export const damageAdjustmentApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/damage-adjustment/pending${buildQuery(params)}`), 'orders', flattenDamageStage);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    search?: string;
    manual_sauda_no?: string;
    do_date_from?: string;
    do_date_to?: string;
  }): Promise<ApiResponse> => {
    return adaptList(await request(`/damage-adjustment/history${buildQuery(params)}`), 'orders', flattenDamageStage);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/damage-adjustment/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const userApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/users${queryString}`);
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/users/${id}`);
  },

  create: async (userData: any): Promise<ApiResponse> => {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (id: number, userData: any): Promise<ApiResponse> => {
    return request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  me: async (): Promise<ApiResponse> => {
    return request('/users/me');
  },

  login: async (credentials: { username: string; password: string }): Promise<ApiResponse> => {
    return request('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async (): Promise<ApiResponse> => {
    return request('/users/logout', {
      method: 'POST',
    });
  },

  getPageAccessOptions: async (): Promise<ApiResponse> => {
    return request('/users/page-access-options');
  },

  getCsvFormats: async (id: number): Promise<ApiResponse> => {
    return request(`/users/${id}/csv-formats`);
  },

  saveCsvFormats: async (id: number, formats: Record<string, string[]>): Promise<ApiResponse> => {
    return request(`/users/${id}/csv-formats`, {
      method: 'PUT',
      body: JSON.stringify({ formats }),
    });
  },

  getColumnPrefs: async (id: number): Promise<ApiResponse> => {
    return request(`/users/${id}/column-prefs`);
  },

  saveColumnPrefs: async (
    id: number,
    stageKey: string,
    partial: { visible?: string[]; order?: string[]; sort?: { field: string; dir: 'asc' | 'desc' } | null; filters?: Record<string, any> | null },
    opts?: { keepalive?: boolean }
  ): Promise<ApiResponse> => {
    return request(`/users/${id}/column-prefs`, {
      method: 'PUT',
      body: JSON.stringify({ stageKey, ...partial }),
      ...(opts?.keepalive ? { keepalive: true } : {}),
    });
  },
};

export const customerApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/customers${queryString}`);
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/customers/${id}`);
  },

  getByName: async (name: string): Promise<ApiResponse> => {
    return request(`/customers/name/${encodeURIComponent(name)}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  getPending: async (): Promise<ApiResponse> => {
    return request('/customers/pending');
  },

  review: async (id: number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => {
    return request(`/customers/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/customers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  getGstHistory: async (id: number): Promise<ApiResponse> => {
    return request(`/customers/${id}/gst-history`);
  },

  getMailingHistory: async (id: number | string): Promise<ApiResponse> => {
    return request(`/customers/${id}/mailing-history`);
  },

  getStructuredGstHistory: async (id: number | string): Promise<ApiResponse> => {
    return request(`/customers/${id}/structured-gst-history`);
  },

  getMsmeHistory: async (id: number | string): Promise<ApiResponse> => {
    return request(`/customers/${id}/msme-history`);
  },

  getFssaiHistory: async (id: number | string): Promise<ApiResponse> => {
    return request(`/customers/${id}/fssai-history`);
  },

  getEffectiveDetails: async (id: number | string, date?: string): Promise<ApiResponse> => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/customers/${id}/effective-details${qs}`);
  },

  addSectionHistory: async (id: number | string, sectionOrData: string | Record<string, any>, data?: any): Promise<ApiResponse> => {
    const payload = typeof sectionOrData === 'string' ? { section: sectionOrData, ...data } : sectionOrData;
    return request(`/customers/${id}/section-history`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const skuApi = {
  getAll: async (params?: {
    all?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/skus${queryString}`);
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/skus/${id}`);
  },

  getRateByName: async (skuName: string): Promise<any> => {
    return request(`/skus/rate/${encodeURIComponent(skuName)}`);
  },

  getAllSkuRates: async (): Promise<ApiResponse> => {
    return request('/skus/rates/all');
  },
};

export const depotApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/depots${queryString}`);
  },

  getById: async (id: string): Promise<ApiResponse> => {
    return request(`/depots/${id}`);
  },

  getByName: async (name: string): Promise<ApiResponse> => {
    return request(`/depots/name/${encodeURIComponent(name)}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/depots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string | number, data: any): Promise<ApiResponse> => {
    return request(`/depots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number): Promise<ApiResponse> => {
    return request(`/depots/${id}`, { method: 'DELETE' });
  },
  getPending: async (): Promise<ApiResponse> => request('/depots/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/depots/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/depots/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const stateApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/states${queryString}`);
  },
  getById: async (id: string | number): Promise<ApiResponse> => request(`/states/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/states', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/states/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/states/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/states/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/states/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const districtApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/districts${queryString}`);
  },
  getById: async (id: string | number): Promise<ApiResponse> => request(`/districts/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/districts', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/districts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/districts/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/districts/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/districts/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const subDistrictApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/sub-districts${queryString}`);
  },
  getById: async (id: string | number): Promise<ApiResponse> => request(`/sub-districts/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/sub-districts', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/sub-districts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/sub-districts/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/sub-districts/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/sub-districts/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export type LookupType =
  | 'is_gst_registered'
  | 'gst_registration_type'
  | 'city'
  | 'post'
  | 'thana'
  | 'sub_district'
  | 'district'
  | 'state'
  | 'msme_registration_type'
  | 'fssai_licence_type'
  | 'bank_name'
  | 'transaction_type'
  | 'uqc'
  | 'gst_rate'
  | 'hsn_code'
  | 'sac_code'
  | 'type_of_supply'
  | 'vehicle_type'
  | 'fuel_type'
  | 'rto_code'
  | 'stock_category'
  | 'oil_type';

export const lookupApi = {
  getAll: async (type: LookupType, params?: any): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.getAll(params);
    if (type === 'district') return districtApi.getAll(params);
    if (type === 'sub_district') return subDistrictApi.getAll(params);
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/lookups/${type}${queryString}`);
  },
  getById: async (type: LookupType, id: string | number): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.getById(id);
    if (type === 'district') return districtApi.getById(id);
    if (type === 'sub_district') return subDistrictApi.getById(id);
    return request(`/lookups/${type}/${id}`);
  },
  create: async (type: LookupType, data: any): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.create(data);
    if (type === 'district') return districtApi.create(data);
    if (type === 'sub_district') return subDistrictApi.create(data);
    return request(`/lookups/${type}`, { method: 'POST', body: JSON.stringify(data) });
  },
  update: async (type: LookupType, id: string | number, data: any): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.update(id, data);
    if (type === 'district') return districtApi.update(id, data);
    if (type === 'sub_district') return subDistrictApi.update(id, data);
    return request(`/lookups/${type}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: async (type: LookupType, id: string | number): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.delete(id);
    if (type === 'district') return districtApi.delete(id);
    if (type === 'sub_district') return subDistrictApi.delete(id);
    return request(`/lookups/${type}/${id}`, { method: 'DELETE' });
  },
  getPending: async (type: LookupType): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.getPending();
    if (type === 'district') return districtApi.getPending();
    if (type === 'sub_district') return subDistrictApi.getPending();
    return request(`/lookups/${type}/pending`);
  },
  review: async (type: LookupType, id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => {
    if (type === 'state') return stateApi.review(id, data);
    if (type === 'district') return districtApi.review(id, data);
    if (type === 'sub_district') return subDistrictApi.review(id, data);
    return request(`/lookups/${type}/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) });
  },
};

export const processStageApi = {
  getAll: async (): Promise<ApiResponse> => {
    return request('/process-stages');
  },

  save: async (data: { stage_name: string; total_minutes: number }): Promise<ApiResponse> => {
    return request('/process-stages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: { stage_name: string; total_minutes: number }): Promise<ApiResponse> => {
    return request(`/process-stages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/process-stages/${id}`, { method: 'DELETE' });
  },
};

export const brokerApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/brokers${queryString}`);
  },

  getById: async (id: string): Promise<ApiResponse> => {
    return request(`/brokers/${id}`);
  },

  getByName: async (name: string): Promise<ApiResponse> => {
    return request(`/brokers/name/${encodeURIComponent(name)}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/brokers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string | number, data: any): Promise<ApiResponse> => {
    return request(`/brokers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number): Promise<ApiResponse> => {
    return request(`/brokers/${id}`, { method: 'DELETE' });
  },
  getPending: async (): Promise<ApiResponse> => request('/brokers/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/brokers/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/brokers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const skuDetailsApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/sku-details${queryString}`);
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/sku-details/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/sku-details', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/sku-details/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/sku-details/${id}`, { method: 'DELETE' });
  },
  getPending: async (): Promise<ApiResponse> => request('/sku-details/pending'),
  review: async (id: number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/sku-details/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/sku-details/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const skuSellingPriceApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/skus/sku-selling-price${queryString}`);
  },

  update: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/skus/sku-selling-price/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/skus/sku-selling-price', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/skus/sku-selling-price/${id}`, {
      method: 'DELETE',
    });
  },

  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/skus/sku-selling-price/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const commonApi = {
  getNextId: async (type: 'customer' | 'depot' | 'broker' | 'sku' | 'salesperson' | 'vehicle' | 'driver' | 'transport' | 'state' | 'district' | 'sub_district' | 'ledger_group' | 'stock_group' | 'unit' | 'ledger' | 'raw_material' | 'semi_finished_good' | 'insurance_detail' | 'conversion_formula' | 'price_level' | 'petrol_pump' | 'cd_rule' | 'tds_rule' | 'bhada_rate'): Promise<ApiResponse<{ nextId: string; type: string; prefix: string }>> => {
    return request(`/common/next-id?type=${type}`);
  },
};

export const vehicleMasterApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/vehicle-master${queryString}`);
  },

  getById: async (id: string | number): Promise<ApiResponse> => {
    return request(`/vehicle-master/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/vehicle-master', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string | number, data: any): Promise<ApiResponse> => {
    return request(`/vehicle-master/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number): Promise<ApiResponse> => {
    return request(`/vehicle-master/${id}`, { method: 'DELETE' });
  },
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/vehicle-master/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
  getPending: async (): Promise<ApiResponse> => request('/vehicle-master/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/vehicle-master/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const driverMasterApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/driver-master${queryString}`);
  },

  getById: async (id: string | number): Promise<ApiResponse> => {
    return request(`/driver-master/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/driver-master', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string | number, data: any): Promise<ApiResponse> => {
    return request(`/driver-master/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number): Promise<ApiResponse> => {
    return request(`/driver-master/${id}`, { method: 'DELETE' });
  },
  getPending: async (): Promise<ApiResponse> => request('/driver-master/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/driver-master/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/driver-master/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const transportMasterApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/transport-master${queryString}`);
  },

  getById: async (id: string | number): Promise<ApiResponse> => {
    return request(`/transport-master/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/transport-master', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string | number, data: any): Promise<ApiResponse> => {
    return request(`/transport-master/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number): Promise<ApiResponse> => {
    return request(`/transport-master/${id}`, { method: 'DELETE' });
  },
  getPending: async (): Promise<ApiResponse> => request('/transport-master/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/transport-master/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/transport-master/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const varCalcApi = {
  getLatest: async (): Promise<ApiResponse> => {
    return request('/common/var-calc/latest');
  },

  save: async (data: any): Promise<ApiResponse> => {
    return request('/common/var-calc', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/common/var-calc/history${queryString}`);
  },
};

export const salespersonApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/salespersons${queryString}`);
  },

  getById: async (id: string): Promise<ApiResponse> => {
    return request(`/salespersons/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/salespersons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string | number, data: any): Promise<ApiResponse> => {
    return request(`/salespersons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number): Promise<ApiResponse> => {
    return request(`/salespersons/${id}`, { method: 'DELETE' });
  },
  getPending: async (): Promise<ApiResponse> => request('/salespersons/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/salespersons/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/salespersons/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const ledgerGroupApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/ledger-groups${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/ledger-groups/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/ledger-groups', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/ledger-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/ledger-groups/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/ledger-groups/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/ledger-groups/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/ledger-groups/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const stockGroupApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/stock-groups${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/stock-groups/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/stock-groups', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/stock-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/stock-groups/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/stock-groups/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/stock-groups/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/stock-groups/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const unitApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/units${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/units/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/units', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/units/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/units/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/units/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/units/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const ledgerApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/ledgers${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/ledgers/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/ledgers', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/ledgers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/ledgers/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/ledgers/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/ledgers/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const rawMaterialApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/raw-materials${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/raw-materials/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/raw-materials', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/raw-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/raw-materials/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/raw-materials/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/raw-materials/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/raw-materials/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
  addSectionHistory: async (id: string | number, section: string, data: any, wefDate?: string): Promise<ApiResponse> => request(`/raw-materials/${id}/section-history`, { method: 'POST', body: JSON.stringify({ section, data, wefDate }) }),
};

export const semiFinishedGoodApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/semi-finished-goods${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/semi-finished-goods/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/semi-finished-goods', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/semi-finished-goods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/semi-finished-goods/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/semi-finished-goods/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/semi-finished-goods/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/semi-finished-goods/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const insuranceDetailApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/insurance-details${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/insurance-details/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/insurance-details', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/insurance-details/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/insurance-details/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/insurance-details/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/insurance-details/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/insurance-details/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const conversionFormulaApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/conversion-formulas${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/conversion-formulas/${id}`),
  getHistory: async (id: string | number): Promise<ApiResponse> => request(`/conversion-formulas/${id}/history`),
  create: async (data: any): Promise<ApiResponse> => request('/conversion-formulas', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/conversion-formulas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/conversion-formulas/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/conversion-formulas/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/conversion-formulas/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/conversion-formulas/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const priceLevelApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/price-levels${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/price-levels/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/price-levels', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/price-levels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/price-levels/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/price-levels/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/price-levels/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/price-levels/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const petrolPumpApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/petrol-pumps${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/petrol-pumps/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/petrol-pumps', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/petrol-pumps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/petrol-pumps/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/petrol-pumps/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/petrol-pumps/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/petrol-pumps/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};

export const cdRuleApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/cd-rules${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/cd-rules/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/cd-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/cd-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/cd-rules/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/cd-rules/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/cd-rules/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/cd-rules/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};


export const oilTagApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/oil-tags${queryString}`);
  },
  getById: async (id: number | string): Promise<ApiResponse> => request(`/oil-tags/${id}`),
  getPending: async (): Promise<ApiResponse> => request(`/oil-tags/pending`),
  create: async (data: any): Promise<ApiResponse> => request('/oil-tags', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: number | string, data: any): Promise<ApiResponse> => request(`/oil-tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: number | string): Promise<ApiResponse> => request(`/oil-tags/${id}`, { method: 'DELETE' }),
  review: async (id: number | string, data: any): Promise<ApiResponse> => request(`/oil-tags/${id}/action`, { method: 'POST', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/oil-tags/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};


export const tdsRuleApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/tds-rules${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/tds-rules/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/tds-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/tds-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/tds-rules/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/tds-rules/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/tds-rules/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => request('/tds-rules/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) }),
};


export const bhadaRateApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/bhada-rates${queryString}`);
  },
  getById: async (id: string): Promise<ApiResponse> => request(`/bhada-rates/${id}`),
  create: async (data: any): Promise<ApiResponse> => request('/bhada-rates', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string | number, data: any): Promise<ApiResponse> => request(`/bhada-rates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string | number): Promise<ApiResponse> => request(`/bhada-rates/${id}`, { method: 'DELETE' }),
  getPending: async (): Promise<ApiResponse> => request('/bhada-rates/pending'),
  review: async (id: string | number, data: { action: string; reason?: string; [key: string]: any }): Promise<ApiResponse> => request(`/bhada-rates/${id}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkImport: async (rows: any[]): Promise<ApiResponse> => {
    return request('/bhada-rates/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export const dashboardApi = {
  getStats: async (): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.dashboard.stats);
  },
  getOverview: async (): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.dashboard.overview);
  },
};

export const ownerDashboardApi = {
  getFull: async (params?: Record<string, any>): Promise<ApiResponse> => {
    const queryString = params && Object.keys(params).length > 0
      ? '?' + new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
          ) as Record<string, string>
        ).toString()
      : '';
    return request(`${API_ENDPOINTS.ownerDashboard.full}${queryString}`);
  },
  getUserDetail: async (userId: number, params?: Record<string, any>): Promise<ApiResponse> => {
    const queryString = params && Object.keys(params).length > 0
      ? '?' + new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
          ) as Record<string, string>
        ).toString()
      : '';
    return request(`${API_ENDPOINTS.ownerDashboard.userDetail}/${userId}${queryString}`);
  },
  getCustomerOrders: async (customerId: string, params?: Record<string, any>): Promise<ApiResponse> => {
    const qs = new URLSearchParams({ customerId: customerId ?? '', ...Object.fromEntries(Object.entries(params || {}).filter(([,v]) => v)) }).toString();
    return request(`${API_ENDPOINTS.ownerDashboard.customerOrders}?${qs}`);
  },
  getOrderJourney: async (orderNo: string): Promise<ApiResponse> => {
    return request(`${API_ENDPOINTS.ownerDashboard.orderJourney}?orderNo=${encodeURIComponent(orderNo)}`);
  },
  getStageOrders: async (stage: string, params?: Record<string, any>): Promise<ApiResponse> => {
    const qs = new URLSearchParams({ stage, ...Object.fromEntries(Object.entries(params || {}).filter(([,v]) => v)) }).toString();
    return request(`${API_ENDPOINTS.ownerDashboard.stageOrders}?${qs}`);
  },
  getOilTypeOrders: async (oilType: string, params?: Record<string, any>): Promise<ApiResponse> => {
    const qs = new URLSearchParams({ oilType, ...Object.fromEntries(Object.entries(params || {}).filter(([,v]) => v)) }).toString();
    return request(`${API_ENDPOINTS.ownerDashboard.oilTypeOrders}?${qs}`);
  },
};

export const reportsApi = {
  getReport: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.get}${queryString}`);
  },
  getDispatchReport: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.dispatchReport}${queryString}`);
  },
  getPendingSauda: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.pendingSauda}${queryString}`);
  },
  getPendingSaudaCustomer: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.pendingSaudaCustomer}${queryString}`);
  },
  getPendingSaudaDetailed: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.pendingSaudaDetailed}${queryString}`);
  },
  getPendingSaudaSku: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.pendingSaudaSku}${queryString}`);
  },
  getOilDispatchVoucher: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.oilDispatchVoucher}${queryString}`);
  },
  getDailyDispatch: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.dailyDispatch}${queryString}`);
  },
  getTransitLoss: async (params?: any): Promise<ApiResponse> => {
    const queryString = params && Object.keys(params).length
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.transitLoss}${queryString}`);
  },
};

export const commitmentPunchApi = {
  create: async (data: any): Promise<ApiResponse> =>
    request('/commitment-punch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Uses buildQuery so undefined values are never serialised to the string "undefined"
  getAll: async (params?: { page?: number; limit?: number; party_name?: string; search?: string }): Promise<ApiResponse> =>
    request(`/commitment-punch${buildQuery(params)}`),

  getPending: async (params?: { page?: number; limit?: number; search?: string; commitment_date?: string; po_date?: string; do_date?: string }): Promise<ApiResponse> =>
    request(`/commitment-punch/pending${buildQuery(params)}`),

  /** Fetch a single commitment with joined names — used as pre-fill source for the Process dialog. */
  getById: async (id: number): Promise<ApiResponse> =>
    request(`/commitment-punch/${id}`),

  /** Update planned values on a commitment (Payment Terms, Transport, Depot, etc.). */
  updateCommitment: async (id: number, data: any): Promise<ApiResponse> =>
    request(`/commitment-punch/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  processCommitment: async (id: number, data: any): Promise<ApiResponse> =>
    request(`/commitment-punch/${id}/process`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getDetails: async (id: number): Promise<ApiResponse> =>
    request(`/commitment-punch/${id}/details`),
};

export const inventoryApi = {
  getData: async (): Promise<ApiResponse> => {
    return request('/inventory/data');
  },

  upsertOpeningQty: async (data: { depo_name: string; product_name: string; opening_qty: number; is_staged?: boolean }): Promise<ApiResponse> => {
    return request('/inventory/opening-qty', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getDetail: async (depot_name: string, product_name: string, type: string): Promise<ApiResponse> => {
    const params = new URLSearchParams({ depot_name, product_name, type });
    return request(`/inventory/detail?${params}`);
  },
};

export const productionApi = {
  getByDate: async (date: string): Promise<ApiResponse> => {
    return request(`/production?date=${date}`);
  },
  getByRange: async (from: string, to: string): Promise<ApiResponse> => {
    return request(`/production?from=${from}&to=${to}`);
  },
  bulkUpsert: async (data: { date: string; items: { sku_name: string; qty: number }[] }): Promise<ApiResponse> => {
    return request('/production/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const masterHistoryApi = {
  getHistory: async (masterType: string, recordId: number | string): Promise<ApiResponse> => {
    return request(`/master-history/${masterType}/${recordId}`);
  },
  logHistory: async (data: { masterType: string; recordId: number | string; fieldName: string; oldValue?: string; newValue?: string; applicableFrom?: string }): Promise<ApiResponse> => {
    return request(`/master-history/log`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteHistory: async (id: number | string): Promise<ApiResponse> => {
    return request(`/master-history/${id}`, { method: 'DELETE' });
  },
  deleteSectionHistory: async (section: string, id: number | string): Promise<ApiResponse> => {
    return request(`/master-history/section/${section}/${id}`, { method: 'DELETE' });
  },
};

export default {
  dashboard: dashboardApi,
  reports: reportsApi,
  order: orderApi,
  preApproval: preApprovalApi,
  approval: approvalApi,
  dispatchPlanning: dispatchPlanningApi,
  actualDispatch: actualDispatchApi,
  planVehicle: planVehicleApi,
  securityGuardApproval: securityGuardApprovalApi,
  makeInvoice: makeInvoiceApi,
  checkInvoice: checkInvoiceApi,
  finalInvoice: finalInvoiceApi,
  gateOut: gateOutApi,
  unloading: unloadingApi,
  returns: returnApi,
  transportBills: transportBillApi,
  dieselBills: dieselBillApi,
  skuDetails: skuDetailsApi,
  skuSellingPrice: skuSellingPriceApi,
  common: commonApi,
  varCalc: varCalcApi,
  salesperson: salespersonApi,
  ledgerGroup: ledgerGroupApi,
  stockGroup: stockGroupApi,
  unit: unitApi,
  commitmentPunch: commitmentPunchApi,
  vehicleMaster: vehicleMasterApi,
  driverMaster: driverMasterApi,
  masterHistory: masterHistoryApi,
};
