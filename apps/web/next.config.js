/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: `api.bodyParser` is the Pages Router config and is IGNORED by App
  // Router route handlers (which is what /api/billing/extract-rate uses).
  // Kept here as documentation of intent. App Router handlers have no built-in
  // body size limit, so the practical cap comes from the hosting platform
  // (e.g. Vercel = 4.5MB on Hobby) and from the proxied backend (now 20MB).
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default nextConfig;
