
// TODO: move this file somewhere else
// not sure if this code sucks or not. the uri structure certainly does
const BASE_URI = "hvkclient://"

type Route =
    { path: "vpScreen"; pathParams?: {}; queryParams?: { course?: string } } |
    { path: "revealmark"; pathParams: { mark: string }; queryParams?: {} } |
    { path: "settings"; pathParams?: {}; queryParams?: {} }

export const CHANNEL_NAMES = {
    CHANNEL_GRADES: "grade_notifications",
    CHANNEL_VP_UPDATES: "vp_updates",
    CHANNEL_OTHER: "other_notifications",
}

export function buildDeepLink(route: Route) {
    let url = BASE_URI

    switch (route.path) {
        case "vpScreen": {
            url += "vpScreen";
            break;
        }
        case "revealmark": {
            url += `revealmark/${route.pathParams.mark}`;
            break;
        }
        case "settings": {
            url += "settings";
            break;
        }
    }

    if (route.queryParams) {
        url += buildQueryParams(route.queryParams)
    }
    return url;
}

function buildQueryParams(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString()
    return (query != "") ? `?${query}` : ""
}