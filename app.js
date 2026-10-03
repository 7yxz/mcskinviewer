const canvas = document.getElementById("skin_container");
const nametagWrapper = document.getElementById("nametag-wrapper");
const nametagPlate = document.getElementById("nametag-plate");
const nametagInput = document.getElementById("nametag-input");
const nametagSizer = document.getElementById("nametag-sizer");

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

async function getNameMCCape(username) {
  try {
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://namemc.com/profile/${username}`)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const html = data.contents;

    const capeMatch = html.match(/href="\/cape\/([a-f0-9]+)"/i) || 
                      html.match(/data-cape="([a-f0-9]+)"/i);

    if (capeMatch && capeMatch[1]) {
      return `https://textures.minecraft.net/texture/${capeMatch[1]}`;
    }
  } catch (e) {}
  return null;
}

async function loadPlayer(username) {
  if (!username) return;

  nametagInput.classList.remove("error");
  nametagInput.style.opacity = "0.6";

  let skinUrl = null;
  let capeUrl = null;
  let isSlim = false;
  let success = false;

  const [nameMCCape, profileData] = await Promise.all([
    getNameMCCape(username),
    (async () => {
      try {
        const uuidRes = await fetch(`https://api.minetools.eu/uuid/${encodeURIComponent(username)}`);
        const uuidData = await uuidRes.json();
        if (uuidData.id) {
          const profileRes = await fetch(`https://api.minetools.eu/profile/${uuidData.id}`);
          const profile = await profileRes.json();
          if (profile.decoded && profile.decoded.textures) {
            return {
              skinUrl: profile.decoded.textures.SKIN ? profile.decoded.textures.SKIN.url : null,
              isSlim: profile.decoded.textures.SKIN && profile.decoded.textures.SKIN.metadata ? profile.decoded.textures.SKIN.metadata.model === "slim" : false,
              capeUrl: profile.decoded.textures.CAPE ? profile.decoded.textures.CAPE.url : null
            };
          }
        }
      } catch (e) {}
      return null;
    })()
  ]);

  if (profileData && profileData.skinUrl) {
    skinUrl = profileData.skinUrl;
    isSlim = profileData.isSlim;
    capeUrl = profileData.capeUrl;
    success = true;
  }

  if (nameMCCape) {
    capeUrl = nameMCCape;
  }

  if (!skinUrl) {
    try {
      const res = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`);
      const json = await res.json();
      if (json.success && json.data.player) {
        const props = json.data.player.properties;
        const texProp = props ? props.find(p => p.name === "textures") : null;
        if (texProp && texProp.value) {
          const decoded = JSON.parse(atob(texProp.value));
          skinUrl = decoded.textures?.SKIN?.url || null;
          isSlim = decoded.textures?.SKIN?.metadata?.model === "slim";
          if (!capeUrl) capeUrl = decoded.textures?.CAPE?.url || null;
          success = true;
        }
      }
    } catch (e) {}
  }

  if (success && skinUrl) {
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
    nametagInput.style.opacity = "1";
  } else {
    nametagInput.classList.add("error");
    nametagInput.style.opacity = "1";
    setTimeout(() => nametagInput.classList.remove("error"), 1500);
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
