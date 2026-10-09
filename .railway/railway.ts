// Railway infrastructure for SafaiRanchi. Preview with `railway config plan`, apply with `railway config apply`.
// Variables (ADMIN_PASSWORD, IP_HASH_SALT, SMTP/SMS keys, ...) are set in Railway, never here.
import { defineRailway, github, project, service, volume } from "railway/iac";

// Singapore: the closest Railway region to Ranchi.
const REGION = "sin";

export default defineRailway(() => {
  // SQLite database, photos and daily backups (see Dockerfile: DATABASE_PATH / UPLOAD_DIR under /data).
  const data = volume("teamgreen-volume", {
    region: REGION,
    sizeMB: 500,
    allowOnlineResize: true,
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
  });

  const app = service("teamgreen", {
    source: github("SohamJain2007/teamgreen", { branch: "main", checkSuites: false }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      healthcheckPath: "/api/health",
      healthcheckTimeout: 120,
      // Restart policy: Railway's default (restart on failure, up to 10 times).
      // SQLite has one writer: never run the old and new deployment side by side.
      overlapSeconds: 0,
    },
    // Exactly one instance (SQLite + a single volume).
    replicas: { [REGION]: 1 },
    volumeMounts: { "/data": data },
  });

  return project("amiable-comfort", {
    variables: { managed: false },
    resources: [app, data],
  });
});
