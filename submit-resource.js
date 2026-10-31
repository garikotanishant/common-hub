document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const form = document.getElementById("resource-suggestion");
  if (!form || !window.COMMON) return;
  const { storage, toast } = window.COMMON;
  const success = document.getElementById("suggestion-success");
  let latest;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    Object.keys(data).forEach((key) => (data[key] = String(data[key]).trim()));
    if (data.name.length < 2 || data.description.length < 15) {
      toast("Add a resource name and a short description.");
      return;
    }
    if (!window.COMMON.categories.some((c) => c.name === data.category)) {
      toast("Choose a category for your resource.");
      return;
    }
    let source;
    try {
      source = new URL(data.sourceUrl);
      if (!["http:", "https:"].includes(source.protocol)) throw Error();
    } catch {
      toast("Use a public website beginning with https:// or http://.");
      document.getElementById("sourceUrl").focus();
      return;
    }
    latest = {
      ...data,
      id: `suwanee-custom-${Date.now()}`,
      sourceUrl: source.href,
      type: "Community resource",
      governance: "See official source",
      utility: data.description,
      features: "Community suggestion; details have not been independently checked.",
      audience: data.audience || "See the official source for eligibility.",
      requirements: "Contact the organization for current requirements.",
      address: data.address || "See official source for address or service area",
      phone: data.phone || "Not provided",
      hours: data.hours || "Check with the organization",
      operational: [data.address, data.phone, data.hours].filter(Boolean).join(" · "),
      lat: null,
      lng: null,
      cluster: null,
      gradeLevel: null,
      locationPrecision: "Community suggestion; not mapped",
      verificationStatus: "needs-review",
      verificationNotes:
        "Visitor-suggested information saved in this browser; it has not been independently reviewed.",
      sourceType: "Community suggestion",
      tags: [data.name, data.category],
    };
    const entries = storage.read("common.customResources.v1");
    if (!storage.write("common.customResources.v1", [...entries, latest])) {
      toast("Your browser couldn’t save this suggestion. Check your storage settings.");
      return;
    }
    form.hidden = true;
    success.hidden = false;
    document.getElementById("suggestion-message").textContent =
      `“${latest.name}” is saved in this browser and appears in your directory on this device. You can email the details to the team for review.`;
    const body = `Resource suggestion for COMMON\n\nName: ${latest.name}\nCategory: ${latest.category}\nDescription: ${latest.description}\nSource: ${latest.sourceUrl}\nAddress: ${latest.address}\nPhone: ${latest.phone}\nHours: ${latest.hours}\nWho it is for: ${latest.audience}`;
    document.getElementById("email-suggestion").href =
      `mailto:vedantpanday0830@gmail.com,garikotanishant@gmail.com?subject=${encodeURIComponent("COMMON resource suggestion: " + latest.name)}&body=${encodeURIComponent(body)}`;
    success.focus();
  });
  document.getElementById("another-suggestion").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    form.reset();
    document.getElementById("name").focus();
  });
  document.getElementById("download-suggestion").addEventListener("click", () => {
    if (!latest) return;
    const blob = new Blob([JSON.stringify(latest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "common-resource-suggestion.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Your suggestion details are ready to download.");
  });
});
