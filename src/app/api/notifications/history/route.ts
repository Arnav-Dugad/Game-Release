import { getAdminServices, verifyUserRequest } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await verifyUserRequest(request);
  const services = getAdminServices();
  if (!user || !services) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await services.db
    .collection("users")
    .doc(user.uid)
    .collection("notificationDeliveries")
    .orderBy("createdAt", "desc")
    .limit(40)
    .get();

  return Response.json({
    deliveries: snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        notificationId: data.notificationId ?? entry.id,
        kind: data.kind ?? "release-soon",
        title: data.title ?? "Notification",
        body: data.body ?? "",
        href: data.href ?? "/notifications",
        gameName: data.gameName ?? "Game",
        image: data.image ?? null,
        imageFallback: data.imageFallback ?? null,
        createdAt: data.createdAt?.toMillis?.() ?? 0,
        channels: data.channels ?? {},
        status: data.status ?? "unknown",
      };
    }),
  });
}
