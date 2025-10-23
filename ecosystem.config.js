/**
 * @Author: Your name
 * @Date:   2025-10-23 18:22:11
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-23 18:22:17
 */
module.exports = {
    apps: [{
      name: 'leilabot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }]
  };