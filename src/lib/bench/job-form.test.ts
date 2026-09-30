/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "fs";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CreateJobForm } from "@/app/bench/forms";
import { PHONE_INVALID_MESSAGE } from "@/lib/bench/phone";
import { fieldForBenchMessage, retainJobForm, type FormState, type JobDraft } from "@/lib/bench/form-state";
import { BRAND, contrast } from "@/lib/brand";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

vi.mock("@/app/bench/actions", () => ({
  createJobAction: vi.fn(async (_prev: unknown, formData: FormData) => {
    const { retainJobForm: retain } = await import("@/lib/bench/form-state");
    return retain(
      {
        customerName: String(formData.get("customer_name") ?? ""),
        deviceLabel: String(formData.get("device_label") ?? ""),
        reportedFault: String(formData.get("reported_fault") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      },
      { message: "Phone number looks wrong. Use 7 to 15 digits. Spaces, +, dashes and brackets are fine." },
      "kept",
    );
  }),
  addPhotoAction: vi.fn(),
}));

const DRAFT: JobDraft = {
  customerName: "Jordan <script>",
  deviceLabel: "iPhone 13",
  reportedFault: "No signal after a drop",
  phone: "+44 7708 268607",
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("new job form state", () => {
  it("maps a phone or field message onto that field and keeps the typed draft", () => {
    expect(fieldForBenchMessage(PHONE_INVALID_MESSAGE)).toBe("phone");
    expect(fieldForBenchMessage("Customer name is required.")).toBe("customerName");
    expect(fieldForBenchMessage("Customer name must be 120 characters or fewer.")).toBe("customerName");
    expect(fieldForBenchMessage("Device is required.")).toBe("deviceLabel");
    expect(fieldForBenchMessage("Device must be 160 characters or fewer.")).toBe("deviceLabel");
    expect(fieldForBenchMessage("Reported fault is required.")).toBe("reportedFault");
    expect(fieldForBenchMessage("Could not create the job.")).toBeNull();

    const phone = retainJobForm(DRAFT, { message: PHONE_INVALID_MESSAGE }, "kept");
    expect(phone).toEqual({
      error: null,
      reason: null,
      draft: DRAFT,
      field: "phone",
      fieldMessage: PHONE_INVALID_MESSAGE,
      formKey: "kept",
    });

    const blocked = retainJobForm(
      DRAFT,
      { message: "Could not create the job.", reason: "Reason: permission denied (42501)" },
      "kept-2",
    );
    expect(blocked.draft).toEqual(DRAFT);
    expect(blocked.field).toBeNull();
    expect(blocked.fieldMessage).toBeNull();
    expect(blocked.error).toBe("Could not create the job.");
    expect(blocked.reason).toBe("Reason: permission denied (42501)");
  });

  it("renders the kept values and highlights the phone field", () => {
    const state: FormState = retainJobForm(DRAFT, { message: PHONE_INVALID_MESSAGE }, "kept");
    const html = renderToStaticMarkup(createElement(CreateJobForm, { initialState: state }));
    expect(html).toContain('value="Jordan &lt;script&gt;"');
    expect(html).toContain('value="iPhone 13"');
    expect(html).toContain("No signal after a drop");
    expect(html).toContain('value="+44 7708 268607"');
    expect(html).toContain('id="phone"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="phone-hint phone-error"');
    expect(html).toContain(`id="phone-error"`);
    expect(html).toContain(PHONE_INVALID_MESSAGE);
    expect(html).not.toContain("Reason:");
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);

    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.field input\[aria-invalid="true"\]/);
    expect(css).toContain("color: var(--danger-text)");
    expect(contrast(BRAND.danger, BRAND.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(BRAND.darkDanger, BRAND.darkSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every field when the error is not tied to one input", () => {
    const state: FormState = retainJobForm(
      DRAFT,
      { message: "Could not create the job.", reason: "Reason: permission denied (42501)" },
      "kept-2",
    );
    const html = renderToStaticMarkup(createElement(CreateJobForm, { initialState: state }));
    expect(html).toContain('value="+44 7708 268607"');
    expect(html).toContain('value="iPhone 13"');
    expect(html).toContain("No signal after a drop");
    expect(html).toContain("Could not create the job.");
    expect(html).toContain("Reason: permission denied (42501)");
    expect(html).not.toContain("aria-invalid");
  });

  it("focuses the first invalid field", async () => {
    const state: FormState = retainJobForm(DRAFT, { message: "Customer name is required." }, "name");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(createElement(CreateJobForm, { initialState: state }));
    });
    expect(document.activeElement).toBe(document.getElementById("customer_name"));
    expect(document.getElementById("customer_name")?.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("customer_name-error")?.textContent).toBe("Customer name is required.");
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("puts the submitted values back after the action returns a phone error", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(createElement(CreateJobForm));
    });
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    const set = (name: string, value: string) => {
      const field = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      expect(field, name).toBeTruthy();
      if (!field) return;
      field.value = value;
    };
    set("customer_name", DRAFT.customerName);
    set("device_label", DRAFT.deviceLabel);
    set("reported_fault", DRAFT.reportedFault);
    set("phone", DRAFT.phone);
    await act(async () => {
      form?.requestSubmit();
    });
    const phone = container.querySelector<HTMLInputElement>("#phone");
    expect(phone?.value).toBe(DRAFT.phone);
    expect(container.querySelector<HTMLInputElement>("#customer_name")?.value).toBe(DRAFT.customerName);
    expect(container.querySelector<HTMLInputElement>("#device_label")?.value).toBe(DRAFT.deviceLabel);
    expect(container.querySelector<HTMLTextAreaElement>("#reported_fault")?.value).toBe(DRAFT.reportedFault);
    expect(phone?.getAttribute("aria-invalid")).toBe("true");
    expect(phone?.getAttribute("aria-describedby")).toBe("phone-hint phone-error");
    expect(container.querySelector("#phone-error")?.textContent).toBe(PHONE_INVALID_MESSAGE);
    expect(document.activeElement).toBe(phone);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
