import axios from "axios";
import os from "os";

export async function getJellyfinToken(url, username, password, deviceId) {
    try {
        const data = await axios({
            method: "POST",
            url: `${url}/Users/AuthenticateByName`,
            headers: {
                "Content-Type": "application/json",
                Authorization: `MediaBrowser Client="JellyRPC", Version="1.0.0", Device=${os.hostname()}, DeviceId="${deviceId}"`,
            },
            data: {
                Username: username,
                Pw: password
            }
        });

        return data.data.AccessToken;
    } catch {
        return undefined;
    }
}

export async function getJellyfinSessions(url, token, deviceId) {
    try {
        const data = await axios({
            method: "GET",
            url: `${url}/Sessions`,
            headers: {
                "Content-Type": "application/json",
                Authorization: `MediaBrowser Client="JellyRPC", Version="1.0.0", Device=${os.hostname()}, DeviceId="${deviceId}", Token="${token}"`,
            }
        });

        return data.data;
    } catch {
        return undefined;
    }
}