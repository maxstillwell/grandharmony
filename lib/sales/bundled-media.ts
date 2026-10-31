import path from "node:path";
import registry from "../../assets/sales-media/golfview-unit02-v1/registry.json";
/** Exact owner-authorised source package, mirrored only for same-origin Portal previews. */
export const unit02SourcePackage = registry;
export function bundledSource(url: string) {
  return registry.manifest.assets.find((a) => a.url === url);
}
export function bundledPreview(v: {
  url: string;
  sha256: string;
  mime: string;
}) {
  const source = bundledSource(v.url);
  return source && source.sha256 === v.sha256 && source.mime === v.mime
    ? {
        filePath: path.join(
          process.cwd(),
          "assets/sales-media/golfview-unit02-v1",
          source.sourceFile,
        ),
        mime: source.mime,
        sha256: source.sha256,
      }
    : null;
}
export function sourceFloorEvidence(floorId: string) {
  const f = registry.sourceComparison.floors.find((f) => f.floorId === floorId);
  return JSON.stringify({
    format: registry.sourceComparison.format,
    engineSha256: registry.sourceComparison.engineSha256,
    testOnly: true,
    residenceKey: "700:2",
    sourceVersion: registry.sourceComparison.sourceVersion,
    candidateVersion: registry.sourceComparison.candidateVersion,
    ...f,
  });
}
