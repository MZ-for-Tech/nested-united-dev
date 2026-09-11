module.exports = {
  apps: [{
    name: 'browser-notifications',
    script: 'node_modules/ts-node/dist/bin.js',
    args: '--project scripts/tsconfig.json --transpile-only scripts/notification-worker.ts',
    cwd: 'C:\\inetpub\\wwwroot\\nested-united',
    instances: 1,
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 100,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      TZ: 'Asia/Riyadh',
      NOTIFICATION_POLL_INTERVAL_MS: '15000',
      NOTIFICATION_HTTP_TIMEOUT_MS: '20000',
    },
  }],
};
