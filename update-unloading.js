const fs = require('fs');

const pagePath = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/unloading/page.tsx';
let content = fs.readFileSync(pagePath, 'utf8');

// Add import for UnloadingForm and UnloadingFormData
if (!content.includes('UnloadingForm')) {
  content = content.replace(
    'import { ColumnDragProvider } from "@/components/ui/column-drag-provider"',
    'import { ColumnDragProvider } from "@/components/ui/column-drag-provider"\nimport { UnloadingForm, UnloadingFormData } from "@/components/unloading-form"'
  );
}

// Replace handleSubmit with new logic
const oldHandleSubmitStart = 'const handleSubmit = async () => {';
const newHandleSubmit = `const handleSubmit = async (formData: UnloadingFormData) => {
    if (!selectedGroup) return

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []

      // Submit for the unloading group/row
      // Note: we'll submit the first row's ID for the entire unloading process
      const targetProduct = selectedGroup._allProducts?.[0]
      if (!targetProduct) throw new Error("No products found in this unloading group")
      
      const submitData = {
        userId: user?.id || null,
        shortageQty: formData.shortageQty,
        remarks: formData.remarks,
        damagedContainers: formData.damagedContainers
      }

      const response = await unloadingApi.submit(targetProduct.id, submitData);
      
      if (response.success) {
        toast({ title: "Unloading Confirmed", description: \`Unloading report saved successfully.\` })
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["material-receipt-history"] });
        setIsDialogOpen(false)
        setSelectedItems([])
      } else {
        throw new Error(response.message || "Failed to submit")
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Submit failed", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }`;

// Use regex to replace the old handleSubmit
const handleSubmitRegex = /const handleSubmit = async \(\) => \{[\s\S]*?setIsProcessing\(false\)\n    \}\n  \}/;
content = content.replace(handleSubmitRegex, newHandleSubmit);

// Replace the DialogContent
const oldDialogContentStart = '<DialogContent className="w-[calc(100vw-0.75rem)]';
const newDialogContent = `<DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-4xl max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 border-none rounded-2xl sm:rounded-[2.5rem] shadow-2xl bg-slate-50 [overflow-wrap:anywhere]">
            <div className="p-3 sm:p-8 space-y-6 sm:space-y-8">
              <DialogHeader className="border-b-2 border-slate-100 pb-4 sm:pb-6 -mx-3 sm:-mx-8 px-3 sm:px-8 bg-white rounded-t-2xl sm:rounded-t-[2.5rem]">
                <DialogTitle className="text-base sm:text-2xl font-black text-slate-900 tracking-tight flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>Unloading Form - Invoice: <span className="text-blue-600 italic uppercase">{selectedGroup?.invoiceNo}</span></span>
                </DialogTitle>
                <DialogDescription className="hidden" />
              </DialogHeader>

              {selectedGroup && (
                <UnloadingForm onSubmit={handleSubmit} isSubmitting={isProcessing} />
              )}
            </div>
          </DialogContent>`;

const dialogContentRegex = /<DialogContent className="w-\[calc\(100vw-0\.75rem\)\][\s\S]*?<\/DialogContent>/;
content = content.replace(dialogContentRegex, newDialogContent);

fs.writeFileSync(pagePath, content, 'utf8');
console.log("Successfully updated page.tsx");
