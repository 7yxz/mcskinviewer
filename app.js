const canvas = document.getElementById("skin_container");
const nametagWrapper = document.getElementById("nametag-wrapper");
const nametagPlate = document.getElementById("nametag-plate");
const nametagInput = document.getElementById("nametag-input");
const nametagSizer = document.getElementById("nametag-sizer");
const toast = document.getElementById("advancement-toast");

const soundSources = [
  "advancment.mp3",
  "advancement.mp3",
  "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.19/assets/minecraft/sounds/ui/toast/challenge_complete.ogg"
];

let soundIdx = 0;
const challengeAudio = new Audio(soundSources[0]);
challengeAudio.volume = 0.7;
challengeAudio.preload = "auto";

challengeAudio.addEventListener("error", () => {
  soundIdx++;
  if (soundIdx < soundSources.length) {
    challengeAudio.src = soundSources[soundIdx];
    challengeAudio.load();
  }
});

let userInteracted = false;
function unlockAudioContext() {
  if (userInteracted) return;
  challengeAudio.play().then(() => {
    challengeAudio.pause();
    challengeAudio.currentTime = 0;
    userInteracted = true;
  }).catch(() => {});

  window.removeEventListener("pointerdown", unlockAudioContext);
  window.removeEventListener("keydown", unlockAudioContext);
}
window.addEventListener("pointerdown", unlockAudioContext);
window.addEventListener("keydown", unlockAudioContext);

function launchAdvancement() {
  toast.classList.add("show");
  challengeAudio.currentTime = 0;
  challengeAudio.play().catch(() => {
    const playOnClick = () => {
      challengeAudio.currentTime = 0;
      challengeAudio.play().catch(() => {});
      window.removeEventListener("pointerdown", playOnClick);
    };
    window.addEventListener("pointerdown", playOnClick);
  });
}

setTimeout(launchAdvancement, 10000);

toast.addEventListener("click", (e) => {
  e.preventDefault();
  challengeAudio.currentTime = 0;
  challengeAudio.play().catch(() => {});
  window.open("https://github.com/7yxz/mcskinviewer", "_blank");
});

const skinViewer = new skinview3d.SkinViewer({
  canvas: canvas,
  width: window.innerWidth,
  height: window.innerHeight
});

skinViewer.camera.position.set(0, 2, 54);
skinViewer.zoom = 0.9;
skinViewer.autoRotate = false;

const walkingAnimation = new skinview3d.WalkingAnimation();
walkingAnimation.speed = 0.8;
skinViewer.animation = walkingAnimation;

function syncNametagSize() {
  const val = nametagInput.value || " ";
  nametagSizer.textContent = val;
  nametagInput.style.width = `${nametagSizer.offsetWidth + 6}px`;
}
syncNametagSize();

const cache = new Map();

async function fetchFastProfile(username) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  const crafthead = fetch(`https://crafthead.net/profile/${encodeURIComponent(username)}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => {
      if (!data || !data.properties) throw new Error();
      const tex = data.properties.find(p => p.name === "textures");
      if (!tex) throw new Error();
      const dec = JSON.parse(atob(tex.value));
      return {
        skinUrl: dec.textures?.SKIN?.url || null,
        isSlim: dec.textures?.SKIN?.metadata?.model === "slim",
        capeUrl: dec.textures?.CAPE?.url || null
      };
    });

  const playerdb = fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => {
      if (!data.success || !data.data?.player) throw new Error();
      const tex = data.data.player.properties?.find(p => p.name === "textures");
      if (!tex) throw new Error();
      const dec = JSON.parse(atob(tex.value));
      return {
        skinUrl: dec.textures?.SKIN?.url || null,
        isSlim: dec.textures?.SKIN?.metadata?.model === "slim",
        capeUrl: dec.textures?.CAPE?.url || null
      };
    });

  try {
    const result = await Promise.any([crafthead, playerdb]);
    clearTimeout(timeout);
    return result;
  } catch (err) {
    clearTimeout(timeout);
    return {
      skinUrl: `https://crafthead.net/skin/${encodeURIComponent(username)}`,
      isSlim: false,
      capeUrl: null
    };
  }
}

async function loadPlayer(username) {
  if (!username) return;

  const cleanName = username.trim();
  nametagInput.classList.remove("error");
  nametagInput.style.opacity = "0.6";

  if (cache.has(cleanName.toLowerCase())) {
    const cached = cache.get(cleanName.toLowerCase());
    await applyPlayerData(cached.skinUrl, cached.isSlim, cached.capeUrl, cleanName);
    nametagInput.style.opacity = "1";
    return;
  }

  const profile = await fetchFastProfile(cleanName);

  if (profile && profile.skinUrl) {
    cache.set(cleanName.toLowerCase(), profile);
    await applyPlayerData(profile.skinUrl, profile.isSlim, profile.capeUrl, cleanName);
    nametagInput.style.opacity = "1";
  } else {
    nametagInput.classList.add("error");
    nametagInput.style.opacity = "1";
    setTimeout(() => nametagInput.classList.remove("error"), 1500);
  }
}

async function applyPlayerData(skinUrl, isSlim, capeUrl, username) {
  await skinViewer.loadSkin(skinUrl, isSlim ? "slim" : "default");

  if (capeUrl) {
    await skinViewer.loadCape(capeUrl);
    skinViewer.playerObject.backEquipment = "cape";
  } else {
    const ofCape = `https://optifine.net/capes/${encodeURIComponent(username)}.png`;
    const testImg = new Image();
    testImg.crossOrigin = "anonymous";
    testImg.src = ofCape;

    testImg.onload = async () => {
      await skinViewer.loadCape(ofCape);
      skinViewer.playerObject.backEquipment = "cape";
    };

    testImg.onerror = () => {
      skinViewer.loadCape(null);
    };
  }
}

loadPlayer(nametagInput.value.trim());

nametagInput.addEventListener("input", syncNametagSize);

nametagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    nametagInput.blur();
    loadPlayer(nametagInput.value.trim());
  }
});

nametagInput.addEventListener("blur", () => {
  loadPlayer(nametagInput.value.trim());
});

function updateNametag() {
  requestAnimationFrame(updateNametag);

  try {
    if (!skinViewer.playerObject || !skinViewer.playerObject.skin) return;

    skinViewer.playerObject.updateMatrixWorld(true);

    const head = skinViewer.playerObject.skin.head;
    const headPos = new THREE.Vector3();
    head.getWorldPosition(headPos);

    headPos.y += 9.0;

    const proj = headPos.clone().project(skinViewer.camera);
    const rect = canvas.getBoundingClientRect();
    const screenX = rect.left + ((proj.x + 1) / 2) * rect.width;
    const screenY = rect.top + ((-proj.y + 1) / 2) * rect.height;

    nametagWrapper.style.left = `${screenX}px`;
    nametagWrapper.style.top = `${screenY}px`;

    const cam = skinViewer.camera.position;
    const camAngle = Math.atan2(cam.x, cam.z);
    const playerAngle = skinViewer.playerObject.rotation.y;
    let diff = camAngle - playerAngle;

    let rotY = -(diff * (180 / Math.PI));
    rotY = ((rotY + 180) % 360);
    if (rotY < 0) rotY += 360;
    rotY -= 180;

    let displayRotY = rotY;
    if (displayRotY > 90) displayRotY -= 180;
    else if (displayRotY < -90) displayRotY += 180;

    const distXZ = Math.sqrt(cam.x * cam.x + cam.z * cam.z);
    const pitch = Math.atan2(cam.y - headPos.y, distXZ);
    const rotX = pitch * (180 / Math.PI);

    nametagPlate.style.transform = `perspective(500px) rotateX(${rotX * 0.5}deg) rotateY(${displayRotY.toFixed(1)}deg)`;
  } catch (err) {}
}

requestAnimationFrame(updateNametag);

window.addEventListener("resize", () => {
  skinViewer.width = window.innerWidth;
  skinViewer.height = window.innerHeight;
});
