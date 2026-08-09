import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices, verifyUserRequest } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const subscriptionId = (fid: string) => createHash("sha256").update(fid).digest("hex").slice(0, 32);

export async function GET(request: Request) {
  const user = await verifyUserRequest(request);
  const services = getAdminServices();
  if (!user || !services) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await services.db.collection("users").doc(user.uid).collection("pushSubscriptions").limit(10).get();
  return Response.json({
    enabled: !snapshot.empty,
    devices: snapshot.size,
    pushConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL),
    schedulerConfigured: Boolean(process.env.CRON_SECRET),
  });
}

export async function POST(request: Request) {
  const user = await verifyUserRequest(request);
  const services = getAdminServices();
  if (!user || !services) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { fid?: unknown; label?: unknown } | null;
  const fid = typeof body?.fid === "string" ? body.fid.trim() : "";
  if (!fid || fid.length > 256) return Response.json({ error: "Invalid installation" }, { status: 400 });

  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : "This browser";
  await services.db
    .collection("users")
    .doc(user.uid)
    .collection("pushSubscriptions")
    .doc(subscriptionId(fid))
    .set({ fid, label, enabled: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return Response.json({ enabled: true });
}

export async function DELETE(request: Request) {
  const user = await verifyUserRequest(request);
  const services = getAdminServices();
  if (!user || !services) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { fid?: unknown; all?: unknown } | null;
  const fid = typeof body?.fid === "string" ? body.fid.trim() : "";
  const collection = services.db.collection("users").doc(user.uid).collection("pushSubscriptions");

  if (body?.all === true) {
    const snapshot = await collection.get();
    const batch = services.db.batch();
    snapshot.docs.forEach((entry) => batch.delete(entry.ref));
    if (!snapshot.empty) await batch.commit();
  } else if (fid) {
    await collection.doc(subscriptionId(fid)).delete();
  } else {
    return Response.json({ error: "Invalid installation" }, { status: 400 });
  }

  return Response.json({ enabled: false });
}
