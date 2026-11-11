
"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const checks = [
  "Display",
  "Touch",
  "Front Camera",
  "Rear Camera",
  "Speaker",
  "Microphone",
  "Earpiece",
  "Wi-Fi",
  "Bluetooth",
  "Charging Port",
  "Battery",
  "Fingerprint / Face ID",
  "Buttons",
  "Body / Frame",
];

const deviceConditions = [
  { value: "WORKING", label: "Working" },
  { value: "DEAD", label: "Dead / Not Powering On" },
  { value: "PARTIALLY_WORKING", label: "Partially Working" },
  { value: "PHYSICALLY_DAMAGED", label: "Physically Damaged" },
  { value: "WATER_DAMAGED", label: "Water Damaged" },
  { value: "NOT_TESTED", label: "Not Tested" },
];

export default function NewRepair() {
  const router = useRouter();

  const [customers, setCustomers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerResults, setShowCustomerResults] = useState(false);

  const [form, setForm] = useState<any>({
    branchId: "",
    customerId: "",
    deviceType: "MOBILE",
    serviceType: "REPAIR",
    condition: "WORKING",
    issue: "",
    brand: "",
    model: "",
    imei: "",
    serialNumber: "",
    ram: "",
    storage: "",
    color: "",
    estimate: "",
    promisedDate: "",
    chargerReceived: false,
    bagReceived: false,
    passwordNote: "",
    accessories: "",
  });

  const [inspection, setInspection] = useState<Record<string, string>>({});

  // Load customers and branches
  useEffect(() => {
    async function loadData() {
      try {
        const [customerResponse, branchResponse] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/branches"),
        ]);

        if (!customerResponse.ok || !branchResponse.ok) {
          throw new Error("Unable to load customers or branches.");
        }

        const [customerData, branchData] = await Promise.all([
          customerResponse.json(),
          branchResponse.json(),
        ]);

        setCustomers(customerData.customers ?? []);
        setBranches(branchData.branches ?? []);

        const selectedBranch =
          localStorage.getItem("aamee_selected_branch") ?? "";

        setForm((previous: any) => ({
          ...previous,
          branchId:
            selectedBranch.replace("ALL", "") ||
            branchData.branches?.[0]?.id ||
            "",
        }));
      } catch (error) {
        console.error("Loading error:", error);
        alert("Unable to load initial data. Please refresh the page.");
      }
    }

    loadData();
  }, []);

  // Update form fields
  const set = (key: string, value: any) => {
    setForm((previous: any) => ({
      ...previous,
      [key]: value,
    }));
  };

  // Create new customer
  async function addCustomer() {
    const name = prompt("Customer name");

    if (!name?.trim()) return;

    const phone = prompt("Customer mobile number");

    if (!phone?.trim()) return;

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.message || "Unable to create customer.");
        return;
      }

      const newCustomer = data.customer;

      setCustomers((previous) =>
        [...previous, newCustomer].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      set("customerId", newCustomer.id);

      setCustomerSearch(
        `${newCustomer.name} · ${newCustomer.phone}`
      );

      setShowCustomerResults(false);
    } catch (error) {
      console.error("Customer creation error:", error);
      alert("Unable to create customer. Please try again.");
    }
  }

  // Create repair job card
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.customerId) {
      alert("Please select a customer.");
      return;
    }

    if (!form.branchId) {
      alert("Please select a branch.");
      return;
    }

    if (!form.issue.trim()) {
      alert("Please enter the customer complaint.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/repairs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          estimate: Number(form.estimate || 0),

          inspection: Object.entries(inspection).map(
            ([item, status]) => ({
              item,
              status,
            })
          ),

          accessories: form.accessories
            .split(",")
            .map((item: string) => item.trim())
            .filter(Boolean),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.message || "Unable to create repair.");
        return;
      }

      if (!data.repair?.id) {
        alert("Repair created, but the response did not contain a job ID.");
        return;
      }

      router.push(`/repairs/${data.repair.id}`);
    } catch (error) {
      console.error("Repair creation error:", error);
      alert("Something went wrong while creating the job card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-6xl space-y-4 pb-6"
    >
      {/* PAGE HEADER */}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Repair Centre
            </div>

            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              Create Job Card
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Capture customer details, device condition and repair
              requirements before handing the device to the technician.
            </p>
          </div>

          <div className="w-fit rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
            WhatsApp click-to-chat available
          </div>
        </div>
      </div>

      {/* 1. JOB AND CUSTOMER */}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-lg font-extrabold">
          1. Job & Customer
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Branch">
            <select
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
              className="input"
              required
            >
              <option value="">Select Branch</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Customer">
            <div className="relative">
              <input
                value={customerSearch}
                onFocus={() => setShowCustomerResults(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerResults(true);
                  set("customerId", "");
                }}
                placeholder="Search customer name or phone"
                className="input"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addCustomer}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                >
                  + Add Customer
                </button>

                {form.customerId && (
                  <button
                    type="button"
                    onClick={() => {
                      set("customerId", "");
                      setCustomerSearch("");
                    }}
                    className="rounded-lg border px-3 py-2 text-xs"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {showCustomerResults &&
                customerSearch.trim().length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white shadow-xl">
                    {customers
                      .filter((customer) =>
                        `${customer.name} ${customer.phone}`
                          .toLowerCase()
                          .includes(customerSearch.toLowerCase())
                      )
                      .slice(0, 12)
                      .map((customer) => (
                        <button
                          type="button"
                          key={customer.id}
                          onClick={() => {
                            set("customerId", customer.id);

                            setCustomerSearch(
                              `${customer.name} · ${customer.phone}`
                            );

                            setShowCustomerResults(false);
                          }}
                          className="block w-full border-b px-3 py-3 text-left text-sm hover:bg-blue-50"
                        >
                          <span className="font-semibold">
                            {customer.name}
                          </span>

                          <span className="ml-2 text-slate-500">
                            {customer.phone}
                          </span>
                        </button>
                      ))}

                    {!customers.some((customer) =>
                      `${customer.name} ${customer.phone}`
                        .toLowerCase()
                        .includes(customerSearch.toLowerCase())
                    ) && (
                      <div className="p-3 text-xs text-slate-500">
                        No matching customer. Use Add Customer.
                      </div>
                    )}
                  </div>
                )}
            </div>
          </Field>

          <Field label="Device Type">
            <select
              value={form.deviceType}
              onChange={(e) => set("deviceType", e.target.value)}
              className="input"
            >
              <option value="MOBILE">MOBILE</option>
              <option value="LAPTOP">LAPTOP</option>
              <option value="TABLET">TABLET</option>
              <option value="OTHER">OTHER</option>
            </select>
          </Field>

          <Field label="Service Type">
            <select
              value={form.serviceType}
              onChange={(e) => set("serviceType", e.target.value)}
              className="input"
            >
              <option value="REPAIR">REPAIR</option>
              <option value="SERVICE">SERVICE</option>
              <option value="UPGRADE">UPGRADE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="DIAGNOSIS">DIAGNOSIS</option>
              <option value="REWORK">REWORK</option>
            </select>
          </Field>
        </div>
      </section>

      {/* 2. DEVICE DETAILS */}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-lg font-extrabold">
          2. Device Details
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["brand", "Brand"],
            ["model", "Model"],
            ["imei", "IMEI"],
            ["serialNumber", "Serial Number"],
            ["ram", "RAM"],
            ["storage", "Storage"],
            ["color", "Color"],
            ["estimate", "Estimated Cost"],
            ["promisedDate", "Expected Delivery"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                required={key === "model"}
                type={key === "promisedDate" ? "date" : "text"}
                inputMode={key === "estimate" ? "decimal" : "text"}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="input"
              />
            </Field>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.chargerReceived}
              onChange={(e) =>
                set("chargerReceived", e.target.checked)
              }
            />
            Charger received
          </label>

          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.bagReceived}
              onChange={(e) =>
                set("bagReceived", e.target.checked)
              }
            />
            Bag / cover received
          </label>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Accessories received (comma separated)">
            <input
              value={form.accessories}
              onChange={(e) => set("accessories", e.target.value)}
              placeholder="Charger, USB cable, SIM card"
              className="input"
            />
          </Field>

          <Field label="Device password / pattern note">
            <input
              value={form.passwordNote}
              onChange={(e) => set("passwordNote", e.target.value)}
              placeholder="Only store if customer authorizes it"
              className="input"
            />
          </Field>
        </div>
      </section>

      {/* 3. CUSTOMER COMPLAINT */}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-lg font-extrabold">
          3. Customer Complaint
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          This appears on the Job Card and WhatsApp report.
        </p>

        <textarea
          required
          value={form.issue}
          onChange={(e) => set("issue", e.target.value)}
          className="mt-4 min-h-32 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Describe the customer's reported problem..."
        />
      </section>

      {/* 4. DEVICE PRE-CHECK */}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">
              4. Device Pre-Check
            </h2>

            <p className="text-xs text-slate-500">
              Record the device condition before repair.
            </p>
          </div>

          <CheckCircle2
            className="text-emerald-600"
            size={22}
          />
        </div>

        {/* Device condition */}

        <div className="mt-4 max-w-md">
          <Field label="Device Condition">
            <select
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
              className="input"
            >
              {deviceConditions.map((condition) => (
                <option
                  key={condition.value}
                  value={condition.value}
                >
                  {condition.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Inspection checklist */}

        <h3 className="mb-3 mt-6 text-sm font-bold text-slate-700">
          Inspection Checklist
        </h3>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {checks.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
            >
              <span className="text-sm font-semibold">
                {item}
              </span>

              <select
                value={inspection[item] || "N/A"}
                onChange={(e) =>
                  setInspection((previous) => ({
                    ...previous,
                    [item]: e.target.value,
                  }))
                }
                className="rounded-lg border px-2 py-1.5 text-xs font-semibold"
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* SUBMIT SECTION */}

      <section className="sticky bottom-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            After creating the job card, use WhatsApp Customer to
            open WhatsApp with a pre-filled repair update.
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Creating..." : "Create Job Card"}
          </button>
        </div>
      </section>
    </form>
  );
}

// Reusable field component

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}
