/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'mammoth', 'bcryptjs'],
  },
};

export default nextConfig;
