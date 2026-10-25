import { useState } from "react";
import { Truck, Cpu, X, ShieldAlert, Check } from "lucide-react";

export interface SupplierRecordItem {
  id: string;
  name: string;
  category: string;
  spocName: string;
  spocEmail: string;
  spocPhone: string;
  status: "Draft" | "Pending_Verification" | "Approved";
  createdAt: string;
}

export interface PartRecordItem {
  id: string;
  mpn: string;
  description: string;
  manufacturer: string;
  packageFootprint: string;
  category: string;
  status: "Draft" | "Engineering_Only" | "Released";
  createdAt: string;
}

/**
 * Inline Supplier Creation Modal (§14.12)
 * Restricted to Purchasing / Admin capability.
 * Produces a draft/pending verification supplier master without leaving parent form.
 */
export function InlineSupplierModal({
  onClose,
  onSupplierCreated,
}: {
  onClose: () => void;
  onSupplierCreated: (supplier: SupplierRecordItem) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Active & Passive Components");
  const [spocName, setSpocName] = useState("");
  const [spocEmail, setSpocEmail] = useState("");
  const [spocPhone, setSpocPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = [
    "Active & Passive Components",
    "Semiconductors & ICs",
    "Mechanical & Enclosures",
    "PCB Fabrication & Stencils",
    "Cables & Wire Harnesses",
    "Testing & Calibration Services",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Supplier Company Name is required.");
    if (!spocName.trim()) return setError("SPOC Contact Name is required.");

    setBusy(true);
    setError("");

    const newSupplier: SupplierRecordItem = {
      id: `sup-${Date.now()}`,
      name: name.trim(),
      category,
      spocName: spocName.trim(),
      spocEmail: spocEmail.trim(),
      spocPhone: spocPhone.trim(),
      status: "Pending_Verification",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    try {
      await onSupplierCreated(newSupplier);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register supplier.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Inline Supplier Creation</h3>
              <p className="text-xs text-muted-foreground">
                Master Plan §14.12 · Adds to Supplier Master without clearing parent form
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-destructive font-medium" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="block font-medium text-foreground">
              Supplier / Distributor Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Mouser Electronics, Digi-Key, Arrow"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-medium text-foreground">Commodity / Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground">
                SPOC Contact Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={spocName}
                onChange={(e) => setSpocName(e.target.value)}
                placeholder="e.g. Rajiv Menon"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-foreground">Contact Phone</label>
              <input
                type="text"
                value={spocPhone}
                onChange={(e) => setSpocPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-foreground">Contact Email</label>
            <input
              type="email"
              value={spocEmail}
              onChange={(e) => setSpocEmail(e.target.value)}
              placeholder="sales@supplier.com"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
            />
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="size-3.5" />
              <span>Draft Master Safeguard (§14.12)</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Inline creation adds this vendor as <strong>Pending Verification</strong>.
              Downstream mass-production PO actions remain blocked until formal ASL qualification review.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-md border border-input px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {busy ? "Saving to Master…" : "Save Supplier & Select"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Inline Component / Part Creation Modal (§14.12)
 * Restricted to Engineering / Stores / Purchasing / Admin capability.
 * Produces a component master entry without leaving parent form.
 */
export function InlinePartModal({
  onClose,
  onPartCreated,
}: {
  onClose: () => void;
  onPartCreated: (part: PartRecordItem) => Promise<void> | void;
}) {
  const [mpn, setMpn] = useState("");
  const [description, setDescription] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [packageFootprint, setPackageFootprint] = useState("");
  const [category, setCategory] = useState("Microcontrollers & Processors");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = [
    "Microcontrollers & Processors",
    "Power Management & Regulators",
    "Wireless / RF Modules (LTE, GNSS, BLE)",
    "Passives (Resistors, Capacitors, Inductors)",
    "Connectors & Headers",
    "Discrete Semiconductors & Diodes",
    "Mechanical & Hardware Enclosures",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpn.trim()) return setError("Manufacturer Part Number (MPN) is required.");
    if (!description.trim()) return setError("Part Description is required.");

    setBusy(true);
    setError("");

    const newPart: PartRecordItem = {
      id: `prt-${Date.now()}`,
      mpn: mpn.trim().toUpperCase(),
      description: description.trim(),
      manufacturer: manufacturer.trim(), // Stored as entered, never synthesized as 'Generic'
      packageFootprint: packageFootprint.trim(), // Stored as entered, never synthesized as 'Surface Mount'
      category,
      status: "Engineering_Only",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    try {
      await onPartCreated(newPart);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register component.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Inline Component Master Creation</h3>
              <p className="text-xs text-muted-foreground">
                Master Plan §14.12 · Registers component without losing parent form draft
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-destructive font-medium" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="block font-medium text-foreground">
              Manufacturer Part Number (MPN) <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={mpn}
              onChange={(e) => {
                setMpn(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="e.g. STM32G0B1VCT6, ESP32-WROOM-32E"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs uppercase"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-medium text-foreground">
              Description <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError("");
              }}
              placeholder="e.g. ARM Cortex-M0+ MCU 512KB Flash 144KB RAM"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground">Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. STMicroelectronics"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-foreground">Package / Footprint</label>
              <input
                type="text"
                value={packageFootprint}
                onChange={(e) => setPackageFootprint(e.target.value)}
                placeholder="e.g. LQFP-100, 0603, QFN-32"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-steel/30 bg-secondary/30 p-2.5 text-muted-foreground">
            <p className="text-[11px] leading-relaxed">
              Saved to master with status <strong>Draft / Engineering Only</strong>.
              This allows prototyping and rapid engineering while protecting mass-production release gates.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-md border border-input px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {busy ? "Saving to Master…" : "Save Part & Select"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
