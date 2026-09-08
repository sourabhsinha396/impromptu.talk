/* How the built frontend runs in production. The backend is compose's
   job and is not in here.

   The script is Next's own binary rather than `pnpm start`, so pm2
   supervises the server itself: through the package manager it would
   watch a wrapper, and the memory it reports and the process it restarts
   would both be that wrapper rather than the thing serving requests.

   cwd is __dirname and never a path under a home directory, so this file
   describes the deploy and not the machine it happens to be on. It is
   also how `.env` is found: Next reads it from the working directory at
   startup, which is where BACKEND_ORIGIN comes from. NEXT_PUBLIC_ values
   are not read here at all - those are baked into the bundle by
   `pnpm build`, so changing one needs a build and not a restart. */
module.exports = {
  apps: [
    {
      name: "yapholic-frontend",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      // Named, because that file has no extension for pm2 to guess from.
      interpreter: "node",
      args: "start -p 3009",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      time: true,
      env: { NODE_ENV: "production" },
    },
  ],
};
