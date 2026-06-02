'use client'

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-white flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-stone-800">Document Generator</p>
          <p className="text-[11px] text-stone-400 mt-0.5">Create Onboarding docs, MOUs, and MOAs for Taha Media clients</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            3 document types
          </span>
        </div>
      </div>

      {/* Full-height iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src="/doc-gen.html"
          className="w-full h-full border-0"
          title="Document Generator"
        />
      </div>
    </div>
  )
}
