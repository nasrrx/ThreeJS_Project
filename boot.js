// boot.js
const menuOverlay = document.getElementById("menuOverlay");
const returnBtn   = document.getElementById("returnBtn");

const btnPlayground = document.getElementById("btnPlayground");
const btnFPS        = document.getElementById("btnFPS");
const btnWaves      = document.getElementById("btnWaves");

// mode is chosen by URL: ?mode=playground OR ?mode=fps OR ?mode=waves
function getMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode"); // null if none
}

function goToMenu() {
  // remove mode, reload for a clean reset (ensures total separation)
  const url = new URL(window.location.href);
  url.searchParams.delete("mode");
  window.location.href = url.toString();
}

function chooseMode(mode) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.location.href = url.toString(); // reload -> clean init
}

// Menu button handlers
btnPlayground?.addEventListener("click", () => chooseMode("playground"));
btnFPS?.addEventListener("click", () => chooseMode("fps"));
btnWaves?.addEventListener("click", () => chooseMode("waves"));

// Return button handler
returnBtn?.addEventListener("click", goToMenu);

const mode = getMode();

if (!mode) {
  // No mode -> show main menu only, load nothing else
  menuOverlay.style.display = "flex";
  returnBtn.style.display = "none";
} else {
  // Mode chosen -> hide menu and show return button
  menuOverlay.style.display = "none";
  returnBtn.style.display = "block";

  // Load ONLY the selected app entry
  if (mode === "fps") {
    await import("./fps.js");
  } else if (mode === "waves") {
    await import("./waves.js"); 
  } else {
    // default: playground / main app
    await import("./main.js");
  }
}
