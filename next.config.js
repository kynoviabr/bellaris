/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.33"],
  // Fotos de celular passam de 1 MB. O limite do envio precisa acompanhar a validação de 5 MB das fotos.
  serverActions: { bodySizeLimit: "6mb" },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qcltxqnocckbkabcuoqr.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: 'qcltxqnocckbkabcuoqr.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'pnvhqvspziujrpagsclx.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: 'pnvhqvspziujrpagsclx.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'sibfrwzhsvkhtshakoaf.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: 'sibfrwzhsvkhtshakoaf.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};
module.exports = nextConfig;
