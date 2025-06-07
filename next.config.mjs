/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable logging to file in development
  webpack: (config, { dev }) => {
    if (dev) {
      // Enable console logging to file in development
      config.plugins = config.plugins || [];
      
      // Add a plugin to enable file logging when the app starts
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.done.tap('DevLoggingPlugin', () => {
            // Import and enable console logging after the app is ready
            import('./src/lib/utils/logger.js').then(({ enableConsoleLogging }) => {
              enableConsoleLogging();
            }).catch(console.error);
          });
        }
      });
    }
    return config;
  },
};

export default nextConfig;
