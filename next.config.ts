import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
      };
      
      config.module.rules.push({
        test: /\.node$/,
        use: 'null-loader',
      });
    }
    
    config.externals = config.externals || [];
    config.externals.push({
      'sharp': 'commonjs sharp',
      'onnxruntime-node': 'commonjs onnxruntime-node',
    });

    return config;
  },
};

export default nextConfig;
