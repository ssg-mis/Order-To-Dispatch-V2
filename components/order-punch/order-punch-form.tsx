"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUploadField } from "@/components/file-upload-field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Save, FileUp, Plus, Trash2, CalendarIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { orderApi, customerApi, depotApi, skuApi, brokerApi, salespersonApi, conversionFormulaApi } from "@/lib/api-service"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { fetchCustomerDropdownOptions } from "@/components/order-punch/customer-dropdown"
import { useStatesMap } from "@/hooks/use-states-map"
import { useCustomerAddresses, formatCustomerAddress, type CustomerAddressOption } from "@/hooks/use-customer-addresses"
import { format } from "date-fns"
import { cn, fuzzyMatch } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Chandigarh", "Puducherry",
  "Andaman and Nicobar Islands", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep",
]

function extractState(addr: string): string | null {
  if (!addr) return null
  const lower = addr.toLowerCase()
  for (const s of INDIAN_STATES) {
    if (lower.includes(s.toLowerCase())) return s
  }
  return null
}

type ProductItem = {
  id: string
  skuId?: number
  productName: string
  uom: string
  orderQty: string
  altUom: string
  altQty: string
  rate: string
  ratePer15Kg: string
  ratePerLtr: string
  oilType: string
  skuWeight: string
  nosPerMainUom: string
}

type PreApprovalProduct = {
  id: string
  oilType: string
  ratePer15Kg: string
  ratePerLtr: string
}

const forwardEvaluateSteps = (baseRate: number, steps: any[]): number => {
  let result = baseRate;
  if (!steps || steps.length === 0) return result;
  
  for (const step of steps) {
    const operand = parseFloat(step.operand_value) || 0;
    switch (step.operation) {
      case 'add': result += operand; break;
      case 'subtract': result -= operand; break;
      case 'multiply': result *= operand; break;
      case 'divide': if (operand !== 0) result /= operand; break;
    }
  }
  return result;
};

interface OrderPunchFormProps {
  /** Called when the user clicks Cancel. Omit to hide/no-op the button (used
   * standalone, e.g. on the /order-punch/create page). */
  onCancel?: () => void
  /** Called after an order is successfully created, with the generated DO number. */
  onSuccess?: (orderNo: string) => void
}

export function OrderPunchForm({ onCancel, onSuccess }: OrderPunchFormProps) {
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isLoading: isAuthLoading } = useAuth()

  // New state for customers
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  // New state for depots
  const [depots, setDepots] = useState<any[]>([])
  const [isLoadingDepots, setIsLoadingDepots] = useState(false)

  // New state for SKUs
  const [skus, setSkus] = useState<any[]>([])
  const skuRegistryRef = useRef<Record<string, any>>({})
  const [isLoadingSkus, setIsLoadingSkus] = useState(false)

  // New state for Brokers
  const [brokers, setBrokers] = useState<any[]>([])
  const [isLoadingBrokers, setIsLoadingBrokers] = useState(false)

  // New state for Salespersons
  const [salespersons, setSalespersons] = useState<any[]>([])
  const [isLoadingSalespersons, setIsLoadingSalespersons] = useState(false)

  // New state for Conversion Formulas
  const [conversionFormulas, setConversionFormulas] = useState<any[]>([])
  const [isLoadingFormulas, setIsLoadingFormulas] = useState(false)

  const fetchFormulas = async () => {
    try {
      setIsLoadingFormulas(true)
      const response = await conversionFormulaApi.getAll({ all: "true" })
      if (response.success) {
        setConversionFormulas(response.data.conversion_formulas || response.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch formulas:", error)
    } finally {
      setIsLoadingFormulas(false)
    }
  }

  // Function to fetch customers - declared before useEffect
  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true)
      const response = await customerApi.getAll({ all: "true" })
      if (response.success) {
        // Correctly extract customers array from paginated response
        const customerData = response.data.customers || (Array.isArray(response.data) ? response.data : [])
        setCustomers(customerData)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
      toast({
        title: "Error",
        description: "Failed to load customer list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  // Function to fetch depots
  const fetchDepots = async () => {
    try {
      setIsLoadingDepots(true)
      const response = await depotApi.getAll({ all: "true" })
      if (response.success) {
        // Correctly extract depots array from paginated response
        const depotData = response.data.depots || (Array.isArray(response.data) ? response.data : [])
        setDepots(depotData)
      }
    } catch (error) {
      console.error("Failed to fetch depots:", error)
      toast({
        title: "Error",
        description: "Failed to load depot list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingDepots(false)
    }
  }

  // Godown gates the Customer picker: changing it clears any already-selected
  // customer that isn't tagged to the newly-selected Godown (re-checked via a
  // real backend query, not just cleared unconditionally).
  const handleDepoChange = async (val: string) => {
    setDepoName(val)
    if (!customerName) return
    const selectedDepot = depots.find(d => d.depot_name === val)
    if (!selectedDepot) { setCustomerName(""); return }
    const [name, gstin] = customerName.split('|')
    try {
      const res = await customerApi.getAll({ search: name, depot_id: selectedDepot.id, limit: 10 })
      const list = res.success ? (res.data.customers || []) : []
      const stillValid = list.some((c: any) => c.customer_name === name && (c.gstin || '') === gstin)
      if (!stillValid) {
        setCustomerName("")
        toast({ title: "Customer cleared", description: "The previously selected customer isn't tagged to this Godown.", variant: "destructive" })
      }
    } catch {
      setCustomerName("")
    }
  }

  // Function to fetch SKUs
  const fetchSkus = async () => {
    try {
      setIsLoadingSkus(true)
      const response = await skuApi.getAll({ all: "true" })
      if (response.success) {
        const skuData = response.data.skuDetails || (Array.isArray(response.data) ? response.data : [])
        skuData.forEach((s: any) => { if (s.sku_name) skuRegistryRef.current[s.sku_name] = s })
        setSkus(skuData)
      }
    } catch (error) {
      console.error("Failed to fetch SKUs:", error)
      toast({
        title: "Error",
        description: "Failed to load product list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSkus(false)
    }
  }

  // Function to fetch Brokers
  const fetchBrokers = async () => {
    try {
      setIsLoadingBrokers(true)
      const response = await brokerApi.getAll({ all: "true" })
      if (response.success) {
        // Correctly extract brokers array from paginated response
        const brokerData = response.data.brokers || (Array.isArray(response.data) ? response.data : [])
        setBrokers(brokerData)
      }
    } catch (error) {
      console.error("Failed to fetch brokers:", error)
      toast({
        title: "Error",
        description: "Failed to load broker list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingBrokers(false)
    }
  }

  // Function to fetch Salespersons
  const fetchSalespersons = async () => {
    try {
      setIsLoadingSalespersons(true)
      const response = await salespersonApi.getAll({ all: "true" })
      if (response.success) {
        // Correctly extract salespersons array from paginated response
        const salespersonData = response.data.salespersons || (Array.isArray(response.data) ? response.data : [])
        setSalespersons(salespersonData)
      }
    } catch (error) {
      console.error("Failed to fetch salespersons:", error)
      toast({
        title: "Error",
        description: "Failed to load salesperson list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSalespersons(false)
    }
  }

type OrderThroughType =  "Broker" | "Direct" | "Salesperson"


  const [products, setProducts] = useState<ProductItem[]>([
    { id: "1", productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "", skuWeight: "", nosPerMainUom: "" },
  ])
  const [customerType, setCustomerType] = useState<string>("existing")
  const [depoName, setDepoName] = useState<string>("")
  const [isBrokerOrder, setIsBrokerOrder] = useState<OrderThroughType>("Direct")
  const orderThrough = isBrokerOrder
  const setOrderThrough = setIsBrokerOrder
  const [orderPurpose, setOrderPurpose] = useState<string>("week-on-week")
  const [orderType, setOrderType] = useState<string>("regular")
  const [advancePaymentTaken, setAdvancePaymentTaken] = useState<string>("NO")
  // Set DO Date to today's date by default
  const [soDate, setSoDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [customerName, setCustomerName] = useState<string>("")
  const [gst, setGst] = useState<string>("") // New state for GST
  const [contactPerson, setContactPerson] = useState<string>("")
  const [whatsappNo, setWhatsappNo] = useState<string>("")
  const [whatsappNoError, setWhatsappNoError] = useState<string>("")
  const [customerAddress, setCustomerAddress] = useState<string>("")
  const [deliveryAddress, setDeliveryAddress] = useState<string>("")
  const [sameAsCustomerAddress, setSameAsCustomerAddress] = useState<boolean>(true)
  const [orderCategory, setOrderCategory] = useState<string>("Sales")

  // Pre-Approval Products State
  const [preApprovalProducts, setPreApprovalProducts] = useState<PreApprovalProduct[]>([])

  // Current Pre-Approval Input State
  const [currentPreApproval, setCurrentPreApproval] = useState({
    oilType: "Palm Oil",
    ratePer15Kg: "",
    ratePerLtr: ""
  })

  const [brokerName, setBrokerName] = useState<string>("Ashish Motwani")
  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [deliveryDateError, setDeliveryDateError] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [paymentTerms, setPaymentTerms] = useState<string>("7days")
  const [transportType, setTransportType] = useState<string>("self")
  const [advanceAmount, setAdvanceAmount] = useState<string>("")
  const [futurePeriodDate, setFuturePeriodDate] = useState<string>("") // New state for future period date
  const [orderPunchRemarks, setOrderPunchRemarks] = useState<string>("")
  const [soFile, setSoFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeliveryDatePickerOpen, setIsDeliveryDatePickerOpen] = useState(false)
  const [isFuturePeriodDatePickerOpen, setIsFuturePeriodDatePickerOpen] = useState(false)
  const [salespersonName, setSalespersonName] = useState<string>("")
  const [gstSupplyType, setGstSupplyType] = useState<"INTRA" | "INTER">("INTRA")
  const [gstRatePercent, setGstRatePercent] = useState<string>("5")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSoFile(e.target.files[0])
    }
  }

  // Fetch customers, depots, SKUs, and brokers on mount
  useEffect(() => {
    fetchCustomers()
    fetchDepots()
    fetchSkus()
    fetchBrokers()
    fetchSalespersons()
    fetchFormulas()
  }, [])

  useEffect(() => {
    const allowedDepos = user?.depo_access?.['Order Punch'] || []
    const banari = allowedDepos.find((d: string) => d.toLowerCase() === "banari")
    setDepoName(banari || (allowedDepos.length > 0 ? allowedDepos[0] : "Banari"))
  }, [user])

  // Admins/Super Admins always see every option; other users only see the values
  // granted to them under Settings > Order Punch Field Access. Default is no access.
  const allowedOrderThroughTypes: string[] = isAdmin
    ? ["Direct", "Broker", "Salesperson"]
    : (user?.features?.order_punch_access?.is_order_through || [])
  const allowedBrokerNames: string[] | null = isAdmin
    ? null
    : (user?.features?.order_punch_access?.broker_name || [])
  const allowedSalespersonNames: string[] | null = isAdmin
    ? null
    : (user?.features?.order_punch_access?.salesperson_name || [])
  const allowedOrderTypes: string[] = isAdmin
    ? ["regular", "pre-approval"]
    : (user?.features?.order_punch_access?.order_type || [])
  const allowedOrderCategories: string[] = isAdmin
    ? ["Sales", "Stock Transfer"]
    : (user?.features?.order_punch_access?.order_category || [])

  useEffect(() => {
    if (isAdmin || !user) return
    if (allowedOrderThroughTypes.length === 0) {
      setOrderThrough("Direct")
    } else if (!allowedOrderThroughTypes.includes(orderThrough)) {
      setOrderThrough(allowedOrderThroughTypes[0] as OrderThroughType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin])

  useEffect(() => {
    if (isAdmin || !user || orderThrough !== "Broker" || !allowedBrokerNames) return
    const activeBrokerSet = new Set(
      brokers.filter(b => (b.status || "").toLowerCase() === "active").map(b => (b.salesman_name || "").toLowerCase())
    )
    const activeAllowedBrokerNames = allowedBrokerNames.filter(b => activeBrokerSet.has(b.toLowerCase()))
    if (activeAllowedBrokerNames.length === 0) {
      setBrokerName("")
    } else if (!activeAllowedBrokerNames.some((b: string) => b.toLowerCase() === brokerName.toLowerCase())) {
      setBrokerName(activeAllowedBrokerNames[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, orderThrough, brokers])

  useEffect(() => {
    if (isAdmin || !user || isBrokerOrder !== "Salesperson" || !allowedSalespersonNames) return
    const activeSalespersonSet = new Set(
      salespersons.filter(s => (s.status || "").toLowerCase() === "active").map(s => (s.salesman_name || "").toLowerCase())
    )
    const activeAllowedSalespersonNames = allowedSalespersonNames.filter(s => activeSalespersonSet.has(s.toLowerCase()))
    if (activeAllowedSalespersonNames.length === 0) {
      setSalespersonName("")
    } else if (!activeAllowedSalespersonNames.some((s: string) => s.toLowerCase() === salespersonName.toLowerCase())) {
      setSalespersonName(activeAllowedSalespersonNames[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, isBrokerOrder, salespersons])

  useEffect(() => {
    if (isAdmin || !user) return
    if (allowedOrderTypes.length === 0) {
      setOrderType("")
    } else if (!allowedOrderTypes.includes(orderType)) {
      setOrderType(allowedOrderTypes[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin])

  useEffect(() => {
    if (isAdmin || !user) return
    if (allowedOrderCategories.length === 0) {
      setOrderCategory("")
    } else if (!allowedOrderCategories.includes(orderCategory)) {
      setOrderCategory(allowedOrderCategories[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin])

  // Customer Auto-fill Effect
  useEffect(() => {
    if (customerType === "existing" && customerName) {
      // Find customer in the fetched list using unique combination
      const [name, gstin] = customerName.split('|')
      const selectedCustomer = customers.find(c => c.customer_name === name && (c.gstin || '') === gstin)

      if (selectedCustomer) {
        setGst(selectedCustomer.gstin || "")
        setContactPerson(selectedCustomer.contact_person || "")
        setWhatsappNo(selectedCustomer.contact || "") // Using 'contact' field for WhatsApp

        // Construct full address
        const parts = [
          selectedCustomer.address_line_1,
          selectedCustomer.address_line_2,
          selectedCustomer.state,
          selectedCustomer.pincode
        ].filter(Boolean)

        setCustomerAddress(parts.join(", "))
      }
    } else if (customerType === "new") {
        setGst("")
    }
  }, [customerName, customerType, customers])

  // Pre-Approval Rate Auto-fill Effect
  useEffect(() => {
    if (orderType !== "pre-approval" || conversionFormulas.length === 0) return;

    let changed = false;
    const newProducts = products.map(p => {
      if (!p.productName) return p;

      const productNameLower = p.productName.toLowerCase();
      let oilTypeVal = "";
      if (productNameLower.includes("palm") || productNameLower.includes("p.o.") || productNameLower.includes(" po ")) oilTypeVal = "Palm Oil";
      else if (productNameLower.includes("rice") || productNameLower.includes("r.o.") || productNameLower.includes(" ro ") || productNameLower.includes("rbo")) oilTypeVal = "Rice Oil";
      else if (productNameLower.includes("soya") || productNameLower.includes("s.o.") || productNameLower.includes(" so ") || productNameLower.includes("sbo")) oilTypeVal = "Soya Oil";

      if (!oilTypeVal) return p;

      const matchedRate = preApprovalProducts.find(pap => pap.oilType.toLowerCase() === oilTypeVal.toLowerCase());
      if (!matchedRate) return p;

      const baseRate15kg = parseFloat(matchedRate.ratePer15Kg) || 0;
      const baseRateLtr = parseFloat(matchedRate.ratePerLtr) || 0;

      const formula = conversionFormulas.find(f => f.child_item_id === p.skuId || f.child_sku_name === p.productName);
      let newRate = p.rate;

      if (formula) {
        const baseName = (formula.base_sku_name || '').toUpperCase();
        const isLtrBase = baseName.includes('1 LTR') || baseName.includes('1LTR');
        const baseRate = isLtrBase ? baseRateLtr : baseRate15kg;

        newRate = baseRate.toString();
        if (formula.steps && formula.steps.length > 0) {
           newRate = forwardEvaluateSteps(baseRate, formula.steps).toString();
        }
      } else {
        // Fallback for base items that don't have a conversion formula
        const nameUpper = p.productName.toUpperCase();
        if (nameUpper.includes("15 KG") || nameUpper.includes("15KG")) {
           newRate = baseRate15kg.toString();
        } else if (nameUpper.includes("1 LTR") || nameUpper.includes("1LTR") || nameUpper.includes("1 LITER")) {
           newRate = baseRateLtr.toString();
        } else {
           return p;
        }
      }

      if (p.rate !== newRate) {
        changed = true;
        return { ...p, rate: newRate };
      }
      return p;
    });

    if (changed) {
      setProducts(newProducts);
    }
  }, [products, preApprovalProducts, orderType, conversionFormulas]);

  // Track which fields are auto-filled from the database
  const selectedCustomerRecord = customerType === "existing" && customerName 
    ? (() => {
        const [name, gstin] = customerName.split('|')
        return customers.find(c => c.customer_name === name && (c.gstin || '') === gstin)
      })()
    : null;

  const isContactPersonAutoFilled = !!(selectedCustomerRecord && selectedCustomerRecord.contact_person);
  const isWhatsappNoAutoFilled = !!(selectedCustomerRecord && selectedCustomerRecord.contact && /^\d{10}$/.test(selectedCustomerRecord.contact));
  const isAddressAutoFilled = !!(selectedCustomerRecord && (
    selectedCustomerRecord.address_line_1 ||
    selectedCustomerRecord.address_line_2 ||
    selectedCustomerRecord.state ||
    selectedCustomerRecord.pincode
  ));

  // Multi-address support (Section 10): a customer's addresses are its default
  // row plus any extra customer_addresses rows - the picker below only appears
  // when there's more than one to choose from.
  const statesById = useStatesMap()
  const [selectedAddressId, setSelectedAddressId] = useState<"default" | number>("default")
  const { addresses: customerAddressOptions, hasMultiple: hasMultipleAddresses } = useCustomerAddresses(selectedCustomerRecord?.id ?? null, statesById)

  useEffect(() => {
    setSelectedAddressId("default")
  }, [selectedCustomerRecord?.id])

  useEffect(() => {
    const picked = customerAddressOptions.find((a: CustomerAddressOption) => a.id === selectedAddressId)
    if (picked) setCustomerAddress(formatCustomerAddress(picked))
  }, [selectedAddressId, customerAddressOptions])

  // Week on Week / Future Period Date Logic - Initialize Start Date from DO Date
  useEffect(() => {
    if (orderPurpose === "week-on-week" || orderPurpose === "future-period") {
      // If DO Date (soDate) is set, use it as Start Date; otherwise use today
      if (soDate) {
        setStartDate(soDate)
      } else if (!startDate) {
        setStartDate(new Date().toISOString().split("T")[0])
      }
    }
  }, [orderPurpose, soDate])

  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      setEndDate(end.toISOString().split("T")[0])
    }
  }, [startDate])

  // Validate Expected Delivery Date is within Start Date to End Date range
  useEffect(() => {
    if (deliveryDate && startDate && endDate && orderPurpose === "week-on-week") {
      const delivery = new Date(deliveryDate)
      const start = new Date(startDate)
      const end = new Date(endDate)

      if (delivery < start || delivery > end) {
        setDeliveryDateError(`You selected a date not between the start and end date (${startDate} to ${endDate})`)
      } else {
        setDeliveryDateError("")
      }
    } else {
      setDeliveryDateError("")
    }
  }, [deliveryDate, startDate, endDate, orderPurpose])

  // Same as Customer Address Logic
  useEffect(() => {
    if (sameAsCustomerAddress) {
      setDeliveryAddress(customerAddress)
    }
  }, [sameAsCustomerAddress, customerAddress])

  // Handle Order Category Change Logic
  useEffect(() => {
    if (orderCategory === "Stock Transfer") {
      setIsBrokerOrder("Direct")
    }
  }, [orderCategory])

  // Dynamic validation for WhatsApp number
  useEffect(() => {
    if (!whatsappNo) {
      setWhatsappNoError("")
      return
    }
    const digits = whatsappNo.replace(/\D/g, "")
    if (digits.length !== 10) {
      setWhatsappNoError("WhatsApp number must be exactly 10 digits")
    } else {
      setWhatsappNoError("")
    }
  }, [whatsappNo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Customer must be selected/entered before anything else
    const enteredCustomerName = customerType === "existing"
      ? (customerName.split('|')[0] || "").trim()
      : customerName.trim()
    if (!enteredCustomerName) {
      toast({
        title: "Customer Required",
        description: "Please select a customer before submitting the order.",
        variant: "destructive",
      })
      return
    }

    // Validate WhatsApp number: min and max 10 digits
    const cleanedWhatsapp = whatsappNo.replace(/\D/g, "")
    if (cleanedWhatsapp.length !== 10) {
      toast({
        title: "Validation Error",
        description: "Customer contact person WhatsApp number must be exactly 10 digits.",
        variant: "destructive",
      })
      setWhatsappNoError("WhatsApp number must be exactly 10 digits")
      return
    }

    // Validate based on Order Type
    if (orderType === "regular" || orderType === "pre-approval") {
      // For regular and pre-approval, validate products
      const invalidProduct = products.find((p) =>
        !p.productName ||
        !p.orderQty || parseFloat(p.orderQty) <= 0 ||
        (orderCategory !== "Stock Transfer" && (!p.rate || parseFloat(p.rate) <= 0))
      )

      if (depoName && invalidProduct) {
        let errorDesc = "Please fill in product details for all rows."
        if (!invalidProduct.productName) {
          errorDesc = "Please select a product for all rows."
        } else if (!invalidProduct.orderQty || parseFloat(invalidProduct.orderQty) <= 0) {
          errorDesc = `Order Quantity is mandatory and must be greater than 0 for ${invalidProduct.productName || 'the selected product'}.`
        } else if (!invalidProduct.rate || parseFloat(invalidProduct.rate) <= 0) {
          errorDesc = `Rate is mandatory and must be greater than 0 for ${invalidProduct.productName || 'the selected product'}.`
        }

        toast({
          title: "Validation Error",
          description: errorDesc,
          variant: "destructive",
        })
        return
      }
    }

    // Validate dates based on orderPurpose
    if (orderPurpose === "future-period" || orderPurpose === "week-on-week") {
      if (!startDate) {
        toast({
          title: "Validation Error",
          description: "Please select a start date.",
          variant: "destructive",
        })
        return
      }

      if (orderPurpose === "week-on-week" && !deliveryDate) {
        toast({
          title: "Validation Error",
          description: "Please select an expected delivery date.",
          variant: "destructive",
        })
        return
      }

      if (orderPurpose === "future-period" && !futurePeriodDate) {
        toast({
          title: "Validation Error",
          description: "Please select a future period date.",
          variant: "destructive",
        })
        return
      }
    }

    if (!orderType) {
      toast({
        title: "Validation Error",
        description: "Please select an order type.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      let uploadedSoUrl = null

      // Upload SO Copy if selected
      if (soFile) {
        try {
          const uploadResponse = await orderApi.uploadFile(soFile)
          if (uploadResponse.success) {
            uploadedSoUrl = uploadResponse.data.url
          }
        } catch (uploadError) {
          console.error('Error uploading SO copy:', uploadError)
          toast({
            title: "Upload Error",
            description: "Failed to upload SO copy. Order will be submitted without it.",
            variant: "destructive",
          })
        }
      }

      // Prepare data for backend API
      const customerNameValue = customerType === "existing" ? customerName.split('|')[0] : customerName

      // v2 requires a real customer FK - a "new" (not-yet-in-master) customer
      // has no id to send. Master-data self-serve creation isn't migrated yet,
      // so block here rather than silently submitting an unresolvable order.
      if (!selectedCustomerRecord) {
        setIsSubmitting(false)
        toast({
          title: "Customer Not Found In Master Data",
          description: customerType === "new"
            ? "This v2 build requires selecting an existing customer from master data - on-the-fly new-customer creation isn't migrated yet."
            : "Could not resolve the selected customer to a master record. Please re-select it from the list.",
          variant: "destructive",
        })
        return
      }

      const selectedBrokerRecord = isBrokerOrder === "Broker"
        ? brokers.find((b: any) => (b.salesman_name || "").toLowerCase() === (brokerName || "").toLowerCase())
        : null
      const selectedSalespersonRecord = isBrokerOrder === "Salesperson"
        ? salespersons.find((s: any) => (s.salesman_name || "").toLowerCase() === (salespersonName || "").toLowerCase())
        : null

      // Prepare common order data (v2 schema: real FK ids, not name strings)
      const orderData: any = {
        customerId: selectedCustomerRecord.id,
        depotId: billingDepot?.id ?? null,
        brokerId: selectedBrokerRecord?.id ?? null,
        salespersonId: selectedSalespersonRecord?.id ?? null,
        orderType: orderType,
        customerType: customerType,
        deliveryPurpose: orderPurpose,
        startDate: startDate || null,
        endDate: endDate || null,
        deliveryDate: deliveryDate || null,
        partySoDate: soDate || null,
        customerContactPersonName: contactPerson || null,
        customerContactPersonWhatsappNo: whatsappNo || null,
        customerAddress: customerAddress || null,
        customerDeliveryAddress: (sameAsCustomerAddress ? customerAddress : deliveryAddress) || null,
        paymentTerms: paymentTerms || null,
        advancePaymentToBeTaken: advancePaymentTaken === "YES",
        advanceAmount: advanceAmount ? parseFloat(advanceAmount) : null,
        orderThrough: isBrokerOrder,
        typeOfTransporting: transportType || null,
        orderPunchRemarks: orderPunchRemarks || null,
        futurePeriodDate: futurePeriodDate || null,
        uploadSo: uploadedSoUrl,
        userId: user?.id || null,
        orderCategory: orderCategory,
        gst: gst || null,
      }

      // Add items array for backend (for regular and pre-approval order types)
      if ((orderType === "regular" || orderType === "pre-approval") && products.length > 0) {
        const missingRateProducts: string[] = []
        const missingSkuProducts: string[] = []
        orderData.items = products.map(p => {
          let rate15kg = p.ratePer15Kg ? parseFloat(p.ratePer15Kg) : null
          let rateLtr = p.ratePerLtr ? parseFloat(p.ratePerLtr) : null
          let oilTypeVal = ""

          if (!p.skuId) {
            missingSkuProducts.push(p.productName || "Unnamed product")
          }

          // For pre-approval, pick from the preApprovalProducts list based on detected oil type
          if (orderType === "pre-approval") {
            const productNameLower = (p.productName || "").toLowerCase()
            let matchedRate = null

            // Robust auto-detection of oil type from product name
            if (productNameLower.includes("palm") || productNameLower.includes("p.o.") || productNameLower.includes(" po ")) {
              oilTypeVal = "Palm Oil"
            } else if (productNameLower.includes("rice") || productNameLower.includes("r.o.") || productNameLower.includes(" ro ") || productNameLower.includes("rbo")) {
              oilTypeVal = "Rice Oil"
            } else if (productNameLower.includes("soya") || productNameLower.includes("s.o.") || productNameLower.includes(" so ") || productNameLower.includes("sbo")) {
              oilTypeVal = "Soya Oil"
            }

            if (oilTypeVal) {
              matchedRate = preApprovalProducts.find(pap => pap.oilType.toLowerCase() === oilTypeVal.toLowerCase())
            }

            if (matchedRate) {
              rate15kg = matchedRate.ratePer15Kg ? parseFloat(matchedRate.ratePer15Kg) : rate15kg
              rateLtr = matchedRate.ratePerLtr ? parseFloat(matchedRate.ratePerLtr) : rateLtr
            }
          }

          // Pre-approval: flag products whose detected oil type has no matching rate
          if (orderType === "pre-approval" && (rate15kg == null || rateLtr == null)) {
            missingRateProducts.push(oilTypeVal || p.productName || "Unnamed product")
          }

          return {
            skuId: p.skuId ?? null,
            uom: p.uom || "Ltr",
            orderQuantity: p.orderQty ? parseFloat(p.orderQty) : null,
            rateOfMaterial: p.rate ? parseFloat(p.rate) : null,
            ratePer15kg: rate15kg,
            ratePerLtr: rateLtr,
            oilType: oilTypeVal,
            alternateUom: p.altUom || "Kg",
            alternateQtyKg: p.altQty ? parseFloat(p.altQty) : null,
          }
        })

        // v2 requires a real SKU FK - a free-typed product name that was never
        // selected from the dropdown has no id to send.
        if (missingSkuProducts.length > 0) {
          setIsSubmitting(false)
          toast({
            title: "Product Not Selected From List",
            description: `Select these products from the dropdown (not typed manually) so they resolve to a master SKU: ${[...new Set(missingSkuProducts)].join(", ")}.`,
            variant: "destructive",
          })
          return
        }

        // Block submission if any pre-approval product is missing its rate,
        // otherwise it would save null and show blank in the WhatsApp message
        if (missingRateProducts.length > 0) {
          setIsSubmitting(false)
          toast({
            title: "Missing Pre-Approval Rate",
            description: `No Pre-Approval rate found for: ${[...new Set(missingRateProducts)].join(", ")}. Add the matching oil-type rate in the Pre-Approval section before submitting.`,
            variant: "destructive",
          })
          return
        }
      }

      // Call backend API (v2 schema)
      const response = await orderApi.create(orderData)

      if (response.success) {
        const backendOrderNo = response.data.order.orderNo

        // Prepare order entry for localStorage (for compatibility in existing workflow)
        const orderEntry = {
          doNumber: backendOrderNo, // Use backend-generated order number
          customerType,
          depoName,
          isBrokerOrder,
          orderPurpose,
          orderType: orderType as "regular" | "pre-approval",
          advancePaymentTaken,
          soNumber: backendOrderNo, // Use generated order number
          soDate,
          customerName: customerNameValue,
          contactPerson,
          whatsappNo,
          customerAddress,
          deliveryAddress,
          brokerName,
          salespersonName,
          deliveryDate,
          startDate,
          endDate,
          paymentTerms,
          transportType,
          orderPunchRemarks,
          advanceAmount,
          products: products.map(p => ({
            ...p,
            uom: p.uom || "Ltr",
            altUom: p.altUom || "Kg"
          })),
          preApprovalProducts,
          orderCategory,
          stage: orderType === "regular" ? "Approval Of Order" : "Pre-Approval",
          status: "Pending" as const,
          timestamp: new Date().toISOString()
        }

        // saveWorkflowHistory(orderEntry) - Removed as per user request to disable localStorage history

        // Keep legacy keys for compatibility with current workflow stages
        localStorage.setItem("orderData", JSON.stringify(orderEntry))
        if (orderType === "regular") {
          localStorage.setItem("commitmentReviewData", JSON.stringify({ orderData: orderEntry }))
        }

        // Show success message with prominently displayed order number
        toast({
          title: "✅ Order Created Successfully!",
          description: `Order Number: ${backendOrderNo.replace(/[A-Z]$/i, '')} — this order has been saved to the database.`,
        })

        resetForm()
        onSuccess?.(backendOrderNo)
      }

    } catch (error: any) {
      let errorMessage = error.message || "Failed to save order to database. Please try again."

      // Surface a specific field-level message if the backend returned one
      if (Array.isArray(error?.errors) && error.errors.length > 0 && error.errors[0]?.message) {
        errorMessage = error.errors[0].message
      }

      if (errorMessage.includes("too long for type character varying")) {
        errorMessage = "One or more fields exceed maximum length. Check: WhatsApp number (max 20 chars), Payment Terms, Transport Type."
      }

      toast({
        title: "Error Saving Order",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const addProduct = () => {
    setProducts([
      ...products,
      { id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "", skuWeight: "", nosPerMainUom: "" },
    ])
  }

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id))
    } else {
      // If only 1 product row exists, reset its values
      setProducts([
        { id, productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "", skuWeight: "", nosPerMainUom: "" }
      ])
    }
  }

  const updateProduct = (id: string, field: keyof ProductItem, value: string) => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id !== id) return p;
        return { ...p, [field]: value };
      })
    );
  }

  // Handle product selection and auto-fill UOM fields
  const handleProductSelect = (productId: string, skuName: string, skuData?: any) => {
    if (!skuName) {
      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            skuId: undefined,
            productName: "",
            uom: "",
            altUom: "",
            orderQty: "",
            rate: "",
            ratePer15Kg: "",
            ratePerLtr: "",
            oilType: "",
            skuWeight: "",
            nosPerMainUom: "",
          };
        })
      );
      return;
    }

    const selectedSku = skuData || skuRegistryRef.current[skuName] || skus.find((sku) => sku.sku_name === skuName)

    if (selectedSku) {
      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            skuId: selectedSku.id,
            productName: selectedSku.sku_name,
            uom: selectedSku.main_uom || "",
            altUom: selectedSku.alternate_uom || "",
            skuWeight: selectedSku.sku_weight != null ? String(selectedSku.sku_weight) : "",
            nosPerMainUom: selectedSku.nos_per_main_uom != null ? String(selectedSku.nos_per_main_uom) : "",
          };
        })
      );
    } else {
      updateProduct(productId, "productName", skuName)
    }
  }

  // Pre-Approval Product Helpers
  const addPreApprovalProduct = () => {
    if (!currentPreApproval.ratePer15Kg || !currentPreApproval.ratePerLtr) {
      toast({
        title: "Validation Error",
        description: "Both 15 KG and 1 LTR rates are mandatory for Pre-Approval orders.",
        variant: "destructive",
      })
      return
    }

    // Row Limit: maximum 3 items
    if (preApprovalProducts.length >= 3) {
      toast({
        title: "Limit Reached",
        description: "You can add a maximum of 3 oil types (Palm, Rice, and Soya Oil).",
        variant: "destructive",
      })
      return
    }

    // Duplicate Check: ensure same oil type isn't added twice
    if (preApprovalProducts.some(p => p.oilType === currentPreApproval.oilType)) {
      toast({
        title: "Duplicate Entry",
        description: "Rates for this oil type have already been added. Select a different oil type or edit the existing row.",
        variant: "destructive",
      })
      return
    }

    setPreApprovalProducts([
      ...preApprovalProducts,
      {
        id: Math.random().toString(36).substr(2, 9),
        oilType: currentPreApproval.oilType,
        ratePer15Kg: currentPreApproval.ratePer15Kg,
        ratePerLtr: currentPreApproval.ratePerLtr,
      },
    ])

    // Reset current input
    setCurrentPreApproval({
      ...currentPreApproval,
      ratePer15Kg: "",
      ratePerLtr: ""
    })
  }

  const removePreApprovalProduct = (id: string) => {
    setPreApprovalProducts(preApprovalProducts.filter((p) => p.id !== id))
  }

  const updatePreApprovalProduct = (id: string, field: keyof PreApprovalProduct, value: string) => {
    setPreApprovalProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id !== id) return p;
        return { ...p, [field]: value };
      })
    );
  }

  const resetForm = () => {
    setCustomerType("existing")
    setOrderCategory("Sales")
    const allowedDepos = user?.depo_access?.['Order Punch'] || []
    const banari = allowedDepos.find((d: string) => d.toLowerCase() === "banari")
    setDepoName(banari || (allowedDepos.length > 0 ? allowedDepos[0] : "Banari"))
    setIsBrokerOrder("Direct")
    setOrderPurpose("week-on-week")
    setOrderType("regular")
    setAdvancePaymentTaken("NO")
    setSoDate(new Date().toISOString().split("T")[0])
    setCustomerName("")
    setGst("")
    setContactPerson("")
    setWhatsappNo("")
    setWhatsappNoError("")
    setCustomerAddress("")
    setDeliveryAddress("")
    setSameAsCustomerAddress(true)
    setPreApprovalProducts([])
    setCurrentPreApproval({
      oilType: "Palm Oil",
      ratePer15Kg: "",
      ratePerLtr: ""
    })
    setBrokerName("Ashish Motwani")
    setDeliveryDate("")
    setStartDate("")
    setEndDate("")
    setPaymentTerms("7days")
    setTransportType("self")
    setAdvanceAmount("")
    setFuturePeriodDate("")
    setOrderPunchRemarks("")
    setGstSupplyType("INTRA")
    setGstRatePercent("5")
    setSoFile(null)
    const fileInput = document.getElementById("soFile") as HTMLInputElement
    if (fileInput) fileInput.value = ""
    setProducts([{ id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "", skuWeight: "", nosPerMainUom: "" }])
  }

  // Company/billing state comes from the DEPOT master record's own address (state field)
  const { data: billingRes } = useQuery({
    queryKey: ['billing-depot-state', depoName],
    queryFn: () => depotApi.getAll({ search: depoName, all: "true" }),
    enabled: !!depoName,
    staleTime: 10 * 60 * 1000,
  })
  const billingDepots: any[] = billingRes?.data?.depots || []
  const billingDepot = billingDepots.find((d: any) =>
    d.depot_name?.toLowerCase() === depoName.toLowerCase()
  ) || billingDepots[0]
  const billingState = billingDepot?.state || ""

  // Customer/shipping state comes from the customer's billing address (customerAddress)
  const shippingState = extractState(customerAddress || "") || ""

  // Auto-detect Same State vs Other State if both states are determined, but user can toggle manually
  useEffect(() => {
    if (billingState && shippingState) {
      if (billingState.trim().toLowerCase() === shippingState.trim().toLowerCase()) {
        setGstSupplyType("INTRA")
      } else {
        setGstSupplyType("INTER")
      }
    }
  }, [billingState, shippingState])

  console.log("[GST DEBUG] depoName:", depoName, "| billingDepot:", billingDepot?.depot_name, "| billingState:", billingState, "| shippingState:", shippingState, "| gstSupplyType:", gstSupplyType)

  const numericGstRate = parseFloat(gstRatePercent) || 0
  const halfRate = numericGstRate / 2
  // Rate is the taxable (GST-exclusive) price - GST is added on top, same model
  // as Commitment Punch's Process dialog. Previously this divided the rate by
  // (1 + gst%) to "back out" GST and then re-added the same GST on top, which
  // always reconstructed the original rate*qty regardless of the entered GST%
  // (the two operations are exact inverses) - the Total never actually moved
  // no matter what rate you typed.
  const totalTaxable = products.reduce((sum, p) => {
    const rate = parseFloat(p.rate) || 0
    const nos = parseFloat(p.nosPerMainUom) || 0
    const qty = parseFloat(p.orderQty) || 0
    return sum + (rate * nos * qty)
  }, 0)

  const orderCgst = totalTaxable * (halfRate / 100)
  const orderSgst = totalTaxable * (halfRate / 100)
  const orderIgst = totalTaxable * (numericGstRate / 100)
  const totalGstAmount = gstSupplyType === "INTRA" ? (orderCgst + orderSgst) : orderIgst
  const orderRawTotal = totalTaxable + totalGstAmount
  const orderRoundedTotal = Math.round(orderRawTotal)
  const orderRoundOff = orderRoundedTotal - orderRawTotal

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="soDate">DO Date</Label>
                <Input id="soDate" type="date" value={soDate} onChange={(e) => setSoDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderCategory">ORDER CATEGORY</Label>
                <Select value={orderCategory} onValueChange={setOrderCategory}>
                  <SelectTrigger id="orderCategory">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedOrderCategories.includes("Sales") && (
                      <SelectItem value="Sales">Sales</SelectItem>
                    )}
                    {allowedOrderCategories.includes("Stock Transfer") && (
                      <SelectItem value="Stock Transfer">Stock Transfer</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderPurpose">ORDER TYPE (DELIVERY PURPOSE)</Label>
                <Select value={orderPurpose} onValueChange={setOrderPurpose}>
                  <SelectTrigger id="orderPurpose">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week-on-week">Week On Week</SelectItem>
                    <SelectItem value="future-period">Future Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              <div className="space-y-2">
                <Label htmlFor="orderType">ORDER TYPE</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger id="orderType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedOrderTypes.includes("regular") && (
                      <SelectItem value="regular">Regular</SelectItem>
                    )}
                    {allowedOrderTypes.includes("pre-approval") && (
                      <SelectItem value="pre-approval">Pre-Approval</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {orderType === "regular" && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ Regular orders will skip Pre-Approval and go directly to Approval Of Order
                  </p>
                )}
              </div>

              {(orderPurpose === "week-on-week" || orderPurpose === "future-period") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  {orderPurpose === "week-on-week" && (
                    <div className="space-y-2">
                      <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
                      <Popover open={isDeliveryDatePickerOpen} onOpenChange={setIsDeliveryDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !deliveryDate && "text-muted-foreground",
                              deliveryDateError && "border-red-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {deliveryDate ? format(new Date(deliveryDate), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={deliveryDate ? new Date(deliveryDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setDeliveryDate(format(date, "yyyy-MM-dd"))
                                setIsDeliveryDatePickerOpen(false)
                              }
                            }}
                            initialFocus
                            modifiers={{
                              inRange: (date) => {
                                if (!startDate || !endDate) return false
                                const start = new Date(startDate)
                                const end = new Date(endDate)
                                return date >= start && date <= end
                              }
                            }}
                            modifiersClassNames={{
                              inRange: "bg-blue-100 text-blue-900 hover:bg-blue-200"
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      {deliveryDateError && (
                        <p className="text-xs text-red-600 font-medium">{deliveryDateError}</p>
                      )}
                    </div>
                  )}

                  {orderPurpose === "future-period" && (
                    <div className="space-y-2">
                      <Label htmlFor="futurePeriodDate">Future Period Date</Label>
                      <Popover open={isFuturePeriodDatePickerOpen} onOpenChange={setIsFuturePeriodDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !futurePeriodDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {futurePeriodDate ? format(new Date(futurePeriodDate), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={futurePeriodDate ? new Date(futurePeriodDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setFuturePeriodDate(format(date, "yyyy-MM-dd"))
                                setIsFuturePeriodDatePickerOpen(false)
                              }
                            }}
                            initialFocus
                            modifiers={{
                              inRange: (date) => {
                                if (!startDate || !endDate) return false
                                const start = new Date(startDate)
                                const end = new Date(endDate)
                                return date >= start && date <= end
                              }
                            }}
                            modifiersClassNames={{
                              inRange: "bg-blue-100 text-blue-900 hover:bg-blue-200"
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ This date will be saved for future period delivery
                      </p>
                    </div>
                  )}
                  <div className="hidden md:block"></div>
                </>
              )}

              {/* Note for Pre-Approval Orders */}
              {orderType === "pre-approval" && (orderPurpose === "week-on-week" || orderPurpose === "future-period") && (
                <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    15 KG and 1 Ltr rate is compulsory for Pre-Approval orders
                  </p>
                </div>
              )}

              {/* Dispatch From (Depot) is selected BEFORE Customer - the Customer
                  list below is filtered by whichever Godown is picked here. */}
              <div className="space-y-2">
                <Label htmlFor="depoName">Dispatch From (Depo)</Label>
                {isAuthLoading ? (
                  <div className="h-9 w-full rounded-md border border-input bg-muted animate-pulse" />
                ) : (
                  <AsyncCombobox
                    placeholder="Select Depo"
                    searchPlaceholder="Search depots..."
                    value={depoName}
                    onValueChange={handleDepoChange}
                    onSelectOption={(opt: any) => {
                      if (opt?.original) {
                        setDepots(prev => {
                          const exists = prev.find(d => d.depot_id === opt.original.depot_id);
                          return exists ? prev : [...prev, opt.original];
                        });
                      }
                    }}
                    fetchOptions={async (search: string, page: number) => {
                      const res = await depotApi.getAll({ search, page, limit: 20 });
                      let list = res.data.depots || [];
                      const fetchedCount = list.length;
                      const allowedDepos = user?.depo_access?.['Order Punch'] || [];
                      if (allowedDepos.length > 0) {
                        list = list.filter((d: any) =>
                          allowedDepos.some((ad: string) => ad.toLowerCase() === d.depot_name.toLowerCase())
                        );
                      }
                      return {
                        options: list.map((d: any) => ({ value: d.depot_name, label: d.depot_name, original: d })),
                        hasMore: (fetchedCount + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    className="w-full"
                  />
                )}
              </div>

              <div className="space-y-2 hidden">
                <Label htmlFor="customerType">Customer Type</Label>
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger id="customerType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Existing Customer</SelectItem>
                    <SelectItem value="new">New Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerName">Customer Name</Label>
                {customerType === "existing" ? (
                  <AsyncCombobox
                    placeholder={!depoName ? "Select a Godown first" : (isLoadingCustomers ? "Loading..." : "Select existing customer")}
                    disabled={!depoName}
                    searchPlaceholder="Search by name, city, state, GST, mobile or contact person..."
                    value={customerName}
                    onValueChange={setCustomerName}
                    onSelectOption={(opt: any) => {
                      if (opt?.original) {
                        setCustomers(prev => {
                          const exists = prev.find(c => c.id === opt.original.id);
                          return exists ? prev : [...prev, opt.original];
                        });
                      }
                    }}
                    fetchOptions={(search: string, page: number) => {
                      const selectedDepot = depots.find(d => d.depot_name === depoName);
                      // Godown-gated: only customers tagged to the selected Godown, filtered
                      // server-side (not by loading every customer and filtering in the browser).
                      return fetchCustomerDropdownOptions(search, page, selectedDepot?.id)
                    }}
                  />
                ) : (
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                )}
              </div>

              {/* Only shown once the selected customer actually has more than one
                  saved address (its default row + customer_addresses rows). */}
              {hasMultipleAddresses && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="customerAddressSelect">Address</Label>
                  <Select value={String(selectedAddressId)} onValueChange={(v) => setSelectedAddressId(v === "default" ? "default" : Number(v))}>
                    <SelectTrigger id="customerAddressSelect">
                      <SelectValue placeholder="Select an address" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerAddressOptions.map((a) => (
                        <SelectItem key={String(a.id)} value={String(a.id)}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {gst && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="gst">GST Number</Label>
                  <Input
                    id="gst"
                    value={gst}
                    readOnly
                    className="bg-muted font-mono"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="contactPerson">Customer Contact Person Name <span className="text-red-500">*</span></Label>
                <Input
                  id="contactPerson"
                  placeholder="Enter name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  required
                  disabled={isContactPersonAutoFilled}
                  className={isContactPersonAutoFilled ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappNo">Customer Contact Person WhatsApp No.<span className="text-red-500">*</span></Label>
                <Input
                  id="whatsappNo"
                  placeholder="Enter WhatsApp number"
                  value={whatsappNo}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "");
                    setWhatsappNo(cleaned);
                  }}
                  required
                  disabled={isWhatsappNoAutoFilled}
                  className={cn(
                    isWhatsappNoAutoFilled ? "bg-muted" : "",
                    whatsappNoError && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {whatsappNoError && (
                  <p className="text-xs text-red-600 font-medium">{whatsappNoError}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerAddress">Customer Address<span className="text-red-500">*</span></Label>
                <Input
                  id="customerAddress"
                  placeholder="Enter full address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  required
                  disabled={isAddressAutoFilled}
                  className={isAddressAutoFilled ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="sameAsCustomer"
                    checked={sameAsCustomerAddress}
                    onCheckedChange={(checked) => setSameAsCustomerAddress(checked as boolean)}
                  />
                  <Label htmlFor="sameAsCustomer" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Same as Customer Address
                  </Label>
                </div>
                <Label htmlFor="deliveryAddress">Delivery Address</Label>
                <Input
                  id="deliveryAddress"
                  placeholder="Enter delivery address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  readOnly={sameAsCustomerAddress}
                  className={sameAsCustomerAddress ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="advancePayment">Advance Payment to Be Taken</Label>
                <Select value={advancePaymentTaken} onValueChange={setAdvancePaymentTaken}>
                  <SelectTrigger id="advancePayment">
                    <SelectValue placeholder="Select YES/NO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {advancePaymentTaken === "YES" && (
                <div className="space-y-2">
                  <Label htmlFor="advanceAmount">Advance Amount</Label>
                  <Input
                    id="advanceAmount"
                    type="number"
                    placeholder="0.00"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </div>
              )}



              {/* Pre-Approval Rates Section */}
              {orderType === "pre-approval" && (
                <div className="md:col-span-2 space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div className="flex flex-col space-y-1">
                    <Label className="text-lg font-semibold text-blue-900">Pre-Approval Rates</Label>
                    <p className="text-sm text-blue-600">Add 15 KG and 1 LTR rates for different oil types.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white p-4 rounded-md shadow-sm border border-blue-100">
                    <div className="space-y-2">
                      <Label htmlFor="currentOilType">Oil Type</Label>
                      <Select
                        value={currentPreApproval.oilType}
                        onValueChange={(val) => setCurrentPreApproval(prev => ({ ...prev, oilType: val }))}
                      >
                        <SelectTrigger id="currentOilType">
                          <SelectValue placeholder="Select Oil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Palm Oil">Palm Oil</SelectItem>
                          <SelectItem value="Rice Oil">Rice Oil</SelectItem>
                          <SelectItem value="Soya Oil">Soya Oil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentRate15Kg">15 KG Rate</Label>
                      <Input
                        id="currentRate15Kg"
                        type="number"
                        value={currentPreApproval.ratePer15Kg}
                        onChange={(e) => setCurrentPreApproval(prev => ({ ...prev, ratePer15Kg: e.target.value }))}
                        placeholder="0.00"
                        className="font-semibold text-green-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentRateLtr">1 LTR Rate</Label>
                      <Input
                        id="currentRateLtr"
                        type="number"
                        value={currentPreApproval.ratePerLtr}
                        onChange={(e) => setCurrentPreApproval(prev => ({ ...prev, ratePerLtr: e.target.value }))}
                        placeholder="0.00"
                        className="font-semibold text-blue-600"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addPreApprovalProduct}
                      disabled={isReadOnly}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      title={isReadOnly ? "View Only Access" : "Add to List"}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add to List
                    </Button>
                  </div>

                  {preApprovalProducts.length > 0 && (
                    <div className="overflow-hidden rounded-md border border-blue-100 bg-white">
                      <Table>
                        <TableHeader className="bg-blue-50/50">
                          <TableRow>
                            <TableHead className="font-bold text-blue-900 text-xs uppercase tracking-wider">Oil Type</TableHead>
                            <TableHead className="font-bold text-blue-900 text-xs uppercase tracking-wider">15 KG Rate</TableHead>
                            <TableHead className="font-bold text-blue-900 text-xs uppercase tracking-wider">1 LTR Rate</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preApprovalProducts.map((p) => (
                            <TableRow key={p.id} className="hover:bg-blue-50/30">
                              <TableCell className="font-medium py-2">{p.oilType}</TableCell>
                              <TableCell className="font-semibold text-green-600 py-2">₹{p.ratePer15Kg || "—"}</TableCell>
                              <TableCell className="font-semibold text-blue-600 py-2">₹{p.ratePerLtr || "—"}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePreApprovalProduct(p.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Show Product List for both regular and pre-approval */}
              {(orderType === "regular" || orderType === "pre-approval") && (
                <div className="md:col-span-2 space-y-4 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Product List</Label>
                  </div>
                  <div className="space-y-4">
                    {products.map((product, idx) => (
                      <div key={product.id} className="flex gap-4 items-end p-4 border rounded-lg bg-card shadow-sm relative pt-8">
                        <div className="absolute top-2 left-4 text-[10px] font-bold text-blue-500/80 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">
                          Product {idx + 1}
                        </div>
                        <div className="grid grid-cols-2 gap-4 flex-1 md:grid-cols-13">
                          <div className={`space-y-1.5 col-span-2 md:col-span-5`}>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</Label>
                            <AsyncCombobox
                              placeholder={isLoadingSkus ? "Loading..." : "Select product"}
                              searchPlaceholder="Search products..."
                              value={product.productName}
                              onValueChange={(val) => handleProductSelect(product.id, val)}
                              onSelectOption={(opt: any) => {
                                if (!opt) {
                                  handleProductSelect(product.id, "")
                                  return
                                }
                                if (opt.original) {
                                  if (opt.original.sku_name) skuRegistryRef.current[opt.original.sku_name] = opt.original
                                  setSkus(prev => {
                                    const exists = prev.find(s => s.sku_id === opt.original.sku_id);
                                    return exists ? prev : [...prev, opt.original];
                                  });
                                  handleProductSelect(product.id, opt.original.sku_name, opt.original)
                                }
                              }}
                              fetchOptions={async (search: string, page: number) => {
                                // Fuzzy search needs the whole list, so filter the SKUs we already
                                // hold locally and page through them; fall back to the server only
                                // if that list hasn't loaded.
                                let list: any[] = skus.length > 0
                                  ? skus.filter((s: any) => fuzzyMatch(search, s.sku_name || ""))
                                  : ((await skuApi.getAll({ all: "true" })).data.skuDetails || [])
                                      .filter((s: any) => fuzzyMatch(search, s.sku_name || ""));

                                // Local filter for pre-approval types if needed
                                if (orderType === "pre-approval" && preApprovalProducts.length > 0) {
                                  list = list.filter((s: any) => {
                                    const skuNameLower = s.sku_name.toLowerCase();
                                    return (Array.isArray(preApprovalProducts) ? preApprovalProducts : []).some(pap => {
                                      const oilType = pap.oilType.toLowerCase();
                                      if (oilType.includes("palm")) return skuNameLower.includes("palm") || skuNameLower.includes("p.o.");
                                      if (oilType.includes("rice")) return skuNameLower.includes("rice") || skuNameLower.includes("r.o.") || skuNameLower.includes("rbo");
                                      if (oilType.includes("soya")) return skuNameLower.includes("soya") || skuNameLower.includes("s.o.") || skuNameLower.includes("sbo");
                                      return false;
                                    });
                                  });
                                }

                                const pageSize = 20;
                                const slice = list.slice((page - 1) * pageSize, page * pageSize);

                                return {
                                  options: slice.map((sku: any) => ({
                                    value: sku.sku_name,
                                    label: sku.sku_name,
                                    original: sku
                                  })),
                                  hasMore: page * pageSize < list.length
                                };
                              }}
                              className="h-10"
                            />
                          </div>

                          <div className="space-y-1.5 col-span-1 md:col-span-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">UOM</Label>
                            <Input
                              value={product.uom}
                              onChange={(e) => updateProduct(product.id, "uom", e.target.value)}
                              placeholder="UOM"
                              className="h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400 bg-muted"
                              readOnly
                            />
                          </div>

                          <div className="space-y-1.5 col-span-1 md:col-span-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Order Qty <span className="text-red-500">*</span></Label>
                            <Input
                              type="number"
                              name={`qty-${Math.random().toString(36).substring(7)}`}
                              value={product.orderQty}
                              onChange={(e) => updateProduct(product.id, "orderQty", e.target.value)}
                              placeholder="0"
                              autoComplete="new-password"
                              className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                            />
                          </div>

                          {/* Rate field for both types, but auto-filled for Pre-Approval */}
                          <div className="space-y-1.5 col-span-2 md:col-span-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">Rate {orderCategory !== "Stock Transfer" && <span className="text-red-500">*</span>} {orderCategory === "Stock Transfer" && <span className="text-[10px] lowercase">(Optional)</span>}</Label>
                            <Input
                              type="number"
                              name={`rate-${Math.random().toString(36).substring(7)}`}
                              value={product.rate}
                              onChange={(e) => updateProduct(product.id, "rate", e.target.value)}
                              placeholder="0.00"
                              autoComplete="new-password"
                              className="bg-background h-11 min-w-[120px] border-slate-200 focus:border-blue-400 focus:ring-blue-400 font-semibold text-blue-600 text-base px-3"
                            />
                          </div>

                          <div className="space-y-1.5 col-span-2 md:col-span-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">Taxable Amount</Label>
                            <Input
                              readOnly
                              value={(() => {
                                const rate = parseFloat(product.rate) || 0;
                                const nos = parseFloat(product.nosPerMainUom) || 0;
                                const qty = parseFloat(product.orderQty) || 0;
                                const rateWoGst = parseFloat(((rate * nos) / 1.05).toFixed(2));
                                return `₹${(rateWoGst * qty).toFixed(2)}`;
                              })()}
                              className="bg-background h-11 min-w-[120px] border-slate-200 font-semibold text-blue-600 text-base px-3"
                            />
                          </div>


                        </div>

                        <div className="flex-none mb-1 pt-6">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(product.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 cursor-pointer"
                            title={products.length > 1 ? "Remove this product" : "Reset / clear product details"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addProduct}
                        disabled={isReadOnly}
                        className="gap-2 bg-white hover:bg-blue-50 text-blue-600 border-blue-200 shadow-sm"
                        title={isReadOnly ? "View Only Access" : "Add Product"}
                      >
                        <Plus className="h-4 w-4" /> Add Product
                      </Button>
                    </div>
                    {products.length > 0 && (
                      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Order Weight</p>
                          <p className="text-sm font-bold text-blue-700">
                            {products.reduce((sum, p) => sum + (parseFloat(p.skuWeight) || 0) * (parseFloat(p.orderQty) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Order Qty</p>
                          <p className="text-sm font-bold text-blue-700">
                            {products.reduce((sum, p) => sum + (parseFloat(p.orderQty) || 0), 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Taxable Amount</p>
                          <p className="text-sm font-bold text-blue-700">
                            ₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}
                    {products.length > 0 && (
                      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST Breakdown (Indicative)</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500">GST Rate:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={gstRatePercent}
                              onChange={(e) => setGstRatePercent(e.target.value)}
                              placeholder="5"
                              className="w-14 h-5 px-1 text-[11px] font-mono font-bold text-blue-700 bg-white border border-slate-300 rounded text-right focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-[10px] font-bold text-slate-600">%</span>
                          </div>
                        </div>
                        <div className="p-4 max-w-sm ml-auto space-y-2 text-xs">
                          {/* State Supply Toggle */}
                          <div className="flex items-center justify-between bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold text-slate-600 mb-3">
                            <button
                              type="button"
                              onClick={() => setGstSupplyType("INTRA")}
                              className={cn(
                                "flex-1 py-1 rounded text-center transition-all cursor-pointer",
                                gstSupplyType === "INTRA"
                                  ? "bg-white text-blue-700 shadow-xs font-bold"
                                  : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              Same State
                            </button>
                            <button
                              type="button"
                              onClick={() => setGstSupplyType("INTER")}
                              className={cn(
                                "flex-1 py-1 rounded text-center transition-all cursor-pointer",
                                gstSupplyType === "INTER"
                                  ? "bg-white text-blue-700 shadow-xs font-bold"
                                  : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              Other State
                            </button>
                          </div>

                          {gstSupplyType === "INTRA" ? (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="font-black uppercase text-slate-500 text-[10px]">CGST ({halfRate.toFixed(1)}%)</span>
                                <span className="font-mono font-bold text-slate-700">
                                  ₹{orderCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="font-black uppercase text-slate-500 text-[10px]">SGST ({halfRate.toFixed(1)}%)</span>
                                <span className="font-mono font-bold text-slate-700">
                                  ₹{orderSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="font-black uppercase text-slate-500 text-[10px]">IGST ({numericGstRate.toFixed(1)}%)</span>
                              <span className="font-mono font-bold text-slate-700">
                                ₹{orderIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="font-black uppercase text-slate-500 text-[10px]">Round Off</span>
                            <span className="font-mono font-bold text-slate-500">
                              {`${orderRoundOff >= 0 ? "+" : "-"}₹${Math.abs(orderRoundOff).toFixed(2)}`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                            <span className="font-black uppercase text-slate-800 text-[11px]">Total Order Value</span>
                            <span className="font-mono font-black text-blue-700 text-sm">
                              ₹{orderRoundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {allowedOrderThroughTypes.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="isBroker"> Is This Order Through</Label>
                  <Select value={orderThrough} onValueChange={(value: OrderThroughType) => setOrderThrough(value)}>
                    <SelectTrigger id="isBroker">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedOrderThroughTypes.includes("Direct") && <SelectItem value="Direct">Direct</SelectItem>}
                      {allowedOrderThroughTypes.includes("Broker") && <SelectItem value="Broker">Broker</SelectItem>}
                      {allowedOrderThroughTypes.includes("Salesperson") && <SelectItem value="Salesperson">Salesperson</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isBrokerOrder === "Broker" && allowedOrderThroughTypes.includes("Broker") && (
                <div className="space-y-2">
                  <Label htmlFor="brokerName">Broker Name (IF ORDER THROUGH BROKER)</Label>
                  <AsyncCombobox
                    placeholder={isLoadingBrokers ? "Loading..." : "Select broker"}
                    searchPlaceholder="Search brokers..."
                    value={brokerName}
                    onValueChange={setBrokerName}
                    onSelectOption={(opt: any) => {
                      if (opt?.original) {
                        setBrokers(prev => {
                          const exists = prev.find(b => b.id === opt.original.id);
                          return exists ? prev : [...prev, opt.original];
                        });
                      }
                    }}
                    fetchOptions={async (search: string, page: number) => {
                      if (allowedBrokerNames) {
                        const allowedSet = new Set(allowedBrokerNames.map(b => b.toLowerCase()))
                        const filtered = brokers.filter(b =>
                          allowedSet.has((b.salesman_name || "").toLowerCase()) &&
                          (b.status || "").toLowerCase() === "active" &&
                          (!search || (b.salesman_name || "").toLowerCase().includes(search.toLowerCase()))
                        )
                        const start = (page - 1) * 20
                        const pageItems = filtered.slice(start, start + 20)
                        return {
                          options: pageItems.map((b: any) => ({ value: b.salesman_name, label: b.salesman_name, original: b })),
                          hasMore: start + 20 < filtered.length
                        };
                      }
                      const res = await brokerApi.getAll({ search, page, limit: 20 });
                      const list = res.data.brokers || [];
                      return {
                        options: list.map((b: any) => ({ value: b.salesman_name, label: b.salesman_name, original: b })),
                        hasMore: (list.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    disabled={isLoadingBrokers}
                  />
                </div>
              )}

              {isBrokerOrder === "Salesperson" && (
                <div className="space-y-2">
                  <Label htmlFor="salespersonName">Salesperson Name</Label>
                  <AsyncCombobox
                    placeholder={isLoadingSalespersons ? "Loading..." : "Select salesperson"}
                    searchPlaceholder="Search salespersons..."
                    value={salespersonName}
                    onValueChange={setSalespersonName}
                    onSelectOption={(opt: any) => {
                      if (opt?.original) {
                        setSalespersons(prev => {
                          const exists = prev.find(s => s.id === opt.original.id);
                          return exists ? prev : [...prev, opt.original];
                        });
                      }
                    }}
                    fetchOptions={async (search: string, page: number) => {
                      if (allowedSalespersonNames) {
                        const allowedSet = new Set(allowedSalespersonNames.map(s => s.toLowerCase()))
                        const filtered = salespersons.filter(s =>
                          allowedSet.has((s.salesman_name || "").toLowerCase()) &&
                          (s.status || "").toLowerCase() === "active" &&
                          (!search || (s.salesman_name || "").toLowerCase().includes(search.toLowerCase()))
                        )
                        const start = (page - 1) * 20
                        const pageItems = filtered.slice(start, start + 20)
                        return {
                          options: pageItems.map((s: any) => ({ value: s.salesman_name, label: s.salesman_name, original: s })),
                          hasMore: start + 20 < filtered.length
                        };
                      }
                      const res = await salespersonApi.getAll({ search, page, limit: 20 });
                      const list = res.data.salespersons || [];
                      return {
                        options: list.map((s: any) => ({ value: s.salesman_name, label: s.salesman_name, original: s })),
                        hasMore: (list.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    disabled={isLoadingSalespersons}
                  />
                </div>
              )}

              {orderPurpose === "future-period" && (
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger id="paymentTerms">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="7days">7 Days After Delivery</SelectItem>
                    <SelectItem value="delivery">On Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transportType">Transport Type</Label>
                <Select value={transportType} onValueChange={setTransportType}>
                  <SelectTrigger id="transportType">
                    <SelectValue placeholder="Select transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">FOR</SelectItem>
                    <SelectItem value="others">EX-Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <FileUploadField
                  label="Upload SO Copy"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                  fileName={soFile?.name || ""}
                  helperText="Max file size: 20 MB"
                  buttonText="Select SO Copy"
                  onFilesSelected={(files) => {
                    if (files[0]) {
                      setSoFile(files[0])
                    }
                  }}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="orderPunchRemarks">Remarks</Label>
                <Textarea
                  id="orderPunchRemarks"
                  placeholder="Enter any additional remarks here..."
                  value={orderPunchRemarks}
                  onChange={(e) => setOrderPunchRemarks(e.target.value)}
                  className="min-h-25"
                />
              </div>
            </div>

        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button variant="ghost" type="button" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" className="gap-2 px-8" disabled={isSubmitting || isReadOnly} title={isReadOnly ? "View Only Access" : "Save Order"}>
            <Save className="h-4 w-4" /> {isSubmitting ? "Saving..." : "Save Order"}
          </Button>
        </div>
      </form>
    </>
  )
}
