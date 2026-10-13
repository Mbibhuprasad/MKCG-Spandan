// Notifications carry the website's path for the thing they are about
// (see content.linkFor in backend/src/services/content.service.js). This maps
// each of those paths to the matching screen in the app. Returns null when a
// notification has nowhere to go.
export function routeForLink(link) {
  const raw = String(link || "");
  if (!raw.startsWith("/")) return null;
  const [path, query = ""] = raw.split("?");
  const params = Object.fromEntries(
    query
      .split("&")
      .filter(Boolean)
      .map((pair) => pair.split("=").map(decodeURIComponent)),
  );
  const parts = path.split("/").filter(Boolean);
  const isId = (value) => /^[a-f\d]{24}$/i.test(value || "");

  if (parts[0] === "dashboard" && parts[1] === "profile")
    return "/profile/edit";
  if (parts[0] === "dashboard" && parts[1] === "notifications") return null;
  if (parts[0] === "dashboard") return "/profile";
  if (parts[0] === "events")
    return isId(parts[1]) ? `/events/${parts[1]}` : "/events";
  if (parts[0] === "community" && parts[1] === "posts" && isId(parts[2]))
    return `/posts/${parts[2]}`;
  if (parts[0] === "community") return "/community";
  if (parts[0] === "blogs")
    return parts[1] && /^[a-z0-9-]+$/.test(parts[1])
      ? `/blogs/${parts[1]}`
      : { pathname: "/library", params: { tab: "blogs" } };
  if (parts[0] === "memories")
    return isId(params.memory)
      ? `/memories/${params.memory}`
      : { pathname: "/library", params: { tab: "memories" } };
  if (parts[0] === "doctors")
    return isId(parts[1]) ? `/doctors/${parts[1]}` : "/doctors";
  if (parts[0] === "community-guidelines")
    return { pathname: "/guidelines", params: { which: "guidelines" } };
  if (parts[0] === "privacy")
    return { pathname: "/guidelines", params: { which: "privacy" } };
  if (parts[0] === "about") return "/about";
  return null;
}
