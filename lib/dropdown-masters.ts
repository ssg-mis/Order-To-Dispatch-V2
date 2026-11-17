/**
 * Centralized Dropdown Masters Utility
 * 
 * Provides centralized fetching, caching, and formatting for all 20 reusable
 * Small / Dropdown Masters across the application (Customer Master, Broker Master,
 * Transporter Master, Vehicle Master, GST forms, e-Invoice/e-Way Bill flows).
 * 
 * Guarantees:
 * - Only ACTIVE records are returned for new dropdown selections.
 * - Inactive records remain available for historical lookups by ID.
 * - Stores and references the Unique ID, not only display text.
 * - Standardized display formats (e.g. "15159040 – Description", "CG04 – Raipur", "KGS – Kilograms").
 * - Dependent address cascading (State -> District -> Sub-District).
 */

import { lookupApi, stateApi, districtApi, subDistrictApi, type LookupType } from './api-service';

export interface DropdownOption {
  value: string; // The referenced Master Record ID
  label: string; // Formatted user-facing display label
  code?: string;
  raw?: any;     // Complete underlying master entity
  status?: string;
  parentId?: string | number; // e.g. state_id for districts, district_id for sub-districts
}

// In-memory fallback dataset initialized with standard mandatory records
export const DEFAULT_MASTER_RECORDS: Record<LookupType, any[]> = {
  is_gst_registered: [
    { id: '1', name: 'Registered', description: 'Taxable person holding valid GSTIN', status: 'Active' },
    { id: '2', name: 'Unregistered', description: 'Persons exempt or below threshold turnover limit', status: 'Active' },
  ],
  gst_registration_type: [
    { id: '1', name: 'Regular', description: 'Regular taxpayer filing normal monthly/quarterly GST returns', status: 'Active' },
    { id: '2', name: 'Composition', description: 'Composition dealer under Section 10', status: 'Active' },
  ],
  msme_registration_type: [
    { id: '1', name: 'Micro', description: 'Investment ≤ ₹1 Cr & Turnover ≤ ₹5 Cr', status: 'Active' },
    { id: '2', name: 'Small', description: 'Investment ≤ ₹10 Cr & Turnover ≤ ₹50 Cr', status: 'Active' },
    { id: '3', name: 'Medium', description: 'Investment ≤ ₹50 Cr & Turnover ≤ ₹250 Cr', status: 'Active' },
  ],
  fssai_licence_type: [
    { id: '1', name: 'Registration', description: 'Basic FSSAI registration for turnover up to ₹12 Lakhs/annum', status: 'Active' },
    { id: '2', name: 'State Licence', description: 'State licence for turnover between ₹12 Lakhs and ₹20 Cr/annum', status: 'Active' },
    { id: '3', name: 'National Licence', description: 'Central / National licence for large food business operators', status: 'Active' },
  ],
  city: [
    { id: '1', name: 'Mumbai', status: 'Active' },
    { id: '2', name: 'Pune', status: 'Active' },
    { id: '3', name: 'Raipur', status: 'Active' },
    { id: '4', name: 'Ahmedabad', status: 'Active' },
    { id: '5', name: 'Bengaluru', status: 'Active' },
    { id: '6', name: 'Jaipur', status: 'Active' },
    { id: '7', name: 'Delhi', status: 'Active' },
    { id: '8', name: 'Indore', status: 'Active' },
  ],
  post: [
    { id: '1', name: 'GPO Mumbai (400001)', status: 'Active' },
    { id: '2', name: 'Shivajinagar PO Pune (411005)', status: 'Active' },
    { id: '3', name: 'GPO Raipur (492001)', status: 'Active' },
    { id: '4', name: 'Navrangpura PO (380009)', status: 'Active' },
    { id: '5', name: 'Koramangala PO (560034)', status: 'Active' },
  ],
  thana: [
    { id: '1', name: 'Shivajinagar Police Station', status: 'Active' },
    { id: '2', name: 'Bandra Police Station', status: 'Active' },
    { id: '3', name: 'Civil Lines Thana Raipur', status: 'Active' },
    { id: '4', name: 'Navrangpura Police Station', status: 'Active' },
    { id: '5', name: 'Indiranagar Police Station', status: 'Active' },
  ],
  state: [
    { id: '1', name: 'Chhattisgarh', state_name: 'Chhattisgarh', state_code: '22', gst_state_code: '22', short_name: 'CG', status: 'Active' },
    { id: '2', name: 'Maharashtra', state_name: 'Maharashtra', state_code: '27', gst_state_code: '27', short_name: 'MH', status: 'Active' },
    { id: '3', name: 'Gujarat', state_name: 'Gujarat', state_code: '24', gst_state_code: '24', short_name: 'GJ', status: 'Active' },
    { id: '4', name: 'Karnataka', state_name: 'Karnataka', state_code: '29', gst_state_code: '29', short_name: 'KA', status: 'Active' },
    { id: '5', name: 'Delhi', state_name: 'Delhi', state_code: '07', gst_state_code: '07', short_name: 'DL', status: 'Active' },
    { id: '6', name: 'Rajasthan', state_name: 'Rajasthan', state_code: '08', gst_state_code: '08', short_name: 'RJ', status: 'Active' },
    { id: '7', name: 'Madhya Pradesh', state_name: 'Madhya Pradesh', state_code: '23', gst_state_code: '23', short_name: 'MP', status: 'Active' },
    { id: '8', name: 'Uttar Pradesh', state_name: 'Uttar Pradesh', state_code: '09', gst_state_code: '09', short_name: 'UP', status: 'Active' },
  ],
  district: [
    { id: '1', name: 'Raipur', district_name: 'Raipur', state_id: '1', state_name: 'Chhattisgarh', status: 'Active' },
    { id: '2', name: 'Bilaspur', district_name: 'Bilaspur', state_id: '1', state_name: 'Chhattisgarh', status: 'Active' },
    { id: '3', name: 'Durg', district_name: 'Durg', state_id: '1', state_name: 'Chhattisgarh', status: 'Active' },
    { id: '4', name: 'Mumbai City', district_name: 'Mumbai City', state_id: '2', state_name: 'Maharashtra', status: 'Active' },
    { id: '5', name: 'Pune', district_name: 'Pune', state_id: '2', state_name: 'Maharashtra', status: 'Active' },
    { id: '6', name: 'Thane', district_name: 'Thane', state_id: '2', state_name: 'Maharashtra', status: 'Active' },
    { id: '7', name: 'Nagpur', district_name: 'Nagpur', state_id: '2', state_name: 'Maharashtra', status: 'Active' },
    { id: '8', name: 'Ahmedabad', district_name: 'Ahmedabad', state_id: '3', state_name: 'Gujarat', status: 'Active' },
    { id: '9', name: 'Surat', district_name: 'Surat', state_id: '3', state_name: 'Gujarat', status: 'Active' },
    { id: '10', name: 'Bengaluru Urban', district_name: 'Bengaluru Urban', state_id: '4', state_name: 'Karnataka', status: 'Active' },
    { id: '11', name: 'Jaipur', district_name: 'Jaipur', state_id: '6', state_name: 'Rajasthan', status: 'Active' },
  ],
  sub_district: [
    { id: '1', name: 'Raipur', sub_district_name: 'Raipur', district_id: '1', district_name: 'Raipur', state_name: 'Chhattisgarh', status: 'Active' },
    { id: '2', name: 'Arang', sub_district_name: 'Arang', district_id: '1', district_name: 'Raipur', state_name: 'Chhattisgarh', status: 'Active' },
    { id: '3', name: 'Haveli', sub_district_name: 'Haveli', district_id: '5', district_name: 'Pune', state_name: 'Maharashtra', status: 'Active' },
    { id: '4', name: 'Pune City', sub_district_name: 'Pune City', district_id: '5', district_name: 'Pune', state_name: 'Maharashtra', status: 'Active' },
    { id: '5', name: 'Andheri', sub_district_name: 'Andheri', district_id: '4', district_name: 'Mumbai City', state_name: 'Maharashtra', status: 'Active' },
    { id: '6', name: 'Thane West', sub_district_name: 'Thane West', district_id: '6', district_name: 'Thane', state_name: 'Maharashtra', status: 'Active' },
    { id: '7', name: 'Daskroi', sub_district_name: 'Daskroi', district_id: '8', district_name: 'Ahmedabad', state_name: 'Gujarat', status: 'Active' },
  ],
  bank_name: [
    { id: '1', name: 'State Bank of India', status: 'Active' },
    { id: '2', name: 'HDFC Bank', status: 'Active' },
    { id: '3', name: 'ICICI Bank', status: 'Active' },
    { id: '4', name: 'Axis Bank', status: 'Active' },
    { id: '5', name: 'Kotak Mahindra Bank', status: 'Active' },
    { id: '6', name: 'Punjab National Bank', status: 'Active' },
    { id: '7', name: 'Bank of Baroda', status: 'Active' },
  ],
  transaction_type: [
    { id: '1', name: 'NEFT', status: 'Active' },
    { id: '2', name: 'RTGS', status: 'Active' },
    { id: '3', name: 'IMPS', status: 'Active' },
    { id: '4', name: 'UPI', status: 'Active' },
    { id: '5', name: 'Cheque', status: 'Active' },
    { id: '6', name: 'Cash', status: 'Active' },
    { id: '7', name: 'Bank Transfer', status: 'Active' },
  ],
  uqc: [
    { id: '1', code: 'KGS', name: 'Kilograms', status: 'Active' },
    { id: '2', code: 'NOS', name: 'Numbers / Pieces', status: 'Active' },
    { id: '3', code: 'BTL', name: 'Bottles', status: 'Active' },
    { id: '4', code: 'PCS', name: 'Pieces', status: 'Active' },
    { id: '5', code: 'MTR', name: 'Meters', status: 'Active' },
    { id: '6', code: 'KLR', name: 'Kilolitres', status: 'Active' },
    { id: '7', code: 'TON', name: 'Metric Tonnes', status: 'Active' },
    { id: '8', code: 'BOX', name: 'Boxes', status: 'Active' },
  ],
  gst_rate: [
    { id: '1', name: 'GST 0% (Nil Rated)', rate: '0', status: 'Active' },
    { id: '2', name: 'GST 5% (Essential Goods)', rate: '5', status: 'Active' },
    { id: '3', name: 'GST 12% (Standard Low)', rate: '12', status: 'Active' },
    { id: '4', name: 'GST 18% (Standard Rate)', rate: '18', status: 'Active' },
    { id: '5', name: 'GST 28% (Luxury / Special)', rate: '28', status: 'Active' },
  ],
  hsn_code: [
    { id: '1', code: '15121110', hsn_code: '15121110', name: 'Sunflower seed oil (Crude)', description: 'Sunflower seed oil (Crude)', status: 'Active' },
    { id: '2', code: '15121910', hsn_code: '15121910', name: 'Refined Sunflower seed oil, edible grade', description: 'Refined Sunflower seed oil, edible grade', status: 'Active' },
    { id: '3', code: '15119020', hsn_code: '15119020', name: 'Refined Bleached Deodorised Palm oil', description: 'Refined Bleached Deodorised Palm oil', status: 'Active' },
    { id: '4', code: '15079010', hsn_code: '15079010', name: 'Refined Soya bean oil, edible grade', description: 'Refined Soya bean oil, edible grade', status: 'Active' },
    { id: '5', code: '15141910', hsn_code: '15141910', name: 'Refined Mustard oil, edible grade', description: 'Refined Mustard oil, edible grade', status: 'Active' },
    { id: '6', code: '15159040', hsn_code: '15159040', name: 'Rice bran oil, refined edible grade', description: 'Rice bran oil, refined edible grade', status: 'Active' },
  ],
  sac_code: [
    { id: '1', code: '996511', sac_code: '996511', name: 'Road transport services of goods by trucks/tankers', description: 'Road transport services of goods by trucks/tankers', status: 'Active' },
    { id: '2', code: '996711', sac_code: '996711', name: 'Container handling services', description: 'Container handling services', status: 'Active' },
    { id: '3', code: '996721', sac_code: '996721', name: 'Bulk liquid storage and warehousing services', description: 'Bulk liquid storage and warehousing services', status: 'Active' },
    { id: '4', code: '996519', sac_code: '996519', name: 'Other goods transport services by road', description: 'Other goods transport services by road', status: 'Active' },
  ],
  type_of_supply: [
    { id: '1', name: 'Intra-State Supply (CGST + SGST)', status: 'Active' },
    { id: '2', name: 'Inter-State Supply (IGST)', status: 'Active' },
    { id: '3', name: 'Export with Payment of Tax', status: 'Active' },
    { id: '4', name: 'Export without Payment of Tax (LUT)', status: 'Active' },
    { id: '5', name: 'Deemed Export', status: 'Active' },
    { id: '6', name: 'SEZ Supply with Payment of Tax', status: 'Active' },
    { id: '7', name: 'SEZ Supply without Payment of Tax', status: 'Active' },
  ],
  vehicle_type: [
    { id: '1', name: 'Tanker (Oil / Bulk Liquid)', status: 'Active' },
    { id: '2', name: 'Heavy Goods Truck (Multi-Axle)', status: 'Active' },
    { id: '3', name: 'Open Body Truck', status: 'Active' },
    { id: '4', name: 'Container / Closed Body', status: 'Active' },
    { id: '5', name: 'LCV (Light Commercial Vehicle)', status: 'Active' },
    { id: '6', name: 'Trailer', status: 'Active' },
  ],
  fuel_type: [
    { id: '1', name: 'Diesel', pucc_applicable: 'Applicable', status: 'Active' },
    { id: '2', name: 'Petrol', pucc_applicable: 'Applicable', status: 'Active' },
    { id: '3', name: 'CNG', pucc_applicable: 'Applicable', status: 'Active' },
    { id: '4', name: 'Electric (EV)', pucc_applicable: 'Not Applicable', status: 'Active' },
    { id: '5', name: 'Hybrid', pucc_applicable: 'Applicable', status: 'Active' },
  ],
  rto_code: [
    { id: '1', code: 'CG04', name: 'Raipur RTO', rto_name: 'Raipur', status: 'Active' },
    { id: '2', code: 'MH12', name: 'Pune RTO (Maharashtra)', rto_name: 'Pune', status: 'Active' },
    { id: '3', code: 'MH01', name: 'Mumbai South RTO (Tardeo)', rto_name: 'Mumbai South', status: 'Active' },
    { id: '4', code: 'MH04', name: 'Thane RTO', rto_name: 'Thane', status: 'Active' },
    { id: '5', code: 'GJ01', name: 'Ahmedabad RTO (Gujarat)', rto_name: 'Ahmedabad', status: 'Active' },
    { id: '6', code: 'KA01', name: 'Bengaluru Central (Koramangala)', rto_name: 'Bengaluru Central', status: 'Active' },
    { id: '7', code: 'DL01', name: 'Delhi North (Mall Road)', rto_name: 'Delhi North', status: 'Active' },
  ],
  stock_category: [
    { id: '1', name: 'Bulk Packaging', status: 'Active' },
    { id: '2', name: 'Retail Packaging', status: 'Active' },
  ],
  oil_type: [
    { id: '1', name: 'Rice Bran Refined Oil', status: 'Active' },
    { id: '2', name: 'Soya Bean Refined Oil', status: 'Active' },
    { id: '3', name: 'Palm Olein Refined Oil', status: 'Active' },
  ],
};

/**
 * Format standard label for specific master types according to application requirements
 */
export function formatDropdownLabel(type: LookupType, item: any): string {
  if (!item) return '';

  switch (type) {
    case 'uqc':
      return item.code ? `${item.code} – ${item.name || item.description || ''}` : item.name;

    case 'gst_rate':
      if (item.rate !== undefined && item.rate !== null) {
        return `${item.rate}%${item.name ? ` (${item.name})` : ''}`;
      }
      return item.name || '';

    case 'hsn_code': {
      const code = item.code || item.hsn_code || '';
      const desc = item.description || item.name || '';
      return code && desc ? `${code} – ${desc}` : code || desc;
    }

    case 'sac_code': {
      const code = item.code || item.sac_code || '';
      const desc = item.description || item.name || '';
      return code && desc ? `${code} – ${desc}` : code || desc;
    }

    case 'rto_code': {
      const code = item.code || '';
      const rto = item.rto_name || item.name || '';
      return code && rto ? `${code} – ${rto}` : code || rto;
    }

    case 'state': {
      const stateName = item.state_name || item.name || '';
      const code = item.gst_state_code || item.state_code || '';
      return [code, item.short_name, stateName].filter(Boolean).join(' ');
    }

    case 'district': {
      const distName = item.district_name || item.name || '';
      const stateName = item.state_name || (item.state ? item.state.state_name : '');
      return stateName ? `${distName} (${stateName})` : distName;
    }

    case 'sub_district': {
      const subName = item.sub_district_name || item.name || '';
      const distName = item.district_name || '';
      return distName ? `${subName} (Dist: ${distName})` : subName;
    }

    case 'bank_name':
      return formatBankLabel(item);

    case 'fuel_type': {
      const pucc = item.pucc_applicable ?? item.puccApplicable;
      if (pucc === undefined || pucc === null || pucc === '') return item.name;
      const puccText = pucc === false || pucc === 'false' || pucc === 'Not Applicable' ? 'Not Applicable' : 'Applicable';
      return `${item.name} (PUCC: ${puccText})`;
    }

    default:
      return item.name || item.label || String(item.id || '');
  }
}

/** Bank dropdown label: "State Bank of India (India)" - the country in brackets when one is set. */
export function formatBankLabel(item: any): string {
  const name = String(item?.name ?? '').trim();
  const country = String(item?.country ?? '').trim();
  return country ? `${name} (${country})` : name;
}

/** Hidden search text for a bank option, so typing the short name (SBI, PNB...) finds the bank. */
export function bankSearchKeywords(item: any): string {
  return [item?.short_name, item?.shortName].filter(Boolean).join(' ');
}

/** Masters whose natural order is NOT alphabetical (lower number = listed first; unknown names go last). */
const FIXED_ORDER: Partial<Record<LookupType, string[]>> = {
  msme_registration_type: ['not applicable', 'micro', 'small', 'medium'],
  fssai_licence_type: ['registration', 'state licence', 'national licence'],
};

/** System rows shown with a "Primary" badge and locked (no edit / deactivate). */
const PRIMARY_ROWS: Partial<Record<LookupType, string[]>> = {
  msme_registration_type: ['not applicable'],
};

export function isPrimaryMasterRecord(type: LookupType, item: any): boolean {
  const names = PRIMARY_ROWS[type];
  return !!names && names.includes(String(item?.name ?? '').trim().toLowerCase());
}

/** Comparator that applies a master's fixed business order; returns 0 for masters without one. */
export function compareMasterRecords(type: LookupType, a: any, b: any): number {
  const order = FIXED_ORDER[type];
  if (!order) return 0;
  const rank = (item: any) => {
    const i = order.indexOf(String(item?.name ?? '').trim().toLowerCase());
    return i === -1 ? order.length : i;
  };
  return rank(a) - rank(b);
}

/**
 * Fetch and format active dropdown options for any of the 20 small masters
 */
export async function getActiveDropdownOptions(
  type: LookupType,
  filterParams?: { state_id?: string | number; district_id?: string | number; [key: string]: any }
): Promise<DropdownOption[]> {
  try {
    let items: any[] = [];

    if (type === 'state') {
      const res = await stateApi.getAll({ all: 'true', ...filterParams });
      if (res.success && res.data?.states) items = res.data.states;
    } else if (type === 'district') {
      const res = await districtApi.getAll({ all: 'true', ...filterParams });
      if (res.success && res.data?.districts) items = res.data.districts;
    } else if (type === 'sub_district') {
      const res = await subDistrictApi.getAll({ all: 'true', ...filterParams });
      if (res.success && (res.data?.sub_districts || res.data?.subDistricts)) {
        items = res.data.sub_districts || res.data.subDistricts;
      }
    } else {
      const res = await lookupApi.getAll(type, { all: 'true', ...filterParams });
      if (res.success && res.data?.items) items = res.data.items;
    }

    // Fallback to local default records if backend list is empty
    if (!items || items.length === 0) {
      items = DEFAULT_MASTER_RECORDS[type] || [];
      if (filterParams?.state_id && type === 'district') {
        items = items.filter(d => String(d.state_id) === String(filterParams.state_id));
      }
      if (filterParams?.district_id && type === 'sub_district') {
        items = items.filter(sd => String(sd.district_id) === String(filterParams.district_id));
      }
    }

    // Filter to only ACTIVE records for new dropdown selections
    const activeItems = items
      .filter((item: any) => item.status === 'Active' || item.status === undefined)
      .sort((a: any, b: any) => compareMasterRecords(type, a, b));

    return activeItems.map((item: any) => ({
      value: String(item.id),
      label: formatDropdownLabel(type, item),
      code: item.code || item.hsn_code || item.sac_code || item.gst_state_code,
      parentId: item.state_id || item.district_id,
      status: item.status || 'Active',
      raw: item,
    }));
  } catch (error) {
    console.warn(`[DropdownMasters] Failed fetching ${type} from backend, using default seed:`, error);
    let fallback = DEFAULT_MASTER_RECORDS[type] || [];
    if (filterParams?.state_id && type === 'district') {
      fallback = fallback.filter(d => String(d.state_id) === String(filterParams.state_id));
    }
    if (filterParams?.district_id && type === 'sub_district') {
      fallback = fallback.filter(sd => String(sd.district_id) === String(filterParams.district_id));
    }
    return fallback
      .filter(item => item.status === 'Active')
      .map(item => ({
        value: String(item.id),
        label: formatDropdownLabel(type, item),
        code: item.code || item.hsn_code || item.sac_code || item.gst_state_code,
        parentId: item.state_id || item.district_id,
        status: item.status || 'Active',
        raw: item,
      }));
  }
}
