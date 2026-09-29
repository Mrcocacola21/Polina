import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const resolver = read("src/components/scenes/SceneRenderer.tsx");
const phase6 = read("src/lib/cinematic/phase6.ts");
const phase7 = read("src/lib/cinematic/phase7.ts");
const phase8 = read("src/lib/cinematic/phase8.ts");
const phase9 = read("src/lib/cinematic/phase9.ts");
const phase10 = read("src/lib/cinematic/phase10.ts");
const phase11 = read("src/lib/cinematic/phase11.ts");
const preloader = read("src/components/scenes/PreloaderScene.tsx");
const prologue = read("src/components/scenes/PrologueScene.tsx");
const s01 = read("src/components/scenes/Soul01Scene.tsx");
const s02 = read("src/components/scenes/Soul02Scene.tsx");
const s03 = read("src/components/scenes/Soul03Scene.tsx");
const s04 = read("src/components/scenes/Soul04Scene.tsx");
const s05 = read("src/components/scenes/Soul05Scene.tsx");
const s06 = read("src/components/scenes/Soul06Scene.tsx");
const s07 = read("src/components/scenes/Soul07Scene.tsx");
const s08 = read("src/components/scenes/Soul08Scene.tsx");
const s09 = read("src/components/scenes/Soul09Scene.tsx");
const s10 = read("src/components/scenes/Soul10Scene.tsx");
const preFinal = read("src/components/scenes/PreFinalScene.tsx");
const soulsRelease = read("src/components/scenes/SoulsReleaseScene.tsx");
const requiem = read("src/components/scenes/RequiemScene.tsx");
const silence = read("src/components/scenes/SilenceBoundaryScene.tsx");
const final = read("src/components/scenes/FinalScene.tsx");
const audioEngine = read("src/lib/audio/AudioEngine.ts");
const soulTypes = read("src/lib/souls/types.ts");
const soulClaims = read("src/lib/souls/claim-config.ts");
const visualManifest = JSON.parse(read("public/assets/manifest.json"));
const audioManifest = JSON.parse(read("public/assets/audio-manifest.json"));

const errors = [];
const requireText = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label} is missing: ${value}`);
};

for (const [id, component] of [
  ["PRELOADER", "PreloaderScene"],
  ["PROLOGUE", "PrologueScene"],
  ["S01", "Soul01Scene"],
  ["S02", "Soul02Scene"],
  ["S03", "Soul03Scene"],
  ["S04", "Soul04Scene"],
  ["S05", "Soul05Scene"],
  ["S06", "Soul06Scene"],
  ["S07", "Soul07Scene"],
  ["S08", "Soul08Scene"],
  ["S09", "Soul09Scene"],
  ["S10", "Soul10Scene"],
  ["PRE_FINAL", "PreFinalScene"],
  ["SOULS_RELEASE", "SoulsReleaseScene"],
  ["REQUIEM", "RequiemScene"],
  ["SILENCE", "SilenceBoundaryScene"],
  ["FINAL", "FinalScene"],
]) requireText(resolver, `${id}: ${component}`, `${id} production resolver`);

for (const [source, value, label] of [
  [phase6, "S01_COPY", "S01 copy configuration"],
  [phase6, "S02_COPY", "S02 copy configuration"],
  [phase7, "Я бы хотел разделять с тобой каждый момент этой жизни, они меня делают счастливыми", "S03 mandatory phrase"],
  [phase7, "Я слишком быстро соскучиваюсь по тебе", "S04 mandatory phrase"],
  [phase7, "Когда я просыпаюсь и вижу доброе утро от тебя, мое утро становится по-истинну добрым", "S05 mandatory phrase"],
  [phase7, 'soulId: "SOUL_03"', "S03 Soul mapping"],
  [phase7, 'source: "POINTS"', "S03 POINTS source"],
  [soulClaims, 'SOUL_03: define("B")', "S03 voice B"],
  [phase7, 'soulId: "SOUL_04"', "S04 Soul mapping"],
  [phase7, 'variant: "SILENT"', "S04 silent variant"],
  [phase7, 'soulId: "SOUL_05"', "S05 Soul mapping"],
  [soulTypes, 'type: "POINTS"', "POINTS collection adapter"],
  [audioEngine, "applyMusicTone", "transient music tone stage"],
  [s04, "release(1.6)", "S04 music tone restoration"],
  [s05, "resetMusicTone", "S05 neutral music tone restoration"],
  [phase8, "Каждый раз когда я выбиваю из тебя реакцию ❤️ или вижу его в сообщениях мне на душе становится так приятно", "S06 mandatory phrase"],
  [phase8, "Ты мне нравишься с головы до ног полностью и тебя я буду рейтить выше всех ВСЕГДА!!! (люблю твою попку, хехе❤️)", "S07 mandatory phrase"],
  [phase8, 'soulId: "SOUL_06"', "S06 Soul mapping"],
  [soulClaims, 'SOUL_06: define("C")', "S06 voice C"],
  [phase8, 'soulId: "SOUL_07"', "S07 Soul mapping"],
  [soulClaims, 'SOUL_07: define("NONE")', "S07 no voice"],
  [phase8, 'PHASE8_MUSIC_STATE = "MEMORIES"', "Phase 8 music continuity"],
  [phase9, "Королеву не убить, Я умру за королеву", "S08 mandatory phrase"],
  [phase9, 'soulId: "SOUL_08"', "S08 Soul mapping"],
  [phase9, 'source: "POINT"', "S08 POINT source"],
  [phase9, 'variant: "NORMAL"', "S08 normal variant"],
  [phase9, 'visualState: "ACTIVE"', "S08 active visual state"],
  [phase9, 'QUEEN_SOUL_VOICE = "A"', "S08 deterministic final voice"],
  [phase9, 'PHASE9_MUSIC_STATE = "MEMORIES"', "Phase 9 music continuity"],
  [phase10, "Когда ты чувствуешь себя плохо, я честно стараюсь каждый раз тебя хоть как-то пожалеть или подбодрить, и если бы это было возможно - забрать всю боль, что ты чувствуешь", "S09 mandatory phrase"],
  [phase10, 'soulId: "SOUL_09"', "S09 Soul mapping"],
  [phase10, 'source: "POINT"', "S09 POINT source"],
  [phase10, 'variant: "DEEP"', "S09 deep variant"],
  [phase10, 'visualState: "ACTIVE"', "S09 active visual state"],
  [soulClaims, 'SOUL_09: define("NONE", 58)', "S09 no voice"],
  [phase10, 'PHASE10_MUSIC_STATE = "VULNERABILITY"', "Phase 10 music transition"],
  [phase11, "Я тревожусь по маленьким поводам и могу надумать себе всякого, потому что люблю тебя и боюсь, что снова сделал что-то не так и потеряю тебя, твой интерес к себе или ты уйдешь к другому мальчику", "S10 mandatory phrase"],
  [phase11, "Я не самый красивый, умный или что-то в этом роде, но можна я..", "PRE_FINAL mandatory phrase"],
  [phase11, 'soulId: "SOUL_10"', "S10 Soul mapping"],
  [phase11, 'source: "POINT"', "S10 POINT source"],
  [phase11, 'variant: "DEEP"', "S10 deep variant"],
  [phase11, 'visualState: "ACTIVE"', "S10 active visual state"],
  [soulClaims, 'SOUL_10: define("NONE", 58)', "S10 no voice"],
  [phase11, 'PHASE11_MUSIC_STATE = "VULNERABILITY"', "Phase 11 music continuity"],
]) requireText(source, value, label);

for (const [source, ref, label] of [
  [preloader, "visual:brand.asset02", "BRAND-02"],
  [s01, "visual:sections.section01Asset01", "S01 environment"],
  [s01, "visual:screens.discord", "Discord screenshot"],
  [prologue, "audio:prologue.soulAwakening", "Prologue awakening audio"],
  [s02, "audio:scenes.s02.cue01", "S02 ordinary cue"],
  [s02, "audio:scenes.s02.cue02", "S02 special cue"],
  [s02, "audio:scenes.s02.cue03", "S02 open cue"],
  [s03, "visual:sections.section03Asset02", "S03 memory environment"],
  [s03, "visual:sections.section03Asset04", "S03 temporal streaks"],
  [s03, "visual:screens.together", "S03 together memory"],
  [s03, "visual:screens.minecraftTogether", "S03 Minecraft memory"],
  [s03, "visual:screens.livingTogether", "S03 conversation memory"],
  [s03, "audio:scenes.s03.cue01.a", "S03 reveal A"],
  [s03, "audio:scenes.s03.cue01.b", "S03 reveal B"],
  [s03, "audio:scenes.s03.cue01.c", "S03 reveal C"],
  [s03, "audio:scenes.s03.cue02", "S03 spatial pass"],
  [s03, "MEMORY_SPACE", "S03 ambience"],
  [s05, "visual:sections.section05Asset01", "S05 room"],
  [s05, "visual:sections.section05Asset02", "S05 light shaft"],
  [s05, "visual:screens.goodMorning", "S05 message"],
  [s05, "audio:scenes.s05.cue02", "S05 light reveal"],
  [s05, "audio:scenes.s05.cue03.a", "S05 piano A"],
  [s05, "audio:scenes.s05.cue03.b", "S05 piano B"],
  [s05, "audio:scenes.s05.cue03.c", "S05 piano C"],
  [s06, "visual:screens.heartReaction", "S06 heart reaction"],
  [s06, "audio:scenes.s06.cue01", "S06 heart audio"],
  [s07, "visual:sections.section07Asset01", "S07 portrait stage"],
  [s07, "visual:sections.section07Asset05", "S07 petals"],
  [s07, "visual:screens.polina", "S07 still"],
  [s07, "visual:screens.polinaCircle", "S07 video"],
  [s07, "audio:scenes.s07.cue01", "S07 portrait cue"],
  [s07, "audio:scenes.s07.cue02", "S07 infinity cue"],
  [s07, "audio:scenes.s07.cue03", "S07 aside cue"],
  [s07, "startRatingRise", "S07 procedural rating rise"],
  [s07, "visual:global.asset06", "S07 controlled displacement handoff"],
  [s08, "visual:sections.section08Asset01", "S08 Queen Sigil"],
  [s08, "visual:sections.section08Asset02", "S08 Throne Hall"],
  [s08, "visual:sections.section08Asset03", "S08 crown fragments"],
  [s08, "visual:screens.queenCantDie", "S08 personal relic"],
  [s08, "visual:global.asset06", "S08 displacement"],
  [s08, "setFog(\"CRIMSON\"", "S08 crimson fog controller"],
  [s08, "setLightLeak", "S08 light leak accent"],
  [phase9, "audio:scenes.s08.cue01", "S08 arrival cue"],
  [phase9, "audio:scenes.s08.cue02", "S08 sigil cue"],
  [phase9, "audio:scenes.s08.cue03", "S08 fragment cue"],
  [phase9, "audio:scenes.s08.cue04", "S08 declaration cue"],
  [s09, "visual:sections.section09Asset01", "S09 heavy environment"],
  [s09, "visual:sections.section09Asset02", "S09 rain video"],
  [s09, "visual:sections.section09Asset03", "S09 fractured light"],
  [s09, "visual:sections.section09Asset04", "S09 pain fragments"],
  [s09, "visual:screens.pain", "S09 personal pain fragment"],
  [s09, 'setFog("HEAVY"', "S09 GLOBAL-04C fog controller"],
  [phase10, "audio:scenes.s09.cue03", "S09 fractured-light cue"],
  [phase10, "audio:scenes.s09.cue04", "S09 progress cue"],
  [phase10, "audio:scenes.s09.cue05", "S09 completion cue"],
  [phase10, "PAIN_DRONE", "S09 drone ambience"],
  [phase10, "SPARSE_RAIN", "S09 rain ambience"],
  [s10, "visual:sections.section10Asset01", "S10 Anxiety Void"],
  [s10, "visual:sections.section10Asset02VariantA", "S10 jitter displacement"],
  [s10, "visual:sections.section10Asset02VariantB", "S10 liquid displacement"],
  [s10, "visual:sections.section10Asset02VariantC", "S10 fragmented-edge displacement"],
  [s10, "createLowRumble", "S10 scene-scoped rumble"],
  [s10, "applyMusicTone", "S10 transient music tone"],
  [preFinal, 'data-procedural-audio="none"', "PRE_FINAL procedural silence"],
  [soulsRelease, "releaseAllForRequiem", "SOULS_RELEASE collection transaction"],
  [requiem, "RequiemClock", "REQUIEM AudioContext cue clock"],
  [requiem, "enterAbsoluteBlack", "REQUIEM hard visual cut"],
  [silence, "enterCinematicSilence", "SILENCE cinematic audio gate"],
  [silence, "SILENCE_LINES", "SILENCE production copy"],
  [final, "FINAL_QUESTION", "Final exact question"],
  [final, "FINAL_AUDIO.musicState", "Final music semantics"],
]) requireText(source, ref, label);

if (/releaseAllForRequiem\s*\(/.test(s10) || /releaseAllForRequiem\s*\(/.test(preFinal)) {
  errors.push("Phase 11 must not release HUD Souls.");
}

const expectedAssets = [
  visualManifest.brand.asset02,
  visualManifest.sections.section01Asset01,
  visualManifest.screens.discord,
  audioManifest.prologue.soulAwakening,
  audioManifest.scenes.s01.cue01,
  audioManifest.scenes.s02.cue01,
  audioManifest.scenes.s02.cue02,
  audioManifest.scenes.s02.cue03,
  audioManifest.music.night,
  visualManifest.sections.section03Asset02,
  visualManifest.sections.section03Asset04,
  visualManifest.screens.together,
  visualManifest.screens.minecraftTogether,
  visualManifest.screens.livingTogether,
  visualManifest.global.asset04VariantB,
  audioManifest.scenes.s03.cue01.a,
  audioManifest.scenes.s03.cue01.b,
  audioManifest.scenes.s03.cue01.c,
  audioManifest.scenes.s03.cue02,
  audioManifest.scenes.s03.cue03,
  visualManifest.sections.section05Asset01,
  visualManifest.sections.section05Asset02,
  visualManifest.screens.goodMorning,
  visualManifest.global.asset09VariantD,
  audioManifest.scenes.s05.cue01,
  audioManifest.scenes.s05.cue02,
  audioManifest.scenes.s05.cue03.a,
  audioManifest.scenes.s05.cue03.b,
  audioManifest.scenes.s05.cue03.c,
  audioManifest.music.memories,
  visualManifest.screens.heartReaction,
  audioManifest.scenes.s06.cue01,
  visualManifest.sections.section07Asset01,
  visualManifest.sections.section07Asset05,
  visualManifest.screens.polina,
  visualManifest.screens.polinaCircle,
  visualManifest.screens.prosOfDatingMe,
  visualManifest.global.asset07,
  audioManifest.scenes.s07.cue01,
  audioManifest.scenes.s07.cue02,
  audioManifest.scenes.s07.cue03,
  visualManifest.sections.section08Asset01,
  visualManifest.sections.section08Asset02,
  visualManifest.sections.section08Asset03,
  visualManifest.screens.queenCantDie,
  visualManifest.global.asset04VariantB,
  visualManifest.global.asset06,
  visualManifest.global.asset07,
  audioManifest.scenes.s08.cue01,
  audioManifest.scenes.s08.cue02,
  audioManifest.scenes.s08.cue03,
  audioManifest.scenes.s08.cue04,
  visualManifest.sections.section09Asset01,
  visualManifest.sections.section09Asset02,
  visualManifest.sections.section09Asset03,
  visualManifest.sections.section09Asset04,
  visualManifest.screens.pain,
  visualManifest.global.asset04VariantC,
  audioManifest.scenes.s09.cue01,
  audioManifest.scenes.s09.cue02,
  audioManifest.scenes.s09.cue03,
  audioManifest.scenes.s09.cue04,
  audioManifest.scenes.s09.cue05,
  audioManifest.music.vulnerability,
  visualManifest.sections.section10Asset01,
  visualManifest.sections.section10Asset02VariantA,
  visualManifest.sections.section10Asset02VariantB,
  visualManifest.sections.section10Asset02VariantC,
];
for (const relativePath of expectedAssets) {
  if (!fs.existsSync(path.join(root, "public", "assets", relativePath))) {
    errors.push(`Manifest asset does not exist: ${relativePath}`);
  }
}

if (errors.length > 0) {
  console.error("Phase 11 scene validation failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Phase 13 scene validation passed: prior scenes preserved; SILENCE and terminal FINAL use production components.");
