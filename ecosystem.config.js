/**
 * PM2 Ecosystem Configuration for Hexaplast ERP
 * Production deployment on Windows 10 on-prem server
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart hexaplast-erp
 *   pm2 stop hexaplast-erp
 *   pm2 logs hexaplast-erp
 */

module.exports = {
  apps: [
    {
      name: "hexaplast-erp",
      script: "node",
      args: "node_modules/next/dist/bin/next start -p 3000 -H 0.0.0.0",
      cwd: "D:/hexaplast-sales-erp",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
