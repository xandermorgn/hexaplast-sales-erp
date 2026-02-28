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
      name: 'hexaplast-erp',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/erp-error.log',
      out_file: './logs/erp-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
