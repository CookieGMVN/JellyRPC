let credsSet = false;

document.getElementById("config-form").addEventListener("submit", (e) => {
    document.getElementById("config-submit").innerHTML = `
    <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
    </div>`;
    const serverUrl = document.getElementById("server-url").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    e.preventDefault();

    window.electronAPI.setCreds(serverUrl, username, password);
});

window.electronAPI.onCredsSet(() => {
    document.getElementById("config-menu").hidden = true;
    document.getElementById("main").hidden = false;
    credsSet = true;
});

window.electronAPI.onCredsReset(() => {
    document.getElementById("config-menu").hidden = false;
    document.getElementById("main").hidden = true;
    document.getElementById("config-submit").innerHTML = "Save Config";
    credsSet = false;
});

window.electronAPI.onCredsError(() => {
    document.getElementById("config-menu").hidden = false;
    document.getElementById("main").hidden = true;
    document.getElementById("config-submit").innerHTML = "Save Config";
    document.getElementById("error-message").hidden = false;
    credsSet = false;
});

setInterval(() => {
    if (credsSet) {
        document.getElementById("config-menu").hidden = true;
        document.getElementById("main").hidden = false;
    } else {
        document.getElementById("config-menu").hidden = false;
        document.getElementById("main").hidden = true;
    }
}, 200);