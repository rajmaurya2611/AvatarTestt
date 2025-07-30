
// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

// vite.config.js
// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     // don’t pre-bundle TalkingHead — leave its dynamic imports alone
//     exclude: ['@met4citizen/talkinghead']
//   }
// })


// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path  from "path";

export default defineConfig({
  plugins: [
    // ↓ this enables the automatic JSX runtime so you don't need
    //    `import React` in every .jsx/.tsx file
    react(),
  ],

  resolve: {
    alias: {
      // your existing talkinghead alias
      talkinghead: path.resolve(
        __dirname,
        "node_modules/@met4citizen/talkinghead/modules/talkinghead.mjs"
      ),
    },
  },

  optimizeDeps: {
    // skip pre‐bundling talkinghead so you don't get path‐weirdness
    exclude: ["@met4citizen/talkinghead"],
  },
});
