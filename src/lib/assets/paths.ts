export const PUBLIC_ASSET_ROOT = "/assets" as const;

export function assetUrl(relativePath: string): string {
  const normalizedPath = relativePath.trim();

  if (
    normalizedPath.length === 0 ||
    normalizedPath.startsWith("/") ||
    normalizedPath.includes("\\") ||
    normalizedPath.includes("?") ||
    normalizedPath.includes("#") ||
    normalizedPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid relative asset path: ${relativePath}`);
  }

  const encodedPath = normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${PUBLIC_ASSET_ROOT}/${encodedPath}`;
}
