module.exports = {
  apps: [
    {
      name: 'processo-audit-backend',
      script: 'server.js',
      cwd: './processo-audit-app/processo-audit-app',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'processo-audit-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './processo-audit-app/processo-audit-app/frontend',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'processo-audit-public-referral',
      script: 'npm',
      args: 'run dev',
      cwd: './processo-audit-app/processo-audit-app/public-referral',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
