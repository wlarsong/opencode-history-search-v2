import { register } from "node:module";
register(new URL("./sqlite-shim-loader.mjs", import.meta.url));
