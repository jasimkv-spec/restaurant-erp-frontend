import { useEffect, useState } from "react";
import { Download, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";

interface DocumentType {
  id: string;
  moduleCode: string;
  name: string;
  expiryRequired: boolean;
  mandatory: boolean;
}

interface Attachment {
  id: string;
  documentTypeId: string;
  documentType?: DocumentType;
  fileRef: string;
  fileName?: string | null;
  mimeType?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  status: string;
  createdAt: string;
}

/**
 * Reusable upload/list/download/delete panel for the polymorphic
 * DocumentAttachment model (see prisma/schema.prisma + workflow.routes.ts).
 * Any master or transaction screen can drop this in by passing its own
 * moduleCode/recordId - Vendors and Customers use it today, Employee and
 * transaction screens (PO, GRN, Invoice...) can reuse it unchanged later,
 * same as the backend model was designed for.
 */
export function DocumentAttachments({ moduleCode, recordId }: { moduleCode: string; recordId?: string | null }) {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!recordId) return;
    setLoading(true);
    setError(null);
    try {
      const [typesRes, itemsRes] = await Promise.all([
        api.get<ListResponse<DocumentType>>(`/api/workflow/document-types?pageSize=200`),
        api.get<ListResponse<Attachment>>(
          `/api/workflow/document-attachments?moduleCode=${encodeURIComponent(moduleCode)}&recordId=${encodeURIComponent(recordId)}`
        ),
      ]);
      setDocumentTypes(typesRes.data.filter((t) => t.moduleCode === moduleCode));
      setItems(itemsRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleCode, recordId]);

  async function handleUpload() {
    if (!recordId || !documentTypeId || !file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("moduleCode", moduleCode);
      formData.append("recordId", recordId);
      formData.append("documentTypeId", documentTypeId);
      if (issueDate) formData.append("issueDate", issueDate);
      if (expiryDate) formData.append("expiryDate", expiryDate);
      formData.append("file", file);
      await api.postForm("/api/workflow/document-attachments", formData);
      setDocumentTypeId("");
      setIssueDate("");
      setExpiryDate("");
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(item: Attachment) {
    try {
      await api.downloadFile(`/api/workflow/document-attachments/${item.id}/download`, item.fileName || item.fileRef);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Download failed");
    }
  }

  async function handleDelete(item: Attachment) {
    if (!window.confirm(`Remove "${item.fileName || item.fileRef}"?`)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await api.del(`/api/workflow/document-attachments/${item.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove attachment");
    } finally {
      setDeletingId(null);
    }
  }

  if (!recordId) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
        Save this record first, then you can attach documents.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
        <Paperclip size={12} />
        Attachments
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          {items.length === 0 ? (
            <div className="py-2 text-xs text-gray-400">No documents uploaded yet.</div>
          ) : (
            <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-navy-900">{item.fileName || item.fileRef}</div>
                    <div className="truncate text-[11px] text-gray-400">
                      {[
                        item.documentType?.name,
                        item.expiryDate ? `Expires ${new Date(item.expiryDate).toLocaleDateString()}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(item)}
                    title="Download"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-brand-600"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    title="Remove"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 rounded-lg bg-gray-50 p-3">
            <select
              className="col-span-4 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm sm:col-span-1"
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
            >
              <option value="">Document type...</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="col-span-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm sm:col-span-1"
              placeholder="Issue date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            <input
              type="date"
              className="col-span-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm sm:col-span-1"
              placeholder="Expiry date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <input
              type="file"
              className="col-span-4 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm sm:col-span-1"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !documentTypeId || !file}
              className="col-span-4 flex items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <UploadCloud size={13} />
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
