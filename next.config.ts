import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  webpack(config, { webpack }) {
    const vercelStore = path.resolve(process.cwd(), 'db/vercel-tracker-store.ts');
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^(?:@\/db\/tracker-store|.*[\\/]db[\\/]tracker-store(?:\.ts)?)$/,
        vercelStore,
      ),
    );
    return config;
  },
};

export default nextConfig;
