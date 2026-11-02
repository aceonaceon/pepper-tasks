/** Build metadata is injected by tsup; unbundled development code stays explicit. */
export const BUILD_COMMIT = process.env.PEPPER_BUILD_COMMIT ?? "unknown";
export const BUILD_DIRTY = process.env.PEPPER_BUILD_DIRTY === "true";
export const BUILD_VERSION = BUILD_COMMIT + (BUILD_DIRTY ? "-dirty" : "");
