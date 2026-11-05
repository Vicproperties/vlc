/** Social networks accepted in Website Settings (HTTPS links to these hosts only). */
export const SOCIAL_NETWORKS = [
  { key: "facebook", label: "Facebook", host: /(^|\.)facebook\.com$/ },
  { key: "instagram", label: "Instagram", host: /(^|\.)instagram\.com$/ },
  { key: "x", label: "X (Twitter)", host: /(^|\.)(x|twitter)\.com$/ },
  { key: "linkedin", label: "LinkedIn", host: /(^|\.)linkedin\.com$/ },
  { key: "youtube", label: "YouTube", host: /(^|\.)youtube\.com$/ },
  { key: "tiktok", label: "TikTok", host: /(^|\.)tiktok\.com$/ },
] as const;
