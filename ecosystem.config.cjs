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
      // Substitui o antigo 'processo-audit-public-referral' na porta 3005.
      // Código agora vive no repo separado rafael-calixto1/indique-e-ganhe-referral.
      name: 'indique-e-ganhe-referral',
      script: 'npm',
      args: 'run dev',
      cwd: '/root/indique-e-ganhe-referral',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
