export function parseHomepageImageList(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => String(entry || "")
    .replace(/,\s*(?=https?:\/\/)/gi, "\n")
    .split(/\r?\n/)
    .map((url) => url.trim().replace(/,\s*$/, ""))
    .filter(Boolean));
}
